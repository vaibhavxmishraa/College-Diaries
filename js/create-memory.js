/* Create-memory page.
   The page waits for the account check. Signed-in students save to the
   backend when it is connected, or to this browser in preview mode.
   User text is never inserted as HTML.
*/

function cleanLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanDescription(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function fieldValue(id) {
  var field = document.getElementById(id);
  return field ? field.value : "";
}

function readFormValues() {
  return {
    title: cleanLine(fieldValue("title")),
    author: cleanLine(fieldValue("author")),
    category: fieldValue("category"),
    description: cleanDescription(fieldValue("description")),
    image: fieldValue("image").trim()
  };
}

function validateMemoryForm(values) {
  var errors = {};

  if (!values.title) {
    errors.title = "Please give this memory a title.";
  } else if (values.title.length < 3) {
    errors.title = "Use at least 3 characters for the title.";
  } else if (values.title.length > FIELD_LIMITS.title) {
    errors.title = "Keep the title under " + FIELD_LIMITS.title + " characters.";
  }

  if (!values.author) {
    errors.author = "Please add the student name.";
  } else if (values.author.length < 2) {
    errors.author = "Please enter at least 2 characters for the name.";
  } else if (values.author.length > FIELD_LIMITS.author) {
    errors.author = "Keep the name under " + FIELD_LIMITS.author + " characters.";
  }

  if (!values.category || CATEGORIES.indexOf(values.category) === -1) {
    errors.category = "Choose a category from the list.";
  }

  if (!values.description) {
    errors.description = "Please write a short description.";
  } else if (values.description.length < 20) {
    errors.description = "Write a little more — at least 20 characters — so the page feels like a diary entry.";
  } else if (values.description.length > FIELD_LIMITS.description) {
    errors.description = "Keep the description under " + FIELD_LIMITS.description + " characters.";
  }

  if (values.image && !isSafeImageUrl(values.image)) {
    errors.image = "Use a full image link that starts with http:// or https://.";
  } else if (values.image.length > FIELD_LIMITS.image) {
    errors.image = "That image link is too long. Try a shorter direct URL.";
  }

  return errors;
}

function showFieldErrors(errors) {
  var fields = ["title", "author", "category", "description", "image"];
  var firstInvalid = null;

  fields.forEach(function (name) {
    var input = document.getElementById(name);
    var error = document.getElementById(name + "-error");
    var field = input ? input.closest(".field") : null;
    var message = errors[name] || "";

    if (error) {
      error.textContent = message;
      error.hidden = !message;
    }
    if (input) {
      if (message) {
        input.setAttribute("aria-invalid", "true");
        input.setAttribute("aria-describedby", name + "-error");
        if (!firstInvalid) {
          firstInvalid = input;
        }
      } else {
        input.removeAttribute("aria-invalid");
      }
    }
    if (field) {
      field.classList.toggle("has-error", Boolean(message));
    }
  });

  return firstInvalid;
}

function updateDescriptionCount() {
  var description = document.getElementById("description");
  var count = document.getElementById("description-count");
  if (!description || !count) {
    return;
  }
  count.textContent = description.value.length + " / " + FIELD_LIMITS.description;
}

function showCreateGate() {
  var form = document.getElementById("memory-form");
  var gate = document.getElementById("auth-gate");
  var strip = document.getElementById("signed-in-strip");
  var checking = document.getElementById("auth-checking");
  if (form) {
    form.hidden = true;
  }
  if (gate) {
    gate.hidden = false;
  }
  if (strip) {
    strip.hidden = true;
  }
  if (checking) {
    checking.hidden = true;
  }
}

async function initCreateMemoryPage() {
  var form = document.getElementById("memory-form");
  if (!form) {
    return;
  }

  var summary = document.getElementById("form-summary");
  var success = document.getElementById("form-success");
  var successTitle = document.getElementById("success-title");
  var successText = document.getElementById("success-text");
  var submitButton = document.getElementById("submit-button");
  var storageWarning = document.getElementById("storage-warning");
  var gate = document.getElementById("auth-gate");
  var strip = document.getElementById("signed-in-strip");
  var checking = document.getElementById("auth-checking");
  var description = document.getElementById("description");

  fillCategoryOptions(document.getElementById("category"), CATEGORIES, "Choose a category");
  updateDescriptionCount();

  if (description) {
    description.addEventListener("input", updateDescriptionCount);
  }

  if (!window.CD_AUTH) {
    showCreateGate();
    if (summary) {
      summary.textContent = "The account connection could not load. Refresh the page and try again.";
      summary.hidden = false;
    }
    return;
  }

  await CD_AUTH.ready;

  var user = CD_AUTH.getUser();
  var storageProblem = CD_AUTH.getStorageProblem();

  if (checking) {
    checking.hidden = true;
  }

  if (!user) {
    showCreateGate();
    return;
  }

  if (gate) {
    gate.hidden = true;
  }
  form.hidden = false;

  if (strip) {
    strip.textContent = "Signed in as " + user.name + " · " + CD_AUTH.getModeLabel();
    strip.hidden = false;
  }

  var authorField = document.getElementById("author");
  if (authorField && !authorField.value) {
    authorField.value = user.name;
  }

  if (!storageAvailable()) {
    if (storageWarning) {
      storageWarning.textContent = "This browser cannot save account sessions or pages. Allow site storage, or use the VS Code Live Server extension.";
      storageWarning.hidden = false;
    }
    submitButton.disabled = true;
    return;
  }

  if (storageProblem && storageWarning) {
    storageWarning.textContent = storageProblem;
    storageWarning.hidden = false;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (submitButton.disabled) {
      return;
    }

    var activeUser = CD_AUTH.getUser();
    if (!activeUser) {
      showCreateGate();
      return;
    }

    var values = readFormValues();
    var errors = validateMemoryForm(values);
    var firstInvalid = showFieldErrors(errors);
    var errorNames = Object.keys(errors);

    if (errorNames.length > 0) {
      summary.textContent = "Please fix the highlighted fields before saving this page.";
      summary.hidden = false;
      if (firstInvalid) {
        firstInvalid.focus();
      }
      return;
    }

    summary.hidden = true;
    submitButton.disabled = true;
    submitButton.textContent = "Saving page…";

    var isServer = CD_AUTH.getMode() === "server";
    var savedMemory;

    try {
      if (isServer) {
        savedMemory = await CD_AUTH.createMemory({
          title: values.title,
          author: values.author,
          category: values.category,
          description: values.description,
          image: values.image
        });
      } else {
        savedMemory = {
          id: createMemoryId(),
          title: values.title,
          author: values.author,
          category: values.category,
          date: todayIsoDate(),
          image: values.image,
          description: values.description,
          source: "user",
          ownerId: activeUser.id,
          createdAt: new Date().toISOString()
        };
        saveUserMemory(savedMemory);
      }
    } catch (error) {
      summary.textContent = error.status === 401
        ? "Your sign-in has expired. Log in again, and this page will still be waiting in the form."
        : (error.message || "The page could not be saved. Check the connection and try again.");
      summary.hidden = false;
      submitButton.disabled = false;
      submitButton.textContent = "Save memory";
      return;
    }

    form.hidden = true;
    successTitle.textContent = "Memory saved";
    successText.textContent = isServer
      ? "“" + savedMemory.title + "” is now on your signed-in shelf in the backend. Taking you back to the memories."
      : "“" + savedMemory.title + "” is saved in this browser only. Taking you back to the memories.";
    success.hidden = false;
    successTitle.focus();

    window.setTimeout(function () {
      window.location.href = "index.html?saved=1#feed";
    }, 1600);
  });
}

document.addEventListener("DOMContentLoaded", initCreateMemoryPage);
