// Small API client for talking to the Express backend.
// - Uses Vite dev proxy (/api) by default, or VITE_API_BASE if set.
// - Attaches JWT from localStorage when present.
// - Handles 401 (expired/invalid token) by clearing auth and redirecting to /login.

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const TOKEN_KEY = "bookease_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

export function clearToken() {
  setToken(null);
}

export async function apiRequest(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const token = getToken();

  const headers = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    const error = new Error("Cannot reach the server. Please make sure the backend API is running (port 5000) and try again.");
    error.cause = err;
    error.status = 0;
    throw error;
  }

  let data = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    data = await res.text().catch(() => null);
  }

  if (res.status === 401) {
    clearToken();
    // Avoid redirect loops; let auth-aware UI react. For protected flows, navigate on catch.
    const error = new Error((data && data.message) || "Session expired. Please log in again.");
    error.status = 401;
    error.data = data;
    throw error;
  }

  if (!res.ok) {
    let message = (data && data.message) || `Request failed (${res.status})`;
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      message =
        (data && data.message) ||
        "The backend service is unavailable. Start the backend server, verify PostgreSQL is running, and check /api/health.";
    }
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

// Upload a FormData payload with real browser upload progress.
// Uses XMLHttpRequest because fetch() does not expose upload progress.
export function postFormWithProgress(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };

    xhr.onload = () => {
      let data = null;
      const contentType = xhr.getResponseHeader("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = null;
        }
      } else {
        data = xhr.responseText || null;
      }

      if (xhr.status === 401) {
        clearToken();
        const error = new Error((data && data.message) || "Session expired. Please log in again.");
        error.status = 401;
        error.data = data;
        reject(error);
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        let message = (data && data.message) || `Request failed (${xhr.status})`;
        if ([502, 503, 504].includes(xhr.status)) {
          message =
            (data && data.message) ||
            "The backend service is unavailable. Start the backend server, verify PostgreSQL is running, and check /api/health.";
        }
        const error = new Error(message);
        error.status = xhr.status;
        error.data = data;
        reject(error);
        return;
      }

      resolve(data);
    };

    xhr.onerror = () => {
      const error = new Error(
        "Cannot reach the server. Please make sure the backend API is running (port 5000) and try again."
      );
      error.status = 0;
      reject(error);
    };

    xhr.ontimeout = () => {
      const error = new Error("The upload timed out. Please check your connection and try again.");
      error.status = 0;
      reject(error);
    };

    xhr.send(formData);
  });
}

export const api = {
  get: (path) => apiRequest(path),
  post: (path, body) => apiRequest(path, { method: "POST", body: JSON.stringify(body) }),
  postForm: (path, formData) => apiRequest(path, { method: "POST", body: formData }),
  postFormWithProgress,
  put: (path, body) => apiRequest(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body) => apiRequest(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: (path) => apiRequest(path, { method: "DELETE" }),
};
