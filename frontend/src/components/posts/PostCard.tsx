import React, { useState } from 'react';
import {
  Globe,
  Users,
  MoreHorizontal,
  Pencil,
  Trash2,
  Flag,
  Heart,
  MessageCircle,
  Send,
} from 'lucide-react';
import type { PostAudience, PostCommentItem, PostItem } from '../../types';
import { apiFetch } from '../../lib/api';
import { Avatar } from '../ui/Avatar';

interface PostCardProps {
  post: PostItem;
  onEdit?: (postId: string, caption: string, audience: PostAudience) => Promise<void>;
  onDelete?: (postId: string) => Promise<void>;
  onOpenProfile?: (username: string) => void;
  onReportSoon?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onEdit,
  onDelete,
  onOpenProfile,
  onReportSoon,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftCaption, setDraftCaption] = useState(post.caption);
  const [draftAudience, setDraftAudience] = useState<PostAudience>(post.audience);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  // Likes & Comments state
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostCommentItem[]>([]);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  async function handleToggleLike() {
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);
    try {
      const res = await apiFetch<{ likedByMe: boolean; likeCount: number }>(
        `/api/posts/${post.id}/like`,
        { method: 'POST' }
      );
      setLiked(res.likedByMe);
      setLikeCount(res.likeCount);
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    }
  }

  async function handleToggleComments() {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && comments.length === 0) {
      setLoadingComments(true);
      try {
        const res = await apiFetch<{ comments: PostCommentItem[] }>(
          `/api/posts/${post.id}/comments`
        );
        setComments(res.comments);
        setCommentCount(res.comments.length);
      } finally {
        setLoadingComments(false);
      }
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    const clean = commentText.trim();
    if (!clean) return;
    setPostingComment(true);
    try {
      const res = await apiFetch<{ comment: PostCommentItem }>(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: clean }),
      });
      setComments((prev) => [...prev, res.comment]);
      setCommentCount((c) => c + 1);
      setCommentText('');
    } finally {
      setPostingComment(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await apiFetch(`/api/posts/comments/${commentId}`, { method: 'DELETE' });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentCount((c) => Math.max(0, c - 1));
    } catch {
      // Ignore
    }
  }

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
        <button
          type="button"
          onClick={() => onOpenProfile?.(post.author.username)}
          className="flex items-center gap-3 min-w-0 text-left hover:opacity-90 transition"
        >
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
        </button>

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

      {/* Photo (double-tap / double-click to like) */}
      <div
        onDoubleClick={handleToggleLike}
        className="bg-cbox-bg border-y border-cbox-border select-none"
      >
        <img
          src={post.imageUrl}
          alt={post.caption || `Photo by ${post.author.primaryNickname}`}
          loading="lazy"
          className="w-full max-h-[540px] object-contain mx-auto"
        />
      </div>

      {/* Likes & Comments Action Bar */}
      <div className="px-4 pt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={handleToggleLike}
          aria-pressed={liked}
          className={`inline-flex items-center gap-1.5 text-sm font-medium transition ${
            liked ? 'text-rose-500' : 'text-cbox-muted hover:text-cbox-text'
          }`}
        >
          <Heart className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} />
          <span>{likeCount}</span>
        </button>

        <button
          type="button"
          onClick={handleToggleComments}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-cbox-muted hover:text-cbox-text transition"
        >
          <MessageCircle className="h-5 w-5" />
          <span>{commentCount}</span>
        </button>
      </div>

      {/* Caption / Edit Form */}
      <div className="p-4 pt-2.5 space-y-3">
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
              <option value="CLOSE_FRIENDS">💚 Close Friends</option>
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

        {/* Expandable Comments Section */}
        {commentsOpen && (
          <div className="pt-3 border-t border-cbox-border space-y-3">
            {loadingComments ? (
              <p className="text-xs text-cbox-muted">Loading comments…</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-cbox-muted">No comments yet. Start the conversation!</p>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {comments.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-2 text-xs">
                    <div className="flex items-start gap-2 min-w-0">
                      <Avatar src={c.author.avatarUrl} name={c.author.primaryNickname} size="sm" />
                      <div className="min-w-0 bg-cbox-elevated/70 rounded-xl px-3 py-2">
                        <button
                          type="button"
                          onClick={() => onOpenProfile?.(c.author.username)}
                          className="font-semibold text-cbox-text hover:underline"
                        >
                          {c.author.primaryNickname}
                        </button>
                        <p className="text-cbox-text/90 mt-0.5 break-words">{c.content}</p>
                      </div>
                    </div>
                    {(c.isOwner || post.isOwner) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(c.id)}
                        aria-label="Delete comment"
                        className="p-1 text-cbox-muted hover:text-cbox-danger shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                maxLength={600}
                placeholder="Write a comment…"
                className="flex-1 rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-base sm:text-xs text-cbox-text"
              />
              <button
                type="submit"
                disabled={postingComment || !commentText.trim()}
                aria-label="Post comment"
                className="px-3 py-2 rounded-xl bg-cbox-accent text-slate-950 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        )}

        {confirmDelete && (
          <div className="p-3 rounded-xl bg-cbox-danger/10 border border-cbox-danger/30 flex items-center justify-between gap-3">
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
