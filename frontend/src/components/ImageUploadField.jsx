// ImageUploadField — reusable admin image uploader.
// Handles file selection, client-side validation, preview, replacement, removal,
// upload progress, and success/error messages. The parent owns the actual upload
// request so the same component works for services and specialists.

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, Upload, X } from 'lucide-react';

import Button from './Button';
import ConfirmDialog from './ConfirmDialog';

const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;

function formatMb(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export default function ImageUploadField({
  id,
  label = 'Image',
  description,
  file = null,
  onFileChange,
  currentImageUrl = '',
  onUpload,
  onRemove,
  canUpload = true,
  busy = false,
  progress = null,
  status = { type: '', message: '' },
  uploadLabel = 'Upload Image',
  removeLabel = 'Remove Image',
  removeConfirm = 'Remove this image?',
  clearLabel = 'Clear selection',
  shape = 'wide',
  disabled = false,
  accept = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  maxBytes = DEFAULT_MAX_BYTES,
  emptyText,
  helpText,
  className = '',
}) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [validationError, setValidationError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const isDisabled = disabled || busy;
  const previewSource =
    (file && previewUrl) || (!file && typeof currentImageUrl === 'string' ? currentImageUrl.trim() : '');
  const message = validationError || status.message;
  const messageType = validationError ? 'error' : status.type;

  // When the parent clears the selected file (for example after a successful
  // upload), reset the native input and release the preview URL.
  useEffect(() => {
    if (!file) {
      if (inputRef.current) inputRef.current.value = '';
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    }
  }, [file, previewUrl]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const clearPreview = () => {
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return '';
    });
  };

  const handleFileChange = (event) => {
    const selected = event.target.files && event.target.files[0];
    setValidationError('');

    if (!selected) {
      clearPreview();
      onFileChange?.(null);
      return;
    }

    if (!allowedTypes.includes(selected.type)) {
      setValidationError('Unsupported format. Please use JPG, JPEG, PNG, or WEBP.');
      clearPreview();
      event.target.value = '';
      onFileChange?.(null);
      return;
    }

    if (selected.size > maxBytes) {
      setValidationError(`Image is too large. Maximum size is ${formatMb(maxBytes)}.`);
      clearPreview();
      event.target.value = '';
      onFileChange?.(null);
      return;
    }

    if (selected.size <= 0) {
      setValidationError('The selected image is empty. Please choose another file.');
      clearPreview();
      event.target.value = '';
      onFileChange?.(null);
      return;
    }

    clearPreview();
    setPreviewUrl(URL.createObjectURL(selected));
    onFileChange?.(selected);
  };

  const handleClear = () => {
    clearPreview();
    setValidationError('');
    if (inputRef.current) inputRef.current.value = '';
    onFileChange?.(null);
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    setRemoving(true);
    try {
      await onRemove();
      setConfirmOpen(false);
    } catch {
      // The parent shows the error message via the status prop.
      setConfirmOpen(false);
    } finally {
      setRemoving(false);
    }
  };

  const previewClassName =
    shape === 'avatar'
      ? 'h-28 w-28 rounded-2xl object-cover'
      : 'h-40 w-full rounded-xl object-cover sm:h-48';

  return (
    <div className={`rounded-2xl border border-line bg-surface/70 p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-bold text-ink">
            <ImagePlus className="h-4 w-4 text-teal-deep" aria-hidden="true" />
            {label}
          </h4>
          {description ? <p className="mt-1 text-xs leading-relaxed text-ink-soft">{description}</p> : null}
        </div>
        {busy ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-teal-deep ring-1 ring-line">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Working…
          </span>
        ) : null}
      </div>

      <div className="mt-3">
        {previewSource ? (
          <img
            src={previewSource}
            alt={file ? 'Selected image preview' : label}
            className={`${previewClassName} border border-line bg-white`}
          />
        ) : (
          <div
            className={`flex items-center justify-center border border-dashed border-line bg-white/70 text-center ${
              shape === 'avatar' ? 'h-28 w-28 rounded-2xl' : 'h-40 w-full rounded-xl sm:h-48'
            }`}
          >
            <div className="px-4">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-deep">
                <ImagePlus className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-2 text-xs text-ink-soft">{emptyText || 'No image selected yet.'}</p>
            </div>
          </div>
        )}
      </div>

      <label htmlFor={id} className="mt-4 mb-1.5 block text-sm font-semibold text-ink">
        Select image from your computer
      </label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={isDisabled}
        className="block w-full cursor-pointer rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-teal-deep hover:file:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <p className="mt-1 text-xs text-ink-soft">
        {helpText || `JPG, JPEG, PNG, or WEBP. Max ${formatMb(maxBytes)}.`}
      </p>

      {busy && typeof progress === 'number' ? (
        <div className="mt-3">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.max(0, Math.min(100, Math.round(progress)))}
            aria-label="Image upload progress"
          >
            <div
              className="h-full rounded-full bg-teal-brand transition-all duration-200"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
          <p className="mt-1 text-xs font-semibold text-ink-soft">
            {progress >= 100 ? 'Finishing upload…' : `Uploading… ${Math.round(progress)}%`}
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onUpload}
          disabled={!file || isDisabled || !canUpload}
          title={canUpload ? 'Upload the selected image' : 'Save the record first, then upload an image.'}
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? 'Working…' : uploadLabel}
        </Button>

        {file ? (
          <Button type="button" size="sm" variant="ghost" onClick={handleClear} disabled={isDisabled}>
            <X className="h-4 w-4" />
            {clearLabel}
          </Button>
        ) : null}

        {!file && currentImageUrl && onRemove ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmOpen(true)} disabled={isDisabled}>
            <X className="h-4 w-4" />
            {removeLabel}
          </Button>
        ) : null}
      </div>

      {message ? (
        <p
          role="status"
          aria-live="polite"
          className={`mt-2 text-xs font-semibold ${
            messageType === 'error'
              ? 'text-red-600'
              : messageType === 'warning'
                ? 'text-amber-700'
                : messageType === 'success'
                  ? 'text-teal-deep'
                  : 'text-ink-soft'
          }`}
        >
          {message}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRemove}
        title="Remove image"
        description={removeConfirm}
        confirmLabel="Remove image"
        loading={removing}
      />
    </div>
  );
}
