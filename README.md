# College Diaries

A small digital yearbook for college memories, friendships, fests, classrooms,
sports days, and farewells.

**Every campus has a story. Every memory deserves a place.**

## Run the full version (with backend)

Requires Node.js 18 or newer. There are no npm packages to install.

```bash
npm start
```

Then open **http://localhost:3000**.

The backend stores accounts, sessions, and new memories in `data/db.json`.
That file is created automatically the first time the server starts.

### Demo account

- Email: `demo@collegediaries.app`
- Password: `campus123`

You can also create a new account from the login page. Passwords are hashed with
Node's `scrypt`. Server sessions last for 7 days and are stored in an HttpOnly,
SameSite=Lax cookie. The frontend does not need to read the session token.

## Browser preview mode

You can still open `index.html` directly, or serve the folder with VS Code Live
Server. When `/api/health` is not available, the site switches to a clearly
labelled browser-only mode:

- Accounts and new memories are saved in localStorage.
- The demo account works there too.
- The sample memories always appear.
- This mode is for trying the flow, not for real credentials. Do not reuse an
  important password.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Home and the searchable/filterable memory shelf |
| `login.html` | Sign in, create an account, and view your signed-in account |
| `create-memory.html` | Add a memory (signed-in only) |
| `memory-detail.html` | Read one memory using `?id=...` |
| `about.html` | About College Diaries and how it works |
| `profile.html` | View and edit the signed-in student profile |

## Shared files

- `css/style.css` — the warm yearbook design and responsive layouts
- `js/data.js` — sample memories, safe DOM helpers, local/server memory cache
- `js/auth.js` — account client, automatic mode detection, API bridge
- `js/main.js` — navigation and the home-page shelf
- `js/auth-page.js` — login/sign-up form behaviour
- `js/profile.js` — profile view and edit form
- `js/create-memory.js` — validation and saving a new memory
- `js/memory-detail.js` — detail page and friendly missing-page state
- `server.js` — the zero-dependency Node server and JSON API

## API

| Method | Route | Notes |
| --- | --- | --- |
| GET | `/api/health` | Mode check used by the frontend |
| POST | `/api/auth/signup` | `{ name, email, password }` |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/logout` | Clears the server session cookie |
| GET | `/api/auth/me` | Requires a valid session |
| GET | `/api/profile` | Returns the signed-in student's profile |
| PATCH | `/api/profile` | Updates only the signed-in student's profile |
| GET | `/api/memories` | Public list of new memories |
| GET | `/api/memories/:id` | Public single memory |
| POST | `/api/memories` | Requires a valid session cookie |

All request and response bodies are JSON. Input lengths are validated on both
the page and the server, and every user-provided string is rendered with
`textContent`, never `innerHTML`.

## Not included yet

No likes, comments, messaging, payments, admin approval, photo uploads, or
password-reset email yet. Profile photos use a public image URL rather than a file upload.
The JSON file is suitable for a small learning project only; it is not a multi-process
production database. Use HTTPS and add rate limiting, email verification, CSRF protections,
backups, and a production database before deploying accounts publicly.

## Developer credit

College Diaries • Developed with love and memories by Vaibhav Mishra.


## Department-only messaging (new)

- Student messaging page: `http://localhost:3000/messaging.html`
- Separate HOD sign-in: `http://localhost:3000/hod-login.html`
- HOD requests dashboard: `http://localhost:3000/hod-dashboard.html`
- Demo HOD account for local testing: `hod.cse@collegediaries.app` / `Hod@12345` (department: `CSE`). Change/remove this demo account before any real deployment.
- Students must sign in, set their department in **My Profile**, and request access. Only the HOD assigned to the same department can approve/reject. Approved students can message other approved students in that exact department only.
- HOD accounts are not created through public student sign-up. The demo HOD is seeded by `server.js` for local testing.
- This is an MVP with JSON-file storage; before production, provision real HOD credentials securely, use a database, HTTPS, backups, and operational monitoring.
