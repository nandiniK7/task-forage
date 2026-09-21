import ApiError from "../utils/ApiError.js";
import { MAX_ATTACHMENTS_PER_TASK } from "../config/constants.js";
import {
  contentTypeFor, openFile, removeFile, sanitizeFilename, saveFile,
} from "../utils/files.js";
import { loadTask, presentTask } from "../services/taskService.js";

export const uploadAttachment = async (req, res) => {
  const { task } = await loadTask(req.params.id, req.user, "edit");
  if (!req.file) throw ApiError.badRequest("Choose a file to upload.");
  if (task.attachments.length >= MAX_ATTACHMENTS_PER_TASK) {
    throw ApiError.badRequest(`A task can have at most ${MAX_ATTACHMENTS_PER_TASK} attachments.`);
  }

  const filename = sanitizeFilename(req.file.originalname);
  const contentType = contentTypeFor(filename);
  if (!contentType) throw ApiError.badRequest("This file type is not allowed.");

  const fileId = await saveFile(req.file.buffer, filename, contentType);
  try {
    task.attachments.push({ filename, contentType, size: req.file.size, fileId, uploadedBy: req.user._id });
    await task.save();
  } catch (error) {
    await removeFile(fileId);
    throw error;
  }

  const { dto } = await presentTask(task._id, req.user._id);
  res.status(201).json({ success: true, message: "Attachment uploaded.", task: dto });
};

export const downloadAttachment = async (req, res) => {
  const { task } = await loadTask(req.params.id, req.user, "view");
  const attachment = task.attachments.id(req.params.attachmentId);
  if (!attachment) throw ApiError.notFound("Attachment not found.");

  const asciiName = attachment.filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  res.set({
    "Content-Type": attachment.contentType,
    "Content-Length": String(attachment.size),
    "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
    "Cache-Control": "private, no-store",
  });

  const stream = openFile(attachment.fileId);
  stream.once("error", () => {
    if (res.headersSent) return res.destroy();
    res.removeHeader("Content-Length");
    res.removeHeader("Content-Disposition");
    res.status(404).json({ success: false, message: "The stored file could not be found." });
  });
  stream.pipe(res);
};

export const deleteAttachment = async (req, res) => {
  const { task } = await loadTask(req.params.id, req.user, "edit");
  const attachment = task.attachments.id(req.params.attachmentId);
  if (!attachment) throw ApiError.notFound("Attachment not found.");

  const { fileId } = attachment;
  attachment.deleteOne();
  await task.save();
  await removeFile(fileId);

  const { dto } = await presentTask(task._id, req.user._id);
  res.json({ success: true, message: "Attachment deleted.", task: dto });
};
