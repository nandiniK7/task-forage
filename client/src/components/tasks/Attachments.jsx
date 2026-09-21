import { useRef, useState } from "react";
import { Download, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { tasksApi } from "../../api/services";
import { getErrorMessage } from "../../api/client";
import { useToast } from "../../hooks/hooks";
import { Alert, Button, IconButton } from "../ui/primitives";
import { ConfirmDialog } from "../ui/Modal";
import { ALLOWED_EXTENSIONS, MAX_FILE_BYTES } from "../../lib/constants";
import { formatBytes, formatDate, personName } from "../../lib/format";

const validateFile = (file) => {
  const extension = `.${file.name.split(".").pop().toLowerCase()}`;
  if (!ALLOWED_EXTENSIONS.includes(extension)) return `“${file.name}” is not an allowed file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
  if (file.size > MAX_FILE_BYTES) return `“${file.name}” is too large. The maximum file size is ${formatBytes(MAX_FILE_BYTES)}.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  return null;
};

export default function Attachments({ task, onTaskChange }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const canEdit = task.permissions.canEdit;

  const upload = async (event) => {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file) return;
    const problem = validateFile(file);
    if (problem) { setError(problem); return; }

    setError("");
    setProgress(0);
    try {
      const { task: updated, message } = await tasksApi.upload(task._id, file, setProgress);
      onTaskChange(updated);
      toast.success(message);
    } catch (err) {
      setError(getErrorMessage(err, "Upload failed."));
    } finally {
      setProgress(null);
    }
  };

  const download = async (attachment) => {
    setDownloadingId(attachment._id);
    try {
      const blob = await tasksApi.downloadAttachment(task._id, attachment._id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      toast.error(getErrorMessage(err, "Download failed."));
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const { task: updated, message } = await tasksApi.deleteAttachment(task._id, pendingDelete._id);
      onTaskChange(updated);
      toast.success(message);
      setPendingDelete(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not delete the attachment."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="card p-5" aria-labelledby="attachments-heading">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="attachments-heading" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Paperclip size={20} className="text-brand-600" aria-hidden="true" /> Attachments
          <span className="rounded-full bg-slate-100 px-2 text-sm font-medium text-slate-700">{task.attachments.length}</span>
        </h2>
        {canEdit && (
          <>
            <input ref={inputRef} type="file" className="hidden" accept={ALLOWED_EXTENSIONS.join(",")} onChange={upload} data-testid="file-input" aria-label="Choose a file to attach" />
            <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} loading={progress !== null}>
              <Upload size={14} /> {progress !== null ? `Uploading ${progress}%` : "Upload"}
            </Button>
          </>
        )}
      </div>

      {error && <Alert className="mb-3">{error}</Alert>}

      {task.attachments.length === 0 ? (
        <p className="text-sm text-slate-600">{canEdit ? "No files yet. Upload documents, images or spreadsheets (max 5 MB each)." : "No files attached."}</p>
      ) : (
        <ul className="divide-y divide-slate-100" data-testid="attachment-list">
          {task.attachments.map((file) => (
            <li key={file._id} className="flex items-center gap-3 py-2.5">
              <FileText size={20} className="shrink-0 text-slate-400" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900" title={file.filename}>{file.filename}</p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)} · {personName(file.uploadedBy)} · {formatDate(file.uploadedAt)}</p>
              </div>
              <IconButton label={`Download ${file.filename}`} onClick={() => download(file)} disabled={downloadingId === file._id}><Download size={16} /></IconButton>
              {canEdit && <IconButton label={`Delete ${file.filename}`} onClick={() => setPendingDelete(file)} className="hover:bg-red-50 hover:text-red-700"><Trash2 size={16} /></IconButton>}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog open={Boolean(pendingDelete)} title="Delete attachment?" message={pendingDelete ? `“${pendingDelete.filename}” will be permanently deleted.` : ""} loading={deleting} onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
    </section>
  );
}
