// AdminProviders (Specialists) - manage specialist details.
// Profile images are uploaded to UploadThing by the backend and the returned
// URL is saved in PostgreSQL (Specialist.imageUrl). Existing images are
// preserved when other specialist fields are edited.

import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, Pencil, Plus, Star, Trash2, UserRound } from 'lucide-react';

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
  title: '',
  experience: 5,
  rating: 4.8,
  specialty: 'Salons',
  image: '',
};

export default function AdminProviders() {
  const { specialists, categories, refreshCatalog } = useDemo();
  const specialistList = Array.isArray(specialists) ? specialists : [];
  const specialtyOptions = (Array.isArray(categories) ? categories : [])
    .filter((c) => c.id !== 'all')
    .map((c) => c.name);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  // Keep the new-specialist form on a specialty that exists in the live
  // catalog instead of the stale built-in default.
  const effectiveSpecialty = editing
    ? form.specialty
    : specialtyOptions.includes(form.specialty)
      ? form.specialty
      : specialtyOptions[0] || '';
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

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const clearSelectedImage = () => {
    setImageFile(null);
    setImageProgress(0);
  };

  const handleUploadImage = async () => {
    if (!editing || !form.id) {
      setImageStatus({
        type: 'error',
        message:
          'Save the specialist first to create a database record, then upload the image. (Or select an image and use Save — it will create the specialist and upload the image.)',
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
        `/specialists/${encodeURIComponent(form.id)}/image`,
        fd,
        setImageProgress
      );
      setForm((current) => ({ ...current, image: data?.specialist?.image || '' }));
      clearSelectedImage();
      setImageStatus(
        data?.warning
          ? { type: 'warning', message: data.warning }
          : {
              type: 'success',
              message: 'Profile image uploaded to UploadThing and saved in PostgreSQL.',
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
      const data = await api.del(`/specialists/${encodeURIComponent(form.id)}/image`);
      setForm((current) => ({ ...current, image: data?.specialist?.image || '' }));
      clearSelectedImage();
      setImageStatus(
        data?.warning
          ? { type: 'warning', message: data.warning }
          : {
              type: 'success',
              message: 'Image removed. Existing specialist data was preserved.',
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

    // Keep specialty in sync with the live category list; fall back to the
    // first category for a new specialist instead of a stale default.
    const specialty =
      specialtyOptions.find((name) => name === effectiveSpecialty) ||
      (editing ? '' : specialtyOptions[0] || '');
    if (!specialty) {
      setImageStatus({
        type: 'error',
        message: editing
          ? 'Choose a valid specialty before saving.'
          : 'Create a category before adding a specialist.',
      });
      return;
    }

    setImageBusy(true);
    setImageProgress(0);
    let savedRecord = null;
    let uploadWarning = '';
    const hadFile = Boolean(imageFile);
    try {
      setImageStatus({
        type: 'loading',
        message: editing && form.id ? 'Saving specialist…' : 'Creating specialist…',
      });
      const payload = {
        name: form.name,
        title: form.title,
        specialty,
        experience: Number(form.experience) || 0,
        rating: Number(form.rating) || 4.8,
      };
      if (editing && form.id) {
        const data = await api.patch(`/specialists/${encodeURIComponent(form.id)}`, payload);
        savedRecord = data?.specialist;
      } else {
        const data = await api.post('/specialists', payload);
        savedRecord = data?.specialist;
      }
      if (!savedRecord?.id) throw new Error('Specialist was saved but the server response was incomplete.');

      let finalImage = savedRecord.image || '';
      if (imageFile) {
        setImageStatus({ type: 'loading', message: 'Uploading image to UploadThing…' });
        const fd = new FormData();
        fd.append('image', imageFile);
        const imgData = await api.postFormWithProgress(
          `/specialists/${encodeURIComponent(savedRecord.id)}/image`,
          fd,
          setImageProgress
        );
        finalImage = imgData?.specialist?.image || finalImage;
        uploadWarning = imgData?.warning || '';
        clearSelectedImage();
      }
      await refreshCatalog();
      setForm({ ...savedRecord, image: finalImage });
      setEditing(true);
      flashNote('Specialist saved to the database.');
      setImageStatus(
        uploadWarning
          ? { type: 'warning', message: uploadWarning }
          : {
              type: 'success',
              message: hadFile
                ? 'Specialist saved and image uploaded to UploadThing.'
                : 'Specialist saved to the database.',
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
          message: `Specialist was saved, but image upload failed: ${err?.message || 'Unknown error'}. You can try uploading again.`,
        });
      } else {
        setImageStatus({
          type: 'error',
          message:
            err?.message ||
            'Could not save specialist. Make sure you are logged in as an admin and the backend is running.',
        });
      }
    } finally {
      setImageBusy(false);
    }
  };

  const handleEdit = (specialist) => {
    setForm({ ...specialist });
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
      const data = await api.del(`/specialists/${encodeURIComponent(id)}`);
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
          : { type: 'success', message: 'Specialist deleted from the database.' }
      );
      scheduleStatusClear();
    } catch (err) {
      setDeleteTarget(null);
      setNote('');
      setImageStatus({ type: 'error', message: err?.message || 'Could not delete specialist.' });
    } finally {
      setDeleting(false);
    }
  };

  const withPhotos = specialistList.filter((s) => s.image).length;
  const avgExperience =
    specialistList.length > 0
      ? Math.round(
          specialistList.reduce((sum, item) => sum + (Number(item.experience) || 0), 0) /
            specialistList.length
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-brand" aria-hidden="true" />
            Team
          </p>
          <h2 className="mt-2 text-h2">Providers</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Maintain specialist profiles, specialties, experience, and photos. Providers appear on
            the public specialists page and in booking.
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
          <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">Providers</p>
          <p className="mt-0.5 text-lg font-bold text-ink">{specialistList.length}</p>
        </div>
        <div className="rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-soft">
          <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">With photo</p>
          <p className="mt-0.5 text-lg font-bold text-ink">{withPhotos}</p>
        </div>
        <div className="rounded-xl border border-line/80 bg-white px-3.5 py-3 shadow-soft">
          <p className="text-[11px] font-bold tracking-wide text-ink-soft uppercase">Avg. experience</p>
          <p className="mt-0.5 text-lg font-bold text-ink">
            {avgExperience}
            <span className="ml-1 text-xs font-medium text-ink-soft">yrs</span>
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card padding="p-0" className="overflow-hidden lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <div>
              <h3 className="text-base font-bold text-ink">All specialists</h3>
              <p className="mt-0.5 text-xs text-ink-soft">Click edit to load a provider into the form.</p>
            </div>
            <Badge variant="muted">{specialistList.length} total</Badge>
          </div>

          {specialistList.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No specialists yet"
                description="Add your first specialist using the form to start taking bookings."
                icon={UserRound}
              />
            </div>
          ) : (
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-y border-line bg-surface/80 text-[11px] font-bold tracking-[0.08em] text-ink-soft uppercase">
                    <th className="px-5 py-3">Specialist</th>
                    <th className="px-5 py-3">Specialty</th>
                    <th className="px-5 py-3">Experience</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {specialistList.map((s) => (
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
                              className="h-10 w-10 shrink-0 rounded-full border border-line bg-surface object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-deep ring-1 ring-teal-100/70">
                              <UserRound className="h-4 w-4" aria-hidden="true" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-bold text-ink">{s.name}</p>
                            <p className="flex items-center gap-1 text-xs text-ink-soft">
                              <span className="truncate">{s.title || '—'}</span>
                              <span aria-hidden="true">·</span>
                              <Star
                                className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400"
                                aria-hidden="true"
                              />
                              {s.rating ?? '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge>{s.specialty || '—'}</Badge>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-ink-soft">
                        {s.experience ?? 0} yrs
                      </td>
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
            Specialists with existing appointments cannot be deleted; edit them instead.
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
                {editing ? 'Edit specialist' : 'Add specialist'}
              </h3>
              <p className="mt-1 text-xs text-ink-soft">
                {editing
                  ? 'Changes are saved to the existing database record.'
                  : 'Create a new provider profile.'}
              </p>
            </div>
            {editing ? <Badge variant="warning">Editing</Badge> : null}
          </div>

          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <div>
              <label htmlFor="sp-name" className="field-label">
                Name
              </label>
              <input
                id="sp-name"
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. Sita Sharma"
                className="field"
              />
            </div>
            <div>
              <label htmlFor="sp-title" className="field-label">
                Job title
              </label>
              <input
                id="sp-title"
                required
                maxLength={100}
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="e.g. Senior Stylist"
                className="field"
              />
            </div>
            <div>
              <label htmlFor="sp-spec" className="field-label">
                Specialty (category)
              </label>
              <select
                id="sp-spec"
                value={effectiveSpecialty}
                onChange={(e) => update('specialty', e.target.value)}
                className="field"
              >
                {!specialtyOptions.includes(effectiveSpecialty) ? (
                  <option value={effectiveSpecialty} disabled>
                    Select a specialty…
                  </option>
                ) : null}
                {specialtyOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sp-exp" className="field-label">
                  Experience (yrs)
                </label>
                <input
                  id="sp-exp"
                  type="number"
                  min="0"
                  max="60"
                  value={form.experience}
                  onChange={(e) => update('experience', e.target.value)}
                  className="field"
                />
              </div>
              <div>
                <label htmlFor="sp-rating" className="field-label">
                  Rating
                </label>
                <input
                  id="sp-rating"
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
              id="sp-image"
              label="Profile photo"
              description="Uploaded to UploadThing and saved with this specialist."
              file={imageFile}
              onFileChange={setImageFile}
              currentImageUrl={form.image}
              onUpload={handleUploadImage}
              onRemove={handleRemoveImage}
              canUpload={editing && Boolean(form.id)}
              busy={imageBusy}
              progress={imageProgress}
              status={imageStatus}
              uploadLabel="Upload profile image"
              removeLabel="Remove image"
              removeConfirm="Remove this profile image? The specialist record will be kept."
              shape="avatar"
              emptyText={
                editing
                  ? 'No image set. Existing data is preserved until you upload one.'
                  : 'Select an image to preview it before saving.'
              }
              helpText="JPG, JPEG, PNG, or WEBP. Max 4 MB. The UploadThing URL is stored in PostgreSQL."
            />

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" fullWidth loading={imageBusy} disabled={imageBusy}>
                {imageBusy ? 'Saving…' : editing ? 'Save changes' : 'Create specialist'}
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
              Specialist details are saved to PostgreSQL. Selected images are uploaded to
              UploadThing and only the returned URL is stored in the database.
            </p>
          </form>
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete specialist"
        description={`Permanently delete “${deleteTarget?.name || ''}” from the database? If they have appointments, they will not be deleted.`}
        confirmLabel="Delete specialist"
        loading={deleting}
      />
    </div>
  );
}
