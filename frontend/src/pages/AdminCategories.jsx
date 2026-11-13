// AdminCategories — list, add, and delete categories via the backend API (PostgreSQL source of truth).

import { useState } from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';

import { api } from '../api/client';
import Button from '../components/Button';
import Card from '../components/Card';
import Badge from '../components/Badge';
import { useDemo } from '../store/DemoContext';

export default function AdminCategories() {
  const { categories, services, refreshCatalog } = useDemo();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setStatus({ type: 'loading', message: 'Creating category…' });
    try {
      await api.post('/categories', { name: trimmed });
      setName('');
      await refreshCatalog();
      setStatus({ type: 'success', message: 'Category created and saved to the database.' });
      window.setTimeout(() => setStatus((s) => (s.type === 'success' ? { type: '', message: '' } : s)), 4000);
    } catch (err) {
      setStatus({ type: 'error', message: err?.message || 'Could not create category.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (category) => {
    if (!category || category.id === 'all' || busy) return;
    if (!window.confirm(`Delete category "${category.name}"? If services are assigned to it, it will not be deleted.`)) return;
    setBusy(true);
    setStatus({ type: 'loading', message: `Deleting "${category.name}"…` });
    try {
      const data = await api.del(`/categories/${encodeURIComponent(category.slug || category.id)}`);
      await refreshCatalog();
      setStatus(
        data?.warning
          ? { type: 'warning', message: data.warning }
          : { type: 'success', message: 'Category deleted from the database.' }
      );
      window.setTimeout(() => setStatus((s) => (s.type === 'success' ? { type: '', message: '' } : s)), 4000);
    } catch (err) {
      setStatus({ type: 'error', message: err?.message || 'Could not delete category.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card padding="p-0" className="overflow-hidden lg:col-span-3">
        <div className="px-5 py-4">
          <h3 className="text-base font-bold text-ink">All Categories ({categories.length})</h3>
          {status.message ? (
            <p role="status" className={`mt-1 text-xs font-semibold ${status.type === 'error' ? 'text-red-600' : status.type === 'warning' ? 'text-amber-700' : status.type === 'success' ? 'text-teal-deep' : 'text-ink-soft'}`}>{status.message}</p>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-y border-line bg-surface text-xs font-bold tracking-wider text-ink-soft uppercase">
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">Services</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface">
                  <td className="px-5 py-3.5"><Badge>{c.name}</Badge></td>
                  <td className="px-5 py-3.5 font-mono text-xs text-ink-soft">{c.id}</td>
                  <td className="px-5 py-3.5 text-ink-soft">
                    {c.id === 'all' ? services.length : services.filter((s) => s.category === c.id).length}
                  </td>
                  <td className="px-5 py-3.5">
                    {c.id === 'all' ? (
                      <span className="text-xs text-ink-soft">—</span>
                    ) : (
                      <button type="button" onClick={() => handleDelete(c)} disabled={busy} aria-label={`Delete ${c.name}`} className="rounded-lg border border-line p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <h3 className="flex items-center gap-2 text-base font-bold text-ink"><Layers className="h-5 w-5 text-teal-deep" /> Add Category</h3>
        <form onSubmit={handleAdd} className="mt-4 space-y-4">
          <div>
            <label htmlFor="cat-name" className="mb-1.5 block text-sm font-semibold text-ink">Category Name</label>
            <input id="cat-name" required value={name} onChange={(e) => setName(e.target.value)} disabled={busy} placeholder="e.g. Pharmacy" className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50" />
          </div>
          <Button type="submit" fullWidth disabled={busy || !name.trim()}><Plus className="h-4 w-4" /> {busy ? 'Working…' : 'Add Category'}</Button>
          <p className="text-xs text-ink-soft">Categories are saved to PostgreSQL via the backend API. New categories appear in the Services filter after save.</p>
        </form>
      </Card>
    </div>
  );
}
