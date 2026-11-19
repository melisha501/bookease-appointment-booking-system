// Small API client for talking to the Express backend.
// - Uses VITE_API_BASE when set, the known production API on Vercel, or the
//   Vite dev proxy (/api) locally.
// - Attaches JWT from localStorage when present.
// - Notifies the auth context on 401 so the UI no longer shows a stale session.

// Vercel rewrites every path (including /api/*) to index.html. A deployed
// frontend without VITE_API_BASE would therefore receive HTML instead of JSON.
const PRODUCTION_API_BASE = "https://bookease-appointment-booking-system.onrender.com/api";

function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE;
  if (configured) return String(configured).replace(/\/+$/, "");
  if (import.meta.env.PROD && typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return "/api";
    if (host.endsWith(".vercel.app")) return PRODUCTION_API_BASE;
  }
  return "/api";
}

const API_BASE = resolveApiBase();
const TOKEN_KEY = "bookease_token";

let unauthorizedHandler = null;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === "function" ? handler : null;
}

function notifyUnauthorized() {
  if (unauthorizedHandler) unauthorizedHandler();
}

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

// Default request budget. Render free instances can take a while to wake up,
// so keep this generous but bounded. Individual calls can override both the
// timeout and the retry count (auth calls use a longer timeout, catalogs use
// fewer retries so a cold start cannot stall the first paint for a minute).
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_RETRIES = 1;
const BASE_RETRY_DELAY_MS = 600;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isIdempotentMethod(method) {
  const verb = String(method || "GET").toUpperCase();
  return verb === "GET" || verb === "HEAD";
}

function isRetryableError(error) {
  if (!error || error.aborted) return false;
  const status = Number(error.status);
  if (status === 0 || status === 408 || status === 429) return true;
  return status >= 500 && status <= 599;
}

async function readResponseBody(res) {
  // 204/205 have no body and are valid empty responses.
  if (res.status === 204 || res.status === 205) {
    return { data: null, isJson: true, raw: "" };
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json") || contentType.includes("+json")) {
    const text = await res.text();
    if (!text) return { data: null, isJson: true, raw: "" };
    try {
      return { data: JSON.parse(text), isJson: true, raw: text };
    } catch {
      return { data: null, isJson: false, raw: text };
    }
  }

  const text = await res.text().catch(() => "");
  return { data: text || null, isJson: false, raw: text };
}

async function performRequest(url, fetchOptions, headers, timeout) {
  const controller = new AbortController();
  const externalSignal = fetchOptions.signal;
  let timedOut = false;
  let timer = null;

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }
  if (timeout > 0) {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeout);
  }

  let res;
  let body;
  try {
    try {
      res = await fetch(url, { ...fetchOptions, headers, signal: controller.signal });
      body = await readResponseBody(res);
    } catch (err) {
      if (externalSignal?.aborted) {
        const error = new Error("Request was cancelled.");
        error.name = "AbortError";
        error.aborted = true;
        error.status = 0;
        throw error;
      }
      if (timedOut) {
        const error = new Error(
          `The server took too long to respond (${Math.round(timeout / 1000)}s). It may be starting up — please try again.`
        );
        error.status = 0;
        error.code = "TIMEOUT";
        error.cause = err;
        throw error;
      }
      const error = new Error(
        "Cannot reach the server. Please make sure the backend API is running (port 5000) and try again."
      );
      error.cause = err;
      error.status = 0;
      throw error;
    }
  } finally {
    if (timer) clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
  }

  const data = body.data;

  if (res.status === 401) {
    clearToken();
    notifyUnauthorized();
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

  // A successful status with an HTML/text body almost always means the API
  // base URL is wrong (e.g. pointing at a static site/proxy), not empty data.
  if (!body.isJson) {
    const error = new Error(
      "The API returned an unexpected response instead of JSON. Check that VITE_API_BASE points to the backend API URL (it must include /api)."
    );
    error.status = res.status;
    error.code = "INVALID_RESPONSE";
    error.data = data;
    throw error;
  }

  return data;
}

export async function apiRequest(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const {
    timeout = DEFAULT_TIMEOUT_MS,
    retries,
    retryDelay = BASE_RETRY_DELAY_MS,
    ...fetchOptions
  } = options;

  const headers = {
    ...(fetchOptions.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(fetchOptions.headers || {}),
  };

  const method = fetchOptions.method || "GET";
  const maxRetries =
    Number.isInteger(retries) && retries >= 0
      ? retries
      : isIdempotentMethod(method)
        ? DEFAULT_RETRIES
        : 0;

  for (let attempt = 0; ; attempt += 1) {
    // Re-read the token each attempt so a login during a retry is respected.
    const token = getToken();
    const attemptHeaders = { ...headers };
    if (token) attemptHeaders.Authorization = `Bearer ${token}`;

    try {
      return await performRequest(url, fetchOptions, attemptHeaders, timeout);
    } catch (error) {
      const canRetry =
        attempt < maxRetries &&
        isRetryableError(error) &&
        !fetchOptions.signal?.aborted;
      if (!canRetry) throw error;

      const backoff = retryDelay * 2 ** attempt + Math.random() * 250;
      await delay(backoff);
    }
  }
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
        notifyUnauthorized();
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
  get: (path, options) => apiRequest(path, options),
  post: (path, body, options) =>
    apiRequest(path, { ...options, method: "POST", body: JSON.stringify(body) }),
  postForm: (path, formData, options) =>
    apiRequest(path, { ...options, method: "POST", body: formData }),
  postFormWithProgress,
  put: (path, body, options) =>
    apiRequest(path, { ...options, method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body, options) =>
    apiRequest(path, { ...options, method: "PATCH", body: JSON.stringify(body) }),
  del: (path, options) => apiRequest(path, { ...options, method: "DELETE" }),
};
