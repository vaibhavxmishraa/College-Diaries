(function () {
  "use strict";
  var loading = document.getElementById("profile-loading");
  var gate = document.getElementById("profile-gate");
  var content = document.getElementById("profile-content");
  var form = document.getElementById("profile-form");
  var message = document.getElementById("profile-message");
  var saveButton = document.getElementById("profile-save");

  function initials(name) {
    return String(name || "College Diaries").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) {
      return part.charAt(0).toUpperCase();
    }).join("") || "CD";
  }

  function showMessage(text, kind) {
    message.textContent = text;
    message.className = "auth-notice " + (kind === "error" ? "is-error" : "is-success");
    message.hidden = false;
  }

  function render(user) {
    document.getElementById("profile-display-name").textContent = user.name || "Student";
    document.getElementById("profile-display-email").textContent = user.email || "";
    document.getElementById("profile-display-bio").textContent = user.bio || "Add a line about yourself.";
    document.getElementById("profile-display-branch").textContent = user.branch || "Department not added";
    document.getElementById("profile-display-year").textContent = user.year ? (user.year + (user.year === 1 ? "st" : user.year === 2 ? "nd" : user.year === 3 ? "rd" : "th") + " year") : "Academic year not added";
    document.getElementById("profile-joined").textContent = user.createdAt ? "Joined " + new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "College Diaries member";
    var avatar = document.getElementById("profile-avatar");
    avatar.textContent = initials(user.name);
    avatar.style.backgroundImage = user.avatarUrl ? "url(\"" + user.avatarUrl.replace(/[\"\\]/g, "") + "\")" : "";
    avatar.classList.toggle("has-photo", Boolean(user.avatarUrl));
    form.elements.name.value = user.name || "";
    form.elements.bio.value = user.bio || "";
    form.elements.branch.value = user.branch || "";
    form.elements.year.value = user.year ? String(user.year) : "";
    form.elements.avatarUrl.value = user.avatarUrl || "";
  }

  async function start() {
    await CD_AUTH.ready;
    loading.hidden = true;
    if (!CD_AUTH.isSignedIn()) {
      gate.hidden = false;
      return;
    }
    try {
      var user = await CD_AUTH.fetchProfile();
      render(user);
      content.hidden = false;
    } catch (error) {
      if (error.status === 401) {
        gate.hidden = false;
      } else {
        content.hidden = false;
        render(CD_AUTH.getUser());
        showMessage(error.message || "Could not load profile details.", "error");
      }
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    message.hidden = true;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    try {
      var user = await CD_AUTH.updateProfile({
        name: form.elements.name.value,
        bio: form.elements.bio.value,
        branch: form.elements.branch.value,
        year: form.elements.year.value,
        avatarUrl: form.elements.avatarUrl.value
      });
      render(user);
      showMessage("Your profile has been saved.", "success");
    } catch (error) {
      showMessage(error.message || "Could not save your profile.", "error");
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save profile";
    }
  });

  document.getElementById("profile-avatar-url").addEventListener("input", function () {
    var url = form.elements.avatarUrl.value.trim();
    var avatar = document.getElementById("profile-avatar");
    avatar.style.backgroundImage = /^https?:\/\//i.test(url) ? "url(\"" + url.replace(/[\"\\]/g, "") + "\")" : "";
    avatar.classList.toggle("has-photo", /^https?:\/\//i.test(url));
    if (!url) avatar.textContent = initials(form.elements.name.value);
    else avatar.textContent = "";
  });
  document.getElementById("profile-name").addEventListener("input", function () {
    var avatar = document.getElementById("profile-avatar");
    if (!form.elements.avatarUrl.value.trim()) avatar.textContent = initials(form.elements.name.value);
  });

  start().catch(function () {
    loading.hidden = true;
    gate.hidden = false;
  });
})();
