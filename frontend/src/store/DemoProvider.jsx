// Shared app state.
// - Auth is connected to the real backend API (JWT in localStorage for session persistence only).
// - Catalog data (categories, services, specialists, schedules) is fetched from the backend.
// - Appointments/admin data will be fetched from backend APIs as those endpoints are integrated.

import { useCallback, useEffect, useMemo, useState } from "react";

import { api, clearToken, getToken, setToken } from "../api/client";
import { canCancelAppointment, DemoContext } from "./DemoContext";

// Stable empty list so the context value memo isn't invalidated on every render.
const TESTIMONIALS = [];

function schedulesArrayToMap(specialists) {
  const map = {};
  for (const s of Array.isArray(specialists) ? specialists : []) {
    if (s.schedule) map[s.id] = s.schedule;
  }
  return map;
}

export function DemoProvider({ children }) {
  const [services, setServices] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [categories, setCategories] = useState([{ id: "all", name: "All" }]);
  const [schedules, setSchedules] = useState({});
  const [appointments, setAppointments] = useState([]);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const [catRes, svcRes, spRes] = await Promise.all([
        api.get("/categories"),
        api.get("/services"),
        api.get("/specialists"),
      ]);
      const cats = Array.isArray(catRes?.categories) ? catRes.categories : [];
      const svcs = Array.isArray(svcRes?.services) ? svcRes.services : [];
      const sps = Array.isArray(spRes?.specialists) ? spRes.specialists : [];
      setCategories(cats.length ? cats : [{ id: "all", name: "All" }]);
      setServices(svcs);
      setSpecialists(sps);
      setSchedules(schedulesArrayToMap(sps));
    } catch (err) {
      setCatalogError(err?.message || "Failed to load data from the server.");
      setServices([]);
      setSpecialists([]);
      setSchedules({});
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Restore session from backend if a token exists.
  useEffect(() => {
    let alive = true;
    async function restore() {
      const token = getToken();
      if (!token) {
        if (alive) setAuthLoading(false);
        return;
      }
      try {
        const data = await api.get("/auth/me");
        if (alive) setUser(data.user || null);
      } catch {
        clearToken();
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
    const data = await api.post("/auth/login", { email, password });
    if (data.token) setToken(data.token);
    setUser(data.user || null);
    return data;
  }, []);

  const register = useCallback(async ({ name, email, phone, password }) => {
    const data = await api.post("/auth/register", { name, email, phone, password });
    if (data.token) setToken(data.token);
    setUser(data.user || null);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout", {});
    } catch {
      // stateless logout; ignore network errors
    }
    clearToken();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const data = await api.get("/auth/me");
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
    loadCatalog();
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
      authLoading,
      catalogLoading,
      catalogError,
      refreshCatalog: loadCatalog,
      login,
      register,
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
      loadCatalog,
      login,
      register,
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
