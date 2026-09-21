import crypto from "crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";

import env from "./config/env.js";
import { buildCorsOptions } from "./config/cors.js";
import authRoutes from "./routes/authRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { runReminderCheck } from "./services/reminders.js";
import ApiError from "./utils/ApiError.js";

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

export const createApp = () => {
  const app = express();

  app.set("trust proxy", 1); // Render terminates TLS in front of the app
  app.disable("x-powered-by");

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  // CORS runs first so that every response - including preflights, 4xx and 5xx - carries the right headers.
  // The cors middleware answers OPTIONS preflight requests itself with a 204.
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", apiLimiter);

  app.get("/", (_req, res) => res.json({ success: true, service: "TaskForage API", status: "ok" }));
  app.get("/api/health", (_req, res) => {
    const db = mongoose.connection.readyState === 1;
    res.status(db ? 200 : 503).json({ success: db, service: "TaskForage API", status: db ? "ok" : "database unavailable", uptime: Math.round(process.uptime()) });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/users", userRoutes);

  // Lets an external scheduler trigger the deadline-reminder scan (useful when the host sleeps idle instances).
  app.post("/api/internal/reminders", async (req, res) => {
    if (!env.cronSecret || !safeEqual(req.get("x-cron-secret") ?? "", env.cronSecret)) {
      throw ApiError.unauthorized("Invalid cron secret.");
    }
    res.json({ success: true, reminded: await runReminderCheck() });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
