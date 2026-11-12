// Shared appointment status constants and helpers for the frontend.
// Values are lowercase to stay consistent with the backend API and Prisma enum.

export const APPOINTMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
});

export const APPOINTMENT_STATUS_VALUES = Object.freeze(Object.values(APPOINTMENT_STATUS));

export const OCCUPYING_STATUSES = Object.freeze([
  APPOINTMENT_STATUS.PENDING,
  APPOINTMENT_STATUS.CONFIRMED,
]);

export const TERMINAL_STATUSES = Object.freeze([
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.CANCELLED,
  APPOINTMENT_STATUS.REJECTED,
]);

export const CANCELLABLE_STATUSES = Object.freeze([
  APPOINTMENT_STATUS.PENDING,
  APPOINTMENT_STATUS.CONFIRMED,
]);

export const STATUS_LABELS = Object.freeze({
  [APPOINTMENT_STATUS.PENDING]: 'Pending',
  [APPOINTMENT_STATUS.CONFIRMED]: 'Confirmed',
  [APPOINTMENT_STATUS.COMPLETED]: 'Completed',
  [APPOINTMENT_STATUS.CANCELLED]: 'Cancelled',
  [APPOINTMENT_STATUS.REJECTED]: 'Rejected',
});

export const ADMIN_TRANSITIONS = Object.freeze({
  [APPOINTMENT_STATUS.PENDING]: Object.freeze([
    APPOINTMENT_STATUS.CONFIRMED,
    APPOINTMENT_STATUS.REJECTED,
    APPOINTMENT_STATUS.CANCELLED,
  ]),
  [APPOINTMENT_STATUS.CONFIRMED]: Object.freeze([
    APPOINTMENT_STATUS.COMPLETED,
    APPOINTMENT_STATUS.CANCELLED,
  ]),
  [APPOINTMENT_STATUS.COMPLETED]: Object.freeze([]),
  [APPOINTMENT_STATUS.CANCELLED]: Object.freeze([]),
  [APPOINTMENT_STATUS.REJECTED]: Object.freeze([]),
});

export function normalizeAppointmentStatus(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return APPOINTMENT_STATUS_VALUES.includes(normalized) ? normalized : null;
}

export function appointmentStatusLabel(status) {
  const normalized = normalizeAppointmentStatus(status);
  return normalized ? STATUS_LABELS[normalized] : String(status ?? '');
}

export function isOccupyingStatus(status) {
  return OCCUPYING_STATUSES.includes(normalizeAppointmentStatus(status));
}

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(normalizeAppointmentStatus(status));
}

export function isCancellableStatus(status) {
  return CANCELLABLE_STATUSES.includes(normalizeAppointmentStatus(status));
}

export function canAdminTransition(from, to) {
  const current = normalizeAppointmentStatus(from);
  const next = normalizeAppointmentStatus(to);
  if (!current || !next) return false;
  return ADMIN_TRANSITIONS[current].includes(next);
}

export function allowedAdminTransitions(status) {
  const normalized = normalizeAppointmentStatus(status);
  return normalized ? ADMIN_TRANSITIONS[normalized] : [];
}
