import React, { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Lock,
  MessageCircle,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type { PostItem, ProfileStats, SafeUser } from '../../types';
import { apiFetch } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';
import { RankBadges } from '../ui/RankBadge';

interface ProfileStory {
  id: string;
  imageUrl: string | null;
  textContent: string;
  bgGradient: string;
  expiresAt: string;
  createdAt: string;
}

interface UserProfileResponse {
  profile: SafeUser;
  stats: ProfileStats;
  isFriend: boolean;
  isSelf: boolean;
  isPrivateLocked?: boolean;
  chatStatus?: 'NONE' | 'ACCEPTED' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'COOLDOWN';
  chatRequestId?: string | null;
  cooldownEndsAt?: string | null;
  stories?: ProfileStory[];
  posts: PostItem[];
}

interface UserProfileModalProps {
  username: string | null;
  onClose: () => void;
  onNotify?: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

function formatCooldownRemaining(iso?: string | null): string {
  if (!iso) return '24h';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'now';
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hrs}h ${mins}m`;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ username, onClose, onNotify }) => {
  const [data, setData] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingStoryIdx, setViewingStoryIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadProfile(u: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<UserProfileResponse>(`/api/profile/${encodeURIComponent(u)}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load profile.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!username) {
      setData(null);
      setViewingStoryIdx(null);
      return;
    }
    loadProfile(username);
  }, [username]);

  async function handleAddFriend() {
    if (!data) return;
    setBusy(true);
    try {
      await apiFetch('/api/friends/requests', {
        method: 'POST',
        body: JSON.stringify({ targetUsername: data.profile.username }),
      });
      onNotify?.(`Friend request sent to @${data.profile.username}!`, 'success');
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'Could not send friend request.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleSendChatRequest() {
    if (!data) return;
    setBusy(true);
    try {
      await apiFetch('/api/chat/requests', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: data.profile.id }),
      });
      onNotify?.(`Chat request sent to @${data.profile.username}!`, 'success');
      if (username) loadProfile(username);
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'Could not send chat request.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRespondChatRequest(accept: boolean) {
    if (!data?.chatRequestId) return;
    setBusy(true);
    try {
      await apiFetch(`/api/chat/requests/${data.chatRequestId}/${accept ? 'accept' : 'deny'}`, {
        method: 'POST',
      });
      onNotify?.(accept ? 'Chat request accepted!' : 'Chat request declined (24h cooldown applied).', 'info');
      if (username) loadProfile(username);
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'Action failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const stories = data?.stories || [];
  const hasStories = stories.length > 0;
  const activeStory = viewingStoryIdx !== null ? stories[viewingStoryIdx] : null;

  return (
    <Modal open={Boolean(username)} onClose={onClose} title={data ? `@${data.profile.username}` : 'Profile'} maxWidthClass="max-w-xl">
      {loading ? (
        <LoadingSkeleton variant="profile" />
      ) : error || !data ? (
        <p className="text-sm text-cbox-danger">{error || 'Profile unavailable.'}</p>
      ) : activeStory ? (
        /* Inline Instagram-Style Profile Story Viewer */
        <div className={`relative rounded-2xl overflow-hidden min-h-[380px] flex flex-col justify-between p-5 text-white bg-gradient-to-br ${activeStory.bgGradient}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar src={data.profile.avatarUrl} name={data.profile.primaryNickname} size="sm" />
              <span className="text-xs font-bold">{data.profile.primaryNickname}</span>
            </div>
            <button type="button" onClick={() => setViewingStoryIdx(null)} className="p-1.5 rounded-full bg-black/40">
              <X className="h-4 w-4" />
            </button>
          </div>
          {activeStory.imageUrl ? (
            <img src={activeStory.imageUrl} alt="Story" className="my-3 rounded-xl max-h-72 mx-auto object-contain" />
          ) : (
            <p className="text-center text-lg font-bold px-4">{activeStory.textContent}</p>
          )}
          <div className="flex items-center justify-between text-xs">
            <span>Story {(viewingStoryIdx || 0) + 1} of {stories.length}</span>
            {stories.length > 1 && (
              <button
                type="button"
                onClick={() => setViewingStoryIdx(((viewingStoryIdx || 0) + 1) % stories.length)}
                className="px-3 py-1 rounded-full bg-black/40 font-semibold"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Banner + Avatar (with clickable Story Ring!) */}
          <div className="relative h-28 rounded-2xl overflow-hidden bg-gradient-to-r from-cbox-accent/25 via-cbox-violet/25 to-cbox-elevated border border-cbox-border">
            {data.profile.bannerUrl && (
              <img src={data.profile.bannerUrl} alt="Banner" className="h-full w-full object-cover" />
            )}
          </div>

          <div className="-mt-12 px-2 flex flex-wrap items-end justify-between gap-3">
            <button
              type="button"
              onClick={() => hasStories && setViewingStoryIdx(0)}
              title={hasStories ? 'Click to watch active Story' : undefined}
              className={`rounded-full p-1 ${
                hasStories ? 'bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 cursor-pointer' : 'bg-cbox-surface'
              }`}
            >
              <Avatar src={data.profile.avatarUrl} name={data.profile.primaryNickname} size="lg" />
            </button>

            <div className="flex items-center gap-4 text-center pb-1">
              <div>
                <p className="text-base font-bold text-cbox-text">{data.stats.postCount}</p>
                <p className="text-[11px] text-cbox-muted">Posts</p>
              </div>
              <div>
                <p className="text-base font-bold text-cbox-text">{data.stats.friendCount}</p>
                <p className="text-[11px] text-cbox-muted">Friends</p>
              </div>
            </div>
          </div>

          <div className="px-1 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-base font-bold text-cbox-text">{data.profile.primaryNickname}</h2>
              <RankBadges userRole={data.profile.role} isVerified={data.profile.isVerified} />
            </div>
            <p className="text-xs text-cbox-muted">@{data.profile.username}</p>
            {hasStories && (
              <p className="text-[11px] text-cbox-accent font-semibold">
                Tap profile picture above to view {stories.length} active story!
              </p>
            )}
            {data.profile.bio && <p className="text-xs text-cbox-text/90 pt-1">{data.profile.bio}</p>}
          </div>

          {/* 2-Step Action Buttons: Friend Request + Separate Chat Request (24h Cooldown) */}
          {!data.isSelf && (
            <div className="flex flex-wrap gap-2">
              {data.isFriend ? (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cbox-success/15 text-cbox-success text-xs font-bold">
                  <UserCheck className="h-3.5 w-3.5" /> Friends
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleAddFriend}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cbox-accent text-slate-950 text-xs font-bold"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Add Friend
                </button>
              )}

              {data.chatStatus === 'ACCEPTED' ? (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cbox-violet/15 text-cbox-violet text-xs font-bold">
                  <MessageCircle className="h-3.5 w-3.5" /> Chat Unlocked
                </span>
              ) : data.chatStatus === 'PENDING_SENT' ? (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-cbox-border text-cbox-muted text-xs font-semibold">
                  <Clock className="h-3.5 w-3.5" /> Chat Request Sent
                </span>
              ) : data.chatStatus === 'PENDING_RECEIVED' ? (
                <div className="flex gap-1.5">
                  <button type="button" disabled={busy} onClick={() => handleRespondChatRequest(true)} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-cbox-success text-slate-950 text-xs font-bold">
                    <Check className="h-3.5 w-3.5" /> Accept Chat
                  </button>
                  <button type="button" disabled={busy} onClick={() => handleRespondChatRequest(false)} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-cbox-danger/15 text-cbox-danger text-xs font-bold">
                    <X className="h-3.5 w-3.5" /> Deny
                  </button>
                </div>
              ) : data.chatStatus === 'COOLDOWN' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cbox-danger/10 text-cbox-danger text-xs font-semibold">
                  <Clock className="h-3.5 w-3.5" /> Declined · Retry in {formatCooldownRemaining(data.cooldownEndsAt)}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSendChatRequest}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-cbox-violet/40 bg-cbox-violet/10 text-cbox-violet text-xs font-bold"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Send Chat Request
                </button>
              )}
            </div>
          )}

          {/* Instagram-Style Private Account Lock OR Posts Grid */}
          {data.isPrivateLocked ? (
            <div className="p-6 rounded-2xl border border-cbox-border bg-cbox-elevated/40 text-center space-y-2">
              <Lock className="h-6 w-6 text-cbox-muted mx-auto" />
              <p className="text-sm font-bold text-cbox-text">This Account is Private</p>
              <p className="text-xs text-cbox-muted">Add @{data.profile.username} as a friend to see their posts and stories.</p>
            </div>
          ) : data.posts.length === 0 ? (
            <p className="text-xs text-cbox-muted text-center py-6">No visible posts yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 pt-2">
              {data.posts.map((p) => (
                <div key={p.id} className="aspect-square rounded-xl overflow-hidden border border-cbox-border bg-cbox-elevated">
                  <img src={p.imageUrl} alt={p.caption || 'Post'} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
