// AdminServices — add / edit / delete service details.
// Service images are uploaded to UploadThing by the backend and the returned
// URL is saved in PostgreSQL (Service.imageUrl). Existing images are preserved
// when other service fields are edited.

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
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const [imageStatus, setImageStatus] = useState({ type: '', message: '' });

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
        category: form.category,
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
      setNote('Service saved to the database.');
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
      window.setTimeout(() => setNote(''), 4000);
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
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Permanently delete "${name}" from the database? If this service has appointments, it will not be deleted.`)) {
      return;
    }
    setImageStatus({ type: 'loading', message: `Deleting "${name}"…` });
    try {
      const data = await api.del(`/services/${encodeURIComponent(id)}`);
      if (editing && form.id === id) {
        setForm(EMPTY_FORM);
        setEditing(false);
        clearSelectedImage();
      }
      await refreshCatalog();
      setNote(`"${name}" was deleted.`);
      setImageStatus(
        data?.warning
          ? { type: 'warning', message: data.warning }
          : { type: 'success', message: 'Service deleted from the database.' }
      );
      window.setTimeout(() => setNote(''), 4000);
      window.setTimeout(() => setImageStatus((s) => (s.type === 'success' ? { type: '', message: '' } : s)), 4000);
    } catch (err) {
      setNote('');
      setImageStatus({ type: 'error', message: err?.message || 'Could not delete service.' });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Table */}
      <Card padding="p-0" className="overflow-hidden lg:col-span-3">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-base font-bold text-ink">All Services ({services.length})</h3>
          {note && <p role="status" className="text-xs font-semibold text-teal-deep">{note}</p>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-y border-line bg-surface text-xs font-bold tracking-wider text-ink-soft uppercase">
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Price</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0 hover:bg-surface">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {s.image ? (
                        <img src={s.image} alt={s.name} className="h-10 w-10 shrink-0 rounded-lg border border-line object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-line bg-white text-xs font-semibold text-ink-soft">
                          {(s.name || '?').slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-ink">{s.name}</p>
                        <p className="text-xs text-ink-soft">★ {s.rating}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5"><Badge>{s.categoryName}</Badge></td>
                  <td className="px-5 py-3.5 font-bold text-teal-deep">{s.price}</td>
                  <td className="px-5 py-3.5 text-ink-soft">{s.duration} mins</td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleEdit(s)} aria-label={`Edit ${s.name}`} className="rounded-lg border border-line p-2 text-ink-soft hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => handleDelete(s.id, s.name)} aria-label={`Delete ${s.name}`} className="rounded-lg border border-line p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Form */}
      <Card className="lg:col-span-2">
        <h3 className="flex items-center gap-2 text-base font-bold text-ink">
          {editing ? <Pencil className="h-5 w-5 text-teal-deep" /> : <Plus className="h-5 w-5 text-teal-deep" />}
          {editing ? 'Edit Service' : 'Add Service'}
        </h3>
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label htmlFor="svc-name" className="mb-1.5 block text-sm font-semibold text-ink">Name</label>
            <input id="svc-name" required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Haircut & Styling" className={inputClassName} />
          </div>
          <div>
            <label htmlFor="svc-desc" className="mb-1.5 block text-sm font-semibold text-ink">Description</label>
            <textarea id="svc-desc" required rows="2" value={form.description} onChange={(e) => update('description', e.target.value)} className={inputClassName} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="svc-cat" className="mb-1.5 block text-sm font-semibold text-ink">Category</label>
              <select id="svc-cat" value={form.category} onChange={(e) => update('category', e.target.value)} className={inputClassName}>
                {categories.filter((c) => c.id !== 'all').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="svc-price" className="mb-1.5 block text-sm font-semibold text-ink">Price (NPR)</label>
              <input id="svc-price" required value={form.price} onChange={(e) => update('price', e.target.value)} placeholder="NPR 1,500" className={inputClassName} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="svc-dur" className="mb-1.5 block text-sm font-semibold text-ink">Duration (mins)</label>
              <input id="svc-dur" type="number" min="15" required value={form.duration} onChange={(e) => update('duration', e.target.value)} className={inputClassName} />
            </div>
            <div>
              <label htmlFor="svc-rating" className="mb-1.5 block text-sm font-semibold text-ink">Rating</label>
              <input id="svc-rating" type="number" step="0.1" min="0" max="5" value={form.rating} onChange={(e) => update('rating', e.target.value)} className={inputClassName} />
            </div>
          </div>
          <ImageUploadField
            id="svc-image"
            label="Service Image"
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
            uploadLabel="Upload Image"
            removeLabel="Remove Image"
            removeConfirm="Remove this service image? The service record will be kept."
            shape="wide"
            emptyText={
              editing
                ? 'No image set. Existing data is preserved until you upload one.'
                : 'Select an image to preview it before saving.'
            }
            helpText="JPG, JPEG, PNG, or WEBP. Max 4 MB. The UploadThing URL is stored in PostgreSQL."
          />

          <div className="flex gap-2">
            <Button type="submit" fullWidth disabled={imageBusy}>{imageBusy ? 'Saving…' : (editing ? 'Save Changes' : 'Create Service')}</Button>
            {editing && <Button type="button" variant="secondary" disabled={imageBusy} onClick={() => { setForm(EMPTY_FORM); setEditing(false); clearSelectedImage(); setImageStatus({ type: '', message: '' }); }}>Cancel</Button>}
          </div>
          <p className="text-xs text-ink-soft">Service details are saved to PostgreSQL. Selected images are uploaded to UploadThing and only the returned URL is stored in the database.</p>
        </form>
      </Card>
    </div>
  );
}
