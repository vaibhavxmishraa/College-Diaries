/* Shared navigation, plus the home-page shelf.
   Cards are built with createElement and textContent so titles and names
   typed by a student can never be treated as HTML.
*/

function initNavigation() {
  var page = document.body.getAttribute("data-page");
  var toggle = document.querySelector(".nav-toggle");
  var bar = document.querySelector(".nav-bar");
  var nav = document.getElementById("site-nav");
  var label = toggle ? toggle.querySelector(".sr-only") : null;

  if (nav && page) {
    var current = nav.querySelector('[data-nav="' + page + '"]');
    if (current) {
      current.setAttribute("aria-current", "page");
    }
  }

  if (!toggle || !bar) {
    return;
  }

  function setOpen(open) {
    bar.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (label) {
      label.textContent = open ? "Close menu" : "Open menu";
    }
  }

  toggle.addEventListener("click", function () {
    setOpen(!bar.classList.contains("is-open"));
  });

  if (nav) {
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        setOpen(false);
      }
    });
  }

  document.addEventListener("click", function (event) {
    if (!bar.contains(event.target)) {
      setOpen(false);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      setOpen(false);
    }
  });
}

function enableImageFallbacks(root) {
  var scope = root || document;
  var images = scope.querySelectorAll("img[data-fallback]");
  images.forEach(function (img) {
    img.addEventListener("error", function () {
      var frame = img.closest("[data-frame]");
      if (frame) {
        frame.classList.add("is-fallback");
      }
      img.remove();
    });
  });
}

function showToast(message) {
  var toast = document.getElementById("toast");
  if (!toast) {
    return;
  }
  toast.textContent = message;
  toast.hidden = false;
  window.setTimeout(function () {
    toast.hidden = true;
  }, 4200);
}

function attachCardImage(frame, memory) {
  var safeImage = getSafeImage(memory.image);
  if (!safeImage) {
    frame.classList.add("is-fallback");
    return;
  }
  var image = document.createElement("img");
  image.src = safeImage;
  image.alt = "";
  image.loading = "lazy";
  image.addEventListener("error", function () {
    frame.classList.add("is-fallback");
    image.remove();
  });
  frame.appendChild(image);
}

function createMemoryCard(memory, highlight) {
  var card = createElement("article", "memory-card");
  if (highlight) {
    card.classList.add("is-new");
  }

  var link = createElement("a", "memory-card-link");
  link.href = "memory-detail.html?id=" + encodeURIComponent(memory.id);

  var media = createElement("div", "memory-card-media");
  attachCardImage(media, memory);

  var fallback = createElement("span", "media-fallback", memory.title.charAt(0).toUpperCase());
  fallback.setAttribute("aria-hidden", "true");
  media.appendChild(fallback);

  if (memory.source) {
    var badge = createElement(
      "span",
      "yours-badge",
      memory.source === "server" ? "Account page" : "Saved here"
    );
    media.appendChild(badge);
  }

  var body = createElement("div", "memory-card-body");
  body.appendChild(createElement("p", "eyebrow", memory.category));
  body.appendChild(createElement("h3", "", memory.title));
  body.appendChild(createElement("p", "card-meta", memory.author + " · " + formatDate(memory.date)));

  link.appendChild(media);
  link.appendChild(body);
  card.appendChild(link);
  return card;
}

function initHomePage() {
  var grid = document.getElementById("memory-grid");
  if (!grid) {
    return;
  }

  var searchInput = document.getElementById("search-input");
  var categorySelect = document.getElementById("category-filter");
  var filterForm = document.getElementById("filters");
  var clearButton = document.getElementById("clear-filters");
  var resultCount = document.getElementById("result-count");
  var emptyState = document.getElementById("empty-state");
  var emptyTitle = document.getElementById("empty-title");
  var emptyText = document.getElementById("empty-text");
  var emptyClear = document.getElementById("empty-clear");
  var emptyCreate = document.getElementById("empty-create");
  var total = document.getElementById("memory-total");
  var storageNote = document.getElementById("storage-note");
  var highlightNew = false;

  fillCategoryOptions(categorySelect, getCategoryNames(), "All categories");

  var params = new URLSearchParams(window.location.search);
  var initialCategory = params.get("category") || "";
  if (initialCategory && getCategoryNames().indexOf(initialCategory) !== -1) {
    categorySelect.value = initialCategory;
  }

  if (params.get("saved") === "1") {
    highlightNew = true;
    showToast("Your memory is now part of the yearbook.");
    params.delete("saved");
    var query = params.toString();
    try {
      history.replaceState(null, "", "index.html" + (query ? "?" + query : "") + "#feed");
    } catch (error) {
      /* Opening the file directly can block history updates. The toast still confirms the save. */
    }
  }

  function updateTotal() {
    if (!total) {
      return;
    }
    var count = getAllMemories().length;
    total.textContent = count + (count === 1 ? " page in this yearbook" : " pages in this yearbook");
  }

  updateTotal();

  if (storageNote && !storageAvailable()) {
    storageNote.textContent = "This browser is not storing new memories, so only the sample pages can be shown. If you opened the file directly, try the VS Code Live Server extension.";
    storageNote.hidden = false;
  }

  function hasFilters() {
    return Boolean(searchInput.value.trim() || categorySelect.value);
  }

  function clearFilters() {
    searchInput.value = "";
    categorySelect.value = "";
    renderMemories();
    searchInput.focus();
  }

  function renderMemories() {
    var query = searchInput.value.trim().toLowerCase();
    var category = categorySelect.value;
    var memories = getAllMemories().filter(function (memory) {
      var haystack = [memory.title, memory.author, memory.category, memory.description].join(" ").toLowerCase();
      var matchesQuery = !query || haystack.indexOf(query) !== -1;
      var matchesCategory = !category || memory.category === category;
      return matchesQuery && matchesCategory;
    });

    var fragment = document.createDocumentFragment();
    memories.forEach(function (memory, index) {
      var highlight = highlightNew && index === 0 && Boolean(memory.source);
      fragment.appendChild(createMemoryCard(memory, highlight));
    });
    grid.replaceChildren(fragment);
    highlightNew = false;

    var noun = memories.length === 1 ? "memory" : "memories";
    resultCount.textContent = memories.length === 0
      ? "No memories found"
      : "Showing " + memories.length + " " + noun;

    var filtered = hasFilters();
    clearButton.hidden = !filtered;
    emptyState.hidden = memories.length !== 0;
    grid.hidden = memories.length === 0;

    if (memories.length === 0) {
      if (filtered) {
        emptyTitle.textContent = "No memories match";
        emptyText.textContent = "Try a different word, or look through all categories.";
        emptyClear.hidden = false;
        emptyCreate.hidden = true;
      } else {
        emptyTitle.textContent = "The shelf is empty";
        emptyText.textContent = "Be the first to add a page to this yearbook.";
        emptyClear.hidden = true;
        emptyCreate.hidden = false;
      }
    }
  }

  searchInput.addEventListener("input", renderMemories);
  searchInput.addEventListener("search", renderMemories);
  categorySelect.addEventListener("change", renderMemories);
  filterForm.addEventListener("submit", function (event) {
    event.preventDefault();
    renderMemories();
  });
  clearButton.addEventListener("click", clearFilters);
  emptyClear.addEventListener("click", clearFilters);

  renderMemories();

  if (window.CD_AUTH) {
    CD_AUTH.ready.then(function () {
      if (CD_AUTH.getMode() === "server") {
        CD_AUTH.refreshMemories();
      }
    });

    document.addEventListener("cd:memories-updated", function () {
      updateTotal();
      renderMemories();
    });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  initNavigation();
  enableImageFallbacks(document);
  initHomePage();
});
