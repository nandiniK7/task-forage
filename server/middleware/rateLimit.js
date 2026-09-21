import { rateLimit } from "express-rate-limit";
import env from "../config/env.js";

const limiter = (limit, message) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => env.isTest,
    message: { success: false, message },
  });

export const authLimiter = limiter(env.authRateLimit, "Too many attempts. Please wait a few minutes and try again.");
export const apiLimiter = limiter(1000, "Too many requests. Please slow down.");
