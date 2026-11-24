import React, { useRef, useState } from 'react';
import { Plus, Eye, Trash2, ImagePlus, Globe, Users } from 'lucide-react';
import type { PostAudience, StoryItem } from '../../types';
import { apiFetch, apiUploadWithProgress } from '../../lib/api';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';

const GRADIENTS = [
  'from-sky-600 to-indigo-900',
  'from-violet-600 to-fuchsia-900',
  'from-emerald-600 to-teal-950',
  'from-rose-600 to-orange-900',
  'from-slate-800 to-slate-950',
];

interface StoryBarProps {
  stories: StoryItem[];
  onStoryCreated: (story: StoryItem) => void;
  onStoryDeleted: (id: string) => void;
  onStoryViewed: (id: string) => void;
  onNotify: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

export const StoryBar: React.FC<StoryBarProps> = ({
  stories,
  onStoryCreated,
  onStoryDeleted,
  onStoryViewed,
  onNotify,
}) => {
  const [composerOpen, setComposerOpen] = useState(false);
  const [activeStory, setActiveStory] = useState<StoryItem | null>(null);

  // Composer state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [textContent, setTextContent] = useState('');
  const [bgGradient, setBgGradient] = useState(GRADIENTS[0]);
  const [audience, setAudience] = useState<PostAudience>('FRIENDS_ONLY');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function handleOpenStory(story: StoryItem) {
    setActiveStory(story);
    if (!story.viewedByMe) {
      apiFetch(`/api/stories/${story.id}/view`, { method: 'POST' })
        .then(() => onStoryViewed(story.id))
        .catch(() => {});
    }
  }

  async function handlePublishStory(e: React.FormEvent) {
    e.preventDefault();
    if (!file && !textContent.trim()) {
      onNotify('Add a photo or write text for your story.', 'error');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      if (file) fd.append('image', file);
      fd.append('textContent', textContent.trim());
      fd.append('bgGradient', bgGradient);
      fd.append('audience', audience);
      const res = await apiUploadWithProgress<{ story: StoryItem }>('/api/stories', fd);
      onStoryCreated(res.story);
      setComposerOpen(false);
      setFile(null);
      setPreview(null);
      setTextContent('');
      onNotify('24-hour story published!', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to post story.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteStory(id: string) {
    try {
      await apiFetch(`/api/stories/${id}`, { method: 'DELETE' });
      onStoryDeleted(id);
      setActiveStory(null);
      onNotify('Story deleted.', 'info');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to delete story.', 'error');
    }
  }

  return (
    <section aria-label="24-hour stories" className="pb-1">
      <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
        {/* Add Story Button */}
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="flex flex-col items-center gap-1.5 shrink-0 w-16 group"
        >
          <div className="h-14 w-14 rounded-full border-2 border-dashed border-cbox-accent bg-cbox-accent/10 flex items-center justify-center text-cbox-accent group-hover:bg-cbox-accent/20 transition">
            <Plus className="h-6 w-6" />
          </div>
          <span className="text-[11px] font-medium text-cbox-muted truncate w-full text-center">
            Add Story
          </span>
        </button>

        {stories.map((story) => (
          <button
            key={story.id}
            type="button"
            onClick={() => handleOpenStory(story)}
            className="flex flex-col items-center gap-1.5 shrink-0 w-16"
          >
            <div
              className={`p-0.5 rounded-full ${
                story.viewedByMe
                  ? 'bg-cbox-border'
                  : 'bg-gradient-to-tr from-cbox-accent to-cbox-violet'
              }`}
            >
              <div className="p-0.5 rounded-full bg-cbox-bg">
                <Avatar src={story.author.avatarUrl} name={story.author.primaryNickname} size="md" />
              </div>
            </div>
            <span className="text-[11px] font-medium text-cbox-text truncate w-full text-center">
              {story.isOwner ? 'Your Story' : story.author.primaryNickname}
            </span>
          </button>
        ))}
      </div>

      {/* Story Composer Modal */}
      <Modal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="Add 24-hour Story"
        description="Stories disappear automatically after 24 hours."
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handlePublishStory} className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setFile(f);
              setPreview(URL.createObjectURL(f));
            }}
            className="hidden"
          />

          <div
            className={`relative h-56 rounded-2xl overflow-hidden border border-cbox-border bg-gradient-to-br ${bgGradient} flex items-center justify-center p-5 text-center`}
          >
            {preview ? (
              <img src={preview} alt="Story preview" className="h-full w-full object-contain" />
            ) : (
              <p className="text-white font-semibold text-base whitespace-pre-wrap break-words">
                {textContent || 'Write a quick status or pick a photo…'}
              </p>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/75 text-white text-xs font-medium backdrop-blur-sm"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {preview ? 'Change photo' : 'Add photo'}
            </button>
          </div>

          {!preview && (
            <div className="flex items-center gap-2">
              {GRADIENTS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setBgGradient(g)}
                  className={`h-7 w-7 rounded-full bg-gradient-to-br ${g} ${
                    bgGradient === g ? 'ring-2 ring-cbox-accent ring-offset-2 ring-offset-cbox-surface' : ''
                  }`}
                />
              ))}
            </div>
          )}

          <input
            type="text"
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            maxLength={280}
            placeholder="Write caption or status text…"
            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-sm text-cbox-text"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAudience('FRIENDS_ONLY')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 ${
                audience === 'FRIENDS_ONLY'
                  ? 'border-cbox-violet bg-cbox-violet/15 text-cbox-violet'
                  : 'border-cbox-border text-cbox-muted'
              }`}
            >
              <Users className="h-3.5 w-3.5" /> Friends only
            </button>
            <button
              type="button"
              onClick={() => setAudience('PUBLIC')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 ${
                audience === 'PUBLIC'
                  ? 'border-cbox-accent bg-cbox-accent/15 text-cbox-accent'
                  : 'border-cbox-border text-cbox-muted'
              }`}
            >
              <Globe className="h-3.5 w-3.5" /> Public
            </button>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-semibold text-sm disabled:opacity-50"
          >
            {busy ? 'Sharing…' : 'Share 24h Story'}
          </button>
        </form>
      </Modal>

      {/* Story Viewer Modal */}
      <Modal
        open={Boolean(activeStory)}
        onClose={() => setActiveStory(null)}
        title={activeStory ? activeStory.author.primaryNickname : 'Story'}
        description={
          activeStory
            ? `@${activeStory.author.username} · ${new Date(activeStory.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : undefined
        }
        maxWidthClass="max-w-md"
      >
        {activeStory && (
          <div className="space-y-4">
            <div
              className={`min-h-[300px] rounded-2xl overflow-hidden bg-gradient-to-br ${activeStory.bgGradient} flex flex-col items-center justify-center p-5 text-center`}
            >
              {activeStory.imageUrl && (
                <img
                  src={activeStory.imageUrl}
                  alt="Story"
                  className="max-h-80 w-full object-contain rounded-xl mb-3"
                />
              )}
              {activeStory.textContent && (
                <p className="text-white text-base font-medium whitespace-pre-wrap">
                  {activeStory.textContent}
                </p>
              )}
            </div>

            {activeStory.isOwner && (
              <div className="space-y-2.5 pt-2 border-t border-cbox-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-cbox-text">
                    <Eye className="h-4 w-4 text-cbox-accent" />
                    Viewed by {activeStory.viewCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteStory(activeStory.id)}
                    className="inline-flex items-center gap-1 text-cbox-danger hover:underline font-medium"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete story
                  </button>
                </div>

                {activeStory.viewers && activeStory.viewers.length > 0 && (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {activeStory.viewers.map((v) => (
                      <div key={v.user.id} className="flex items-center gap-2 text-xs">
                        <Avatar src={v.user.avatarUrl} name={v.user.primaryNickname} size="sm" />
                        <span className="font-medium text-cbox-text">{v.user.primaryNickname}</span>
                        <span className="text-cbox-muted">@{v.user.username}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
};
