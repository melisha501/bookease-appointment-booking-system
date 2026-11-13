// Shared app context and booking helpers.
// Kept separate from DemoProvider so Fast Refresh can update the provider
// component without invalidating the hook/helper exports.

import { createContext, useContext } from "react";

import {
  isCancellableStatus,
  isOccupyingStatus,
  normalizeAppointmentStatus,
} from "../utils/appointmentStatus";

export const DemoContext = createContext(null);

// ---- Helpers (exported for pages to reuse) ----

export function makeBookingRef(existingIds) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const id = `APT-${suffix}`;
    if (!existingIds.includes(id)) return id;
  }
  return `APT-${Date.now().toString(36).toUpperCase()}`;
}

export function appointmentDateTime(appointment) {
  return new Date(`${appointment.date}T${to24h(appointment.time)}`);
}

export function to24h(timeLabel) {
  const match = String(timeLabel).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return `${timeLabel}:00`;
  let [, h, m, meridiem] = match;
  h = Number(h);
  if (meridiem.toUpperCase() === "PM" && h !== 12) h += 12;
  if (meridiem.toUpperCase() === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}:00`;
}

export function canCancelAppointment(appointment) {
  const status = normalizeAppointmentStatus(appointment?.status);
  if (!isCancellableStatus(status)) {
    if (status === "completed") {
      return { allowed: false, reason: "Completed appointments cannot be cancelled." };
    }
    if (status === "cancelled") {
      return { allowed: false, reason: "This appointment has already been cancelled." };
    }
    if (status === "rejected") {
      return { allowed: false, reason: "This appointment was rejected and cannot be cancelled." };
    }
    return { allowed: false, reason: "Only pending or confirmed appointments can be cancelled." };
  }
  const startsInHours =
    (appointmentDateTime(appointment).getTime() - Date.now()) / (1000 * 60 * 60);
  if (startsInHours <= 24) {
    return {
      allowed: false,
      reason:
        "Cancellation is not allowed within 24 hours of the appointment. Please visit or call us instead.",
    };
  }
  return { allowed: true };
}

export function isSlotTaken(appointmentsList, specialistName, date, time) {
  return (Array.isArray(appointmentsList) ? appointmentsList : []).some(
    (a) =>
      a.specialist === specialistName &&
      a.date === date &&
      a.time === time &&
      isOccupyingStatus(a.status)
  );
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside DemoProvider");
  return ctx;
}
