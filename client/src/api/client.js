import axios from "axios";

const TOKEN_KEY = "taskforage.token";

// The deployed API. VITE_API_URL always wins; this is only the last-resort default for production
// builds, so a missing variable can never make a deployed site call localhost.
const PRODUCTION_API_URL = "https://taskflow-3-b4t9.onrender.com/api";
const DEV_API_URL = "http://localhost:5000/api";

const resolveBaseUrl = () => {
  const configured = String(import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  return import.meta.env.DEV ? DEV_API_URL : PRODUCTION_API_URL;
};

export const API_BASE_URL = resolveBaseUrl();

export const tokenStore = {
  get() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable (private mode) */ }
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
  },
};

export const AUTH_EXPIRED_EVENT = "taskforage:auth-expired";

const api = axios.create({
  baseURL: API_BASE_URL,
  // Render's free tier can take up to a minute to wake up after being idle.
  timeout: 60_000,
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const isCredentialRequest = (url = "") => /\/auth\/(login|register)$/.test(url);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const hadToken = Boolean(error.config?.headers?.Authorization);
    // A 401 on a request that carried a token means the session is no longer valid.
    // (A 401 from the login form just means "wrong password" and must not log anyone out.)
    if (error.response?.status === 401 && hadToken && !isCredentialRequest(error.config?.url)) {
      tokenStore.clear();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

export const isCancelled = (error) => axios.isCancel(error) || error?.code === "ERR_CANCELED";

/** Turns any failure into a message that is safe and useful to show the user. */
export const getErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  if (error?.response) {
    const { data, status } = error.response;
    if (data?.message) return data.message;
    if (status === 413) return "That file is too large.";
    if (status >= 500) return "The server ran into a problem. Please try again in a moment.";
    return fallback;
  }
  if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
    return "The server took too long to respond. It may be waking up, so please try again in a few seconds.";
  }
  if (error?.request || error?.code === "ERR_NETWORK") {
    return "Cannot reach the server. Check your internet connection and try again.";
  }
  return error?.message || fallback;
};

/** Field-level validation messages from the API, e.g. { title: "Title is required." }. */
export const getFieldErrors = (error) => error?.response?.data?.errors ?? {};

export default api;
