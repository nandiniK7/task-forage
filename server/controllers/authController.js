import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import User from "../models/User.js";
import Task from "../models/Task.js";
import Comment from "../models/Comment.js";
import ApiError from "../utils/ApiError.js";
import { removeFile } from "../utils/files.js";
import { passwordResetEmail } from "../services/notifications.js";
import {
  validateRegistration, validateLogin, validateForgotPassword, validateResetPassword, validateProfile, validatePasswordInto,
} from "../utils/validators.js";

const signToken = (userId) => jwt.sign({ id: String(userId) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

const HASH_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const hashResetToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export const registerUser = async (req, res) => {
  const { name, email, password } = validateRegistration(req.body);

  if (await User.exists({ email })) {
    throw ApiError.conflict("An account with this email already exists.");
  }

  const user = await User.create({ name, email, password: await bcrypt.hash(password, HASH_ROUNDS) });

  res.status(201).json({
    success: true,
    message: "Registration successful.",
    token: signToken(user._id),
    user,
  });
};

export const loginUser = async (req, res) => {
  const { email, password } = validateLogin(req.body);

  const user = await User.findOne({ email }).select("+password");
  const valid = user ? await bcrypt.compare(password, user.password) : false;
  if (!valid) throw ApiError.unauthorized("Invalid email or password.", { code: "BAD_CREDENTIALS" });

  res.json({ success: true, message: "Login successful.", token: signToken(user._id), user });
};

export const forgotPassword = async (req, res) => {
  const { email } = validateForgotPassword(req.body);
  const user = await User.findOne({ email });

  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordTokenHash = hashResetToken(token);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();
    const resetLink = `${env.clientUrl.replace(/\/+$/, "")}/reset-password/${token}`;
    passwordResetEmail({ user, resetLink });
  }

  // Same response whether or not the account exists, so this endpoint can't be used to find out who has one.
  res.json({ success: true, message: "If an account exists for that email, a reset link has been sent." });
};

export const resetPassword = async (req, res) => {
  const { token, password } = validateResetPassword(req.body);
  const user = await User.findOne({ resetPasswordTokenHash: hashResetToken(token), resetPasswordExpires: { $gt: new Date() } });

  if (!user) {
    throw ApiError.badRequest("This reset link is invalid or has expired.", { errors: { token: "This reset link is invalid or has expired." } });
  }

  user.password = await bcrypt.hash(password, HASH_ROUNDS);
  user.resetPasswordTokenHash = null;
  user.resetPasswordExpires = null;
  await user.save();

  res.json({ success: true, message: "Password updated. You're signed in.", token: signToken(user._id), user });
};

export const getCurrentUser = (req, res) => {
  res.json({ success: true, user: req.user });
};

export const updateProfile = async (req, res) => {
  const update = validateProfile(req.body);

  if (update.email && (await User.exists({ email: update.email, _id: { $ne: req.user._id } }))) {
    throw ApiError.conflict("That email is already in use.");
  }

  Object.assign(req.user, update);
  await req.user.save();

  res.json({ success: true, message: "Profile updated.", user: req.user });
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  const errors = {};
  if (!currentPassword) errors.currentPassword = "Current password is required.";
  validatePasswordInto(errors, "newPassword", typeof newPassword === "string" ? newPassword : "");
  if (Object.keys(errors).length) throw ApiError.badRequest(Object.values(errors)[0], { errors });

  const user = await User.findById(req.user._id).select("+password");
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    throw ApiError.badRequest("Current password is incorrect.", { errors: { currentPassword: "Current password is incorrect." } });
  }

  user.password = await bcrypt.hash(newPassword, HASH_ROUNDS);
  await user.save();
  res.json({ success: true, message: "Password changed." });
};

/** Deletes the account, the tasks it owns (with comments and files), and removes it from everyone else's tasks. */
export const deleteAccount = async (req, res) => {
  const password = req.body?.password;
  const user = await User.findById(req.user._id).select("+password");
  if (!password || !(await bcrypt.compare(String(password), user.password))) {
    throw ApiError.badRequest("Password is incorrect.", { errors: { password: "Password is incorrect." } });
  }

  const owned = await Task.find({ createdBy: user._id }).select("_id attachments.fileId");
  const ownedIds = owned.map((task) => task._id);
  await Promise.all(owned.flatMap((task) => task.attachments.map((file) => removeFile(file.fileId))));
  await Comment.deleteMany({ task: { $in: ownedIds } });
  await Task.deleteMany({ _id: { $in: ownedIds } });

  await Task.updateMany({ assignedTo: user._id }, { $pull: { assignedTo: user._id } });
  await Task.updateMany({ "sharedWith.user": user._id }, { $pull: { sharedWith: { user: user._id } } });
  await Comment.updateMany({ author: user._id }, { $set: { author: null } });
  await user.deleteOne();

  res.json({ success: true, message: "Account deleted." });
};
