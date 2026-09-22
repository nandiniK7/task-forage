import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The .env file is located relative to THIS file (server/.env), never relative to the current working
 * directory, so `npm start` inside server/, `npm --prefix server start` and `node server/server.js` all work.
 * Every module gets its configuration through this file, and `server.js` imports it first, so the
 * variables are in place before anything reads them.
 */
export const ENV_FILE_PATH = path.join(__dirname, "..", ".env");

/**
 * Reads and parses the .env file. Handles what Windows editors produce: a UTF-8 BOM (which would otherwise
 * corrupt the first key name), UTF-16 files (Notepad's "Unicode" option) and CRLF line endings.
 * Returns null when the file does not exist.
 */
const readEnvFile = (file) => {
  let buffer;
  try {
    buffer = fs.readFileSync(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }

  let text;
  if (buffer[0] === 0xff && buffer[1] === 0xfe) text = buffer.toString("utf16le").slice(1);
  else if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) text = buffer.toString("utf8").slice(1);
  else text = buffer.toString("utf8");
  return dotenv.parse(text);
};

const fileVariables = readEnvFile(ENV_FILE_PATH);

// Real environment variables (Render, CI) always win over the local .env file.
// A variable that exists but is empty counts as unset, so a blank shell variable cannot mask the file.
for (const [key, value] of Object.entries(fileVariables ?? {})) {
  if (process.env[key] === undefined || process.env[key] === "") process.env[key] = value;
}

const DEFAULT_FRONTEND_ORIGIN = "https://taskforageapp.netlify.app";

const clean = (value = "") => String(value).trim().replace(/^["']|["']$/g, "");

const nodeEnv = clean(process.env.NODE_ENV) || "development";

/** Parses "a, b" style origin lists. Tolerates trailing slashes and a pasted "CORS_ORIGIN=" prefix. */
export const parseOrigins = (raw = "") =>
  String(raw)
    .split(",")
    .map((item) => clean(item).replace(/^CORS_ORIGIN=/i, "").replace(/\/+$/, ""))
    .filter(Boolean);

const corsOrigins = parseOrigins(process.env.CORS_ORIGIN);

const env = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  isTest: nodeEnv === "test",
  port: Number(process.env.PORT) || 5000,
  mongoUri: clean(process.env.MONGO_URI),
  mongoDbName: clean(process.env.MONGO_DB_NAME) || "taskflow",
  jwtSecret: clean(process.env.JWT_SECRET),
  jwtExpiresIn: clean(process.env.JWT_EXPIRES_IN) || "7d",
  corsOrigins: corsOrigins.length ? corsOrigins : [DEFAULT_FRONTEND_ORIGIN],
  clientUrl: clean(process.env.CLIENT_URL) || (corsOrigins.find((o) => o !== "*") ?? DEFAULT_FRONTEND_ORIGIN),
  email: {
    user: clean(process.env.EMAIL_USER),
    pass: clean(process.env.EMAIL_PASS),
    from: clean(process.env.EMAIL_FROM),
    host: clean(process.env.EMAIL_HOST),
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: clean(process.env.EMAIL_SECURE) === "true",
    service: clean(process.env.EMAIL_SERVICE) || "gmail",
  },
  reminderIntervalMinutes: Math.max(1, Number(process.env.REMINDER_INTERVAL_MINUTES) || 15),
  cronSecret: clean(process.env.CRON_SECRET),
  authRateLimit: Number(process.env.AUTH_RATE_LIMIT) || 50,
};

/**
 * Throws when required configuration is missing, so a bad deploy fails loudly instead of half-working.
 * The message explains where the server looked and which variable NAMES it found; values are never printed.
 */
export const assertEnv = () => {
  const missing = [];
  if (!env.mongoUri) missing.push("MONGO_URI");
  if (!env.jwtSecret) missing.push("JWT_SECRET");
  if (missing.length) {
    const where = fileVariables === null
      ? `No .env file was found at ${ENV_FILE_PATH}. Create it (copy server/.env.example) or set the variables in the host's environment.`
      : `${ENV_FILE_PATH} was read (variables found: ${Object.keys(fileVariables).join(", ") || "none"}) but the values above are missing or empty.`;
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}. ${where}`);
  }
  if (env.isProduction && env.jwtSecret.length < 24) {
    throw new Error("JWT_SECRET must be at least 24 characters in production.");
  }
};

export default env;
