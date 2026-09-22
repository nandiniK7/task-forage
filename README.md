# TaskForage

TaskForage is a full-stack task management app for creating, assigning, sharing, discussing and tracking work. Tasks carry deadlines, priorities and statuses, can be assigned to any registered user, shared with view or edit permission, discussed in threaded comments, and backed by file attachments. A dashboard and a calendar show progress and deadlines, and email notifications keep people informed.

## Features

- **Authentication** – register, login, logout, JWT-protected API and routes, expired-session handling
- **Tasks** – title, description, deadline, priority (Low / Medium / High), status (Pending / In Progress / Completed), category (Work / Personal / Projects); full create, read, update, delete
- **Status at a glance** – every task card is colour-coded by status (amber, blue, green), has a status badge, and a one-click status control; overdue tasks get a red ring and badge
- **Assignments** – assign to yourself or any registered user through a searchable picker; *Assigned to*, *Assigned by* and *Created by* are shown on cards, the details page and the edit dialog
- **Navbar search** – global search (`/tasks?search=…`) over title, description, category, assignee and creator, executed by the API, case-insensitive, clearable, shareable URL
- **Filtering and sorting** – status, priority, category, scope (assigned to me / created by me / shared with me); sort by deadline (asc/desc), priority, recently created, oldest, title
- **Dashboard** – totals, pending / in progress / completed / overdue counts, completion progress, pie chart by status, stacked bar charts by priority and category, upcoming and overdue deadlines. All numbers come from the API.
- **Calendar** – month view with every task on its deadline, status colours, overdue markers, a day panel, and overdue / upcoming lists
- **Sharing** – share a task with a registered user as *View only* or *Can edit*, change or remove access, or leave a shared task. Permissions are enforced by the API.
- **Comments** – add, edit (shows "edited"), delete, reply, nested threads; authors edit their own comments, authors and the task owner can delete
- **Attachments** – upload, download, delete; 5 MB limit, file-type allow-list, stored in MongoDB GridFS (not inside task documents)
- **Reminders and email** – per-task reminder time; a scheduler emails assignee and creator before a deadline; emails also go out on assignment, updates, status changes and sharing. Email failures never affect the operation that triggered them.
- **Profile and settings** – edit name and email, toggle email notifications, change password, log out, delete account
- **Responsive UI** – desktop sidebar, mobile drawer, forms and cards that work down to 320 px

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS 4, React Router, Axios, Recharts, Lucide icons |
| Backend | Node.js, Express 5, Mongoose, JWT, bcryptjs, Multer, Nodemailer, Helmet, express-rate-limit |
| Database | MongoDB (Atlas), GridFS for files |
| Hosting | Netlify (frontend), Render (backend) |

## Project structure

```text
.
├── client/               React + Vite app (package.json)
│   ├── public/
│   └── src/  api/ components/ context/ hooks/ lib/ pages/
├── server/               Express API (package.json)
│   ├── config/ controllers/ middleware/ migrations/
│   ├── models/ routes/ services/ utils/ tests/
│   ├── app.js            Express app (CORS, security headers, routes)
│   └── server.js         Entry point (DB connection, reminder scheduler)
├── netlify.toml          Netlify build, SPA fallback, API URL
├── render.yaml           Render blueprint
└── README.md
```

There are exactly two `package.json` files: `client/package.json` and `server/package.json`.

## Local setup

Requirements: Node.js 20+ and a MongoDB database (local or Atlas).

### 1. Backend

```bash
cd server
npm install
cp .env.example .env      # then fill in the values
npm run dev               # or: npm start
```

The API listens on `http://localhost:5000`; check `http://localhost:5000/api/health`.

### 2. Frontend

```bash
cd client
npm install
cp .env.example .env      # set VITE_API_URL=http://localhost:5000/api
npm run dev
```

Open `http://localhost:5173`. Local origins (`localhost:5173` and `localhost:4173`) are allowed by the API automatically outside production.

### Build and test

```bash
cd client && npm run build && npm run lint      # production bundle in client/dist
cd server && TEST_MONGO_URI=mongodb://127.0.0.1:27017 npm test
```

The server tests start the real app against a throwaway database (use a disposable MongoDB; the test database is dropped afterwards). Without `TEST_MONGO_URI` they are skipped.

## Environment variables

Never commit real values. Only the `*.example` files are committed.

### Server (`server/.env`, or the Render dashboard)

| Variable | Required | Description |
| --- | --- | --- |
| `MONGO_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Long random string (24+ characters in production) |
| `CORS_ORIGIN` | yes in production | Comma-separated allowed frontend origins, e.g. `https://taskforageapp.netlify.app` |
| `PORT` | no | Defaults to 5000 (Render sets it) |
| `NODE_ENV` | no | Set to `production` on Render |
| `MONGO_DB_NAME` | no | Database name, default `taskflow` |
| `CLIENT_URL` | no | Public frontend URL used in email links |
| `EMAIL_USER`, `EMAIL_PASS` | for email | SMTP credentials (for Gmail use an App Password) |
| `EMAIL_SERVICE` / `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE` | for email | Gmail by default; set the host/port for other providers |
| `EMAIL_FROM` | no | Sender address shown to recipients |
| `REMINDER_INTERVAL_MINUTES` | no | How often deadlines are scanned (default 15) |
| `CRON_SECRET` | no | Enables `POST /api/internal/reminders` for external schedulers |

If email is not configured the app works normally and email sending is skipped with a log message.

### Client (`client/.env`, or the Netlify environment)

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | API base URL including `/api`, e.g. `https://task-forage.onrender.com/api` |

## API overview

All endpoints return JSON. Errors look like `{ "success": false, "message": "…", "errors": { "field": "…" } }`.

| Area | Endpoints |
| --- | --- |
| Health | `GET /api/health` |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/profile`, `PUT /api/auth/password`, `DELETE /api/auth/account` |
| Users | `GET /api/users?search=` |
| Tasks | `GET /api/tasks?search=&status=&priority=&category=&scope=&sort=&overdue=&dueFrom=&dueTo=`, `GET /api/tasks/stats`, `GET/PUT/PATCH/DELETE /api/tasks/:id`, `POST /api/tasks` |
| Sharing | `POST /api/tasks/:id/share`, `DELETE /api/tasks/:id/share/:userId` |
| Comments | `GET/POST /api/tasks/:id/comments`, `PUT/PATCH/DELETE /api/tasks/:id/comments/:commentId` |
| Attachments | `POST /api/tasks/:id/attachments`, `GET …/attachments/:attachmentId/download`, `DELETE …/attachments/:attachmentId` |

Permissions: the **owner** (creator) can do everything including sharing and deleting; the **assignee** and users shared with *Can edit* can change the task and its files; users shared with *View only* can read and join the discussion.

## Deployment

### Backend on Render

1. Create a **Web Service** from the repository (or use the `render.yaml` blueprint). Root directory `server`, build command `npm ci`, start command `npm start`, health check path `/api/health`.
2. Set the environment variables above. At minimum `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGIN=https://taskforageapp.netlify.app`, and `NODE_ENV=production`.
3. In MongoDB Atlas, allow Render's outbound IPs in Network Access.
4. Note: free Render instances sleep when idle (the first request can take up to a minute) and block outbound SMTP on the standard ports. For reliable email use a provider that offers an alternative SMTP port (for example port 2525) via `EMAIL_HOST` / `EMAIL_PORT`, and to keep deadline reminders running while the service sleeps, call `POST /api/internal/reminders` with the `x-cron-secret` header from a scheduler.

### Frontend on Netlify

1. Import the repository. `netlify.toml` already sets base directory `client`, build command `npm run build`, publish directory `dist`, the SPA fallback (`/* → /index.html`) and `VITE_API_URL=https://task-forage.onrender.com/api`.
2. Deploy. Make sure the deployed Netlify URL is listed in the backend's `CORS_ORIGIN`.

### CORS

The API allows the origins listed in `CORS_ORIGIN` (comma-separated, trailing slashes tolerated). Preflight `OPTIONS` requests are answered with `204` and the correct headers for every route. Authentication uses a Bearer token rather than cookies, so credentials are never enabled, which also keeps `CORS_ORIGIN=*` valid if you ever need it.
