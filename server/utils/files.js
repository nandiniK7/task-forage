import mongoose from "mongoose";
import path from "path";
import { ALLOWED_FILE_TYPES } from "../config/constants.js";

const getBucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "attachments" });

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

export const contentTypeFor = (filename) => ALLOWED_FILE_TYPES[path.extname(filename).toLowerCase()] ?? null;

export const sanitizeFilename = (name = "file") =>
  path.basename(String(name)).replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 200) || "file";

export const saveFile = (buffer, filename, contentType) =>
  new Promise((resolve, reject) => {
    const stream = getBucket().openUploadStream(filename, { metadata: { contentType } });
    stream.once("error", reject);
    stream.once("finish", () => resolve(stream.id));
    stream.end(buffer);
  });

export const openFile = (fileId) => getBucket().openDownloadStream(toObjectId(fileId));

/** Best-effort removal; a missing chunk must never block deleting the task or attachment. */
export const removeFile = async (fileId) => {
  try {
    await getBucket().delete(toObjectId(fileId));
  } catch (error) {
    if (!/FileNotFound/i.test(error.message)) console.error("Could not remove stored file:", error.message);
  }
};
