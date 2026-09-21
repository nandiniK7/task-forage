// config/env.js must stay the first local import: it loads server/.env before any other module reads configuration.
import env, { assertEnv, ENV_FILE_PATH } from "./config/env.js";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import { createApp } from "./app.js";
import { migrateLegacyData } from "./migrations/legacy.js";
import { startReminderScheduler } from "./services/reminders.js";

const start = async () => {
  try {
    assertEnv();
    console.log(`Configuration loaded (${ENV_FILE_PATH}); required variables are present.`);
    await connectDB();
    await migrateLegacyData();

    const server = createApp().listen(env.port, () => {
      console.log(`TaskForage API listening on port ${env.port} (${env.nodeEnv})`);
      console.log(`Allowed CORS origins: ${env.corsOrigins.join(", ")}`);
    });
    startReminderScheduler(env.reminderIntervalMinutes);

    const shutdown = (signal) => {
      console.log(`${signal} received, shutting down.`);
      server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));

start();
