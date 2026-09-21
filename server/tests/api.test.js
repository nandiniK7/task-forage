// Integration tests. Run with a reachable MongoDB:
//   TEST_MONGO_URI=mongodb://127.0.0.1:27017 npm test
// They start the real Express app in-process against a throwaway database.
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import mongoose from "mongoose";

const MONGO = process.env.TEST_MONGO_URI;
const FRONTEND = "https://taskforage.netlify.app";

if (!MONGO) {
  test("integration tests skipped", { skip: "Set TEST_MONGO_URI to run them" }, () => {});
} else {
  // A minimal SMTP server that records messages, so we can prove emails are really sent.
  const inbox = [];
  const sockets = new Set();
  const smtp = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let data = false;
    let buffer = "";
    socket.write("220 test ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      if (data) {
        if (!buffer.includes("\r\n.\r\n")) return;
        inbox.push(buffer);
        buffer = "";
        data = false;
        socket.write("250 OK queued\r\n");
        return;
      }
      for (const line of buffer.split("\r\n").filter(Boolean)) {
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === "EHLO" || cmd === "HELO") socket.write("250-test\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (cmd === "AUTH") socket.write("235 OK\r\n");
        else if (cmd === "DATA") { data = true; socket.write("354 go\r\n"); }
        else if (cmd === "QUIT") { socket.write("221 bye\r\n"); socket.end(); }
        else socket.write("250 OK\r\n");
      }
      if (!data) buffer = "";
    });
    socket.on("error", () => {});
  });
  await new Promise((resolve) => smtp.listen(0, "127.0.0.1", resolve));

  Object.assign(process.env, {
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-test-secret-test-secret",
    CORS_ORIGIN: FRONTEND,
    EMAIL_USER: "sender@example.test",
    EMAIL_PASS: "not-a-real-password",
    EMAIL_HOST: "127.0.0.1",
    EMAIL_PORT: String(smtp.address().port),
    EMAIL_SECURE: "false",
    CRON_SECRET: "cron-secret",
  });

  const { createApp } = await import("../app.js");
  const { default: Task } = await import("../models/Task.js");
  const { runReminderCheck } = await import("../services/reminders.js");
  const { migrateLegacyData } = await import("../migrations/legacy.js");
  const { parseOrigins } = await import("../config/env.js");
  const { buildCorsOptions } = await import("../config/cors.js");

  let server;
  let base;

  const call = async (method, path, { token, body, headers = {}, raw } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      signal: AbortSignal.timeout(15000),
      headers: {
        ...(body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
    if (raw) return res;
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON */ }
    return { status: res.status, json, headers: res.headers };
  };

  const register = async (name) => {
    const email = `${name.toLowerCase()}@example.test`;
    const { status, json } = await call("POST", "/api/auth/register", { body: { name, email, password: "Passw0rd!" } });
    assert.equal(status, 201, JSON.stringify(json));
    return { token: json.token, user: json.user, email };
  };

  const wait = async (predicate, ms = 4000) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (predicate()) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  };

  before(async () => {
    await mongoose.connect(MONGO, { dbName: `taskforage_test_${Date.now()}` });
    server = createApp().listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    server?.closeAllConnections?.();
    server?.close();
    sockets.forEach((socket) => socket.destroy());
    smtp.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  describe("health & CORS", () => {
    test("health check works", async () => {
      const { status, json } = await call("GET", "/api/health");
      assert.equal(status, 200);
      assert.equal(json.status, "ok");
    });

    for (const path of ["/api/auth/register", "/api/auth/login", "/api/tasks"]) {
      test(`OPTIONS preflight ${path} succeeds for the production frontend`, async () => {
        const res = await call("OPTIONS", path, {
          raw: true,
          headers: {
            Origin: FRONTEND,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
          },
        });
        assert.equal(res.status, 204);
        assert.equal(res.headers.get("access-control-allow-origin"), FRONTEND);
        assert.match(res.headers.get("access-control-allow-methods"), /POST/);
        assert.match(res.headers.get("access-control-allow-methods"), /DELETE/);
        assert.match(res.headers.get("access-control-allow-headers").toLowerCase(), /authorization/);
        assert.equal(res.headers.get("access-control-allow-credentials"), null);
      });
    }

    test("actual POST responses carry Access-Control-Allow-Origin", async () => {
      const res = await call("POST", "/api/auth/login", { raw: true, headers: { Origin: FRONTEND }, body: { email: "x@y.zz", password: "nope" } });
      assert.equal(res.status, 401);
      assert.equal(res.headers.get("access-control-allow-origin"), FRONTEND);
    });

    test("error responses (404, bad JSON) still carry CORS headers", async () => {
      const notFound = await call("GET", "/api/nope", { raw: true, headers: { Origin: FRONTEND } });
      assert.equal(notFound.status, 404);
      assert.equal(notFound.headers.get("access-control-allow-origin"), FRONTEND);
      const bad = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: FRONTEND }, body: "{oops" });
      assert.equal(bad.status, 400);
      assert.equal(bad.headers.get("access-control-allow-origin"), FRONTEND);
    });

    test("unknown origins get no CORS headers", async () => {
      const res = await call("OPTIONS", "/api/auth/register", {
        raw: true,
        headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" },
      });
      assert.equal(res.headers.get("access-control-allow-origin"), null);
    });

    test("origin list parsing is forgiving; wildcard never enables credentials", async () => {
      assert.deepEqual(parseOrigins("CORS_ORIGIN=https://a.app/, https://b.app ,"), ["https://a.app", "https://b.app"]);
      const options = buildCorsOptions(["*"], { isProduction: true });
      assert.equal(options.credentials, false);
      await new Promise((resolve) => options.origin("https://anything.example", (_e, allowed) => { assert.equal(allowed, "*"); resolve(); }));
    });
  });

  describe("auth", () => {
    test("register validates input", async () => {
      const bad = await call("POST", "/api/auth/register", { body: { name: "A", email: "nope", password: "123" } });
      assert.equal(bad.status, 400);
      assert.ok(bad.json.errors.name && bad.json.errors.email && bad.json.errors.password);
    });

    test("register, duplicate, login, me, invalid login", async () => {
      const { token, user } = await register("Alice");
      assert.equal(user.password, undefined);

      const dup = await call("POST", "/api/auth/register", { body: { name: "Alice", email: "ALICE@example.test", password: "Passw0rd!" } });
      assert.equal(dup.status, 409);

      const login = await call("POST", "/api/auth/login", { body: { email: "alice@example.test", password: "Passw0rd!" } });
      assert.equal(login.status, 200);
      assert.ok(login.json.token);

      const badLogin = await call("POST", "/api/auth/login", { body: { email: "alice@example.test", password: "wrong-password" } });
      assert.equal(badLogin.status, 401);

      const me = await call("GET", "/api/auth/me", { token });
      assert.equal(me.status, 200);
      assert.equal(me.json.user.email, "alice@example.test");
    });

    test("protected routes reject missing, garbage and forged tokens", async () => {
      assert.equal((await call("GET", "/api/tasks")).status, 401);
      assert.equal((await call("GET", "/api/tasks", { token: "garbage" })).status, 401);
      const { default: jwt } = await import("jsonwebtoken");
      const forged = jwt.sign({ id: new mongoose.Types.ObjectId().toString() }, "another-secret");
      assert.equal((await call("GET", "/api/tasks", { token: forged })).status, 401);
      const validButGone = jwt.sign({ id: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET);
      assert.equal((await call("GET", "/api/tasks", { token: validButGone })).status, 401);
    });

    test("profile update and password change", async () => {
      const { token } = await register("Profiler");
      const upd = await call("PUT", "/api/auth/profile", { token, body: { name: "Profiler Two", emailNotifications: false } });
      assert.equal(upd.status, 200);
      assert.equal(upd.json.user.name, "Profiler Two");
      assert.equal(upd.json.user.emailNotifications, false);

      const wrong = await call("PUT", "/api/auth/password", { token, body: { currentPassword: "bad", newPassword: "NewPassw0rd!" } });
      assert.equal(wrong.status, 400);
      const ok = await call("PUT", "/api/auth/password", { token, body: { currentPassword: "Passw0rd!", newPassword: "NewPassw0rd!" } });
      assert.equal(ok.status, 200);
      const login = await call("POST", "/api/auth/login", { body: { email: "profiler@example.test", password: "NewPassw0rd!" } });
      assert.equal(login.status, 200);
    });
  });

  describe("tasks, assignment, search, filters, sorting", () => {
    let alice; let bob; let carol;
    const ids = {};

    before(async () => {
      alice = await register("Anna");
      bob = await register("Bobby");
      carol = await register("Carla");
    });

    test("validation", async () => {
      const r = await call("POST", "/api/tasks", { token: alice.token, body: { title: "  " } });
      assert.equal(r.status, 400);
      assert.ok(r.json.errors.title);
      assert.equal((await call("POST", "/api/tasks", { token: alice.token, body: { title: "x", priority: "Urgent" } })).status, 400);
      assert.equal((await call("POST", "/api/tasks", { token: alice.token, body: { title: "x", status: "Done" } })).status, 400);
      assert.equal((await call("POST", "/api/tasks", { token: alice.token, body: { title: "x", category: "Project" } })).status, 400);
      assert.equal((await call("POST", "/api/tasks", { token: alice.token, body: { title: "x", deadline: "not-a-date" } })).status, 400);
      assert.equal((await call("POST", "/api/tasks", { token: alice.token, body: { title: "x", assignedTo: "12345" } })).status, 400);
      assert.equal((await call("POST", "/api/tasks", { token: alice.token, body: { title: "x", assignedTo: new mongoose.Types.ObjectId().toString() } })).status, 400);
    });

    test("create defaults to self-assignment and shows created/assigned by", async () => {
      const r = await call("POST", "/api/tasks", {
        token: alice.token,
        body: { title: "Website redesign", description: "Landing page refresh", category: "Projects", priority: "High", status: "Pending", deadline: new Date(Date.now() + 2 * 86400000).toISOString() },
      });
      assert.equal(r.status, 201, JSON.stringify(r.json));
      const t = r.json.task;
      ids.website = t._id;
      assert.equal(t.assignedTo._id, alice.user._id);
      assert.equal(t.assignedBy._id, alice.user._id);
      assert.equal(t.createdBy.name, "Anna");
      assert.equal(t.access, "owner");
      assert.equal(t.isOverdue, false);
    });

    test("assign another user; emails are sent to the assignee; unassign with null", async () => {
      inbox.length = 0;
      const r = await call("POST", "/api/tasks", {
        token: alice.token,
        body: { title: "Prepare quarterly report", description: "Numbers and charts", category: "Work", priority: "Medium", deadline: new Date(Date.now() - 86400000).toISOString(), assignedTo: bob.user._id },
      });
      assert.equal(r.status, 201);
      ids.report = r.json.task._id;
      assert.equal(r.json.task.assignedTo.name, "Bobby");
      assert.equal(r.json.task.assignedBy.name, "Anna");
      assert.equal(r.json.task.createdBy.name, "Anna");
      assert.equal(r.json.task.isOverdue, true);

      assert.ok(await wait(() => inbox.some((m) => m.includes("Task assigned to you"))), "assignment email should arrive");
      assert.ok(inbox.every((m) => !/To:.*anna@/i.test(m)), "actor should not be emailed about their own action");

      const un = await call("POST", "/api/tasks", { token: alice.token, body: { title: "Floating task", assignedTo: null, category: "Personal", priority: "Low" } });
      assert.equal(un.status, 201);
      assert.equal(un.json.task.assignedTo, null);
      ids.floating = un.json.task._id;
    });

    test("assignee sees the task (with permissions) without it being shared", async () => {
      const list = await call("GET", "/api/tasks", { token: bob.token });
      assert.equal(list.json.tasks.length, 1);
      assert.equal(list.json.tasks[0].title, "Prepare quarterly report");
      assert.equal(list.json.tasks[0].access, "edit");
      assert.equal(list.json.tasks[0].permissions.canDelete, false);
      const carolList = await call("GET", "/api/tasks", { token: carol.token });
      assert.equal(carolList.json.tasks.length, 0);
    });

    test("search: title, description, category, assigned user, creator; case-insensitive; empty; regex chars", async () => {
      const search = async (q) => (await call("GET", `/api/tasks?search=${encodeURIComponent(q)}`, { token: alice.token })).json.tasks.map((t) => t.title);
      assert.deepEqual(await search("WEBSITE"), ["Website redesign"]);
      assert.deepEqual(await search("charts"), ["Prepare quarterly report"]);
      assert.deepEqual(await search("personal"), ["Floating task"]);
      assert.deepEqual(await search("bobby"), ["Prepare quarterly report"]);
      assert.equal((await search("anna")).length, 3, "creator name matches all three");
      assert.equal((await search("")).length, 3);
      assert.deepEqual(await search("(["), [], "regex metacharacters must not crash");
      assert.deepEqual(await search("zzzz-no-match"), []);
    });

    test("filters and combinations", async () => {
      const q = async (qs) => (await call("GET", `/api/tasks?${qs}`, { token: alice.token })).json.tasks.map((t) => t.title);
      assert.deepEqual(await q("priority=High"), ["Website redesign"]);
      assert.deepEqual(await q("category=Personal"), ["Floating task"]);
      assert.equal((await q("status=Pending")).length, 3);
      assert.deepEqual(await q("overdue=true"), ["Prepare quarterly report"]);
      assert.deepEqual(await q("scope=assigned"), ["Website redesign"]);
      assert.equal((await q("status=All&priority=All&category=All")).length, 3);
      assert.deepEqual(await q("priority=High&category=Work"), []);
      assert.equal((await call("GET", "/api/tasks?status=Bogus", { token: alice.token })).status, 400);
      assert.equal((await call("GET", "/api/tasks?sort=bogus", { token: alice.token })).status, 400);
    });

    test("sorting: deadline asc/desc (no-deadline last), priority, recent", async () => {
      const q = async (sort) => (await call("GET", `/api/tasks?sort=${sort}`, { token: alice.token })).json.tasks.map((t) => t.title);
      assert.deepEqual(await q("deadline_asc"), ["Prepare quarterly report", "Website redesign", "Floating task"]);
      assert.deepEqual(await q("deadline_desc"), ["Website redesign", "Prepare quarterly report", "Floating task"]);
      assert.deepEqual(await q("priority"), ["Website redesign", "Prepare quarterly report", "Floating task"]);
      assert.deepEqual(await q("recent"), ["Floating task", "Prepare quarterly report", "Website redesign"]);
      assert.deepEqual(await q("oldest"), ["Website redesign", "Prepare quarterly report", "Floating task"]);
    });

    test("read single task, invalid and missing ids", async () => {
      const ok = await call("GET", `/api/tasks/${ids.website}`, { token: alice.token });
      assert.equal(ok.status, 200);
      assert.equal(ok.json.task.title, "Website redesign");
      assert.equal((await call("GET", "/api/tasks/not-an-id", { token: alice.token })).status, 400);
      assert.equal((await call("GET", `/api/tasks/${new mongoose.Types.ObjectId()}`, { token: alice.token })).status, 404);
      assert.equal((await call("GET", `/api/tasks/${ids.website}`, { token: carol.token })).status, 403);
    });

    test("update every field; status change and reassignment send emails", async () => {
      inbox.length = 0;
      const r = await call("PUT", `/api/tasks/${ids.report}`, {
        token: alice.token,
        body: { title: "Quarterly report v2", description: "Updated", deadline: new Date(Date.now() + 5 * 86400000).toISOString(), priority: "Low", status: "In Progress", category: "Projects" },
      });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      const t = r.json.task;
      assert.equal(t.title, "Quarterly report v2");
      assert.equal(t.priority, "Low");
      assert.equal(t.status, "In Progress");
      assert.equal(t.category, "Projects");
      assert.equal(t.assignedTo.name, "Bobby");
      assert.equal(t.isOverdue, false);
      assert.ok(await wait(() => inbox.some((m) => /Status changed to In Progress/.test(m))), "status email");

      inbox.length = 0;
      const re = await call("PUT", `/api/tasks/${ids.report}`, { token: alice.token, body: { assignedTo: carol.user._id } });
      assert.equal(re.json.task.assignedTo.name, "Carla");
      assert.equal(re.json.task.assignedBy.name, "Anna");
      assert.ok(await wait(() => inbox.some((m) => /Task assigned to you/.test(m))), "reassignment email");
      const back = await call("PUT", `/api/tasks/${ids.report}`, { token: alice.token, body: { assignedTo: alice.user._id } });
      assert.equal(back.json.task.assignedTo.name, "Anna");

      const done = await call("PATCH", `/api/tasks/${ids.report}`, { token: alice.token, body: { status: "Completed" } });
      assert.equal(done.json.task.status, "Completed");
      assert.ok(done.json.task.completedAt);
      assert.equal((await call("PUT", `/api/tasks/${ids.report}`, { token: alice.token, body: {} })).status, 400);
      assert.equal((await call("PUT", `/api/tasks/${ids.report}`, { token: alice.token, body: { title: "" } })).status, 400);
    });

    test("stats use real data", async () => {
      const { status, json } = await call("GET", "/api/tasks/stats", { token: alice.token });
      assert.equal(status, 200);
      const s = json.stats;
      assert.equal(s.total, 3);
      assert.deepEqual(s.byStatus, { Pending: 2, "In Progress": 0, Completed: 1 });
      assert.equal(s.completionRate, 33);
      assert.equal(s.overdue, 0);
      assert.equal(s.byPriority.find((p) => p.priority === "High").total, 1);
      assert.equal(s.byCategory.find((c) => c.category === "Projects").Completed, 1);
      assert.ok(s.upcoming.length >= 1);
      const empty = await call("GET", "/api/tasks/stats", { token: carol.token });
      assert.equal(empty.json.stats.total, 0);
    });

    test("email failure never fails the task operation", async () => {
      // Point the transporter at a closed port; the API call must still succeed.
      const emailMod = await import("../utils/sendEmail.js");
      const original = process.env.EMAIL_PORT;
      const { default: env } = await import("../config/env.js");
      const savedPort = env.email.port;
      env.email.port = 1;
      emailMod.resetTransporter();
      try {
        const r = await call("POST", "/api/tasks", { token: alice.token, body: { title: "Survives SMTP outage", assignedTo: bob.user._id } });
        assert.equal(r.status, 201);
        const got = await call("GET", `/api/tasks/${r.json.task._id}`, { token: alice.token });
        assert.equal(got.status, 200, "task persisted even though mail failed");
        await new Promise((resolve) => setTimeout(resolve, 300));
      } finally {
        env.email.port = savedPort;
        process.env.EMAIL_PORT = original;
        emailMod.resetTransporter();
      }
    });

    test("delete is owner-only and removes the task", async () => {
      assert.equal((await call("DELETE", `/api/tasks/${ids.floating}`, { token: bob.token })).status, 403);
      assert.equal((await call("DELETE", `/api/tasks/${ids.floating}`, { token: alice.token })).status, 200);
      assert.equal((await call("GET", `/api/tasks/${ids.floating}`, { token: alice.token })).status, 404);
      assert.equal((await call("DELETE", `/api/tasks/${ids.floating}`, { token: alice.token })).status, 404);
    });

    test("users directory", async () => {
      const r = await call("GET", "/api/users?search=car", { token: alice.token });
      assert.equal(r.status, 200);
      assert.deepEqual(r.json.users.map((u) => u.name), ["Carla"]);
      assert.equal(r.json.users[0].password, undefined);
      const all = await call("GET", "/api/users", { token: alice.token });
      assert.ok(all.json.users.find((u) => u.isMe));
    });
  });

  describe("sharing & permissions (enforced by the backend)", () => {
    let owner; let viewer; let editor; let stranger; let taskId;

    before(async () => {
      owner = await register("Owen");
      viewer = await register("Vera");
      editor = await register("Edgar");
      stranger = await register("Stan");
      const t = await call("POST", "/api/tasks", { token: owner.token, body: { title: "Shared plan", assignedTo: null } });
      taskId = t.json.task._id;
    });

    test("only the owner can share; validation of target and permission", async () => {
      const bad = await call("POST", `/api/tasks/${taskId}/share`, { token: owner.token, body: { userId: viewer.user._id, permission: "admin" } });
      assert.equal(bad.status, 400);
      assert.equal((await call("POST", `/api/tasks/${taskId}/share`, { token: owner.token, body: { userId: new mongoose.Types.ObjectId().toString() } })).status, 404);
      assert.equal((await call("POST", `/api/tasks/${taskId}/share`, { token: owner.token, body: { userId: owner.user._id } })).status, 400);
      assert.equal((await call("POST", `/api/tasks/${taskId}/share`, { token: stranger.token, body: { userId: stranger.user._id } })).status, 403);

      inbox.length = 0;
      const v = await call("POST", `/api/tasks/${taskId}/share`, { token: owner.token, body: { userId: viewer.user._id, permission: "view" } });
      assert.equal(v.status, 200);
      const e = await call("POST", `/api/tasks/${taskId}/share`, { token: owner.token, body: { email: editor.email, permission: "edit" } });
      assert.equal(e.status, 200);
      assert.equal(e.json.task.sharedWith.length, 2);
      assert.ok(await wait(() => inbox.some((m) => /Task shared with you/.test(m))));
    });

    test("view-only user can read but not edit/delete/upload/share; edit user can edit but not delete/share", async () => {
      assert.equal((await call("GET", `/api/tasks/${taskId}`, { token: viewer.token })).json.task.access, "view");
      assert.equal((await call("PUT", `/api/tasks/${taskId}`, { token: viewer.token, body: { title: "Hacked" } })).status, 403);
      assert.equal((await call("DELETE", `/api/tasks/${taskId}`, { token: viewer.token })).status, 403);
      const form = new FormData();
      form.append("file", new Blob(["hello"], { type: "text/plain" }), "a.txt");
      assert.equal((await call("POST", `/api/tasks/${taskId}/attachments`, { token: viewer.token, body: form })).status, 403);
      assert.equal((await call("POST", `/api/tasks/${taskId}/share`, { token: viewer.token, body: { userId: stranger.user._id } })).status, 403);

      const ok = await call("PUT", `/api/tasks/${taskId}`, { token: editor.token, body: { title: "Shared plan (edited)", status: "In Progress" } });
      assert.equal(ok.status, 200);
      assert.equal(ok.json.task.title, "Shared plan (edited)");
      assert.equal((await call("DELETE", `/api/tasks/${taskId}`, { token: editor.token })).status, 403);
      assert.equal((await call("POST", `/api/tasks/${taskId}/share`, { token: editor.token, body: { userId: stranger.user._id } })).status, 403);

      assert.equal((await call("GET", `/api/tasks/${taskId}`, { token: stranger.token })).status, 403);
      assert.equal((await call("PUT", `/api/tasks/${taskId}`, { token: stranger.token, body: { title: "x" } })).status, 403);
    });

    test("shared task appears in list with scope=shared; permission change; removal revokes access", async () => {
      const shared = await call("GET", "/api/tasks?scope=shared", { token: viewer.token });
      assert.equal(shared.json.tasks.length, 1);

      await call("POST", `/api/tasks/${taskId}/share`, { token: owner.token, body: { userId: viewer.user._id, permission: "edit" } });
      assert.equal((await call("PUT", `/api/tasks/${taskId}`, { token: viewer.token, body: { priority: "High" } })).status, 200);
      await call("POST", `/api/tasks/${taskId}/share`, { token: owner.token, body: { userId: viewer.user._id, permission: "view" } });
      assert.equal((await call("PUT", `/api/tasks/${taskId}`, { token: viewer.token, body: { priority: "Low" } })).status, 403);

      assert.equal((await call("DELETE", `/api/tasks/${taskId}/share/${editor.user._id}`, { token: viewer.token })).status, 403);
      const removed = await call("DELETE", `/api/tasks/${taskId}/share/${editor.user._id}`, { token: owner.token });
      assert.equal(removed.status, 200);
      assert.equal(removed.json.task.sharedWith.length, 1);
      assert.equal((await call("GET", `/api/tasks/${taskId}`, { token: editor.token })).status, 403);
      assert.equal((await call("DELETE", `/api/tasks/${taskId}/share/${editor.user._id}`, { token: owner.token })).status, 404);

      const left = await call("DELETE", `/api/tasks/${taskId}/share/${viewer.user._id}`, { token: viewer.token });
      assert.equal(left.status, 200);
      assert.equal((await call("GET", `/api/tasks/${taskId}`, { token: viewer.token })).status, 403);
    });

    test("comments: add, reply (nested), edit, delete; ownership enforced", async () => {
      await call("POST", `/api/tasks/${taskId}/share`, { token: owner.token, body: { userId: viewer.user._id, permission: "view" } });
      const c1 = await call("POST", `/api/tasks/${taskId}/comments`, { token: owner.token, body: { text: "Kick-off notes" } });
      assert.equal(c1.status, 201);
      const rootId = c1.json.comment._id;
      assert.equal(c1.json.comment.author.name, "Owen");
      assert.equal(c1.json.comment.edited, false);

      assert.equal((await call("POST", `/api/tasks/${taskId}/comments`, { token: owner.token, body: { text: "   " } })).status, 400);
      assert.equal((await call("POST", `/api/tasks/${taskId}/comments`, { token: stranger.token, body: { text: "hi" } })).status, 403);

      const reply = await call("POST", `/api/tasks/${taskId}/comments`, { token: viewer.token, body: { text: "Looks good", parentId: rootId } });
      assert.equal(reply.status, 201, "view-only users can reply");
      assert.equal(reply.json.comment.parent, rootId);
      const nested = await call("POST", `/api/tasks/${taskId}/comments`, { token: owner.token, body: { text: "Thanks!", parentId: reply.json.comment._id } });
      assert.equal(nested.status, 201);
      assert.equal((await call("POST", `/api/tasks/${taskId}/comments`, { token: owner.token, body: { text: "x", parentId: new mongoose.Types.ObjectId().toString() } })).status, 400);

      const list = await call("GET", `/api/tasks/${taskId}/comments`, { token: viewer.token });
      assert.equal(list.json.comments.length, 3);

      // Edit: author only
      assert.equal((await call("PUT", `/api/tasks/${taskId}/comments/${rootId}`, { token: viewer.token, body: { text: "tamper" } })).status, 403);
      assert.equal((await call("PUT", `/api/tasks/${taskId}/comments/${rootId}`, { token: owner.token, body: { text: "" } })).status, 400);
      const edited = await call("PUT", `/api/tasks/${taskId}/comments/${rootId}`, { token: owner.token, body: { text: "Kick-off notes (updated)" } });
      assert.equal(edited.status, 200);
      assert.equal(edited.json.comment.text, "Kick-off notes (updated)");
      assert.equal(edited.json.comment.edited, true);

      // Delete: the author, or the task owner
      assert.equal((await call("DELETE", `/api/tasks/${taskId}/comments/${rootId}`, { token: viewer.token })).status, 403);
      const commentCount = (await call("GET", `/api/tasks/${taskId}`, { token: owner.token })).json.task.commentCount;
      assert.equal(commentCount, 3);
      const byOwnerOfTask = await call("DELETE", `/api/tasks/${taskId}/comments/${reply.json.comment._id}`, { token: owner.token });
      assert.equal(byOwnerOfTask.status, 200);
      assert.equal(byOwnerOfTask.json.deletedIds.length, 2, "reply and its nested reply are removed");
      const own = await call("DELETE", `/api/tasks/${taskId}/comments/${rootId}`, { token: owner.token });
      assert.equal(own.status, 200);
      assert.equal((await call("GET", `/api/tasks/${taskId}/comments`, { token: owner.token })).json.comments.length, 0);
      assert.equal((await call("DELETE", `/api/tasks/${taskId}/comments/${rootId}`, { token: owner.token })).status, 404);
    });

    test("attachments: upload, download, type + size validation, delete, permissions", async () => {
      const upload = async (token, name, content, type = "application/octet-stream") => {
        const form = new FormData();
        form.append("file", new Blob([content], { type }), name);
        return call("POST", `/api/tasks/${taskId}/attachments`, { token, body: form });
      };

      const ok = await upload(owner.token, "notes.txt", "hello attachment", "text/plain");
      assert.equal(ok.status, 201, JSON.stringify(ok.json));
      const attachment = ok.json.task.attachments[0];
      assert.equal(attachment.filename, "notes.txt");
      assert.equal(attachment.size, 16);
      assert.equal(attachment.uploadedBy.name, "Owen");

      const fromDb = await Task.findById(taskId).lean();
      assert.ok(fromDb.attachments[0].fileId, "bytes live in GridFS, referenced by fileId");
      assert.equal(fromDb.attachments[0].data, undefined, "no file bytes inside the task document");

      const file = await call("GET", `/api/tasks/${taskId}/attachments/${attachment._id}/download`, { token: viewer.token, raw: true });
      assert.equal(file.status, 200);
      assert.equal(await file.text(), "hello attachment");
      assert.match(file.headers.get("content-disposition"), /attachment; filename="notes.txt"/);
      assert.equal((await call("GET", `/api/tasks/${taskId}/attachments/${attachment._id}/download`, { token: stranger.token })).status, 403);

      assert.equal((await upload(owner.token, "evil.exe", "MZ")).status, 400);
      assert.equal((await upload(owner.token, "page.html", "<script>")).status, 400);
      const big = await upload(owner.token, "big.pdf", Buffer.alloc(5 * 1024 * 1024 + 10, 1), "application/pdf");
      assert.equal(big.status, 413);
      assert.match(big.json.message, /5 MB/);
      const none = await call("POST", `/api/tasks/${taskId}/attachments`, { token: owner.token, body: new FormData() });
      assert.equal(none.status, 400);

      assert.equal((await call("DELETE", `/api/tasks/${taskId}/attachments/${attachment._id}`, { token: viewer.token })).status, 403);
      const del = await call("DELETE", `/api/tasks/${taskId}/attachments/${attachment._id}`, { token: owner.token });
      assert.equal(del.status, 200);
      assert.equal(del.json.task.attachments.length, 0);
      assert.equal((await call("GET", `/api/tasks/${taskId}/attachments/${attachment._id}/download`, { token: owner.token })).status, 404);
      const chunks = await mongoose.connection.db.collection("attachments.files").countDocuments();
      assert.equal(chunks, 0, "GridFS file removed");
    });

    test("deleting a task removes its comments and files", async () => {
      const t = await call("POST", "/api/tasks", { token: owner.token, body: { title: "Temp" } });
      const id = t.json.task._id;
      await call("POST", `/api/tasks/${id}/comments`, { token: owner.token, body: { text: "bye" } });
      const form = new FormData();
      form.append("file", new Blob(["x"]), "x.txt");
      await call("POST", `/api/tasks/${id}/attachments`, { token: owner.token, body: form });
      assert.equal((await call("DELETE", `/api/tasks/${id}`, { token: owner.token })).status, 200);
      assert.equal(await mongoose.connection.db.collection("comments").countDocuments({ task: new mongoose.Types.ObjectId(id) }), 0);
      assert.equal(await mongoose.connection.db.collection("attachments.files").countDocuments(), 0);
    });

    test("deleted users are handled gracefully", async () => {
      const temp = await register("Ghost");
      const t = await call("POST", "/api/tasks", { token: owner.token, body: { title: "Ghost task", assignedTo: temp.user._id } });
      await call("POST", `/api/tasks/${t.json.task._id}/comments`, { token: owner.token, body: { text: "keep me" } });
      const gone = await call("DELETE", "/api/auth/account", { token: temp.token, body: { password: "Passw0rd!" } });
      assert.equal(gone.status, 200);
      const after = await call("GET", `/api/tasks/${t.json.task._id}`, { token: owner.token });
      assert.equal(after.status, 200);
      assert.equal(after.json.task.assignedTo, null);
      assert.equal((await call("GET", "/api/auth/me", { token: temp.token })).status, 401);
    });
  });

  describe("reminders", () => {
    test("approaching deadlines get one reminder email; completed/far tasks do not", async () => {
      const u = await register("Remy");
      const soon = await call("POST", "/api/tasks", { token: u.token, body: { title: "Due very soon", deadline: new Date(Date.now() + 2 * 3600000).toISOString(), reminderBefore: 24 } });
      await call("POST", "/api/tasks", { token: u.token, body: { title: "Far away", deadline: new Date(Date.now() + 10 * 86400000).toISOString(), reminderBefore: 24 } });
      const done = await call("POST", "/api/tasks", { token: u.token, body: { title: "Already done", status: "Completed", deadline: new Date(Date.now() + 3600000).toISOString() } });
      const off = await call("POST", "/api/tasks", { token: u.token, body: { title: "No reminder", deadline: new Date(Date.now() + 3600000).toISOString(), reminderBefore: 0 } });
      assert.ok(done.json.task && off.json.task);

      inbox.length = 0;
      const count = await runReminderCheck();
      assert.equal(count, 1);
      assert.ok(await wait(() => inbox.some((m) => /Deadline approaching: Due very soon/.test(m))));
      assert.equal(await runReminderCheck(), 0, "reminder is only sent once");

      // Moving the deadline re-arms the reminder.
      await call("PUT", `/api/tasks/${soon.json.task._id}`, { token: u.token, body: { deadline: new Date(Date.now() + 3 * 3600000).toISOString() } });
      assert.equal(await runReminderCheck(), 1);

      const cron = await call("POST", "/api/internal/reminders", { headers: { "x-cron-secret": "cron-secret" } });
      assert.equal(cron.status, 200);
      assert.equal((await call("POST", "/api/internal/reminders", { headers: { "x-cron-secret": "wrong" } })).status, 401);
    });
  });

  describe("legacy data migration", () => {
    test("upgrades old comments, attachments and categories", async () => {
      const u = await register("Legacy");
      const oid = () => new mongoose.Types.ObjectId();
      const commentId = oid();
      const attId = oid();
      const taskId = oid();
      await mongoose.connection.collection("tasks").insertOne({
        _id: taskId, title: "Old task", description: "", category: "Project", priority: "High", status: "Pending",
        createdBy: new mongoose.Types.ObjectId(u.user._id), assignedTo: null,
        comments: [{ _id: commentId, text: "old comment", user: new mongoose.Types.ObjectId(u.user._id), parentId: null, createdAt: new Date(), updatedAt: new Date() }],
        attachments: ["legacy-string.txt", { _id: attId, name: "old.txt", type: "text/plain", size: 3, data: Buffer.from("old").toString("base64") }],
        sharedWith: [{ _id: oid(), user: oid(), permission: "view" }],
        createdAt: new Date(), updatedAt: new Date(),
      });
      await migrateLegacyData();
      await migrateLegacyData(); // idempotent

      const got = await call("GET", `/api/tasks/${taskId}`, { token: u.token });
      assert.equal(got.status, 200, JSON.stringify(got.json));
      assert.equal(got.json.task.category, "Projects");
      assert.equal(got.json.task.commentCount, 1);
      assert.equal(got.json.task.attachments.length, 1);
      const list = await call("GET", "/api/tasks?sort=priority", { token: u.token });
      assert.equal(list.json.tasks.length, 1);
      const file = await call("GET", `/api/tasks/${taskId}/attachments/${attId}/download`, { token: u.token, raw: true });
      assert.equal(await file.text(), "old");
      const comments = await call("GET", `/api/tasks/${taskId}/comments`, { token: u.token });
      assert.equal(comments.json.comments[0].text, "old comment");
    });
  });
}
