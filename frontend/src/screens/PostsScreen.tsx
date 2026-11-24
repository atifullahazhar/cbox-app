import React, { useEffect, useState } from 'react';
import { Plus, Images } from 'lucide-react';
import type { PostAudience, PostItem, StoryItem } from '../types';
import { apiFetch } from '../lib/api';
import { PostCard } from '../components/posts/PostCard';
import { PostComposer } from '../components/posts/PostComposer';
import { StoryBar } from '../components/stories/StoryBar';
import { UserProfileModal } from '../components/profile/UserProfileModal';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

interface PostsScreenProps {
  onStatsChanged: () => void;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

export const PostsScreen: React.FC<PostsScreenProps> = ({ onStatsChanged, onNotify }) => {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  async function loadFeed() {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        apiFetch<{ posts: PostItem[] }>('/api/posts/feed'),
        apiFetch<{ stories: StoryItem[] }>('/api/stories'),
      ]);
      setPosts(pRes.posts);
      setStories(sRes.stories);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load feed.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeed();
  }, []);

  async function handleEdit(postId: string, caption: string, audience: PostAudience) {
    try {
      const res = await apiFetch<{ post: PostItem }>(`/api/posts/${postId}`, {
        method: 'PATCH',
        body: JSON.stringify({ caption, audience }),
      });
      setPosts((prev) => prev.map((p) => (p.id === postId ? res.post : p)));
      onNotify('Post updated.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to update post.', 'error');
    }
  }

  async function handleDelete(postId: string) {
    try {
      await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      onStatsChanged();
      onNotify('Post deleted.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to delete post.', 'error');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-cbox-text">Posts & Stories</h1>
          <p className="text-xs text-cbox-muted">
            24-hour stories, public posts, and friends-only photos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          aria-label="Create new post"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cbox-accent text-slate-950 hover:bg-cbox-accentHover text-sm font-semibold shadow-sm transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Post</span>
        </button>
      </div>

      {/* 24-Hour Stories Strip */}
      <StoryBar
        stories={stories}
        onStoryCreated={(s) => setStories((prev) => [s, ...prev])}
        onStoryDeleted={(id) => setStories((prev) => prev.filter((s) => s.id !== id))}
        onStoryViewed={(id) =>
          setStories((prev) => prev.map((s) => (s.id === id ? { ...s, viewedByMe: true } : s)))
        }
        onNotify={onNotify}
      />

      {loading ? (
        <LoadingSkeleton variant="card" rows={2} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<Images className="h-6 w-6" />}
          title="Your feed is quiet"
          description="Share a photo post with your friends or publicly, or accept friend requests to see friends-only updates."
          action={
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cbox-accent text-slate-950 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" /> Create first post
            </button>
          }
        />
      ) : (
        <div className="space-y-5">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onOpenProfile={(uname) => setProfileUsername(uname)}
              onReportSoon={() =>
                onNotify('Post reporting is planned for an upcoming safety release.', 'info')
              }
            />
          ))}
        </div>
      )}

      <PostComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={(created) => {
          setPosts((prev) => [created, ...prev]);
          onStatsChanged();
          onNotify('Post published.', 'success');
        }}
      />

      <UserProfileModal
        username={profileUsername}
        onClose={() => setProfileUsername(null)}
      />
    </div>
  );
};
