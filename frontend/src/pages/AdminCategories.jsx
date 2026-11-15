// AdminCategories — list, add, and delete categories via the backend API (PostgreSQL source of truth).

import { useEffect, useRef, useState } from 'react';
import { Info, Layers, Plus, Tag, Trash2 } from 'lucide-react';

import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { useDemo } from '../store/DemoContext';

export default function AdminCategories() {
  const { categories, services, refreshCatalog } = useDemo();
  const categoryList = Array.isArray(categories) ? categories : [];
  const serviceList = Array.isArray(services) ? services : [];
  const customCategories = categoryList.filter((c) => c.id !== 'all');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const clearTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    },
    []
  );

  const scheduleClear = () => {
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    clearTimerRef.current = window.setTimeout(
      () => setStatus((s) => (s.type === 'success' ? { type: '', message: '' } : s)),
      4000
    );
  };

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
      scheduleClear();
    } catch (err) {
      setStatus({ type: 'error', message: err?.message || 'Could not create category.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const category = deleteTarget;
    if (!category || category.id === 'all') return;
    setDeleting(true);
    setStatus({ type: 'loading', message: `Deleting “${category.name}”…` });
    try {
      const data = await api.del(`/categories/${encodeURIComponent(category.slug || category.id)}`);
      await refreshCatalog();
      setStatus(
        data?.warning
          ? { type: 'warning', message: data.warning }
          : { type: 'success', message: 'Category deleted from the database.' }
      );
      setDeleteTarget(null);
      scheduleClear();
    } catch (err) {
      setDeleteTarget(null);
      setStatus({ type: 'error', message: err?.message || 'Could not delete category.' });
    } finally {
      setDeleting(false);
    }
  };

  const totalServices = serviceList.length;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-brand" aria-hidden="true" />
          Catalog
        </p>
        <h2 className="mt-2 text-h2">Service categories</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Group services so customers can browse and filter the catalog. Categories are shared with
          the public services page immediately after saving.
        </p>
      </div>

      {status.message ? (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
            status.type === 'error'
              ? 'border-red-100 bg-red-50 text-red-700'
              : status.type === 'warning'
                ? 'border-amber-100 bg-amber-50 text-amber-800'
                : status.type === 'success'
                  ? 'border-teal-100 bg-teal-50 text-teal-deep'
                  : 'border-line bg-white text-ink-soft'
          }`}
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {status.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card padding="p-0" className="overflow-hidden lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <div>
              <h3 className="text-base font-bold text-ink">All categories</h3>
              <p className="mt-0.5 text-xs text-ink-soft">
                {customCategories.length} custom · {totalServices} services in catalog
              </p>
            </div>
            <Badge variant="muted">{categoryList.length} rows</Badge>
          </div>

          {customCategories.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No custom categories yet"
                description="Add your first category using the form, then assign services to it."
                icon={Layers}
              />
            </div>
          ) : (
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-y border-line bg-surface/80 text-[11px] font-bold tracking-[0.08em] text-ink-soft uppercase">
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Slug</th>
                    <th className="px-5 py-3">Services</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryList.map((c) => {
                    const count =
                      c.id === 'all'
                        ? totalServices
                        : serviceList.filter((s) => s.category === c.id).length;
                    return (
                      <tr key={c.id} className="border-b border-line transition last:border-0 hover:bg-surface/70">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-deep ring-1 ring-teal-100/70">
                              <Tag className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <Badge>{c.name}</Badge>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-ink-soft">{c.slug || c.id}</td>
                        <td className="px-5 py-3.5">
                          <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-bold text-ink">
                            {count}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {c.id === 'all' ? (
                            <span className="text-xs text-ink-soft">—</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(c)}
                              disabled={busy || deleting}
                              aria-label={`Delete ${c.name}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-line bg-surface/50 px-5 py-2.5 text-[11px] text-ink-soft">
            The “All services” row is a filter shortcut, not a stored category.
          </p>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h3 className="flex items-center gap-2 text-base font-bold text-ink">
              <Plus className="h-5 w-5 text-teal-deep" aria-hidden="true" />
              Add category
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              Keep names short and specific — they appear as filter chips on the services page.
            </p>
            <form onSubmit={handleAdd} className="mt-5 space-y-4">
              <div>
                <label htmlFor="cat-name" className="field-label">
                  Category name
                </label>
                <input
                  id="cat-name"
                  required
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                  placeholder="e.g. Pharmacy"
                  className="field"
                />
                <p className="field-hint">Letters, numbers, and spaces. Max 60 characters.</p>
              </div>
              <Button type="submit" fullWidth loading={busy} disabled={busy || !name.trim()}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {busy ? 'Creating…' : 'Add category'}
              </Button>
            </form>
          </Card>

          <div className="rounded-2xl border border-teal-100/80 bg-teal-50/60 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold text-teal-deep">
              <Info className="h-4 w-4" aria-hidden="true" />
              Deleting categories
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
              A category that still has services assigned cannot be deleted. Move those services to
              another category first, then remove it here.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete category"
        description={`Delete “${deleteTarget?.name || ''}”? If services are assigned to it, the category will not be deleted.`}
        confirmLabel="Delete category"
        loading={deleting}
      />
    </div>
  );
}
