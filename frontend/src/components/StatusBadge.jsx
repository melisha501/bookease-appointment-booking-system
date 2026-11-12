// StatusBadge — maps an appointment status string to a coloured <Badge />.
// Reused in Customer Overview, My Appointments, Booking Details, and Admin pages.
//
// Prop: status — "pending" | "confirmed" | "completed" | "cancelled" | "rejected"

import Badge from './Badge';
import { appointmentStatusLabel, normalizeAppointmentStatus } from '../utils/appointmentStatus';

const statusMap = {
  pending: { label: 'Pending', variant: 'warning' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  completed: { label: 'Completed', variant: 'default' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
  rejected: { label: 'Rejected', variant: 'rejected' },
};

export default function StatusBadge({ status }) {
  const key = normalizeAppointmentStatus(status);
  const item = statusMap[key] || {
    label: status ? appointmentStatusLabel(status) : 'Unknown',
    variant: 'muted',
  };

  return <Badge variant={item.variant}>{item.label}</Badge>;
}
