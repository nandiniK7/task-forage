import mongoose from "mongoose";
import Comment from "../models/Comment.js";
import { PRIORITY_RANK, DEFAULT_REMINDER_HOURS } from "../config/constants.js";
import { contentTypeFor, saveFile } from "../utils/files.js";

const isDuplicateKey = (error) => error?.code === 11000 || error?.writeErrors?.every?.((e) => e.code === 11000);

/**
 * One-time, idempotent upgrade of documents written by the first version of the app:
 *  - category "Project" -> "Projects"
 *  - embedded `comments` -> the Comment collection
 *  - base64 attachments embedded in the task -> GridFS + metadata
 *  - fields added later (priorityRank, reminderBefore) filled in for old tasks
 * Every step can be re-run safely, and a failure is logged without stopping the server.
 */
export const migrateLegacyData = async () => {
  try {
    const tasks = mongoose.connection.collection("tasks");

    await tasks.updateMany({ category: "Project" }, { $set: { category: "Projects" } });
    await tasks.updateMany({ reminderBefore: { $exists: false } }, { $set: { reminderBefore: DEFAULT_REMINDER_HOURS } });
    for (const [priority, rank] of Object.entries(PRIORITY_RANK)) {
      await tasks.updateMany({ priority, priorityRank: { $ne: rank } }, { $set: { priorityRank: rank } });
    }

    let movedComments = 0;
    for await (const task of tasks.find({ "comments.0": { $exists: true } })) {
      const docs = task.comments
        .filter((comment) => comment?.text)
        .map((comment) => ({
          _id: comment._id ?? new mongoose.Types.ObjectId(),
          task: task._id,
          author: comment.user ?? null,
          parent: comment.parentId ?? null,
          text: comment.text,
          editedAt: comment.updatedAt && comment.createdAt && +new Date(comment.updatedAt) - +new Date(comment.createdAt) > 1000 ? comment.updatedAt : null,
          createdAt: comment.createdAt ?? new Date(),
          updatedAt: comment.updatedAt ?? comment.createdAt ?? new Date(),
        }));
      if (docs.length) {
        try {
          await Comment.collection.insertMany(docs, { ordered: false });
        } catch (error) {
          if (!isDuplicateKey(error)) throw error;
        }
      }
      await tasks.updateOne({ _id: task._id }, { $unset: { comments: "" } });
      movedComments += docs.length;
    }

    let movedFiles = 0;
    for await (const task of tasks.find({ attachments: { $elemMatch: { fileId: { $exists: false } } } })) {
      const upgraded = [];
      for (const item of task.attachments) {
        if (item?.fileId) {
          upgraded.push(item);
        } else if (item && typeof item === "object" && typeof item.data === "string" && item.data) {
          const buffer = Buffer.from(item.data.replace(/^data:[^;]*;base64,/, ""), "base64");
          const filename = String(item.name || "attachment");
          const contentType = contentTypeFor(filename) ?? item.type ?? "application/octet-stream";
          upgraded.push({
            _id: item._id ?? new mongoose.Types.ObjectId(),
            filename,
            contentType,
            size: buffer.length,
            fileId: await saveFile(buffer, filename, contentType),
            uploadedBy: item.uploadedBy ?? null,
            uploadedAt: item.createdAt ?? new Date(),
          });
          movedFiles += 1;
        }
        // Old string-only placeholders carried no file and are dropped.
      }
      await tasks.updateOne({ _id: task._id }, { $set: { attachments: upgraded } });
    }

    if (movedComments || movedFiles) {
      console.log(`Legacy data migrated: ${movedComments} comment(s), ${movedFiles} attachment(s).`);
    }
  } catch (error) {
    console.error("Legacy data migration failed (continuing):", error.message);
  }
};
