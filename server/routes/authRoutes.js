import express from "express";
import {
  registerUser, loginUser, forgotPassword, resetPassword, getCurrentUser, updateProfile, changePassword, deleteAccount,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/register", authLimiter, registerUser);
router.post("/login", authLimiter, loginUser);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.get("/me", authMiddleware, getCurrentUser);
router.put("/profile", authMiddleware, updateProfile);
router.put("/password", authMiddleware, changePassword);
router.delete("/account", authMiddleware, deleteAccount);

export default router;
