import multer from "multer";
import env from "../config/env.js";
import { MAX_ATTACHMENT_BYTES } from "../config/constants.js";
import ApiError from "../utils/ApiError.js";

export const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
};

/** Translates any thrown error into a consistent JSON response. Never leaks stack traces. */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  let status = 500;
  let message = "Something went wrong on the server.";
  let extra = {};

  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
    extra = { ...(err.errors && { errors: err.errors }), ...(err.code && { code: err.code }) };
  } else if (err instanceof multer.MulterError) {
    status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    message = err.code === "LIMIT_FILE_SIZE"
      ? `File is too large. The maximum size is ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`
      : `Upload error: ${err.message}`;
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Request body contains invalid JSON.";
  } else if (err.type === "entity.too.large") {
    status = 413;
    message = "Request body is too large.";
  } else if (err.name === "ValidationError" && err.errors) {
    status = 400;
    const errors = Object.fromEntries(Object.entries(err.errors).map(([field, e]) => [field, e.message]));
    message = Object.values(errors)[0] || "Validation failed.";
    extra = { errors };
  } else if (err.name === "CastError") {
    status = 400;
    message = `Invalid value for ${err.path}.`;
  } else if (err.code === 11000) {
    status = 409;
    message = "A record with that value already exists.";
  } else if (["MongoNetworkError", "MongoServerSelectionError", "MongooseServerSelectionError"].includes(err.name)) {
    status = 503;
    message = "The database is temporarily unavailable. Please try again shortly.";
  }

  if (status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, err);

  res.status(status).json({
    success: false,
    message,
    ...extra,
    ...(!env.isProduction && status >= 500 && { detail: err.message }),
  });
};
