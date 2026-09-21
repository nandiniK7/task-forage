import multer from "multer";
import { MAX_ATTACHMENT_BYTES } from "../config/constants.js";
import { contentTypeFor } from "../utils/files.js";
import ApiError from "../utils/ApiError.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
  fileFilter(_req, file, callback) {
    if (!contentTypeFor(file.originalname)) {
      return callback(ApiError.badRequest("This file type is not allowed. Upload a PDF, image, Office document, text, CSV or ZIP file."));
    }
    callback(null, true);
  },
});

export default upload;
