import React, { useEffect, useRef, useState } from 'react';
import { Images } from 'lucide-react';
import type { PostAudience, PostItem, ProfileStats, SafeUser } from '../types';
import { apiFetch, apiUploadWithProgress } from '../lib/api';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { SettingsPanel } from '../components/profile/SettingsPanel';
import { UserProfileModal } from '../components/profile/UserProfileModal';
import { Modal } from '../components/ui/Modal';
import { Avatar } from '../components/ui/Avatar';
import { RankBadges } from '../components/ui/RankBadge';
import { ImageCropModal } from '../components/ui/ImageCropModal';
import { PostCard } from '../components/posts/PostCard';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

interface ProfileScreenProps {
  user: SafeUser;
  stats: ProfileStats;
  onUserUpdated: (user: SafeUser) => void;
  onStatsChanged: () => void;
  onLogout: () => Promise<void>;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 8 * 1024 * 1024;

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  stats,
  onUserUpdated,
  onStatsChanged,
  onLogout,
  onNotify,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [friendsListOpen, setFriendsListOpen] = useState(false);
  const [myFriends, setMyFriends] = useState<SafeUser[]>([]);
  const [viewUsername, setViewUsername] = useState<string | null>(null);
  const [ownPosts, setOwnPosts] = useState<PostItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [cropAspect, setCropAspect] = useState<'avatar' | 'banner'>('avatar');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLoadingPosts(true);
    apiFetch<{ posts: PostItem[] }>('/api/posts/mine')
      .then((res) => setOwnPosts(res.posts))
      .catch(() => {})
      .finally(() => setLoadingPosts(false));
  }, [user.id]);

  function openPicker(aspect: 'avatar' | 'banner') {
    setCropAspect(aspect);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!ALLOWED_TYPES.includes(selected.type)) {
      onNotify('Unsupported image format. Use JPEG, PNG, or WebP.', 'error');
      return;
    }
    if (selected.size > MAX_BYTES) {
      onNotify('Image exceeds the 8 MB limit.', 'error');
      return;
    }
    setCropFile(selected);
  }

  async function handleConfirmCrop(croppedBlob: Blob) {
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('image', croppedBlob, `${cropAspect}.webp`);
      const endpoint = cropAspect === 'avatar' ? '/api/profile/me/avatar' : '/api/profile/me/banner';
      const res = await apiUploadWithProgress<{ profile: SafeUser }>(
        endpoint,
        formData,
        (pct) => setUploadProgress(pct)
      );
      onUserUpdated(res.profile);
      setCropFile(null);
      onNotify(
        cropAspect === 'avatar' ? 'Profile picture updated.' : 'Profile banner updated.',
        'success'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleResetMedia(kind: 'avatar' | 'banner') {
    try {
      const res = await apiFetch<{ profile: SafeUser }>(`/api/profile/me/${kind}`, {
        method: 'DELETE',
      });
      onUserUpdated(res.profile);
      onNotify(`Reset ${kind} to default.`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : `Failed to reset ${kind}.`, 'error');
    }
  }

  async function handleEditPost(postId: string, caption: string, audience: PostAudience) {
    try {
      const res = await apiFetch<{ post: PostItem }>(`/api/posts/${postId}`, {
        method: 'PATCH',
        body: JSON.stringify({ caption, audience }),
      });
      setOwnPosts((prev) => prev.map((p) => (p.id === postId ? res.post : p)));
      onNotify('Post updated.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to update post.', 'error');
    }
  }

  async function handleDeletePost(postId: string) {
    try {
      await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
      setOwnPosts((prev) => prev.filter((p) => p.id !== postId));
      onStatsChanged();
      onNotify('Post deleted.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to delete post.', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFilePicked}
        className="hidden"
      />

      <ProfileHeader
        user={user}
        stats={stats}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenFriendsList={async () => {
          setFriendsListOpen(true);
          try {
            const r = await apiFetch<{ friends: SafeUser[] }>("/api/profile/me/friends");
            setMyFriends(r.friends);
          } catch {}
        }}
        onPickAvatar={() => openPicker('avatar')}
        onPickBanner={() => openPicker('banner')}
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-cbox-text">Your Posts</h2>
          <span className="text-xs text-cbox-muted">{ownPosts.length} total</span>
        </div>

        {loadingPosts ? (
          <LoadingSkeleton variant="card" rows={2} />
        ) : ownPosts.length === 0 ? (
          <EmptyState
            icon={<Images className="h-6 w-6" />}
            title="No posts yet"
            description="Photos you share from the Posts tab will appear here with author-only edit and delete controls."
          />
        ) : (
          <div className="space-y-4">
            {ownPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onEdit={handleEditPost}
                onDelete={handleDeletePost}
              />
            ))}
          </div>
        )}
      </section>

      <Modal open={friendsListOpen} onClose={() => setFriendsListOpen(false)} title={`Friends (${myFriends.length})`}>
        {myFriends.length === 0 ? (
          <p className="text-xs text-cbox-muted py-4 text-center">No friends yet. Accept a friend request to see them here!</p>
        ) : (
          <div className="divide-y divide-cbox-border max-h-80 overflow-y-auto">
            {myFriends.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFriendsListOpen(false);
                  setViewUsername(f.username);
                }}
                className="w-full py-2.5 flex items-center justify-between gap-2 text-left hover:bg-cbox-elevated/40 px-2 rounded-xl transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar src={f.avatarUrl} name={f.primaryNickname} size="sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-cbox-text truncate">{f.primaryNickname}</span>
                      <RankBadges userRole={f.role} isVerified={f.isVerified} />
                    </div>
                    <p className="text-[11px] text-cbox-muted">@{f.username}</p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-cbox-accent">View Profile</span>
              </button>
            ))}
          </div>
        )}
      </Modal>

      <UserProfileModal username={viewUsername} onClose={() => setViewUsername(null)} onNotify={onNotify} />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        onUserUpdated={onUserUpdated}
        onPickAvatar={() => openPicker('avatar')}
        onPickBanner={() => openPicker('banner')}
        onResetAvatar={() => handleResetMedia('avatar')}
        onResetBanner={() => handleResetMedia('banner')}
        onLogout={onLogout}
        onNotify={onNotify}
      />

      <ImageCropModal
        open={Boolean(cropFile)}
        file={cropFile}
        aspect={cropAspect}
        uploading={uploading}
        progress={uploadProgress}
        onCancel={() => setCropFile(null)}
        onConfirm={handleConfirmCrop}
      />
    </div>
  );
};
