// AdminProviders (Specialists) - manage specialist details.
// Profile images are uploaded to UploadThing by the backend and the returned
// URL is saved in PostgreSQL (Specialist.imageUrl). Existing images are
// preserved when other specialist fields are edited.

import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { api } from '../api/client';
import Button from '../components/Button';
import Card from '../components/Card';
import Badge from '../components/Badge';
import ImageUploadField from '../components/ImageUploadField';
import { useDemo } from '../store/DemoContext';

const inputClassName =
  'w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-100';

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
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const [imageStatus, setImageStatus] = useState({ type: '', message: '' });

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
      setImageStatus({
        type: 'success',
        message: 'Profile image uploaded to UploadThing and saved in PostgreSQL.',
      });
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
      setImageStatus({ type: 'success', message: 'Image removed. Existing specialist data was preserved.' });
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
    setImageBusy(true);
    setImageProgress(0);
    let savedRecord = null;
    const hadFile = Boolean(imageFile);
    try {
      setImageStatus({ type: 'loading', message: editing && form.id ? 'Saving specialist…' : 'Creating specialist…' });
      const payload = {
        name: form.name,
        title: form.title,
        specialty: form.specialty,
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
        clearSelectedImage();
      }
      await refreshCatalog();
      setForm({ ...savedRecord, image: finalImage });
      setEditing(true);
      setNote('Specialist saved to the database.');
      setImageStatus({
        type: 'success',
        message: hadFile
          ? 'Specialist saved and image uploaded to UploadThing.'
          : 'Specialist saved to the database.',
      });
      window.setTimeout(() => setNote(''), 4000);
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

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Permanently delete "${name}" from the database? If they have appointments, they will not be deleted.`)) {
      return;
    }
    setImageStatus({ type: 'loading', message: `Deleting "${name}"…` });
    try {
      await api.del(`/specialists/${encodeURIComponent(id)}`);
      if (editing && form.id === id) {
        setForm(EMPTY_FORM);
        setEditing(false);
        clearSelectedImage();
      }
      await refreshCatalog();
      setNote(`"${name}" was deleted.`);
      setImageStatus({ type: 'success', message: 'Specialist deleted from the database.' });
      window.setTimeout(() => setNote(''), 4000);
      window.setTimeout(() => setImageStatus((s) => (s.type === 'success' ? { type: '', message: '' } : s)), 4000);
    } catch (err) {
      setNote('');
      setImageStatus({ type: 'error', message: err?.message || 'Could not delete specialist.' });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card padding="p-0" className="overflow-hidden lg:col-span-3">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-base font-bold text-ink">All Specialists ({specialists.length})</h3>
          {note && <p role="status" className="text-xs font-semibold text-teal-deep">{note}</p>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-y border-line bg-surface text-xs font-bold tracking-wider text-ink-soft uppercase">
                <th className="px-5 py-3">Specialist</th>
                <th className="px-5 py-3">Specialty</th>
                <th className="px-5 py-3">Experience</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {specialists.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0 hover:bg-surface">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {s.image ? (
                        <img src={s.image} alt={s.name} className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-deep">{(s.name || '?').slice(0, 1)}</div>
                      )}
                      <div>
                        <p className="font-bold text-ink">{s.name}</p>
                        <p className="text-xs text-ink-soft">{s.title} · ★ {s.rating}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5"><Badge>{s.specialty}</Badge></td>
                  <td className="px-5 py-3.5 text-ink-soft">{s.experience} yrs</td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setForm({ ...s }); setEditing(true); clearSelectedImage(); setImageStatus({ type: '', message: '' }); }} aria-label={`Edit ${s.name}`} className="rounded-lg border border-line p-2 text-ink-soft hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => handleDelete(s.id, s.name)} aria-label={`Delete ${s.name}`} className="rounded-lg border border-line p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <h3 className="flex items-center gap-2 text-base font-bold text-ink">
          {editing ? <Pencil className="h-5 w-5 text-teal-deep" /> : <Plus className="h-5 w-5 text-teal-deep" />}
          {editing ? 'Edit Specialist' : 'Add Specialist'}
        </h3>
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label htmlFor="sp-name" className="mb-1.5 block text-sm font-semibold text-ink">Name</label>
            <input id="sp-name" required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Sita Sharma" className={inputClassName} />
          </div>
          <div>
            <label htmlFor="sp-title" className="mb-1.5 block text-sm font-semibold text-ink">Job Title</label>
            <input id="sp-title" required value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Senior Stylist" className={inputClassName} />
          </div>
          <div>
            <label htmlFor="sp-spec" className="mb-1.5 block text-sm font-semibold text-ink">Specialty (category)</label>
            <select id="sp-spec" value={form.specialty} onChange={(e) => update('specialty', e.target.value)} className={inputClassName}>
              {categories.filter((c) => c.id !== 'all').map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sp-exp" className="mb-1.5 block text-sm font-semibold text-ink">Experience (yrs)</label>
              <input id="sp-exp" type="number" min="0" value={form.experience} onChange={(e) => update('experience', e.target.value)} className={inputClassName} />
            </div>
            <div>
              <label htmlFor="sp-rating" className="mb-1.5 block text-sm font-semibold text-ink">Rating</label>
              <input id="sp-rating" type="number" step="0.1" min="0" max="5" value={form.rating} onChange={(e) => update('rating', e.target.value)} className={inputClassName} />
            </div>
          </div>
          <ImageUploadField
            id="sp-image"
            label="Specialist Profile Photo"
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
            uploadLabel="Upload Profile Image"
            removeLabel="Remove Image"
            removeConfirm="Remove this profile image? The specialist record will be kept."
            shape="avatar"
            emptyText={
              editing
                ? 'No image set. Existing data is preserved until you upload one.'
                : 'Select an image to preview it before saving.'
            }
            helpText="JPG, JPEG, PNG, or WEBP. Max 4 MB. The UploadThing URL is stored in PostgreSQL."
          />
          <div className="flex gap-2">
            <Button type="submit" fullWidth disabled={imageBusy}>{imageBusy ? 'Saving…' : (editing ? 'Save Changes' : 'Create Specialist')}</Button>
            {editing && <Button type="button" variant="secondary" disabled={imageBusy} onClick={() => { setForm(EMPTY_FORM); setEditing(false); clearSelectedImage(); setImageStatus({ type: '', message: '' }); }}>Cancel</Button>}
          </div>
          <p className="text-xs text-ink-soft">Specialist details are saved to PostgreSQL. Selected images are uploaded to UploadThing and only the returned URL is stored in the database.</p>
        </form>
      </Card>
    </div>
  );
}
