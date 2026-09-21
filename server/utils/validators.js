import mongoose from "mongoose";
import {
  CATEGORIES, PRIORITIES, STATUSES, PERMISSIONS, REMINDER_OPTIONS,
} from "../config/constants.js";
import ApiError from "./ApiError.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const isString = (value) => typeof value === "string";

/** Throws a 400 carrying per-field messages when any were collected. */
const failIfInvalid = (errors) => {
  const fields = Object.keys(errors);
  if (fields.length) throw ApiError.badRequest(errors[fields[0]], { errors });
};

export const normalizeEmail = (email) => (isString(email) ? email.trim().toLowerCase() : "");

export const validateRegistration = (body = {}) => {
  const errors = {};
  const name = isString(body.name) ? body.name.trim() : "";
  const email = normalizeEmail(body.email);
  const password = isString(body.password) ? body.password : "";

  if (name.length < 2) errors.name = "Name must be at least 2 characters.";
  else if (name.length > 80) errors.name = "Name must be 80 characters or fewer.";
  if (!email) errors.email = "Email is required.";
  else if (!EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address.";
  validatePasswordInto(errors, "password", password);

  failIfInvalid(errors);
  return { name, email, password };
};

export const validatePasswordInto = (errors, field, password) => {
  if (!password) errors[field] = "Password is required.";
  else if (password.length < 8) errors[field] = "Password must be at least 8 characters.";
  else if (password.length > 128) errors[field] = "Password must be 128 characters or fewer.";
};

export const validateLogin = (body = {}) => {
  const errors = {};
  const email = normalizeEmail(body.email);
  const password = isString(body.password) ? body.password : "";
  if (!email) errors.email = "Email is required.";
  if (!password) errors.password = "Password is required.";
  failIfInvalid(errors);
  return { email, password };
};

export const validateProfile = (body = {}) => {
  const errors = {};
  const update = {};

  if (body.name !== undefined) {
    const name = isString(body.name) ? body.name.trim() : "";
    if (name.length < 2 || name.length > 80) errors.name = "Name must be between 2 and 80 characters.";
    else update.name = name;
  }
  if (body.email !== undefined) {
    const email = normalizeEmail(body.email);
    if (!EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address.";
    else update.email = email;
  }
  if (body.emailNotifications !== undefined) {
    if (typeof body.emailNotifications !== "boolean") errors.emailNotifications = "emailNotifications must be true or false.";
    else update.emailNotifications = body.emailNotifications;
  }

  failIfInvalid(errors);
  if (!Object.keys(update).length) throw ApiError.badRequest("Nothing to update.");
  return update;
};

/**
 * Validates and normalises task fields. With `partial` (updates) only supplied fields are checked.
 * `assignedTo` is returned as an ObjectId string, or null for "unassigned"; existence is checked by the controller.
 */
export const validateTaskInput = (body = {}, { partial = false } = {}) => {
  const errors = {};
  const data = {};
  const has = (key) => body[key] !== undefined;

  if (!partial || has("title")) {
    const title = isString(body.title) ? body.title.trim() : "";
    if (!title) errors.title = "Title is required.";
    else if (title.length > 150) errors.title = "Title must be 150 characters or fewer.";
    else data.title = title;
  }

  if (has("description")) {
    const description = body.description == null ? "" : body.description;
    if (!isString(description)) errors.description = "Description must be text.";
    else if (description.trim().length > 5000) errors.description = "Description must be 5000 characters or fewer.";
    else data.description = description.trim();
  }

  const enums = [["category", CATEGORIES], ["priority", PRIORITIES], ["status", STATUSES]];
  for (const [key, allowed] of enums) {
    if (has(key)) {
      if (!allowed.includes(body[key])) errors[key] = `${key[0].toUpperCase()}${key.slice(1)} must be one of: ${allowed.join(", ")}.`;
      else data[key] = body[key];
    }
  }

  if (has("deadline")) {
    if (body.deadline === null || body.deadline === "") data.deadline = null;
    else {
      const date = new Date(body.deadline);
      if (Number.isNaN(date.getTime())) errors.deadline = "Deadline is not a valid date.";
      else if (date.getFullYear() < 2000 || date.getFullYear() > 2100) errors.deadline = "Deadline must be between the years 2000 and 2100.";
      else data.deadline = date;
    }
  }

  if (has("reminderBefore")) {
    const hours = Number(body.reminderBefore);
    if (!REMINDER_OPTIONS.includes(hours)) errors.reminderBefore = `Reminder must be one of: ${REMINDER_OPTIONS.join(", ")} hours (0 = none).`;
    else data.reminderBefore = hours;
  }

  if (has("assignedTo")) {
    if (body.assignedTo === null || body.assignedTo === "") data.assignedTo = null;
    else if (!isString(body.assignedTo) || !mongoose.isValidObjectId(body.assignedTo) || body.assignedTo.length !== 24) {
      errors.assignedTo = "Assigned user is not valid.";
    } else data.assignedTo = body.assignedTo;
  }

  failIfInvalid(errors);
  return data;
};

export const validateComment = (body = {}) => {
  const text = isString(body.text) ? body.text.trim() : "";
  if (!text) throw ApiError.badRequest("Comment cannot be empty.", { errors: { text: "Comment cannot be empty." } });
  if (text.length > 2000) throw ApiError.badRequest("Comment must be 2000 characters or fewer.", { errors: { text: "Comment must be 2000 characters or fewer." } });
  return text;
};

export const validateShare = (body = {}) => {
  const errors = {};
  const permission = body.permission ?? "view";
  if (!PERMISSIONS.includes(permission)) errors.permission = "Permission must be 'view' or 'edit'.";
  const userId = isString(body.userId) ? body.userId : "";
  const email = normalizeEmail(body.email);
  if (userId) {
    if (!mongoose.isValidObjectId(userId) || userId.length !== 24) errors.userId = "User is not valid.";
  } else if (!email) {
    errors.userId = "Choose a user to share with.";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  failIfInvalid(errors);
  return { permission, userId: userId || null, email: email || null };
};
