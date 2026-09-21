import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const commentSchema = new mongoose.Schema(
  {
    task: { type: ObjectId, ref: "Task", required: true, index: true },
    author: { type: ObjectId, ref: "User", default: null },
    parent: { type: ObjectId, ref: "Comment", default: null },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Comment", commentSchema);
