import React, { useState } from 'react';
import { Globe, Users, MoreHorizontal, Pencil, Trash2, Flag } from 'lucide-react';
import type { PostAudience, PostItem } from '../../types';
import { Avatar } from '../ui/Avatar';

interface PostCardProps {
  post: PostItem;
  onEdit?: (postId: string, caption: string, audience: PostAudience) => Promise<void>;
  onDelete?: (postId: string) => Promise<void>;
  onReportSoon?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onEdit, onDelete, onReportSoon }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftCaption, setDraftCaption] = useState(post.caption);
  const [draftAudience, setDraftAudience] = useState<PostAudience>(post.audience);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!onEdit) return;
    setBusy(true);
    try {
      await onEdit(post.id, draftCaption, draftAudience);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDelete() {
    if (!onDelete) return;
    setBusy(true);
    try {
      await onDelete(post.id);
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <article className="rounded-2xl border border-cbox-border bg-cbox-surface overflow-hidden shadow-soft">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={post.author.avatarUrl} name={post.author.primaryNickname} size="md" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-cbox-text truncate">
              {post.author.primaryNickname}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-cbox-muted">
              <span className="truncate">@{post.author.username}</span>
              <span>·</span>
              <time dateTime={post.createdAt}>
                {new Date(post.createdAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              post.audience === 'PUBLIC'
                ? 'bg-cbox-accent/10 text-cbox-accent border-cbox-accent/30'
                : 'bg-cbox-violet/10 text-cbox-violet border-cbox-violet/30'
            }`}
          >
            {post.audience === 'PUBLIC' ? (
              <>
                <Globe className="h-3 w-3" /> Public
              </>
            ) : (
              <>
                <Users className="h-3 w-3" /> Friends only
              </>
            )}
          </span>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Post options"
              className="p-1.5 rounded-lg text-cbox-muted hover:text-cbox-text hover:bg-cbox-elevated"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1 w-44 rounded-xl bg-cbox-surface border border-cbox-border shadow-soft py-1 z-20"
              >
                {post.isOwner ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setDraftCaption(post.caption);
                        setDraftAudience(post.audience);
                        setEditing(true);
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-cbox-text hover:bg-cbox-elevated"
                    >
                      <Pencil className="h-4 w-4" /> Edit post
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmDelete(true);
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-cbox-danger hover:bg-cbox-danger/10"
                    >
                      <Trash2 className="h-4 w-4" /> Delete post
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onReportSoon?.();
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-sm text-cbox-muted hover:bg-cbox-elevated"
                  >
                    <span className="flex items-center gap-2">
                      <Flag className="h-4 w-4" /> Report
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cbox-elevated border border-cbox-border">
                      Soon
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo */}
      <div className="bg-cbox-bg border-y border-cbox-border">
        <img
          src={post.imageUrl}
          alt={post.caption || `Photo by ${post.author.primaryNickname}`}
          loading="lazy"
          className="w-full max-h-[540px] object-contain mx-auto"
        />
      </div>

      {/* Caption / Edit Form */}
      <div className="p-4">
        {editing ? (
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <textarea
              rows={3}
              value={draftCaption}
              onChange={(e) => setDraftCaption(e.target.value)}
              maxLength={1000}
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-sm text-cbox-text"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <select
                value={draftAudience}
                onChange={(e) => setDraftAudience(e.target.value as PostAudience)}
                className="rounded-lg bg-cbox-elevated border border-cbox-border px-2.5 py-1.5 text-xs text-cbox-text"
              >
                <option value="FRIENDS_ONLY">Friends only</option>
                <option value="PUBLIC">Public</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-cbox-border text-cbox-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cbox-accent text-slate-950"
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <p className="text-sm text-cbox-text leading-relaxed whitespace-pre-wrap">
            {post.caption || <span className="text-cbox-muted italic">No description</span>}
          </p>
        )}

        {confirmDelete && (
          <div className="mt-3 p-3 rounded-xl bg-cbox-danger/10 border border-cbox-danger/30 flex items-center justify-between gap-3">
            <span className="text-xs text-cbox-danger font-medium">
              Delete this post permanently?
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1 rounded-lg text-xs border border-cbox-border text-cbox-text"
              >
                Keep
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmDelete}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cbox-danger text-white"
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
};
