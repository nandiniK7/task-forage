import env from "./env.js";

const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
];

const warned = new Set();

/**
 * Builds the options for the `cors` middleware.
 *
 * - The API authenticates with a Bearer token (no cookies), so credentials are never enabled.
 *   That keeps CORS_ORIGIN="*" valid: a wildcard origin must not be combined with credentials.
 * - Origins that are not allowed simply receive no CORS headers (the browser blocks them);
 *   we never throw, because an error here would turn a preflight into a header-less 500.
 * - Requests without an Origin header (curl, health checks, server-to-server) are allowed.
 */
export const buildCorsOptions = (origins = env.corsOrigins, { isProduction = env.isProduction } = {}) => {
  const wildcard = origins.includes("*");
  const allowed = new Set(origins.filter((origin) => origin !== "*"));
  if (!isProduction) DEV_ORIGINS.forEach((origin) => allowed.add(origin));

  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (wildcard) return callback(null, "*");
      if (allowed.has(origin)) return callback(null, origin);
      if (!warned.has(origin)) {
        warned.add(origin);
        console.warn(`[cors] Blocked origin: ${origin}. Add it to CORS_ORIGIN to allow it.`);
      }
      return callback(null, false);
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    exposedHeaders: ["Content-Disposition"],
    credentials: false,
    maxAge: 86400,
    optionsSuccessStatus: 204,
  };
};
