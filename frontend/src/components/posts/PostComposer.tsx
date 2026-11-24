import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Globe, Users, RotateCcw } from 'lucide-react';
import type { PostAudience, PostItem } from '../../types';
import { apiUploadWithProgress } from '../../lib/api';
import { Modal } from '../ui/Modal';

interface PostComposerProps {
  open: boolean;
  onClose: () => void;
  onCreated: (post: PostItem) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 8 * 1024 * 1024;

export const PostComposer: React.FC<PostComposerProps> = ({ open, onClose, onCreated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [step, setStep] = useState<'compose' | 'audience'>('compose');
  const [audience, setAudience] = useState<PostAudience>('FRIENDS_ONLY');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreviewUrl(null);
      setCaption('');
      setStep('compose');
      setAudience('FRIENDS_ONLY');
      setProgress(0);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError('Image is larger than 8 MB. Choose a smaller photo.');
      return;
    }
    // Never auto-publish on select — preview and wait for caption + explicit audience confirmation
    setFile(selected);
  }

  async function handlePublish() {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('caption', caption.trim());
      formData.append('audience', audience);

      const res = await apiUploadWithProgress<{ post: PostItem }>(
        '/api/posts',
        formData,
        (pct) => setProgress(pct)
      );
      onCreated(res.post);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish post.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={uploading ? () => {} : onClose}
      title={step === 'compose' ? 'Create photo post' : 'Choose post audience'}
      description={
        step === 'compose'
          ? 'Pick a photo from your device, preview it, and write a description.'
          : 'Confirm who is allowed to view this post before publishing.'
      }
    >
      {step === 'compose' ? (
        <div className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {previewUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-cbox-border bg-cbox-bg">
              <img
                src={previewUrl}
                alt="Selected post preview"
                className="w-full max-h-72 object-contain"
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-slate-950/75 text-white text-xs font-medium backdrop-blur-sm"
              >
                Change photo
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full py-12 px-4 rounded-2xl border-2 border-dashed border-cbox-border hover:border-cbox-accent/60 bg-cbox-elevated/40 flex flex-col items-center gap-2 text-cbox-muted hover:text-cbox-text transition"
            >
              <ImagePlus className="h-8 w-8 text-cbox-accent" />
              <span className="text-sm font-medium">Select photo from device gallery</span>
              <span className="text-xs">JPEG, PNG, or WebP up to 8 MB</span>
            </button>
          )}

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-cbox-muted">Description / Caption</span>
            <textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={1000}
              placeholder="Write a caption for your photo…"
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-sm text-cbox-text"
            />
          </label>

          {error && <p className="text-xs text-cbox-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-cbox-border text-cbox-text hover:bg-cbox-elevated"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!file}
              onClick={() => setStep('audience')}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-cbox-accent text-slate-950 hover:bg-cbox-accentHover disabled:opacity-40"
            >
              Post
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => setAudience('FRIENDS_ONLY')}
              className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition ${
                audience === 'FRIENDS_ONLY'
                  ? 'border-cbox-violet bg-cbox-violet/10'
                  : 'border-cbox-border bg-cbox-elevated/40 hover:bg-cbox-elevated'
              }`}
            >
              <Users className="h-5 w-5 text-cbox-violet shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-cbox-text">Friends only</p>
                <p className="text-xs text-cbox-muted mt-0.5">
                  Visible only to your accepted friends and yourself. Enforced on feed and image
                  delivery.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAudience('PUBLIC')}
              className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition ${
                audience === 'PUBLIC'
                  ? 'border-cbox-accent bg-cbox-accent/10'
                  : 'border-cbox-border bg-cbox-elevated/40 hover:bg-cbox-elevated'
              }`}
            >
              <Globe className="h-5 w-5 text-cbox-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-cbox-text">Public</p>
                <p className="text-xs text-cbox-muted mt-0.5">
                  Visible to all signed-in Cbox users.
                </p>
              </div>
            </button>
          </div>

          {uploading && (
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-cbox-elevated overflow-hidden">
                <div
                  className="h-full bg-cbox-accent transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-cbox-muted text-right">Uploading… {progress}%</p>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-cbox-danger/10 border border-cbox-danger/30 text-xs text-cbox-danger">
              <span>{error}</span>
              <button
                type="button"
                onClick={handlePublish}
                className="inline-flex items-center gap-1 font-semibold underline shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => setStep('compose')}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-cbox-border text-cbox-text hover:bg-cbox-elevated disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={handlePublish}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-cbox-accent text-slate-950 hover:bg-cbox-accentHover disabled:opacity-50"
            >
              {uploading
                ? 'Publishing…'
                : `Confirm & Publish (${audience === 'PUBLIC' ? 'Public' : 'Friends only'})`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
