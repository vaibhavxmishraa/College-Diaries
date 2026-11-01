/* College Diaries — a small zero-dependency backend
   Run:
     npm start
   Then open:
     http://localhost:3000

   Accounts, sessions and student memories are kept in data/db.json.
   Passwords are hashed with Node's scrypt. This is a learning-friendly MVP,
   not a production authentication service.
*/

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const SESSION_DAYS = 7;
const SESSION_COOKIE = "college_diaries_session";
const HOD_SESSION_COOKIE = "college_diaries_hod_session";
const DEMO_HOD_EMAIL = "hod.cse@collegediaries.app";
const DEMO_HOD_PASSWORD = "Hod@12345";
const DEMO_EMAIL = "demo@collegediaries.app";
const DEMO_PASSWORD = "campus123";

const CATEGORIES = [
  "Campus Life",
  "Festivals",
  "Farewell",
  "Classroom",
  "Friendship",
  "Sports"
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function emptyDatabase() {
  return { users: [], sessions: [], memories: [], hods: [], hodSessions: [], messageRequests: [], messages: [] };
}

function loadDatabase() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DB_FILE)) {
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      hods: Array.isArray(parsed.hods) ? parsed.hods : [],
      hodSessions: Array.isArray(parsed.hodSessions) ? parsed.hodSessions : [],
      messageRequests: Array.isArray(parsed.messageRequests) ? parsed.messageRequests : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : []
    };
  } catch (error) {
    console.error("Could not read data/db.json:", error.message);
    return null;
  }
}

function saveDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temporaryFile = DB_FILE + ".tmp";
  fs.writeFileSync(temporaryFile, JSON.stringify(database, null, 2), "utf8");
  fs.renameSync(temporaryFile, DB_FILE);
}

function hashPassword(password, salt) {
  const actualSalt = salt || crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, actualSalt, 64).toString("hex");
  return "scrypt$" + actualSalt + "$" + derived;
}

function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  try {
    const derived = crypto.scryptSync(password, parts[1], 64);
    const expected = Buffer.from(parts[2], "hex");
    return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
  } catch (error) {
    return false;
  }
}

function purgeExpiredSessions() {
  const now = Date.now();
  database.sessions = database.sessions.filter((session) => {
    return new Date(session.expiresAt).getTime() > now;
  });
}

let database = loadDatabase();
if (!database) {
  database = emptyDatabase();
  saveDatabase();
}
purgeExpiredSessions();

if (!database.hods.some((hod) => hod.email === DEMO_HOD_EMAIL)) {
  database.hods.push({ id: "hod-demo-cse", name: "Demo HOD", email: DEMO_HOD_EMAIL, department: "CSE", passwordHash: hashPassword(DEMO_HOD_PASSWORD), createdAt: new Date().toISOString() });
  saveDatabase();
}

if (!database.users.some((user) => user.email === DEMO_EMAIL)) {
  database.users.push({
    id: "user-demo",
    name: "Demo Student",
    email: DEMO_EMAIL,
    passwordHash: hashPassword(DEMO_PASSWORD),
    createdAt: new Date().toISOString()
  });
  saveDatabase();
  console.log("Demo account ready: " + DEMO_EMAIL + " / " + DEMO_PASSWORD);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio || "",
    branch: user.branch || "",
    year: Number.isInteger(user.year) ? user.year : null,
    avatarUrl: user.avatarUrl || "",
    createdAt: user.createdAt || "",
    messagingAccess: Boolean(user.messagingAccess),
    messagingStatus: user.messagingStatus || "not_requested"
  };
}

function readCookies(request) {
  const result = {};
  String(request.headers.cookie || "").split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index < 0) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { result[key] = decodeURIComponent(value); } catch (_) { result[key] = value; }
  });
  return result;
}

function setSessionCookie(request, response, token) {
  const secure = request.socket && request.socket.encrypted ? "; Secure" : "";
  response.setHeader("Set-Cookie", SESSION_COOKIE + "=" + encodeURIComponent(token) +
    "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + (SESSION_DAYS * 24 * 60 * 60) + secure);
}

function clearSessionCookie(request, response) {
  const secure = request.socket && request.socket.encrypted ? "; Secure" : "";
  response.setHeader("Set-Cookie", SESSION_COOKIE + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" + secure);
}

function publicMemory(memory) {
  return {
    id: memory.id,
    title: memory.title,
    author: memory.author,
    category: memory.category,
    date: memory.date,
    image: memory.image || "",
    description: memory.description,
    createdAt: memory.createdAt,
    source: "server"
  };
}

function normaliseEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanLine(value) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function cleanDescription(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

function validateImage(value) {
  const url = String(value || "").trim();
  if (!url) {
    return "";
  }
  if (url.length > 500) {
    throw new ApiError(400, "The photo URL is too long.");
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Protocol");
    }
    return parsed.toString();
  } catch (error) {
    throw new ApiError(400, "Use a full photo URL beginning with http:// or https://.");
  }
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  database.sessions.push({
    token,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  });
  purgeExpiredSessions();
  saveDatabase();
  return token;
}

function userFromRequest(request) {
  const header = request.headers.authorization || "";
  const cookieToken = readCookies(request)[SESSION_COOKIE] || "";
  // Bearer support is retained temporarily so sessions created by older builds still work.
  const token = cookieToken || (header.startsWith("Bearer ") ? header.slice(7).trim() : "");
  if (!token) return null;
  const session = database.sessions.find((item) => {
    return item.token === token && new Date(item.expiresAt).getTime() > Date.now();
  });
  if (!session) {
    return null;
  }
  return database.users.find((user) => user.id === session.userId) || null;
}

function normaliseDepartment(value) { return cleanLine(value).toLowerCase().replace(/\s+/g, " "); }
function hodFromRequest(request) {
  const token = readCookies(request)[HOD_SESSION_COOKIE] || "";
  const session = database.hodSessions.find((item) => item.token === token && new Date(item.expiresAt).getTime() > Date.now());
  return session ? database.hods.find((hod) => hod.id === session.hodId) || null : null;
}
function createHodSession(hod) {
  const token = crypto.randomBytes(32).toString("hex");
  database.hodSessions.push({ token, hodId: hod.id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString() });
  saveDatabase(); return token;
}
function setHodCookie(request, response, token) {
  const secure = request.socket && request.socket.encrypted ? "; Secure" : "";
  response.setHeader("Set-Cookie", HOD_SESSION_COOKIE + "=" + token + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" + (SESSION_DAYS * 24 * 60 * 60) + secure);
}
function clearHodCookie(request, response) {
  const secure = request.socket && request.socket.encrypted ? "; Secure" : "";
  response.setHeader("Set-Cookie", HOD_SESSION_COOKIE + "=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" + secure);
}
function publicHod(hod) { return { id: hod.id, name: hod.name, email: hod.email, department: hod.department }; }
function requireStudent(request) { const user = userFromRequest(request); if (!user) throw new ApiError(401, "Please sign in as a student."); return user; }
function requireApprovedStudent(request) {
  const user = requireStudent(request);
  if (!user.messagingAccess || user.messagingStatus !== "approved") throw new ApiError(403, "Messaging access needs HOD approval first.");
  if (!cleanLine(user.branch)) throw new ApiError(400, "Add your department in My Profile before requesting messaging access.");
  return user;
}
function sameDepartment(a, b) { return normaliseDepartment(a) !== "" && normaliseDepartment(a) === normaliseDepartment(b); }

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    function fail(error) {
      if (!settled) {
        settled = true;
        reject(error);
      }
    }

    request.on("data", (chunk) => {
      if (settled) {
        return;
      }
      size += chunk.length;
      if (size > 100 * 1024) {
        fail(new ApiError(413, "That request is too large."));
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      if (settled) {
        return;
      }
      if (!chunks.length) {
        settled = true;
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Not an object");
        }
        settled = true;
        resolve(parsed);
      } catch (error) {
        fail(new ApiError(400, "Send a valid JSON object."));
      }
    });

    request.on("error", (error) => {
      fail(error);
    });
  });
}

function sendJson(response, status, payload) {
  if (response.writableEnded) {
    return;
  }
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin"
  });
  response.end(body);
}

function sendText(response, status, text) {
  const body = String(text);
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "X-Content-Type-Options": "nosniff"
  });
  response.end(body);
}

async function handleApi(request, response, url) {
  const route = url.pathname;
  const method = request.method || "GET";

  if (route === "/api/hod/login" && method === "POST") {
    const body = await readJsonBody(request); const email = normaliseEmail(body.email); const password = String(body.password || "");
    const hod = database.hods.find((item) => item.email === email);
    if (!hod || !verifyPassword(password, hod.passwordHash)) throw new ApiError(401, "HOD email or password is incorrect.");
    const token = createHodSession(hod); setHodCookie(request, response, token);
    sendJson(response, 200, { hod: publicHod(hod) }); return;
  }
  if (route === "/api/hod/me" && method === "GET") {
    const hod = hodFromRequest(request); if (!hod) throw new ApiError(401, "Please sign in as HOD.");
    sendJson(response, 200, { hod: publicHod(hod) }); return;
  }
  if (route === "/api/hod/logout" && method === "POST") {
    const token = readCookies(request)[HOD_SESSION_COOKIE] || "";
    database.hodSessions = database.hodSessions.filter((item) => item.token !== token); saveDatabase(); clearHodCookie(request, response); sendJson(response, 200, { ok: true }); return;
  }
  if (route === "/api/hod/message-requests" && method === "GET") {
    const hod = hodFromRequest(request); if (!hod) throw new ApiError(401, "Please sign in as HOD.");
    const requests = database.messageRequests.filter((r) => sameDepartment(r.department, hod.department)).map((r) => ({ ...r, student: publicUser(database.users.find((u) => u.id === r.studentId)) })).filter((r) => r.student);
    sendJson(response, 200, { requests, department: hod.department }); return;
  }
  const decisionMatch = route.match(/^\/api\/hod\/message-requests\/([A-Za-z0-9-]+)\/decision$/);
  if (decisionMatch && method === "POST") {
    const hod = hodFromRequest(request); if (!hod) throw new ApiError(401, "Please sign in as HOD.");
    const req = database.messageRequests.find((r) => r.id === decisionMatch[1] && sameDepartment(r.department, hod.department));
    if (!req) throw new ApiError(404, "Request not found in your department.");
    const body = await readJsonBody(request); const decision = body.decision;
    if (!["approved", "rejected"].includes(decision)) throw new ApiError(400, "Choose approve or reject.");
    req.status = decision; req.reviewedAt = new Date().toISOString(); req.reviewedBy = hod.id;
    const student = database.users.find((u) => u.id === req.studentId);
    if (student) { student.messagingStatus = decision; student.messagingAccess = decision === "approved"; }
    saveDatabase(); sendJson(response, 200, { ok: true, status: decision }); return;
  }
  if (route === "/api/messaging/request" && method === "POST") {
    const student = requireStudent(request); if (!cleanLine(student.branch)) throw new ApiError(400, "Please add your department in My Profile first.");
    const existing = database.messageRequests.find((r) => r.studentId === student.id && r.status === "pending");
    if (existing) { sendJson(response, 200, { status: "pending", message: "Your request is already waiting for HOD approval." }); return; }
    const alreadyApproved = student.messagingAccess && student.messagingStatus === "approved";
    if (alreadyApproved) { sendJson(response, 200, { status: "approved", message: "Messaging is already enabled." }); return; }
    const req = { id: "msgreq-" + crypto.randomUUID(), studentId: student.id, department: cleanLine(student.branch), status: "pending", createdAt: new Date().toISOString() };
    database.messageRequests.push(req); student.messagingStatus = "pending"; student.messagingAccess = false; saveDatabase();
    sendJson(response, 201, { status: "pending", message: "Request sent to your department HOD." }); return;
  }
  if (route === "/api/messaging/status" && method === "GET") {
    const student = requireStudent(request); const req = database.messageRequests.filter((r) => r.studentId === student.id).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    sendJson(response, 200, { status: student.messagingStatus || (req ? req.status : "not_requested"), department: student.branch || "", access: Boolean(student.messagingAccess && student.messagingStatus === "approved") }); return;
  }
  if (route === "/api/messaging/contacts" && method === "GET") {
    const student = requireApprovedStudent(request);
    const contacts = database.users.filter((u) => u.id !== student.id && sameDepartment(u.branch, student.branch) && u.messagingAccess && u.messagingStatus === "approved").map(publicUser);
    sendJson(response, 200, { contacts, department: student.branch }); return;
  }
  if (route === "/api/messaging/conversation" && method === "GET") {
    const student = requireApprovedStudent(request); const otherId = url.searchParams.get("with") || "";
    const other = database.users.find((u) => u.id === otherId && sameDepartment(u.branch, student.branch) && u.messagingAccess && u.messagingStatus === "approved");
    if (!other) throw new ApiError(403, "You can message approved students in your department only.");
    const messages = database.messages.filter((m) => (m.fromId === student.id && m.toId === other.id) || (m.fromId === other.id && m.toId === student.id)).sort((a,b) => String(a.createdAt).localeCompare(String(b.createdAt))).map((m) => ({ ...m, mine: m.fromId === student.id }));
    sendJson(response, 200, { messages, contact: publicUser(other) }); return;
  }
  if (route === "/api/messaging/send" && method === "POST") {
    const student = requireApprovedStudent(request); const body = await readJsonBody(request); const toId = String(body.toId || ""); const content = cleanDescription(body.content || "");
    const other = database.users.find((u) => u.id === toId && sameDepartment(u.branch, student.branch) && u.messagingAccess && u.messagingStatus === "approved");
    if (!other) throw new ApiError(403, "Recipient must be an approved student in your department.");
    if (!content || content.length > 2000) throw new ApiError(400, "Message must be between 1 and 2000 characters.");
    const msg = { id: "message-" + crypto.randomUUID(), fromId: student.id, toId: other.id, content, createdAt: new Date().toISOString() }; database.messages.push(msg); saveDatabase(); sendJson(response, 201, { message: { ...msg, mine: true } }); return;
  }

  if (route === "/api/health" && method === "GET") {
    sendJson(response, 200, {
      ok: true,
      app: "College Diaries",
      mode: "server",
      accounts: database.users.length,
      memories: database.memories.length
    });
    return;
  }

  if (route === "/api/auth/signup" && method === "POST") {
    const body = await readJsonBody(request);
    const name = cleanLine(body.name);
    const email = normaliseEmail(body.email);
    const password = String(body.password || "");

    if (name.length < 2 || name.length > 60) {
      throw new ApiError(400, "Enter a name between 2 and 60 characters.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
      throw new ApiError(400, "Enter a valid email address.");
    }
    if (password.length < 8 || password.length > 200) {
      throw new ApiError(400, "Choose a password with at least 8 characters.");
    }
    if (database.users.some((user) => user.email === email)) {
      throw new ApiError(409, "An account with this email already exists. Please sign in.");
    }

    const user = {
      id: "user-" + crypto.randomUUID(),
      name,
      email,
      passwordHash: hashPassword(password),
      bio: "",
      branch: "",
      year: null,
      avatarUrl: "",
      createdAt: new Date().toISOString()
    };
    database.users.push(user);
    const token = createSession(user.id);
    setSessionCookie(request, response, token);
    sendJson(response, 201, { user: publicUser(user), mode: "server" });
    return;
  }

  if (route === "/api/auth/login" && method === "POST") {
    const body = await readJsonBody(request);
    const email = normaliseEmail(body.email);
    const password = String(body.password || "");
    const user = database.users.find((item) => item.email === email);

    if (password.length > 200) {
      throw new ApiError(400, "The password is too long.");
    }
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new ApiError(401, "The email or password is incorrect.");
    }

    purgeExpiredSessions();
    const token = createSession(user.id);
    setSessionCookie(request, response, token);
    sendJson(response, 200, { user: publicUser(user), mode: "server" });
    return;
  }

  if (route === "/api/auth/me" && method === "GET") {
    const user = userFromRequest(request);
    if (!user) {
      throw new ApiError(401, "Please sign in to continue.");
    }
    sendJson(response, 200, { user: publicUser(user), mode: "server" });
    return;
  }

  if (route === "/api/auth/logout" && method === "POST") {
    const header = request.headers.authorization || "";
    const token = readCookies(request)[SESSION_COOKIE] ||
      (header.startsWith("Bearer ") ? header.slice(7).trim() : "");
    if (token) {
      database.sessions = database.sessions.filter((session) => session.token !== token);
      saveDatabase();
    }
    clearSessionCookie(request, response);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (route === "/api/profile" && method === "GET") {
    const user = userFromRequest(request);
    if (!user) throw new ApiError(401, "Please sign in to view your profile.");
    sendJson(response, 200, { user: publicUser(user) });
    return;
  }

  if (route === "/api/profile" && method === "PATCH") {
    const user = userFromRequest(request);
    if (!user) throw new ApiError(401, "Please sign in to edit your profile.");
    const body = await readJsonBody(request);
    const name = cleanLine(body.name);
    const bio = cleanDescription(body.bio || "");
    const branch = cleanLine(body.branch || "");
    const year = body.year === "" || body.year == null ? null : Number(body.year);
    const avatarUrl = validateImage(body.avatarUrl || "");

    if (name.length < 2 || name.length > 60) {
      throw new ApiError(400, "Name must be between 2 and 60 characters.");
    }
    if (bio.length > 240) throw new ApiError(400, "Bio must be 240 characters or fewer.");
    if (branch.length > 60) throw new ApiError(400, "Department must be 60 characters or fewer.");
    if (year !== null && (!Number.isInteger(year) || year < 1 || year > 4)) {
      throw new ApiError(400, "Academic year must be between 1 and 4.");
    }

    user.name = name;
    user.bio = bio;
    user.branch = branch;
    user.year = year;
    user.avatarUrl = avatarUrl;
    saveDatabase();
    sendJson(response, 200, { user: publicUser(user), message: "Profile updated." });
    return;
  }

  if (route === "/api/memories" && method === "GET") {
    const memories = database.memories
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(publicMemory);
    sendJson(response, 200, { memories });
    return;
  }

  if (route === "/api/memories" && method === "POST") {
    const user = userFromRequest(request);
    if (!user) {
      throw new ApiError(401, "Please sign in before sharing a memory.");
    }
    const body = await readJsonBody(request);
    const title = cleanLine(body.title);
    const author = cleanLine(body.author);
    const category = cleanLine(body.category);
    const description = cleanDescription(body.description);
    const image = validateImage(body.image);

    if (title.length < 3 || title.length > 80) {
      throw new ApiError(400, "The title needs between 3 and 80 characters.");
    }
    if (author.length < 2 || author.length > 60) {
      throw new ApiError(400, "The student name needs between 2 and 60 characters.");
    }
    if (CATEGORIES.indexOf(category) === -1) {
      throw new ApiError(400, "Choose a category from the list.");
    }
    if (description.length < 20 || description.length > 800) {
      throw new ApiError(400, "The description needs between 20 and 800 characters.");
    }

    const memory = {
      id: "mem-" + crypto.randomUUID(),
      title,
      author,
      category,
      date: new Date().toISOString().slice(0, 10),
      image,
      description,
      createdAt: new Date().toISOString(),
      ownerId: user.id
    };
    database.memories.unshift(memory);
    saveDatabase();
    sendJson(response, 201, { memory: publicMemory(memory) });
    return;
  }

  const detailMatch = route.match(/^\/api\/memories\/([A-Za-z0-9-]+)$/);
  if (detailMatch && method === "GET") {
    const memory = database.memories.find((item) => item.id === detailMatch[1]);
    if (!memory) {
      throw new ApiError(404, "That memory is not in the yearbook.");
    }
    sendJson(response, 200, { memory: publicMemory(memory) });
    return;
  }

  throw new ApiError(404, "API route not found.");
}

function serveStatic(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendText(response, 405, "This server only allows GET and HEAD for static files.");
    return;
  }

  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (error) {
    sendText(response, 400, "That address could not be read.");
    return;
  }

  let relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const segments = relative.split("/");
  const blockedSegments = ["data", ".git", "node_modules"];
  const blockedFiles = ["server.js", "package.json", "package-lock.json", ".gitignore"];

  if (
    !relative ||
    relative.includes("\0") ||
    blockedFiles.indexOf(relative) !== -1 ||
    segments.some(function (segment) {
      return blockedSegments.indexOf(segment) !== -1 || segment.startsWith(".");
    })
  ) {
    sendText(response, 404, "Page not found. Return to /index.html");
    return;
  }

  const filePath = path.resolve(ROOT, relative);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    sendText(response, 403, "That path is not allowed.");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension];
  if (!contentType) {
    sendText(response, 404, "Page not found. Return to /index.html");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(response, 404, "Page not found. Return to /index.html");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": content.length,
      "Cache-Control": extension === ".html" ? "no-store" : "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "SAMEORIGIN"
    });
    if (request.method === "HEAD") {
      response.end();
    } else {
      response.end(content);
    }
  });
}

const server = http.createServer(async (request, response) => {
  let url;
  try {
    url = new URL(request.url, "http://" + (request.headers.host || "localhost"));
  } catch (error) {
    sendText(response, 400, "Bad request.");
    return;
  }

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
    } else {
      serveStatic(request, response, url.pathname);
    }
  } catch (error) {
    if (error instanceof ApiError) {
      sendJson(response, error.status, { error: error.message });
    } else {
      console.error(error);
      sendJson(response, 500, { error: "Something went wrong on the server." });
    }
  }
});

server.listen(PORT, () => {
  console.log("");
  console.log("College Diaries is running at http://localhost:" + PORT);
  console.log("Demo login: " + DEMO_EMAIL + " / " + DEMO_PASSWORD);
  console.log("Data file: data/db.json");
  console.log("Press Ctrl + C to stop the server.");
});
