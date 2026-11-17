// ProviderServices — create, edit, publish, and delete the signed-in provider's services.
// New provider services start as "pending" and become visible to customers only
// after an administrator approves them and the provider publishes them.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Pencil,
  Plus,
  Scissors,
  Trash2,
} from 'lucide-react';

import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ImageUploadField from '../components/ImageUploadField';
import { useDemo } from '../store/DemoContext';

const EMPTY_FORM = {
  id: '',
  name: '',
  description: '',
  categoryId: '',
  price: '',
  duration: 60,
  benefits: '',
  image: '',
  isActive: true,
  approvalStatus: 'pending',
};

function approvalBadge(status) {
  if (status === 'approved') return { variant: 'success', label: 'Approved' };
  if (status === 'rejected') return { variant: 'danger', label: 'Rejected' };
  return { variant: 'warning', label: 'Pending review' };
}

export default function ProviderServices() {
  const { categories, refreshCatalog } = useDemo();
  const categoryOptions = (Array.isArray(categories) ? categories : []).filter((c) => c.id !== 'all');

  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [noProfile, setNoProfile] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imageProgress, setImageProgress] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState('');
  const noteTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);
    },
    []
  );

  const flash = (message, type = 'success') => {
    if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);
    setStatus({ type, message });
    noteTimerRef.current = window.setTimeout(() => setStatus({ type: '', message: '' }), 6000);
  };

  const resolveCategoryId = useCallback(
    (service) =>
      service?.categoryId ||
      categoryOptions.find((c) => c.id === service?.category || c.id === service?.categoryId)?.id ||
      '',
    [categoryOptions]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setNoProfile(false);
    try {
      const data = await api.get('/providers/me');
      setProvider(data?.provider || null);
      setServices(Array.isArray(data?.services) ? data.services : []);
    } catch (err) {
      if (err?.data?.code === 'NO_PROVIDER_PROFILE' || err?.status === 404) {
        setNoProfile(true);
      } else {
        setLoadError(err?.message || 'Could not load your services.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Keep a new-service form pointed at a category that still exists.
  const effectiveCategoryId = editing
    ? form.categoryId
    : categoryOptions.some((c) => c.id === form.categoryId)
      ? form.categoryId
      : categoryOptions[0]?.id || '';

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditing(false);
    setImageFile(null);
    setImageProgress(0);
  };

  const handleEdit = (service) => {
    setForm({
      id: service.id,
      name: service.name || '',
      description: service.description || '',
      categoryId: resolveCategoryId(service),
      price: String(service.priceNpr ?? ''),
      duration: service.duration ?? 60,
      benefits: Array.isArray(service.benefits) ? service.benefits.join('\n') : '',
      image: service.image || '',
      isActive: service.isActive !== false,
      approvalStatus: service.approvalStatus || 'pending',
    });
    setEditing(true);
    setImageFile(null);
    setImageProgress(0);
    setStatus({ type: '', message: '' });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validate = () => {
    if (!form.name.trim()) return 'Enter a service name.';
    if (!form.description.trim()) return 'Enter a service description.';
    if (!effectiveCategoryId) return 'Create a category before adding a service.';
    if (!(Number(form.price) > 0)) return 'Enter a valid price in NPR.';
    if (!(Number(form.duration) > 0)) return 'Enter a valid duration in minutes.';
    return '';
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const validation = validate();
    if (validation) {
      setStatus({ type: 'error', message: validation });
      return;
    }

    setSaving(true);
    setImageProgress(0);
    setStatus({ type: 'loading', message: editing ? 'Saving service…' : 'Creating service…' });
    let saved = null;
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        categoryId: effectiveCategoryId,
        priceNpr: Math.round(Number(form.price)),
        durationMins: Math.round(Number(form.duration)),
        benefits: form.benefits
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      };

      const data = editing
        ? await api.patch(`/providers/me/services/${encodeURIComponent(form.id)}`, payload)
        : await api.post('/providers/me/services', payload);
      saved = data?.service || null;
      if (!saved?.id) throw new Error('The service was saved but the server response was incomplete.');

      let finalImage = saved.image || '';
      let warning = '';
      if (imageFile) {
        setStatus({ type: 'loading', message: 'Uploading service image…' });
        const fd = new FormData();
        fd.append('image', imageFile);
        const uploaded = await api.postFormWithProgress(
          `/providers/me/services/${encodeURIComponent(saved.id)}/image`,
          fd,
          setImageProgress
        );
        saved = uploaded?.service || saved;
        finalImage = uploaded?.service?.image || finalImage;
        warning = uploaded?.warning || '';
        setImageFile(null);
      }

      setServices((current) => {
        const exists = current.some((item) => item.id === saved.id);
        return exists
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current];
      });
      setForm({
        id: saved.id,
        name: saved.name || '',
        description: saved.description || '',
        categoryId: resolveCategoryId(saved),
        price: String(saved.priceNpr ?? ''),
        duration: saved.duration ?? 60,
        benefits: Array.isArray(saved.benefits) ? saved.benefits.join('\n') : '',
        image: finalImage,
        isActive: saved.isActive !== false,
        approvalStatus: saved.approvalStatus || 'pending',
      });
      setEditing(true);
      setImageProgress(0);
      if (typeof refreshCatalog === 'function') refreshCatalog().catch(() => {});
      flash(
        warning ||
          (editing
            ? 'Service updated.'
            : 'Service created. It will be visible to customers after admin approval and publishing.'),
        warning ? 'warning' : 'success'
      );
    } catch (err) {
      setImageProgress(0);
      if (saved?.id) {
        setServices((current) => {
          const exists = current.some((item) => item.id === saved.id);
          return exists
            ? current.map((item) => (item.id === saved.id ? saved : item))
            : [saved, ...current];
        });
        setEditing(true);
        setStatus({
          type: 'error',
          message: `Service was saved, but the image upload failed: ${err?.message || 'Unknown error'}. Try uploading the image again.`,
        });
        if (typeof refreshCatalog === 'function') refreshCatalog().catch(() => {});
      } else {
        setStatus({ type: 'error', message: err?.message || 'Could not save the service.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUploadImage = async () => {
    if (!editing || !form.id) {
      setStatus({ type: 'error', message: 'Save the service first, then upload an image.' });
      return;
    }
    if (!imageFile) {
      setStatus({ type: 'error', message: 'Choose an image file first.' });
      return;
    }
    setSaving(true);
    setImageProgress(0);
    setStatus({ type: 'loading', message: 'Uploading service image…' });
    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      const data = await api.postFormWithProgress(
        `/providers/me/services/${encodeURIComponent(form.id)}/image`,
        fd,
        setImageProgress
      );
      const updated = data?.service;
      if (updated) {
        setServices((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setForm((current) => ({ ...current, image: updated.image || '' }));
      }
      setImageFile(null);
      if (typeof refreshCatalog === 'function') refreshCatalog().catch(() => {});
      flash(data?.warning || 'Service image uploaded.', data?.warning ? 'warning' : 'success');
    } catch (err) {
      setStatus({ type: 'error', message: err?.message || 'Could not upload the image.' });
    } finally {
      setSaving(false);
      setImageProgress(0);
    }
  };

  const handleRemoveImage = async () => {
    if (!editing || !form.id) return;
    setSaving(true);
    setStatus({ type: 'loading', message: 'Removing image…' });
    try {
      const data = await api.del(`/providers/me/services/${encodeURIComponent(form.id)}/image`);
      const updated = data?.service;
      if (updated) {
        setServices((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setForm((current) => ({ ...current, image: updated.image || '' }));
      }
      setImageFile(null);
      if (typeof refreshCatalog === 'function') refreshCatalog().catch(() => {});
      flash(data?.warning || 'Service image removed.', data?.warning ? 'warning' : 'success');
    } catch (err) {
      setStatus({ type: 'error', message: err?.message || 'Could not remove the image.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (service) => {
    setBusyId(service.id);
    setStatus({ type: 'loading', message: service.isActive ? 'Unpublishing…' : 'Publishing…' });
    try {
      const data = await api.patch(`/providers/me/services/${encodeURIComponent(service.id)}/publish`, {
        isActive: !service.isActive,
      });
      const updated = data?.service;
      if (updated) {
        setServices((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        if (form.id === updated.id) {
          setForm((current) => ({ ...current, isActive: updated.isActive !== false }));
        }
      }
      if (typeof refreshCatalog === 'function') refreshCatalog().catch(() => {});
      flash(data?.message || (updated?.isActive ? 'Service published.' : 'Service unpublished.'));
    } catch (err) {
      setStatus({ type: 'error', message: err?.message || 'Could not change the publish state.' });
    } finally {
      setBusyId('');
    }
  };

  const handleDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    setDeleting(true);
    setStatus({ type: 'loading', message: `Deleting “${target.name}”…` });
    try {
      const data = await api.del(`/providers/me/services/${encodeURIComponent(target.id)}`);
      setServices((current) => current.filter((item) => item.id !== target.id));
      if (form.id === target.id) resetForm();
      if (typeof refreshCatalog === 'function') refreshCatalog().catch(() => {});
      setDeleteTarget(null);
      flash(data?.warning || `“${target.name}” was deleted.`, data?.warning ? 'warning' : 'success');
    } catch (err) {
      setDeleteTarget(null);
      setStatus({
        type: 'error',
        message:
          err?.data?.code === 'HAS_APPOINTMENTS'
            ? err.message
            : err?.message || 'Could not delete the service.',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="skeleton h-20 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="skeleton h-96 rounded-2xl lg:col-span-3" />
          <div className="skeleton h-96 rounded-2xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (noProfile) {
    return (
      <EmptyState
        title="No provider profile yet"
        description="Create a provider profile before adding services."
        icon={Scissors}
      >
        <Button to="/provider/register">Create a provider profile</Button>
      </EmptyState>
    );
  }

  if (loadError) {
    return (
      <EmptyState title="Could not load services" description={loadError} icon={Scissors}>
        <Button onClick={load}>Try again</Button>
      </EmptyState>
    );
  }

  const pendingCount = services.filter((s) => s.approvalStatus === 'pending').length;
  const publishedCount = services.filter((s) => s.isPublished).length;
  const approval = approvalBadge(form.approvalStatus);
  const canSubmitServices = provider?.status !== 'rejected';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-brand" aria-hidden="true" />
            Provider catalog
          </p>
          <h2 className="mt-2 text-h2">Your services</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Add services, keep pricing and descriptions current, and publish them to the customer
            portal. New and edited services are reviewed by an administrator.
          </p>
        </div>
        {status.message ? (
          <span
            role="status"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              status.type === 'error'
                ? 'border border-red-100 bg-red-50 text-red-700'
                : status.type === 'warning'
                  ? 'border border-amber-100 bg-amber-50 text-amber-800'
                  : 'border border-teal-100 bg-teal-50 text-teal-deep'
            }`}
          >
            {status.message}
          </span>
        ) : null}
      </div>

      {provider?.status !== 'approved' ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <strong className="font-bold">Profile {provider?.status || 'pending'}.</strong> Services are
          hidden from customers until your provider profile is approved. You can still create and
          prepare them now.
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-soft">
          <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">Services</p>
          <p className="mt-0.5 text-lg font-bold text-ink">{services.length}</p>
        </div>
        <div className="rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-soft">
          <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">Live</p>
          <p className="mt-0.5 text-lg font-bold text-ink">{publishedCount}</p>
        </div>
        <div className="rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-soft">
          <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">Pending</p>
          <p className="mt-0.5 text-lg font-bold text-ink">{pendingCount}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card padding="p-0" className="overflow-hidden lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <div>
              <h3 className="text-base font-bold text-ink">Service catalog</h3>
              <p className="mt-0.5 text-xs text-ink-soft">
                Approval and publishing are controlled separately.
              </p>
            </div>
            <Badge variant="muted">{services.length} total</Badge>
          </div>

          {services.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No services yet"
                description="Create your first service with the form. It will be reviewed before customers can book it."
                icon={Scissors}
              />
            </div>
          ) : (
            <ul className="divide-y divide-line/80 border-t border-line/80">
              {services.map((service) => {
                const badge = approvalBadge(service.approvalStatus);
                return (
                  <li
                    key={service.id}
                    className={`px-5 py-4 transition ${
                      form.id === service.id ? 'bg-teal-50/40' : 'hover:bg-surface/60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {service.image ? (
                        <img
                          src={service.image}
                          alt=""
                          loading="lazy"
                          className="h-14 w-14 shrink-0 rounded-xl border border-line object-cover"
                        />
                      ) : (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-line bg-white text-ink-soft">
                          <ImageIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-ink">{service.name}</p>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          <Badge variant={service.isActive ? 'default' : 'muted'}>
                            {service.isActive ? 'Published' : 'Unpublished'}
                          </Badge>
                          {service.isPublished ? (
                            <Badge variant="success">Live to customers</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft">
                          {service.description || 'No description yet.'}
                        </p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                          <span className="font-bold text-teal-deep">{service.price}</span>
                          <span>{service.duration} min</span>
                          <span>{service.categoryName || 'Uncategorized'}</span>
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEdit(service)}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePublish(service)}
                            disabled={busyId === service.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                          >
                            {service.isActive ? (
                              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {service.isActive ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(service)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="border-t border-line bg-surface/50 px-5 py-2.5 text-[11px] text-ink-soft">
            Services with appointments cannot be deleted. Unpublish them instead to preserve booking
            history.
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                {editing ? (
                  <Pencil className="h-5 w-5 text-teal-deep" aria-hidden="true" />
                ) : (
                  <Plus className="h-5 w-5 text-teal-deep" aria-hidden="true" />
                )}
                {editing ? 'Edit service' : 'Add a service'}
              </h3>
              <p className="mt-1 text-xs text-ink-soft">
                {editing
                  ? 'Changes to a rejected service are resubmitted for review.'
                  : 'Saved services start with a pending approval status.'}
              </p>
            </div>
            {editing ? <Badge variant={approval.variant}>{approval.label}</Badge> : null}
          </div>

          {!canSubmitServices ? (
            <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-xs leading-relaxed text-red-700">
              Your provider profile was rejected, so new services cannot be submitted. Update your
              profile or contact support.
            </p>
          ) : null}

          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <div>
              <label htmlFor="provider-service-name" className="field-label">
                Service name
              </label>
              <input
                id="provider-service-name"
                required
                maxLength={100}
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder="e.g. Dental check-up"
                className="field"
              />
            </div>
            <div>
              <label htmlFor="provider-service-description" className="field-label">
                Description
              </label>
              <textarea
                id="provider-service-description"
                required
                rows="3"
                maxLength={600}
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                placeholder="What the service includes and who it is for."
                className="field resize-y"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="provider-service-category" className="field-label">
                  Category
                </label>
                <select
                  id="provider-service-category"
                  value={effectiveCategoryId}
                  onChange={(event) => update('categoryId', event.target.value)}
                  className="field"
                >
                  {!categoryOptions.some((c) => c.id === effectiveCategoryId) ? (
                    <option value={effectiveCategoryId} disabled>
                      Select a category…
                    </option>
                  ) : null}
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="provider-service-price" className="field-label">
                  Price (NPR)
                </label>
                <input
                  id="provider-service-price"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={form.price}
                  onChange={(event) => update('price', event.target.value)}
                  placeholder="1500"
                  className="field"
                />
              </div>
            </div>
            <div>
              <label htmlFor="provider-service-duration" className="field-label">
                Duration (minutes)
              </label>
              <input
                id="provider-service-duration"
                type="number"
                min="15"
                step="5"
                required
                value={form.duration}
                onChange={(event) => update('duration', event.target.value)}
                className="field"
              />
            </div>
            <div>
              <label htmlFor="provider-service-benefits" className="field-label">
                What&apos;s included <span className="font-normal text-ink-soft">(optional)</span>
              </label>
              <textarea
                id="provider-service-benefits"
                rows="3"
                value={form.benefits}
                onChange={(event) => update('benefits', event.target.value)}
                placeholder={'One item per line\nConsultation\nAftercare guidance'}
                className="field resize-y"
              />
              <p className="mt-1 text-xs text-ink-soft">Each line becomes a bullet on the service page.</p>
            </div>

            <ImageUploadField
              id="provider-service-image"
              label="Service image"
              description="Uploaded to UploadThing and stored with this service."
              file={imageFile}
              onFileChange={setImageFile}
              currentImageUrl={form.image}
              onUpload={handleUploadImage}
              onRemove={handleRemoveImage}
              canUpload={editing && Boolean(form.id)}
              busy={saving}
              progress={imageProgress}
              status={status}
              uploadLabel="Upload image"
              removeLabel="Remove image"
              removeConfirm="Remove this service image? The service record will be kept."
              emptyText={
                editing
                  ? 'No image set. Existing data is preserved until you upload one.'
                  : 'Choose an image to preview it before saving.'
              }
              helpText="JPG, JPEG, PNG, or WEBP. Max 4 MB."
            />

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="submit"
                fullWidth
                loading={saving}
                disabled={saving || !canSubmitServices}
              >
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create service'}
              </Button>
              {editing ? (
                <Button type="button" variant="secondary" disabled={saving} onClick={resetForm}>
                  Cancel
                </Button>
              ) : null}
            </div>

            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-ink-soft">
              <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-deep" aria-hidden="true" />
              Approved and published services appear in the customer portal. Approval is reviewed by
              an administrator.
            </p>
          </form>
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete service"
        description={`Permanently delete “${deleteTarget?.name || ''}”? If this service has appointments it cannot be deleted; unpublish it instead.`}
        confirmLabel="Delete service"
        loading={deleting}
      />
    </div>
  );
}
