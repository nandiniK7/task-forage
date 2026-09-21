import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";

/**
 * Verifies the Bearer token and loads the user from the database, so the identity
 * always comes from the verified token (never from the request body) and a deleted
 * account can no longer use an old token.
 */
const authMiddleware = async (req, _res, next) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Access denied. No token provided.", { code: "NO_TOKEN" });
  }

  let payload;
  try {
    payload = jwt.verify(header.slice(7), env.jwtSecret);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw ApiError.unauthorized("Your session has expired. Please sign in again.", { code: "TOKEN_EXPIRED" });
    }
    throw ApiError.unauthorized("Invalid token. Please sign in again.", { code: "TOKEN_INVALID" });
  }

  if (!mongoose.isValidObjectId(payload.id)) {
    throw ApiError.unauthorized("Invalid token. Please sign in again.", { code: "TOKEN_INVALID" });
  }

  const user = await User.findById(payload.id);
  if (!user) {
    throw ApiError.unauthorized("This account no longer exists.", { code: "USER_GONE" });
  }

  req.user = user;
  next();
};

export default authMiddleware;
