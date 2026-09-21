import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";

/** Rejects malformed ObjectIds in route params with a 400 instead of a database CastError. */
const validateId = (...params) => (req, _res, next) => {
  for (const name of params) {
    if (!mongoose.isValidObjectId(req.params[name]) || String(req.params[name]).length !== 24) {
      throw ApiError.badRequest(`Invalid ${name === "id" ? "task" : name.replace(/Id$/, "")} id.`);
    }
  }
  next();
};

export default validateId;
