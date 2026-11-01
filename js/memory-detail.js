/* Memory detail page.
   The selected id arrives in the query string, for example:
   memory-detail.html?id=farewell
*/

function renderNotFound(mount) {
  mount.replaceChildren();
  document.title = "Memory not found — College Diaries";

  var panel = createElement("div", "not-found");
  panel.appendChild(createElement("p", "eyebrow", "Missing page"));
  panel.appendChild(createElement("h1", "", "Memory not found"));
  panel.appendChild(createElement(
    "p",
    "",
    "This page is not in the yearbook. The link may be incomplete, or the memory was cleared from this browser."
  ));

  var home = createElement("button", "btn btn-primary", "Return home");
  home.type = "button";
  home.addEventListener("click", function () {
    window.location.href = "index.html";
  });
  panel.appendChild(home);
  mount.appendChild(panel);
}

function renderMemory(mount, memory) {
  mount.replaceChildren();
  document.title = memory.title + " — College Diaries";

  var article = createElement("article", "memory-article");
  var back = createElement("a", "back-link", "← All memories");
  back.href = "index.html#feed";
  article.appendChild(back);

  var spread = createElement("div", "memory-spread");
  var frame = createElement("div", "detail-frame");
  var media = createElement("div", "detail-media");
  var safeImage = getSafeImage(memory.image);

  if (safeImage) {
    var image = document.createElement("img");
    image.src = safeImage;
    image.alt = "Cover photo for " + memory.title;
    image.addEventListener("error", function () {
      media.classList.add("is-fallback");
      image.remove();
    });
    media.appendChild(image);
  } else {
    media.classList.add("is-fallback");
  }

  var fallback = createElement("span", "media-fallback", memory.title.charAt(0).toUpperCase());
  fallback.setAttribute("aria-hidden", "true");
  media.appendChild(fallback);
  frame.appendChild(media);

  var caption = createElement("p", "photo-caption", memory.category + " · " + formatDate(memory.date));
  frame.appendChild(caption);

  var copy = createElement("div", "memory-copy");
  copy.appendChild(createElement("p", "eyebrow", memory.category));
  copy.appendChild(createElement("h1", "", memory.title));

  var byline = memory.author + " · " + formatDate(memory.date);
  if (memory.source === "user") {
    byline += " · Saved in this browser";
  } else if (memory.source === "server") {
    byline += " · Shared from a College Diaries account";
  }
  copy.appendChild(createElement("p", "memory-byline", byline));

  var rule = document.createElement("hr");
  rule.className = "gold-rule";
  copy.appendChild(rule);
  copy.appendChild(createElement("p", "memory-description", memory.description));

  var actions = createElement("div", "detail-actions");
  var home = createElement("a", "btn btn-primary", "Back to memories");
  home.href = "index.html#feed";
  var share = createElement("a", "btn btn-secondary", "Share a memory");
  share.href = "create-memory.html";
  actions.appendChild(home);
  actions.appendChild(share);
  copy.appendChild(actions);

  spread.appendChild(frame);
  spread.appendChild(copy);
  article.appendChild(spread);
  mount.appendChild(article);
}

async function initMemoryDetailPage() {
  var mount = document.getElementById("detail-mount");
  if (!mount) {
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var id = (params.get("id") || "").trim();

  if (!id) {
    renderNotFound(mount);
    return;
  }

  var memory = getMemoryById(id);

  if (!memory && window.CD_AUTH) {
    await CD_AUTH.ready;
    memory = await CD_AUTH.fetchMemory(id);
  }

  if (!memory) {
    memory = getMemoryById(id);
  }

  if (!memory) {
    renderNotFound(mount);
    return;
  }

  renderMemory(mount, memory);
}

document.addEventListener("DOMContentLoaded", initMemoryDetailPage);
