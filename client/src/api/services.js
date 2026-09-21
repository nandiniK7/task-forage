import api from "./client";

const data = (response) => response.data;

export const authApi = {
  register: (payload) => api.post("/auth/register", payload).then(data),
  login: (payload) => api.post("/auth/login", payload).then(data),
  me: (signal) => api.get("/auth/me", { signal }).then(data),
  updateProfile: (payload) => api.put("/auth/profile", payload).then(data),
  changePassword: (payload) => api.put("/auth/password", payload).then(data),
  deleteAccount: (password) => api.delete("/auth/account", { data: { password } }).then(data),
};

const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "" && value !== "All"));

export const tasksApi = {
  list: (params, signal) => api.get("/tasks", { params: clean(params), signal }).then(data),
  stats: (signal) => api.get("/tasks/stats", { signal }).then(data),
  get: (id, signal) => api.get(`/tasks/${id}`, { signal }).then(data),
  create: (payload) => api.post("/tasks", payload).then(data),
  update: (id, payload) => api.put(`/tasks/${id}`, payload).then(data),
  remove: (id) => api.delete(`/tasks/${id}`).then(data),

  share: (id, payload) => api.post(`/tasks/${id}/share`, payload).then(data),
  unshare: (id, userId) => api.delete(`/tasks/${id}/share/${userId}`).then(data),

  comments: (id, signal) => api.get(`/tasks/${id}/comments`, { signal }).then(data),
  addComment: (id, payload) => api.post(`/tasks/${id}/comments`, payload).then(data),
  updateComment: (id, commentId, text) => api.put(`/tasks/${id}/comments/${commentId}`, { text }).then(data),
  deleteComment: (id, commentId) => api.delete(`/tasks/${id}/comments/${commentId}`).then(data),

  upload: (id, file, onProgress) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post(`/tasks/${id}/attachments`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => onProgress?.(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
      })
      .then(data);
  },
  downloadAttachment: (id, attachmentId) =>
    api
      .get(`/tasks/${id}/attachments/${attachmentId}/download`, { responseType: "blob" })
      .then((response) => response.data)
      .catch(async (error) => {
        // Error bodies arrive as a Blob when responseType is "blob"; decode them so the message can be shown.
        if (error.response?.data instanceof Blob) {
          try { error.response.data = JSON.parse(await error.response.data.text()); } catch { /* not JSON */ }
        }
        throw error;
      }),
  deleteAttachment: (id, attachmentId) => api.delete(`/tasks/${id}/attachments/${attachmentId}`).then(data),
};

export const usersApi = {
  list: (search, signal, limit) => api.get("/users", { params: clean({ search, limit }), signal }).then(data),
};
