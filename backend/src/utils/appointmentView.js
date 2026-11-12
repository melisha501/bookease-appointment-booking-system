// Shared appointment serialization for API responses.
// Keeps customer-facing and admin-facing appointment payloads consistent and
// ensures only client-safe fields are returned.

function appointmentToClient(appointment) {
  if (!appointment) return null;
  return {
    id: appointment.reference, // frontend uses reference as id in many places
    reference: appointment.reference,
    dbId: appointment.id,
    customerId: appointment.customerId,
    customer: appointment.customerName,
    customerName: appointment.customerName,
    customerEmail: appointment.customerEmail,
    phone: appointment.customerPhone || "",
    customerPhone: appointment.customerPhone || "",
    email: appointment.customerEmail,
    service: appointment.service?.name || "",
    serviceId: appointment.service?.slug || appointment.serviceId,
    specialist: appointment.specialist?.name || "",
    specialistId: appointment.specialist?.slug || appointment.specialistId,
    date: appointment.date,
    time: appointment.time,
    status: appointment.status,
    notes: appointment.notes || "",
    createdAt: appointment.createdAt,
  };
}

module.exports = { appointmentToClient };
