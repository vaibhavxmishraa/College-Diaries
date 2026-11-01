/* Login page behaviour.
   The backend token never appears in this file. CD_AUTH handles the API.
*/

function getSafeNextPage(value) {
  var candidate = String(value || "").trim();
  if (!candidate) {
    return "";
  }
  if (/^index\.html(\?[A-Za-z0-9_=&%.-]*)?(#[\w-]*)?$/.test(candidate)) {
    return candidate;
  }
  if (/^create-memory\.html$/.test(candidate) || /^about\.html$/.test(candidate)) {
    return candidate;
  }
  if (/^memory-detail\.html\?id=[A-Za-z0-9-]+$/.test(candidate)) {
    return candidate;
  }
  return "";
}

function initAuthPage() {
  if (!window.CD_AUTH) {
    return;
  }

  var signinForm = document.getElementById("signin-form");
  var signupForm = document.getElementById("signup-form");
  var signinTab = document.getElementById("signin-tab");
  var signupTab = document.getElementById("signup-tab");
  var signinError = document.getElementById("signin-error");
  var signupError = document.getElementById("signup-error");
  var notice = document.getElementById("auth-notice");
  var checking = document.getElementById("auth-checking");
  var formsWrap = document.getElementById("auth-forms");
  var accountWrap = document.getElementById("auth-account");
  var modeLabel = document.getElementById("auth-mode-label");
  var modeCopyChecking = document.getElementById("mode-copy-checking");
  var modeCopyServer = document.getElementById("mode-copy-server");
  var modeCopyLocal = document.getElementById("mode-copy-local");
  var modeBox = document.getElementById("auth-mode");
  var demoButton = document.getElementById("demo-button");
  var params = new URLSearchParams(window.location.search);
  var nextPage = getSafeNextPage(params.get("next"));

  function showNotice(message, kind) {
    notice.textContent = message;
    notice.className = "auth-notice " + (kind === "error" ? "is-error" : "is-success");
    notice.hidden = false;
  }

  function hideError(element) {
    if (element) {
      element.textContent = "";
      element.hidden = true;
    }
  }

  function showFormError(element, message) {
    if (!element) {
      return;
    }
    element.textContent = message;
    element.hidden = false;
  }

  function selectTab(name) {
    var isSignin = name === "signin";
    signinForm.hidden = !isSignin;
    signupForm.hidden = isSignin;
    signinTab.classList.toggle("is-active", isSignin);
    signupTab.classList.toggle("is-active", !isSignin);
    signinTab.setAttribute("aria-selected", isSignin ? "true" : "false");
    signupTab.setAttribute("aria-selected", isSignin ? "false" : "true");
    hideError(signinError);
    hideError(signupError);
    var heading = document.getElementById(isSignin ? "signin-heading" : "signup-heading");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
  }

  function showAccount(user) {
    checking.hidden = true;
    formsWrap.hidden = true;
    accountWrap.hidden = false;
    document.getElementById("account-name").textContent = user.name;
    document.getElementById("account-email").textContent = user.email;
    var parts = user.name.split(/\s+/).filter(Boolean);
    var initials = parts.slice(0, 2).map(function (part) {
      return part.charAt(0).toUpperCase();
    }).join("") || "CD";
    document.getElementById("account-initials").textContent = initials;
    if (nextPage) {
      document.getElementById("continue-link").href = nextPage;
    }
  }

  function showForms() {
    checking.hidden = true;
    accountWrap.hidden = true;
    formsWrap.hidden = false;
    if (nextPage) {
      showNotice("Sign in to continue to the page you chose.", "success");
    }
  }

  function busy(button, isBusy, busyLabel) {
    if (!button) {
      return;
    }
    if (isBusy) {
      button.dataset.originalLabel = button.textContent;
      button.textContent = busyLabel;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalLabel || button.textContent;
      button.disabled = false;
    }
  }

  signinTab.addEventListener("click", function () {
    selectTab("signin");
  });
  signupTab.addEventListener("click", function () {
    selectTab("signup");
  });

  signinForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    hideError(signinError);
    if (!signinForm.checkValidity()) {
      signinForm.reportValidity();
      return;
    }
    var button = document.getElementById("signin-submit");
    busy(button, true, "Signing in…");
    try {
      await CD_AUTH.ready;
      await CD_AUTH.signIn({
        email: document.getElementById("signin-email").value,
        password: document.getElementById("signin-password").value
      });
      window.location.assign(nextPage || "index.html#feed");
    } catch (error) {
      showFormError(signinError, error.message || "Sign in could not be completed.");
      busy(button, false);
    }
  });

  signupForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    hideError(signupError);
    if (!signupForm.checkValidity()) {
      signupForm.reportValidity();
      return;
    }
    var signupPassword = document.getElementById("signup-password").value;
    var confirmPassword = document.getElementById("signup-confirm-password").value;
    if (signupPassword !== confirmPassword) {
      showFormError(signupError, "The passwords do not match.");
      document.getElementById("signup-confirm-password").focus();
      return;
    }
    var button = document.getElementById("signup-submit");
    busy(button, true, "Creating account…");
    try {
      await CD_AUTH.ready;
      await CD_AUTH.signUp({
        name: document.getElementById("signup-name").value,
        email: document.getElementById("signup-email").value,
        password: document.getElementById("signup-password").value
      });
      window.location.assign(nextPage || "index.html#feed");
    } catch (error) {
      showFormError(signupError, error.message || "The account could not be created.");
      busy(button, false);
    }
  });

  demoButton.addEventListener("click", function () {
    var credentials = CD_AUTH.getDemoCredentials();
    selectTab("signin");
    document.getElementById("signin-email").value = credentials.email;
    document.getElementById("signin-password").value = credentials.password;
    showNotice("Demo details filled in. Press Sign in to enter.", "success");
    signinForm.requestSubmit();
  });

  document.getElementById("account-logout").addEventListener("click", async function () {
    var button = document.getElementById("account-logout");
    button.disabled = true;
    button.textContent = "Logging out…";
    await CD_AUTH.signOut();
    window.location.assign("login.html?loggedout=1");
  });

  if (params.get("loggedout") === "1") {
    showNotice("You have been logged out. Your saved pages are still on the shelf.", "success");
  }

  CD_AUTH.ready.then(function (state) {
    var mode = CD_AUTH.getMode();
    modeBox.classList.toggle("is-server", mode === "server");
    modeBox.classList.toggle("is-local", mode !== "server");
    modeLabel.textContent = mode === "server" ? "Backend connected" : "Browser preview mode";
    modeCopyChecking.hidden = true;
    modeCopyServer.hidden = mode !== "server";
    modeCopyLocal.hidden = mode === "server";

    var credentials = CD_AUTH.getDemoCredentials();
    document.getElementById("demo-email").textContent = credentials.email;
    document.getElementById("demo-password").textContent = credentials.password;

    if (state.storageProblem) {
      showNotice(state.storageProblem, "error");
      document.getElementById("signin-submit").disabled = true;
      document.getElementById("signup-submit").disabled = true;
      document.getElementById("demo-button").disabled = true;
      checking.hidden = true;
      return;
    }

    if (state.user) {
      showAccount(state.user);
    } else {
      showForms();
      if (params.get("mode") === "signup") {
        selectTab("signup");
      }
    }
  }).catch(function () {
    modeLabel.textContent = "Browser preview mode";
    modeCopyChecking.hidden = true;
    modeCopyServer.hidden = true;
    modeCopyLocal.hidden = false;
    checking.hidden = true;
    showForms();
    showNotice("The account connection could not start. Refresh the page and try again.", "error");
  });
}

document.addEventListener("DOMContentLoaded", initAuthPage);
