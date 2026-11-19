// Shared app state.
// - Auth is connected to the real backend API (JWT in localStorage for session persistence only).
// - Catalog data (categories, services, specialists, schedules) is fetched from the backend.
// - Appointments/admin data will be fetched from backend APIs as those endpoints are integrated.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, clearToken, getToken, setToken, setUnauthorizedHandler } from "../api/client";
import { canCancelAppointment, DemoContext } from "./DemoContext";

// Stable empty list so the context value memo isn't invalidated on every render.
const TESTIMONIALS = [];

const ALL_CATEGORY = { id: "all", name: "All" };
const CATALOG_CACHE_KEY = "bookease_catalog_cache_v1";
const CATALOG_STALE_MS = 5 * 60 * 1000;
const CATALOG_RETRY_ON_VISIBLE_MS = 30 * 1000;

function schedulesArrayToMap(specialists) {
  const map = {};
  for (const s of Array.isArray(specialists) ? specialists : []) {
    if (s.schedule) map[s.id] = s.schedule;
  }
  return map;
}

// Last known good catalog is cached so a browser refresh or a slow cold start
// never flashes an empty site. It is refreshed from the API on every load.
function readCatalogCache() {
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const categories = Array.isArray(parsed.categories) ? parsed.categories : [];
    const services = Array.isArray(parsed.services) ? parsed.services : [];
    const specialists = Array.isArray(parsed.specialists) ? parsed.specialists : [];
    if (!categories.length && !services.length && !specialists.length) return null;
    return {
      categories: categories.length ? categories : [ALL_CATEGORY],
      services,
      specialists,
      savedAt: Number(parsed.savedAt) || 0,
    };
  } catch {
    return null;
  }
}

function writeCatalogCache(catalog) {
  try {
    localStorage.setItem(
      CATALOG_CACHE_KEY,
      JSON.stringify({
        categories: catalog.categories,
        services: catalog.services,
        specialists: catalog.specialists,
        savedAt: catalog.savedAt,
      })
    );
  } catch {
    // Cache is best-effort; storage may be full or disabled.
  }
}

// Treat a missing/incorrect list shape as an error instead of silently
// rendering an empty catalog (which previously hid API/proxy problems).
function readCatalogList(response, key) {
  if (!response || typeof response !== "object" || !Array.isArray(response[key])) {
    const error = new Error(`The server returned an unexpected response for ${key}.`);
    error.code = "INVALID_CATALOG_RESPONSE";
    throw error;
  }
  return response[key];
}

export function DemoProvider({ children }) {
  const [initialCache] = useState(readCatalogCache);

  const [services, setServices] = useState(() => initialCache?.services ?? []);
  const [specialists, setSpecialists] = useState(() => initialCache?.specialists ?? []);
  const [categories, setCategories] = useState(() =>
    initialCache?.categories?.length ? initialCache.categories : [ALL_CATEGORY]
  );
  const [schedules, setSchedules] = useState(() =>
    schedulesArrayToMap(initialCache?.specialists ?? [])
  );
  const [appointments, setAppointments] = useState([]);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(!initialCache);
  const [catalogError, setCatalogError] = useState("");

  // Refs keep loadCatalog stable (so mount effects never re-fire on data
  // changes) while still giving us the latest data for merge/race handling.
  const catalogRef = useRef({
    categories: initialCache?.categories?.length ? initialCache.categories : [ALL_CATEGORY],
    services: initialCache?.services ?? [],
    specialists: initialCache?.specialists ?? [],
  });
  const inFlightRef = useRef(null);
  const requestIdRef = useRef(0);
  const lastAttemptAtRef = useRef(initialCache?.savedAt || 0);
  const catalogErrorRef = useRef("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadCatalog = useCallback((options = {}) => {
    const force = options?.force === true;

    // De-duplicate concurrent calls (e.g. multiple pages mounting + Retry),
    // unless a mutation explicitly asks for a fresh snapshot.
    if (inFlightRef.current && !force) return inFlightRef.current;

    const requestId = ++requestIdRef.current;
    lastAttemptAtRef.current = Date.now();

    const hasData = Boolean(
      catalogRef.current.categories.length > 1 ||
        catalogRef.current.services.length ||
        catalogRef.current.specialists.length
    );
    if (!hasData) setCatalogLoading(true);

    const request = (async () => {
      const resources = [
        { key: "categories", path: "/categories" },
        { key: "services", path: "/services" },
        { key: "specialists", path: "/specialists" },
      ];

      // Settle each endpoint independently: one failing request must not wipe
      // out data from the other successful endpoints. The bounded timeout and
      // single retry keep a cold backend from stalling the first paint.
      const results = await Promise.allSettled(
        resources.map((item) =>
          api.get(item.path, { timeout: 12000, retries: 1 })
        )
      );

      // Ignore stale responses if a newer load was started.
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const failures = [];
      const successfulKeys = new Set();

      results.forEach((result, index) => {
        const { key } = resources[index];
        if (result.status === "rejected") {
          failures.push({ key, message: result.reason?.message || "Request failed." });
          return;
        }

        let list;
        try {
          list = readCatalogList(result.value, key);
        } catch (err) {
          failures.push({ key, message: err.message });
          return;
        }

        successfulKeys.add(key);
        if (key === "categories") {
          const next = list.length ? list : [ALL_CATEGORY];
          catalogRef.current = { ...catalogRef.current, categories: next };
          setCategories(next);
        } else if (key === "services") {
          catalogRef.current = { ...catalogRef.current, services: list };
          setServices(list);
        } else {
          catalogRef.current = { ...catalogRef.current, specialists: list };
          setSpecialists(list);
          setSchedules(schedulesArrayToMap(list));
        }
      });

      if (successfulKeys.size > 0) {
        writeCatalogCache({ ...catalogRef.current, savedAt: Date.now() });
      }

      const nowHasData = Boolean(
        catalogRef.current.categories.length > 1 ||
          catalogRef.current.services.length ||
          catalogRef.current.specialists.length
      );

      if (failures.length) {
        const labels = failures.map((failure) => failure.key).join(", ");
        const detail = failures[0].message;
        const message = nowHasData
          ? `Could not refresh ${labels}. Showing the last loaded data. ${detail}`
          : `Could not load ${labels} from the server. ${detail}`;
        catalogErrorRef.current = message;
        setCatalogError(message);
      } else {
        catalogErrorRef.current = "";
        setCatalogError("");
      }
    })()
      .catch((error) => {
        // Safety net: catalog loading should never produce an unhandled rejection.
        if (!mountedRef.current || requestId !== requestIdRef.current) return;
        const message = error?.message || "Failed to load data from the server.";
        catalogErrorRef.current = message;
        setCatalogError(message);
      })
      .finally(() => {
        if (inFlightRef.current === request) inFlightRef.current = null;
        if (mountedRef.current && requestId === requestIdRef.current) {
          setCatalogLoading(false);
        }
      });

    inFlightRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const refreshCatalog = useCallback(() => loadCatalog({ force: true }), [loadCatalog]);

  // Recover automatically after the browser comes back online, or when the
  // tab becomes visible again after a failed/stale load (avoids manual refresh).
  useEffect(() => {
    const handleOnline = () => loadCatalog();
    const handleVisibility = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      const sinceAttempt = Date.now() - lastAttemptAtRef.current;
      const threshold = catalogErrorRef.current
        ? CATALOG_RETRY_ON_VISIBLE_MS
        : CATALOG_STALE_MS;
      if (sinceAttempt >= threshold) loadCatalog();
    };
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadCatalog]);

  // Any API 401 clears the token in the client. Mirror that into React state so
  // navigation and protected routes immediately reflect the ended session.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  // Restore session from backend if a token exists. The request is bounded so
  // a sleeping backend can never leave the app stuck on "Checking session".
  useEffect(() => {
    let alive = true;
    async function restore() {
      const token = getToken();
      if (!token) {
        if (alive) setAuthLoading(false);
        return;
      }
      try {
        const data = await api.get("/auth/me", { timeout: 15000, retries: 0 });
        if (alive) setUser(data.user || null);
      } catch (error) {
        // Only discard the token when the server explicitly rejects it. A
        // timeout/network error means the API is starting up, so keep the
        // token for the next load instead of silently logging the user out.
        if (error?.status === 401) clearToken();
        if (alive) setUser(null);
      } finally {
        if (alive) setAuthLoading(false);
      }
    }
    restore();
    return () => {
      alive = false;
    };
  }, []);

  // Appointments are loaded from backend APIs when integrated (no browser-storage DB).

  // ---- Real auth (backend API) ----
  const login = useCallback(async ({ email, password }) => {
    const data = await api.post(
      "/auth/login",
      { email, password },
      { timeout: 30000, retries: 0 }
    );
    if (data.token) setToken(data.token);
    setUser(data.user || null);
    return data;
  }, []);

  const register = useCallback(async ({ name, email, phone, password }) => {
    const data = await api.post(
      "/auth/register",
      { name, email, phone, password },
      { timeout: 30000, retries: 0 }
    );
    if (data.token) setToken(data.token);
    setUser(data.user || null);
    return data;
  }, []);

  const registerProvider = useCallback(async (payload) => {
    const data = await api.post("/auth/register-provider", payload, {
      timeout: 30000,
      retries: 0,
    });
    if (data.token) setToken(data.token);
    setUser(data.user || null);
    return data;
  }, []);

  const logout = useCallback(async () => {
    // Clear the local session first: logout must never feel frozen while the
    // optional server acknowledgement is in flight.
    clearToken();
    setUser(null);
    try {
      await api.post("/auth/logout", {}, { timeout: 3000, retries: 0 });
    } catch {
      // stateless logout; ignore network errors
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const data = await api.get("/auth/me", { timeout: 15000, retries: 0 });
    setUser(data.user || null);
    return data.user;
  }, []);

  // ---- Appointments (temporary, until API migration) ----
  const createBooking = useCallback((booking) => {
    setAppointments((prev) => [...(Array.isArray(prev) ? prev : []), booking]);
    return booking;
  }, []);

  const updateAppointmentStatus = useCallback((id, status) => {
    setAppointments((prev) =>
      (Array.isArray(prev) ? prev : []).map((a) => (a.id === id ? { ...a, status } : a))
    );
  }, []);

  const cancelAppointment = useCallback(
    (id) => {
      const appt = (Array.isArray(appointments) ? appointments : []).find((a) => a.id === id);
      if (!appt) return { ok: false, error: "Appointment not found." };
      const rule = canCancelAppointment(appt);
      if (!rule.allowed) return { ok: false, error: rule.reason };
      updateAppointmentStatus(id, "cancelled");
      return { ok: true };
    },
    [appointments, updateAppointmentStatus]
  );

  // ---- Admin/catalog mutations (temporary local; admin API migration pending) ----
  const saveService = useCallback((service) => {
    setServices((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const exists = list.some((x) => x.id === service.id);
      return exists ? list.map((x) => (x.id === service.id ? service : x)) : [...list, service];
    });
  }, []);

  const deleteService = useCallback((id) => {
    setServices((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x.id !== id));
  }, []);

  const saveSpecialist = useCallback((specialist) => {
    setSpecialists((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const exists = list.some((x) => x.id === specialist.id);
      const next = exists ? list.map((x) => (x.id === specialist.id ? specialist : x)) : [...list, specialist];
      return next;
    });
    if (specialist?.id && specialist.schedule) {
      setSchedules((prev) => ({ ...(prev || {}), [specialist.id]: specialist.schedule }));
    } else if (specialist?.id) {
      setSchedules((prev) =>
        prev?.[specialist.id]
          ? prev
          : {
              ...(prev || {}),
              [specialist.id]: {
                days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                start: "09:00 AM",
                end: "05:00 PM",
                breakStart: "01:00 PM",
                breakEnd: "02:00 PM",
              },
            }
      );
    }
  }, []);

  const deleteSpecialist = useCallback((id) => {
    setSpecialists((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x.id !== id));
  }, []);

  const addCategory = useCallback((category) => {
    setCategories((prev) => [...(Array.isArray(prev) ? prev : [{ id: "all", name: "All" }]), category]);
  }, []);

  const resetDemoData = useCallback(() => {
    setAppointments([]);
    loadCatalog({ force: true });
  }, [loadCatalog]);

  const value = useMemo(
    () => ({
      services,
      specialists,
      categories,
      schedules,
      appointments,
      testimonials: TESTIMONIALS,
      user,
      isLoggedIn: Boolean(user),
      isAdmin: user?.role === "ADMIN",
      isProvider: user?.role === "PROVIDER",
      authLoading,
      catalogLoading,
      catalogError,
      refreshCatalog,
      login,
      register,
      registerProvider,
      logout,
      refreshUser,
      createBooking,
      updateAppointmentStatus,
      cancelAppointment,
      saveService,
      deleteService,
      saveSpecialist,
      deleteSpecialist,
      addCategory,
      resetDemoData,
    }),
    [
      services,
      specialists,
      categories,
      schedules,
      appointments,
      user,
      authLoading,
      catalogLoading,
      catalogError,
      refreshCatalog,
      login,
      register,
      registerProvider,
      logout,
      refreshUser,
      createBooking,
      updateAppointmentStatus,
      cancelAppointment,
      saveService,
      deleteService,
      saveSpecialist,
      deleteSpecialist,
      addCategory,
      resetDemoData,
    ]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
