// Shared appointment serialization for API responses.
// Keeps customer-facing and admin-facing appointment payloads consistent and
// ensures only client-safe fields are returned.

function appointmentToClient(appointment) {
  if (!appointment) return null;
  const provider = appointment.service?.provider || null;
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
    serviceDbId: appointment.serviceId,
    serviceImage: appointment.service?.imageUrl || "",
    specialist: appointment.specialist?.name || "",
    specialistId: appointment.specialist?.slug || appointment.specialistId,
    providerId: provider?.slug || appointment.service?.providerId || null,
    providerDbId: provider?.id || appointment.service?.providerId || null,
    providerName: provider?.name || "",
    providerLogo: provider?.logoUrl || "",
    providerType: provider?.type || "",
    date: appointment.date,
    time: appointment.time,
    status: appointment.status,
    notes: appointment.notes || "",
    createdAt: appointment.createdAt,
  };
}

module.exports = { appointmentToClient };
