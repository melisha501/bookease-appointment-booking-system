// Shared appointment status constants and transition rules.
//
// Status values stay lowercase to match the existing Prisma enum, API payloads,
// and frontend filters. Display labels (Pending, Confirmed, ...) are title case.
//
// Occupied statuses block availability. Rejected/cancelled/completed appointments
// are terminal and must not block future slots.

const APPOINTMENT_STATUS = Object.freeze({
  PENDING: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REJECTED: "rejected",
});

const ALL_APPOINTMENT_STATUSES = Object.freeze(Object.values(APPOINTMENT_STATUS));

// Only pending and confirmed appointments reserve a time slot.
const OCCUPIED_STATUSES = Object.freeze([
  APPOINTMENT_STATUS.PENDING,
  APPOINTMENT_STATUS.CONFIRMED,
]);

const TERMINAL_STATUSES = Object.freeze([
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.CANCELLED,
  APPOINTMENT_STATUS.REJECTED,
]);

const CUSTOMER_CANCELLABLE_STATUSES = Object.freeze([
  APPOINTMENT_STATUS.PENDING,
  APPOINTMENT_STATUS.CONFIRMED,
]);

// Admin-permitted transitions. Terminal statuses cannot be changed further.
const ADMIN_STATUS_TRANSITIONS = Object.freeze({
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

const STATUS_LABELS = Object.freeze({
  [APPOINTMENT_STATUS.PENDING]: "Pending",
  [APPOINTMENT_STATUS.CONFIRMED]: "Confirmed",
  [APPOINTMENT_STATUS.COMPLETED]: "Completed",
  [APPOINTMENT_STATUS.CANCELLED]: "Cancelled",
  [APPOINTMENT_STATUS.REJECTED]: "Rejected",
});

/** Normalize API input to a valid lowercase status, or return null. */
function normalizeStatus(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ALL_APPOINTMENT_STATUSES.includes(normalized) ? normalized : null;
}

function statusLabel(status) {
  const normalized = normalizeStatus(status);
  return normalized ? STATUS_LABELS[normalized] : String(status ?? "");
}

function canAdminTransition(from, to) {
  const current = normalizeStatus(from);
  const next = normalizeStatus(to);
  if (!current || !next) return false;
  return ADMIN_STATUS_TRANSITIONS[current].includes(next);
}

function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(normalizeStatus(status));
}

function isCustomerCancellableStatus(status) {
  return CUSTOMER_CANCELLABLE_STATUSES.includes(normalizeStatus(status));
}

function allowedAdminTransitions(status) {
  const normalized = normalizeStatus(status);
  return normalized ? ADMIN_STATUS_TRANSITIONS[normalized] : [];
}

module.exports = {
  APPOINTMENT_STATUS,
  ALL_APPOINTMENT_STATUSES,
  OCCUPIED_STATUSES,
  TERMINAL_STATUSES,
  CUSTOMER_CANCELLABLE_STATUSES,
  ADMIN_STATUS_TRANSITIONS,
  STATUS_LABELS,
  normalizeStatus,
  statusLabel,
  canAdminTransition,
  isTerminalStatus,
  isCustomerCancellableStatus,
  allowedAdminTransitions,
};
