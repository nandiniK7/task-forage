import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import validateId from "../middleware/validateId.js";
import upload from "../middleware/upload.js";
import {
  listTasks, getTaskStats, getTask, createTask, updateTask, deleteTask,
} from "../controllers/taskController.js";
import {
  listComments, addComment, updateComment, deleteComment,
} from "../controllers/commentController.js";
import { shareTask, removeShare } from "../controllers/shareController.js";
import { uploadAttachment, downloadAttachment, deleteAttachment } from "../controllers/attachmentController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", listTasks);
router.post("/", createTask);
router.get("/stats", getTaskStats);

router.get("/:id", validateId("id"), getTask);
router.put("/:id", validateId("id"), updateTask);
router.patch("/:id", validateId("id"), updateTask);
router.delete("/:id", validateId("id"), deleteTask);

router.get("/:id/comments", validateId("id"), listComments);
router.post("/:id/comments", validateId("id"), addComment);
router.put("/:id/comments/:commentId", validateId("id", "commentId"), updateComment);
router.patch("/:id/comments/:commentId", validateId("id", "commentId"), updateComment);
router.delete("/:id/comments/:commentId", validateId("id", "commentId"), deleteComment);

router.post("/:id/share", validateId("id"), shareTask);
router.delete("/:id/share/:userId", validateId("id", "userId"), removeShare);

router.post("/:id/attachments", validateId("id"), upload.single("file"), uploadAttachment);
router.get("/:id/attachments/:attachmentId/download", validateId("id", "attachmentId"), downloadAttachment);
router.delete("/:id/attachments/:attachmentId", validateId("id", "attachmentId"), deleteAttachment);

export default router;
