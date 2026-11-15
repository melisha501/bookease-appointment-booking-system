// AdminServices — add / edit / delete service details.
// Service images are uploaded to UploadThing by the backend and the returned
// URL is saved in PostgreSQL (Service.imageUrl). Existing images are preserved
// when other service fields are edited.

import { useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  Image as ImageIcon,
  Pencil,
  Plus,
  Scissors,
  Star,
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
  category: 'salons',
  categoryName: 'Salons',
  price: 'NPR 1,500',
  duration: 60,
  rating: 4.8,
  image: '',
  benefits: [],
};

export default function AdminServices() {
  const { services, categories, refreshCatalog } = useDemo();
  const categoryOptions = (Array.isArray(categories) ? categories : []).filter((c) => c.id !== 'all');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  // Keep the new-service form on a category that actually exists in the live
  // catalog instead of the stale built-in default.
  const effectiveCategoryId = editing
    ? form.category
    : categoryOptions.some((c) => c.id === form.category)
      ? form.category
      : categoryOptions[0]?.id || '';
  const [note, setNote] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const [imageStatus, setImageStatus] = useState({ type: '', message: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const noteTimerRef = useRef(null);
  const statusTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    },
    []
  );

  const flashNote = (message) => {
    if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);
    setNote(message);
    noteTimerRef.current = window.setTimeout(() => setNote(''), 4000);
  };

  const scheduleStatusClear = () => {
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(
      () => setImageStatus((s) => (s.type === 'success' ? { type: '', message: '' } : s)),
      4000
    );
  };

  const clearSelectedImage = () => {
    setImageFile(null);
    setImageProgress(0);
  };

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleUploadImage = async () => {
    if (!editing || !form.id) {
      setImageStatus({
        type: 'error',
        message:
          'Save the service first to create a database record, then upload the image. (Or select an image and use Save — it will create the service and upload the image.)',
      });
      return;
    }
    if (!imageFile) {
      setImageStatus({ type: 'error', message: 'Please select an image file first.' });
      return;
    }

    setImageBusy(true);
    setImageProgress(0);
    setImageStatus({ type: 'loading', message: 'Uploading image to UploadThing…' });
    try {
      const fd = new FormData();
      fd.append('image', imageFile);
      const data = await api.postFormWithProgress(
        `/services/${encodeURIComponent(form.id)}/image`,
        fd,
        setImageProgress
      );
      const url = data?.service?.image || '';
      setForm((current) => ({ ...current, image: url }));
      clearSelectedImage();
      setImageStatus(
        data?.warning
          ? { type: 'warning', message: data.warning }
          : {
              type: 'success',
              message: 'Image uploaded to UploadThing and saved in PostgreSQL.',
            }
      );
      await refreshCatalog();
    } catch (e) {
      setImageStatus({
        type: 'error',
        message:
          e?.message ||
          'Image upload failed. Check admin login, backend logs, and the UploadThing configuration.',
      });
    } finally {
      setImageBusy(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!editing || !form.id) return;
    setImageBusy(true);
    setImageProgress(0);
    setImageStatus({ type: 'loading', message: 'Removing image…' });
    try {
      const data = await api.del(`/services/${encodeURIComponent(form.id)}/image`);
      setForm((current) => ({ ...current, image: data?.service?.image || '' }));
      clearSelectedImage();
      setImageStatus(
        data?.warning
          ? { type: 'warning', message: data.warning }
          : {
              type: 'success',
              message: 'Image removed. Existing service data was preserved.',
            }
      );
      await refreshCatalog();
    } catch (e) {
      setImageStatus({ type: 'error', message: e?.message || 'Could not remove image.' });
    } finally {
      setImageBusy(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    // Make sure the selected category still exists (the catalog can change
    // while the form is open). For a new service, fall back to the first
    // available category instead of sending a stale default.
    const selectedCategory =
      categoryOptions.find((c) => c.id === effectiveCategoryId) || (editing ? null : categoryOptions[0]);
    if (!selectedCategory) {
      setImageStatus({
        type: 'error',
        message: editing
          ? 'This service category no longer exists. Choose a valid category before saving.'
          : 'Create a category before adding a service.',
      });
      return;
    }

    setImageBusy(true);
    setImageProgress(0);
    let savedRecord = null;
    let uploadWarning = '';
    const hadFile = Boolean(imageFile);
    try {
      setImageStatus({ type: 'loading', message: editing && form.id ? 'Saving service…' : 'Creating service…' });
      const payload = {
        name: form.name,
        description: form.description,
        category: selectedCategory.id,
        price: form.price,
        duration: Number(form.duration) || 60,
        rating: Number(form.rating) || 4.8,
        benefits: Array.isArray(form.benefits) ? form.benefits : [],
      };

      if (editing && form.id) {
        const data = await api.patch(`/services/${encodeURIComponent(form.id)}`, payload);
        savedRecord = data?.service;
      } else {
        const data = await api.post('/services', payload);
        savedRecord = data?.service;
      }
      if (!savedRecord?.id) throw new Error('Service was saved but the server response was incomplete.');

      let finalImage = savedRecord.image || '';
      if (imageFile) {
        setImageStatus({ type: 'loading', message: 'Uploading image to UploadThing…' });
        const fd = new FormData();
        fd.append('image', imageFile);
        const imgData = await api.postFormWithProgress(
          `/services/${encodeURIComponent(savedRecord.id)}/image`,
          fd,
          setImageProgress
        );
        finalImage = imgData?.service?.image || finalImage;
        uploadWarning = imgData?.warning || '';
        clearSelectedImage();
      }

      await refreshCatalog();
      setForm({ ...savedRecord, image: finalImage });
      setEditing(true);
      flashNote('Service saved to the database.');
      setImageStatus(
        uploadWarning
          ? { type: 'warning', message: uploadWarning }
          : {
              type: 'success',
              message: hadFile
                ? 'Service saved and image uploaded to UploadThing.'
                : 'Service saved to the database.',
            }
      );
    } catch (err) {
      setImageProgress(0);
      if (savedRecord?.id) {
        await refreshCatalog().catch(() => {});
        setForm({ ...savedRecord, image: savedRecord.image || '' });
        setEditing(true);
        setImageStatus({
          type: 'error',
          message: `Service was saved, but image upload failed: ${err?.message || 'Unknown error'}. You can try uploading again.`,
        });
      } else {
        setImageStatus({
          type: 'error',
          message:
            err?.message ||
            'Could not save service. Make sure you are logged in as an admin and the backend is running.',
        });
      }
    } finally {
      setImageBusy(false);
    }
  };

  const handleEdit = (service) => {
    setForm({ ...service });
    setEditing(true);
    clearSelectedImage();
    setImageStatus({ type: '', message: '' });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    const { id, name } = target;
    setDeleting(true);
    setImageStatus({ type: 'loading', message: `Deleting “${name}”…` });
    try {
      const data = await api.del(`/services/${encodeURIComponent(id)}`);
      if (editing && form.id === id) {
        setForm(EMPTY_FORM);
        setEditing(false);
        clearSelectedImage();
      }
      await refreshCatalog();
      setDeleteTarget(null);
      flashNote(`“${name}” was deleted.`);
      setImageStatus(
        data?.warning
          ? { type: 'warning', message: data.warning }
          : { type: 'success', message: 'Service deleted from the database.' }
      );
      scheduleStatusClear();
    } catch (err) {
      setDeleteTarget(null);
      setNote('');
      setImageStatus({ type: 'error', message: err?.message || 'Could not delete service.' });
    } finally {
      setDeleting(false);
    }
  };

  const serviceList = Array.isArray(services) ? services : [];
  const withImages = serviceList.filter((s) => s.image).length;
  const avgDuration =
    serviceList.length > 0
      ? Math.round(
          serviceList.reduce((sum, service) => sum + (Number(service.duration) || 0), 0) /
            serviceList.length
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-brand" aria-hidden="true" />
            Catalog
          </p>
          <h2 className="mt-2 text-h2">Services</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Manage treatment names, pricing, duration, imagery, and categories. Every change is
            saved to PostgreSQL and appears on the public site.
          </p>
        </div>
        {note ? (
          <span
            role="status"
            className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-deep"
          >
            {note}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-soft">
          <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">Services</p>
          <p className="mt-0.5 text-lg font-bold text-ink">{serviceList.length}</p>
        </div>
        <div className="rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-soft">
          <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">With image</p>
          <p className="mt-0.5 text-lg font-bold text-ink">{withImages}</p>
        </div>
        <div className="rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-soft">
          <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">Avg. length</p>
          <p className="mt-0.5 text-lg font-bold text-ink">
            {avgDuration}
            <span className="ml-1 text-xs font-medium text-ink-soft">min</span>
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Table */}
        <Card padding="p-0" className="overflow-hidden lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <div>
              <h3 className="text-base font-bold text-ink">All services</h3>
              <p className="mt-0.5 text-xs text-ink-soft">Click edit to load a service into the form.</p>
            </div>
            <Badge variant="muted">{serviceList.length} total</Badge>
          </div>

          {serviceList.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No services yet"
                description="Add your first service using the form to start taking bookings."
                icon={Scissors}
              />
            </div>
          ) : (
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-y border-line bg-surface/80 text-[11px] font-bold tracking-[0.08em] text-ink-soft uppercase">
                    <th className="px-5 py-3">Service</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Price</th>
                    <th className="px-5 py-3">Duration</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceList.map((s) => (
                    <tr
                      key={s.id}
                      className={`border-b border-line transition last:border-0 hover:bg-surface/70 ${
                        editing && form.id === s.id ? 'bg-teal-50/40' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {s.image ? (
                            <img
                              src={s.image}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="h-11 w-11 shrink-0 rounded-lg border border-line bg-surface object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dashed border-line bg-white text-ink-soft">
                              <ImageIcon className="h-4 w-4" aria-hidden="true" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-bold text-ink">{s.name}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                              {s.rating ?? '—'}
                              {s.description ? (
                                <span className="ml-1 hidden truncate sm:inline">· {s.description}</span>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge>{s.categoryName || s.category || 'Uncategorized'}</Badge>
                      </td>
                      <td className="px-5 py-3.5 font-bold whitespace-nowrap text-teal-deep">{s.price}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-ink-soft">{s.duration} min</td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEdit(s)}
                            aria-label={`Edit ${s.name}`}
                            className="rounded-lg border border-line p-2 text-ink-soft transition hover:border-slate-300 hover:bg-slate-100 hover:text-ink"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(s)}
                            aria-label={`Delete ${s.name}`}
                            className="rounded-lg border border-line p-2 text-red-600 transition hover:border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-line bg-surface/50 px-5 py-2.5 text-[11px] text-ink-soft">
            Services with existing appointments cannot be deleted; edit them instead.
          </p>
        </Card>

        {/* Form */}
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-base font-bold text-ink">
                {editing ? (
                  <Pencil className="h-5 w-5 text-teal-deep" aria-hidden="true" />
                ) : (
                  <Plus className="h-5 w-5 text-teal-deep" aria-hidden="true" />
                )}
                {editing ? 'Edit service' : 'Add service'}
              </h3>
              <p className="mt-1 text-xs text-ink-soft">
                {editing
                  ? 'Changes are saved to the existing database record.'
                  : 'Create a new service in the catalog.'}
              </p>
            </div>
            {editing ? <Badge variant="warning">Editing</Badge> : null}
          </div>

          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <div>
              <label htmlFor="svc-name" className="field-label">
                Name
              </label>
              <input
                id="svc-name"
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. Haircut & Styling"
                className="field"
              />
            </div>
            <div>
              <label htmlFor="svc-desc" className="field-label">
                Description
              </label>
              <textarea
                id="svc-desc"
                required
                rows="3"
                maxLength={600}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="What the service includes and who it is for."
                className="field resize-y"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="svc-cat" className="field-label">
                  Category
                </label>
                <select
                  id="svc-cat"
                  value={effectiveCategoryId}
                  onChange={(e) => update('category', e.target.value)}
                  className="field"
                >
                  {!categoryOptions.some((c) => c.id === effectiveCategoryId) ? (
                    <option value={effectiveCategoryId} disabled>
                      Select a category…
                    </option>
                  ) : null}
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="svc-price" className="field-label">
                  Price (NPR)
                </label>
                <input
                  id="svc-price"
                  required
                  value={form.price}
                  onChange={(e) => update('price', e.target.value)}
                  placeholder="NPR 1,500"
                  className="field"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="svc-dur" className="field-label">
                  Duration (mins)
                </label>
                <input
                  id="svc-dur"
                  type="number"
                  min="15"
                  step="5"
                  required
                  value={form.duration}
                  onChange={(e) => update('duration', e.target.value)}
                  className="field"
                />
              </div>
              <div>
                <label htmlFor="svc-rating" className="field-label">
                  Rating
                </label>
                <input
                  id="svc-rating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={form.rating}
                  onChange={(e) => update('rating', e.target.value)}
                  className="field"
                />
              </div>
            </div>

            <ImageUploadField
              id="svc-image"
              label="Service image"
              description="Uploaded to UploadThing and saved with this service."
              file={imageFile}
              onFileChange={setImageFile}
              currentImageUrl={form.image}
              onUpload={handleUploadImage}
              onRemove={handleRemoveImage}
              canUpload={editing && Boolean(form.id)}
              busy={imageBusy}
              progress={imageProgress}
              status={imageStatus}
              uploadLabel="Upload image"
              removeLabel="Remove image"
              removeConfirm="Remove this service image? The service record will be kept."
              shape="wide"
              emptyText={
                editing
                  ? 'No image set. Existing data is preserved until you upload one.'
                  : 'Select an image to preview it before saving.'
              }
              helpText="JPG, JPEG, PNG, or WEBP. Max 4 MB. The UploadThing URL is stored in PostgreSQL."
            />

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" fullWidth loading={imageBusy} disabled={imageBusy}>
                {imageBusy ? 'Saving…' : editing ? 'Save changes' : 'Create service'}
              </Button>
              {editing ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={imageBusy}
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setEditing(false);
                    clearSelectedImage();
                    setImageStatus({ type: '', message: '' });
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>

            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-ink-soft">
              <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-deep" aria-hidden="true" />
              Service details are saved to PostgreSQL. Selected images are uploaded to UploadThing
              and only the returned URL is stored in the database.
            </p>
          </form>
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete service"
        description={`Permanently delete “${deleteTarget?.name || ''}” from the database? If this service has appointments, it will not be deleted.`}
        confirmLabel="Delete service"
        loading={deleting}
      />
    </div>
  );
}
