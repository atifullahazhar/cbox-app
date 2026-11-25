import React, { useEffect, useState } from 'react';
import { Images } from 'lucide-react';
import type { PostItem, ProfileStats, SafeUser } from '../../types';
import { apiFetch } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';
import { EmptyState } from '../ui/EmptyState';

interface UserProfileModalProps {
  username: string | null;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ username, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<SafeUser | null>(null);
  const [stats, setStats] = useState<ProfileStats>({ postCount: 0, friendCount: 0 });
  const [isFriend, setIsFriend] = useState(false);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setError(null);
    apiFetch<{ profile: SafeUser; stats: ProfileStats; isFriend: boolean; posts: PostItem[] }>(
      `/api/profile/${encodeURIComponent(username)}`
    )
      .then((res) => {
        setProfile(res.profile);
        setStats(res.stats);
        setIsFriend(res.isFriend);
        setPosts(res.posts || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load profile.'))
      .finally(() => setLoading(false));
  }, [username]);

  return (
    <Modal
      open={Boolean(username)}
      onClose={onClose}
      title={profile ? profile.primaryNickname : 'Profile'}
      description={profile ? `@${profile.username}` : undefined}
      maxWidthClass="max-w-2xl"
    >
      {loading ? (
        <LoadingSkeleton variant="profile" />
      ) : error || !profile ? (
        <p className="text-sm text-cbox-danger">{error || 'Profile unavailable.'}</p>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-cbox-border overflow-hidden bg-cbox-elevated/40">
            <div className="h-32 sm:h-40 w-full bg-gradient-to-r from-slate-900 via-sky-950 to-indigo-950">
              {profile.bannerUrl && (
                <img
                  src={profile.bannerUrl}
                  alt="Profile banner"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="px-5 pb-5">
              <div className="flex items-end justify-between gap-4 -mt-10 mb-3">
                <div className="rounded-full p-1 bg-cbox-surface inline-block">
                  <Avatar src={profile.avatarUrl} name={profile.primaryNickname} size="xl" />
                </div>
                <div className="flex items-center gap-4 text-center pt-2">
                  <div>
                    <p className="text-base font-bold text-cbox-text">{stats.postCount}</p>
                    <p className="text-[11px] text-cbox-muted">Posts</p>
                  </div>
                  <div className="h-6 w-px bg-cbox-border" />
                  <div>
                    <p className="text-base font-bold text-cbox-text">{stats.friendCount}</p>
                    <p className="text-[11px] text-cbox-muted">Friends</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-cbox-text">{profile.primaryNickname}</h3>
                  {isFriend && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cbox-accent/15 text-cbox-accent">
                      Friend
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-cbox-accent">@{profile.username}</p>
                {profile.alternateNicknames.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {profile.alternateNicknames.map((alias) => (
                      <span
                        key={alias}
                        className="px-2 py-0.5 rounded-full text-[11px] bg-cbox-surface border border-cbox-border text-cbox-muted"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-sm text-cbox-text/90 pt-1">
                  {profile.bio || 'No bio added yet.'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-cbox-muted">
              Visible Posts ({posts.length})
            </h4>
            {posts.length === 0 ? (
              <EmptyState
                icon={<Images className="h-5 w-5" />}
                title="No visible posts"
                description="Posts shared publicly or with friends will appear here."
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {posts.map((p) => (
                  <div
                    key={p.id}
                    className="aspect-square rounded-xl overflow-hidden border border-cbox-border bg-cbox-bg"
                  >
                    <img
                      src={p.imageUrl}
                      alt={p.caption || 'User post'}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
