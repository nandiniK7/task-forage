import mongoose from "mongoose";
import {
  CATEGORIES, PRIORITIES, STATUSES, PERMISSIONS, PRIORITY_RANK, DEFAULT_REMINDER_HOURS,
} from "../config/constants.js";

const { ObjectId } = mongoose.Schema.Types;

const shareSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    permission: { type: String, enum: PERMISSIONS, default: "view" },
    sharedBy: { type: ObjectId, ref: "User", default: null },
    sharedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Only metadata lives on the task; the file bytes are stored in GridFS (see utils/files.js).
const attachmentSchema = new mongoose.Schema({
  filename: { type: String, required: true, maxlength: 255 },
  contentType: { type: String, required: true },
  size: { type: Number, required: true, min: 0 },
  fileId: { type: ObjectId, required: true },
  uploadedBy: { type: ObjectId, ref: "User", default: null },
  uploadedAt: { type: Date, default: Date.now },
});

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, default: "", trim: true, maxlength: 5000 },
    category: { type: String, enum: CATEGORIES, default: "Work" },
    priority: { type: String, enum: PRIORITIES, default: "Medium" },
    priorityRank: { type: Number, default: PRIORITY_RANK.Medium },
    status: { type: String, enum: STATUSES, default: "Pending" },
    deadline: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    reminderBefore: { type: Number, default: DEFAULT_REMINDER_HOURS, min: 0 },
    reminderSentAt: { type: Date, default: null },
    createdBy: { type: ObjectId, ref: "User", required: true },
    assignedTo: { type: ObjectId, ref: "User", default: null },
    assignedBy: { type: ObjectId, ref: "User", default: null },
    sharedWith: { type: [shareSchema], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
  },
  { timestamps: true }
);

taskSchema.index({ createdBy: 1, createdAt: -1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ "sharedWith.user": 1 });
taskSchema.index({ deadline: 1, status: 1 });

taskSchema.pre("validate", function keepDerivedFields() {
  this.priorityRank = PRIORITY_RANK[this.priority] ?? PRIORITY_RANK.Medium;
  if (this.isModified("status")) {
    this.completedAt = this.status === "Completed" ? new Date() : null;
  }
});

export default mongoose.model("Task", taskSchema);
