/* College Diaries — accounts and API bridge
   Two modes:
   1. server — when server.js is running, accounts and memories live in data/db.json.
   2. local  — when the backend is not reachable, the same screens work in the
      browser so the preview can still be used. Local mode is labelled in the UI.

   The API returns JSON only. User text is rendered with textContent elsewhere.
*/

var CD_TOKEN_KEY = "collegeDiariesToken";
var CD_SERVER_USER_KEY = "collegeDiariesServerUser";
var CD_LOCAL_USERS_KEY = "collegeDiariesUsers";
var CD_LOCAL_SESSION_KEY = "collegeDiariesLocalSession";
var CD_DEMO_EMAIL = "demo@collegediaries.app";
var CD_DEMO_PASSWORD = "campus123";

var cdAuthState = {
  mode: "local",
  user: null,
  ready: null,
  storageProblem: ""
};

function normaliseEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio || "",
    branch: user.branch || "",
    year: Number.isInteger(user.year) ? user.year : null,
    avatarUrl: user.avatarUrl || "",
    createdAt: user.createdAt || ""
  };
}

function readJsonStorage(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    throw new Error("This browser is blocking saved accounts. Allow site storage, or use a normal browser window.");
  }
}

function readLocalUsers() {
  var users = readJsonStorage(CD_LOCAL_USERS_KEY, []);
  return Array.isArray(users) ? users : [];
}

function saveLocalUsers(users) {
  writeJsonStorage(CD_LOCAL_USERS_KEY, users);
}

function getDemoCredentials() {
  return { email: CD_DEMO_EMAIL, password: CD_DEMO_PASSWORD };
}

async function hashLocalPassword(password) {
  var source = "college-diaries-preview|" + password;
  if (window.crypto && window.crypto.subtle && window.TextEncoder) {
    try {
      var bytes = new TextEncoder().encode(source);
      var digest = await window.crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest)).map(function (byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("");
    } catch (error) {
      /* Fall through to the lightweight hash for older browsers. */
    }
  }
  var hash = 2166136261;
  for (var i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return "preview-" + (hash >>> 0).toString(16);
}

async function ensureDemoUser() {
  var users = readLocalUsers();
  var exists = users.some(function (user) {
    return normaliseEmail(user.email) === CD_DEMO_EMAIL;
  });
  if (exists) {
    return users;
  }
  users.push({
    id: "preview-demo-student",
    name: "Demo Student",
    email: CD_DEMO_EMAIL,
    passwordHash: await hashLocalPassword(CD_DEMO_PASSWORD),
    createdAt: new Date().toISOString()
  });
  saveLocalUsers(users);
  return users;
}

async function detectBackend() {
  var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timer = window.setTimeout(function () {
    if (controller) {
      controller.abort();
    }
  }, 1600);

  try {
    var response = await fetch("/api/health", {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store",
      signal: controller ? controller.signal : undefined
    });
    var type = response.headers.get("content-type") || "";
    if (response.ok && type.indexOf("application/json") !== -1) {
      var data = await response.json();
      if (data && data.ok === true) {
        cdAuthState.mode = "server";
        return true;
      }
    }
  } catch (error) {
    /* The page is probably opened as a file or on a static preview host. */
  } finally {
    window.clearTimeout(timer);
  }

  cdAuthState.mode = "local";
  return false;
}

async function apiRequest(path, options) {
  var settings = options || {};
  var headers = { "Accept": "application/json" };
  if (settings.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  // Server mode uses an HttpOnly session cookie. Keep the old bearer token
  // as a short migration fallback for sessions created by the previous build.
  if (settings.auth !== false) {
    var legacyToken = readJsonStorage(CD_TOKEN_KEY, "");
    if (legacyToken) headers.Authorization = "Bearer " + legacyToken;
  }

  var response;
  try {
    response = await fetch(path, {
      method: settings.method || "GET",
      headers: headers,
      body: settings.body === undefined ? undefined : JSON.stringify(settings.body),
      credentials: "same-origin",
      cache: "no-store"
    });
  } catch (error) {
    var offline = new Error("Cannot reach the College Diaries server. Check that it is running on port 3000.");
    offline.status = 0;
    throw offline;
  }

  var data = {};
  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  if (!response.ok) {
    var requestError = new Error(data.error || "The request could not be completed.");
    requestError.status = response.status;
    throw requestError;
  }

  return data;
}

function updateMemorySource(memory) {
  return Object.assign({}, memory, { source: "server" });
}

function mapRemoteMemories(list) {
  return (Array.isArray(list) ? list : []).filter(isValidMemory).map(updateMemorySource);
}

async function restoreServerSession() {
  var cachedUser = readJsonStorage(CD_SERVER_USER_KEY, null);
  if (cachedUser && cachedUser.id) cdAuthState.user = publicUser(cachedUser);
  try {
    // Always ask the server: the session cookie is HttpOnly and invisible to JavaScript.
    var data = await apiRequest("/api/auth/me");
    cdAuthState.user = publicUser(data.user);
    writeJsonStorage(CD_SERVER_USER_KEY, cdAuthState.user);
  } catch (error) {
    if (error.status === 401) {
      localStorage.removeItem(CD_TOKEN_KEY);
      localStorage.removeItem(CD_SERVER_USER_KEY);
      cdAuthState.user = null;
    }
  }
}

function restoreLocalSession() {
  var session = readJsonStorage(CD_LOCAL_SESSION_KEY, null);
  if (!session || !session.userId) {
    cdAuthState.user = null;
    return;
  }
  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    localStorage.removeItem(CD_LOCAL_SESSION_KEY);
    cdAuthState.user = null;
    return;
  }
  var found = readLocalUsers().filter(function (user) {
    return user.id === session.userId;
  })[0];
  cdAuthState.user = found ? publicUser(found) : null;
}

function getUser() {
  return cdAuthState.user;
}

function getMode() {
  return cdAuthState.mode;
}

function getModeLabel() {
  return cdAuthState.mode === "server" ? "Backend connected" : "Browser preview";
}

async function signIn(credentials) {
  var values = credentials || {};
  var email = normaliseEmail(values.email);
  var password = String(values.password || "");

  if (!email || !password) {
    throw new Error("Enter both your email and password.");
  }

  if (cdAuthState.mode === "server") {
    var data = await apiRequest("/api/auth/login", {
      method: "POST",
      auth: false,
      body: { email: email, password: password }
    });
    // Session is stored in an HttpOnly cookie by the server, not JavaScript storage.
    localStorage.removeItem(CD_TOKEN_KEY);
    cdAuthState.user = publicUser(data.user);
    writeJsonStorage(CD_SERVER_USER_KEY, cdAuthState.user);
  } else {
    await ensureDemoUser();
    var users = readLocalUsers();
    var user = users.filter(function (item) {
      return normaliseEmail(item.email) === email;
    })[0];
    var hash = await hashLocalPassword(password);
    if (!user || user.passwordHash !== hash) {
      throw new Error("That email and password do not match an account on this device.");
    }
    writeJsonStorage(CD_LOCAL_SESSION_KEY, {
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
    });
    cdAuthState.user = publicUser(user);
  }

  updateAuthUI();
  document.dispatchEvent(new CustomEvent("cd:auth-changed", { detail: { user: getUser(), mode: getMode() } }));
  return getUser();
}

async function signUp(details) {
  var values = details || {};
  var name = String(values.name || "").replace(/\s+/g, " ").trim();
  var email = normaliseEmail(values.email);
  var password = String(values.password || "");

  if (name.length < 2) {
    throw new Error("Please enter your full name.");
  }
  if (name.length > 60) {
    throw new Error("Please keep your name under 60 characters.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (password.length < 8) {
    throw new Error("Choose a password with at least 8 characters.");
  }

  if (cdAuthState.mode === "server") {
    var data = await apiRequest("/api/auth/signup", {
      method: "POST",
      auth: false,
      body: { name: name, email: email, password: password }
    });
    // Session is stored in an HttpOnly cookie by the server, not JavaScript storage.
    localStorage.removeItem(CD_TOKEN_KEY);
    cdAuthState.user = publicUser(data.user);
    writeJsonStorage(CD_SERVER_USER_KEY, cdAuthState.user);
  } else {
    await ensureDemoUser();
    var users = readLocalUsers();
    var duplicate = users.some(function (item) {
      return normaliseEmail(item.email) === email;
    });
    if (duplicate) {
      throw new Error("An account with this email already exists on this device.");
    }
    var user = {
      id: "preview-" + Date.now().toString(36),
      name: name,
      email: email,
      passwordHash: await hashLocalPassword(password),
      createdAt: new Date().toISOString()
    };
    users.push(user);
    saveLocalUsers(users);
    writeJsonStorage(CD_LOCAL_SESSION_KEY, {
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
    });
    cdAuthState.user = publicUser(user);
  }

  updateAuthUI();
  document.dispatchEvent(new CustomEvent("cd:auth-changed", { detail: { user: getUser(), mode: getMode() } }));
  return getUser();
}

async function signOut() {
  if (cdAuthState.mode === "server") {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch (error) {
      /* Clear local UI state even if the server is already offline. */
    }
  }
  localStorage.removeItem(CD_TOKEN_KEY);
  localStorage.removeItem(CD_SERVER_USER_KEY);
  localStorage.removeItem(CD_LOCAL_SESSION_KEY);
  cdAuthState.user = null;
  updateAuthUI();
  document.dispatchEvent(new CustomEvent("cd:auth-changed", { detail: { user: null, mode: getMode() } }));
}

async function refreshMemories() {
  if (cdAuthState.mode !== "server") {
    return false;
  }
  try {
    var data = await apiRequest("/api/memories", { auth: false });
    replaceServerCache(mapRemoteMemories(data.memories));
    document.dispatchEvent(new CustomEvent("cd:memories-updated"));
    return true;
  } catch (error) {
    return false;
  }
}

async function fetchMemory(id) {
  if (cdAuthState.mode !== "server" || !id) {
    return null;
  }
  try {
    var data = await apiRequest("/api/memories/" + encodeURIComponent(id), { auth: false });
    if (data.memory && isValidMemory(data.memory)) {
      var memory = updateMemorySource(data.memory);
      cacheServerMemory(memory);
      return memory;
    }
  } catch (error) {
    return null;
  }
  return null;
}

async function createMemory(memory) {
  if (cdAuthState.mode !== "server") {
    throw new Error("The backend is not connected. The create page will save locally instead.");
  }
  var data = await apiRequest("/api/memories", { method: "POST", body: memory });
  var saved = updateMemorySource(data.memory);
  cacheServerMemory(saved);
  document.dispatchEvent(new CustomEvent("cd:memories-updated"));
  return saved;
}

async function fetchProfile() {
  if (cdAuthState.mode !== "server") {
    var local = getUser();
    if (!local) throw new Error("Please sign in to view your profile.");
    return local;
  }
  var data = await apiRequest("/api/profile");
  cdAuthState.user = publicUser(data.user);
  writeJsonStorage(CD_SERVER_USER_KEY, cdAuthState.user);
  updateAuthUI();
  return cdAuthState.user;
}

async function updateProfile(details) {
  var values = details || {};
  var name = String(values.name || "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 60) throw new Error("Name must be between 2 and 60 characters.");
  if (cdAuthState.mode !== "server") {
    var session = readJsonStorage(CD_LOCAL_SESSION_KEY, null);
    if (!session) throw new Error("Please sign in first.");
    var users = readLocalUsers();
    var index = users.findIndex(function (item) { return item.id === session.userId; });
    if (index < 0) throw new Error("Account not found on this device.");
    users[index].name = name;
    users[index].bio = String(values.bio || "").trim().slice(0, 240);
    users[index].branch = String(values.branch || "").trim().slice(0, 60);
    users[index].year = values.year ? Number(values.year) : null;
    users[index].avatarUrl = String(values.avatarUrl || "").trim();
    saveLocalUsers(users);
    cdAuthState.user = publicUser(users[index]);
  } else {
    var data = await apiRequest("/api/profile", {
      method: "PATCH",
      body: {
        name: name,
        bio: String(values.bio || "").trim(),
        branch: String(values.branch || "").trim(),
        year: values.year ? Number(values.year) : null,
        avatarUrl: String(values.avatarUrl || "").trim()
      }
    });
    cdAuthState.user = publicUser(data.user);
    writeJsonStorage(CD_SERVER_USER_KEY, cdAuthState.user);
  }
  updateAuthUI();
  document.dispatchEvent(new CustomEvent("cd:auth-changed", { detail: { user: getUser(), mode: getMode() } }));
  return getUser();
}

function logoutFromNav() {
  signOut().then(function () {
    window.location.href = "login.html?loggedout=1";
  });
}

function ensureNavAccount() {
  var nav = document.getElementById("site-nav");
  if (!nav) {
    return;
  }
  var link = document.getElementById("auth-nav-link");
  if (!link) {
    link = document.createElement("a");
    link.id = "auth-nav-link";
    link.href = "login.html";
    link.className = "nav-login";
    nav.appendChild(link);
  }

  var logout = document.getElementById("nav-logout");
  if (!logout) {
    logout = document.createElement("button");
    logout.id = "nav-logout";
    logout.type = "button";
    logout.className = "nav-logout";
    logout.textContent = "Log out";
    logout.hidden = true;
    logout.addEventListener("click", logoutFromNav);
    nav.appendChild(logout);
  }

  link.href = cdAuthState.user ? "profile.html" : "login.html";
  link.className = "nav-login";
  link.textContent = cdAuthState.user ? "My profile" : "Log in";
  if (document.body.getAttribute("data-page") === "login") {
    link.setAttribute("aria-current", "page");
  } else {
    link.removeAttribute("aria-current");
  }

  logout.hidden = !cdAuthState.user;
}

function applyCreateGate() {
  if (document.body.getAttribute("data-page") !== "create") {
    return;
  }
  var form = document.getElementById("memory-form");
  var gate = document.getElementById("auth-gate");
  var strip = document.getElementById("signed-in-strip");
  var checking = document.getElementById("auth-checking");

  if (checking) {
    checking.hidden = true;
  }

  if (cdAuthState.user) {
    if (form) {
      form.hidden = false;
    }
    if (gate) {
      gate.hidden = true;
    }
    if (strip) {
      strip.textContent = "Signed in as " + cdAuthState.user.name + " · " + getModeLabel();
      strip.hidden = false;
    }
    var author = document.getElementById("author");
    if (author && !author.value) {
      author.value = cdAuthState.user.name;
    }
  } else {
    if (form) {
      form.hidden = true;
    }
    if (gate) {
      gate.hidden = false;
    }
    if (strip) {
      strip.hidden = true;
    }
  }
}

function updateAuthUI() {
  ensureNavAccount();
  applyCreateGate();
  document.querySelectorAll("[data-auth-mode]").forEach(function (node) {
    node.textContent = getModeLabel();
  });
  document.querySelectorAll("[data-auth-user-name]").forEach(function (node) {
    node.textContent = cdAuthState.user ? cdAuthState.user.name : "";
  });
  document.querySelectorAll("[data-auth-user-email]").forEach(function (node) {
    node.textContent = cdAuthState.user ? cdAuthState.user.email : "";
  });
}

function waitForDom() {
  if (document.readyState !== "loading") {
    return Promise.resolve();
  }
  return new Promise(function (resolve) {
    document.addEventListener("DOMContentLoaded", resolve, { once: true });
  });
}

async function initialiseAuth() {
  await detectBackend();

  if (!storageAvailable()) {
    cdAuthState.storageProblem = "This browser is blocking site storage, so signing in is unavailable.";
  } else if (cdAuthState.mode === "server") {
    await restoreServerSession();
  } else {
    try {
      await ensureDemoUser();
      restoreLocalSession();
    } catch (error) {
      cdAuthState.storageProblem = error.message;
    }
  }

  await waitForDom();
  updateAuthUI();
  document.dispatchEvent(new CustomEvent("cd:auth-ready", {
    detail: { user: getUser(), mode: getMode(), storageProblem: cdAuthState.storageProblem }
  }));
  return { user: getUser(), mode: getMode(), storageProblem: cdAuthState.storageProblem };
}

window.CD_AUTH = {
  signIn: signIn,
  signUp: signUp,
  signOut: signOut,
  getUser: getUser,
  getMode: getMode,
  getModeLabel: getModeLabel,
  getDemoCredentials: getDemoCredentials,
  refreshMemories: refreshMemories,
  fetchMemory: fetchMemory,
  createMemory: createMemory,
  fetchProfile: fetchProfile,
  updateProfile: updateProfile,
  isSignedIn: function () { return Boolean(cdAuthState.user); },
  getStorageProblem: function () { return cdAuthState.storageProblem; },
  updateUI: updateAuthUI
};

window.CD_AUTH_READY = initialiseAuth().catch(function (error) {
  cdAuthState.user = null;
  cdAuthState.storageProblem = cdAuthState.storageProblem ||
    (error && error.message ? error.message : "Accounts could not start in this browser.");
  return waitForDom().then(function () {
    updateAuthUI();
    document.dispatchEvent(new CustomEvent("cd:auth-ready", {
      detail: {
        user: null,
        mode: cdAuthState.mode,
        storageProblem: cdAuthState.storageProblem
      }
    }));
    return {
      user: null,
      mode: cdAuthState.mode,
      storageProblem: cdAuthState.storageProblem
    };
  });
});

window.CD_AUTH.ready = window.CD_AUTH_READY;
