import React, { useEffect, useState } from 'react';
import {
  Ban,
  Check,
  Clock,
  ExternalLink,
  Eye,
  Heart,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Pin,
  QrCode,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  PostItem,
  ProfileBadgeItem,
  ProfileStats,
  SafeUser,
  StoryHighlightItem,
  StoryHighlightStory,
} from '../../types';
import { apiFetch } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';
import {
  getAvatarFrameClass,
  ProfileBadgeShelf,
  ProfileEffectOverlay,
  ProfileMusicPill,
  ProfileShareCardModal,
  RankBadges,
} from '../ui/RankBadge';

interface UserProfileResponse {
  profile: SafeUser;
  stats: ProfileStats;
  badges?: ProfileBadgeItem[];
  highlights?: StoryHighlightItem[];
  mutualFriends?: SafeUser[];
  mutualCommunities?: Array<{ id: string; name: string; iconEmoji: string; role: string }>;
  publicCommunities?: Array<{ id: string; name: string; iconEmoji: string; role: string }>;
  isFriend: boolean;
  isSelf: boolean;
  isCloseFriend?: boolean;
  isMuted?: boolean;
  isRestricted?: boolean;
  isPrivateLocked?: boolean;
  chatStatus?: 'NONE' | 'ACCEPTED' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'COOLDOWN';
  chatRequestId?: string | null;
  cooldownEndsAt?: string | null;
  stories?: StoryHighlightStory[];
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
  const [storyQueue, setStoryQueue] = useState<{ title: string; items: StoryHighlightStory[]; idx: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadProfile(u: string) {
    setLoading(true);
    setError(null);
    setMenuOpen(false);
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
      setStoryQueue(null);
      setMenuOpen(false);
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

  async function handleToggleCloseFriend() {
    if (!data) return;
    setBusy(true);
    try {
      const method = data.isCloseFriend ? 'DELETE' : 'POST';
      await apiFetch(`/api/profile/me/close-friends/${data.profile.id}`, { method });
      setData((prev) => (prev ? { ...prev, isCloseFriend: !prev.isCloseFriend } : prev));
      onNotify?.(data.isCloseFriend ? 'Removed from Close Friends.' : 'Added to Close Friends! 💚', 'success');
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'Action failed.', 'error');
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  }

  async function handleToggleMute() {
    if (!data) return;
    const res = await apiFetch<{ isMuted: boolean }>(`/api/profile/${encodeURIComponent(data.profile.username)}/mute`, { method: 'POST' });
    setData((prev) => (prev ? { ...prev, isMuted: res.isMuted } : prev));
    onNotify?.(res.isMuted ? `Muted @${data.profile.username}.` : `Unmuted @${data.profile.username}.`, 'info');
    setMenuOpen(false);
  }

  async function handleToggleRestrict() {
    if (!data) return;
    const res = await apiFetch<{ isRestricted: boolean }>(`/api/profile/${encodeURIComponent(data.profile.username)}/restrict`, { method: 'POST' });
    setData((prev) => (prev ? { ...prev, isRestricted: res.isRestricted } : prev));
    onNotify?.(res.isRestricted ? `Restricted @${data.profile.username}.` : `Unrestricted @${data.profile.username}.`, 'info');
    setMenuOpen(false);
  }

  async function handleBlockUser() {
    if (!data) return;
    try {
      await apiFetch('/api/friends/block', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: data.profile.id }),
      });
      onNotify?.(`Blocked @${data.profile.username}.`, 'info');
      onClose();
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'Unable to block user.', 'error');
    }
  }

  const stories = data?.stories || [];
  const hasStories = stories.length > 0;
  const activeStory = storyQueue ? storyQueue.items[storyQueue.idx] : null;
  const frameCls = getAvatarFrameClass(data?.profile.avatarFrame);

  return (
    <>
      <Modal open={Boolean(username)} onClose={onClose} title={data ? `@${data.profile.username}` : 'Profile'} maxWidthClass="max-w-xl">
        {loading ? (
          <LoadingSkeleton variant="profile" />
        ) : error || !data ? (
          <p className="text-sm text-cbox-danger">{error || 'Profile unavailable.'}</p>
        ) : activeStory && storyQueue ? (
          /* Inline Story & Highlight Viewer */
          <div className={`relative rounded-2xl overflow-hidden min-h-[380px] flex flex-col justify-between p-5 text-white bg-gradient-to-br ${activeStory.bgGradient}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar src={data.profile.avatarUrl} name={data.profile.primaryNickname} size="sm" />
                <div>
                  <span className="text-xs font-bold block">{data.profile.primaryNickname}</span>
                  <span className="text-[10px] text-white/80">{storyQueue.title}</span>
                </div>
              </div>
              <button type="button" onClick={() => setStoryQueue(null)} className="p-1.5 rounded-full bg-black/40">
                <X className="h-4 w-4" />
              </button>
            </div>
            {activeStory.imageUrl ? (
              <img src={activeStory.imageUrl} alt="Story" className="my-3 rounded-xl max-h-72 mx-auto object-contain" />
            ) : (
              <p className="text-center text-lg font-bold px-4">{activeStory.textContent}</p>
            )}
            <div className="flex items-center justify-between text-xs">
              <span>{storyQueue.idx + 1} / {storyQueue.items.length}</span>
              {storyQueue.items.length > 1 && (
                <button
                  type="button"
                  onClick={() => setStoryQueue((q) => (q ? { ...q, idx: (q.idx + 1) % q.items.length } : null))}
                  className="px-3 py-1 rounded-full bg-black/40 font-semibold"
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Banner + Profile Effect + Top Actions */}
            <div className="relative h-28 rounded-2xl overflow-hidden bg-gradient-to-r from-cbox-accent/25 via-cbox-violet/25 to-cbox-elevated border border-cbox-border">
              {data.profile.bannerUrl && (
                <img src={data.profile.bannerUrl} alt="Banner" className="h-full w-full object-cover" />
              )}
              <ProfileEffectOverlay effect={data.profile.profileEffect} />
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  title="Share Profile Card"
                  className="p-1.5 rounded-xl bg-black/55 hover:bg-black/75 text-white backdrop-blur-md"
                >
                  <QrCode className="h-3.5 w-3.5" />
                </button>
                {!data.isSelf && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpen((v) => !v)}
                      title="Safety & Privacy Controls"
                      className="p-1.5 rounded-xl bg-black/55 hover:bg-black/75 text-white backdrop-blur-md"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                    {menuOpen && (
                      <div className="absolute right-0 mt-1 w-48 rounded-xl border border-cbox-border bg-cbox-surface shadow-2xl p-1.5 z-30 space-y-1 text-xs">
                        {data.isFriend && (
                          <button type="button" onClick={handleToggleCloseFriend} className="w-full px-2.5 py-2 rounded-lg hover:bg-cbox-elevated flex items-center gap-2 text-emerald-400 font-semibold">
                            <Heart className="h-3.5 w-3.5" />
                            {data.isCloseFriend ? 'Remove Close Friend' : 'Add Close Friend'}
                          </button>
                        )}
                        <button type="button" onClick={handleToggleMute} className="w-full px-2.5 py-2 rounded-lg hover:bg-cbox-elevated flex items-center gap-2 text-cbox-text">
                          <VolumeX className="h-3.5 w-3.5" />
                          {data.isMuted ? 'Unmute User' : 'Mute User'}
                        </button>
                        <button type="button" onClick={handleToggleRestrict} className="w-full px-2.5 py-2 rounded-lg hover:bg-cbox-elevated flex items-center gap-2 text-amber-400">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          {data.isRestricted ? 'Unrestrict User' : 'Restrict User'}
                        </button>
                        <button type="button" onClick={handleBlockUser} className="w-full px-2.5 py-2 rounded-lg hover:bg-cbox-danger/15 flex items-center gap-2 text-cbox-danger font-semibold">
                          <Ban className="h-3.5 w-3.5" />
                          Block @{data.profile.username}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Avatar (Animated Frame + Story Ring) + Stats */}
            <div className="-mt-12 px-2 flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => hasStories && setStoryQueue({ title: 'Active Story', items: stories, idx: 0 })}
                  title={hasStories ? 'Tap to watch active Story' : undefined}
                  className={`rounded-full p-1 ${
                    hasStories
                      ? 'bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 cursor-pointer'
                      : frameCls || 'bg-cbox-surface'
                  }`}
                >
                  <div className="rounded-full bg-cbox-surface p-0.5">
                    <Avatar src={data.profile.avatarUrl} name={data.profile.primaryNickname} size="lg" />
                  </div>
                </button>
                {(data.profile.customStatusEmoji || data.profile.customStatusText) && (
                  <span className="mb-1 px-2.5 py-1 rounded-2xl bg-cbox-elevated border border-cbox-border text-[11px] font-semibold text-cbox-text max-w-[165px] truncate">
                    {data.profile.customStatusEmoji} {data.profile.customStatusText}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-center pb-1">
                <div>
                  <p className="text-base font-bold text-cbox-text">{data.stats.postCount}</p>
                  <p className="text-[11px] text-cbox-muted">Posts</p>
                </div>
                <div>
                  <p className="text-base font-bold text-cbox-text">{data.stats.friendCount}</p>
                  <p className="text-[11px] text-cbox-muted">Friends</p>
                </div>
                {typeof data.stats.profileViewsCount === 'number' && (
                  <div>
                    <p className="text-base font-bold text-cbox-text flex items-center justify-center gap-0.5">
                      <Eye className="h-3 w-3 text-cbox-violet" />
                      {data.stats.profileViewsCount}
                    </p>
                    <p className="text-[11px] text-cbox-muted">Views</p>
                  </div>
                )}
              </div>
            </div>

            {/* Name, Badges, Music, Bio, Tags, Links */}
            <div className="px-1 space-y-2">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-base font-bold text-cbox-text">{data.profile.primaryNickname}</h2>
                  <RankBadges userRole={data.profile.role} isVerified={data.profile.isVerified} />
                  {data.isCloseFriend && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-400/40">
                      💚 Close Friend
                    </span>
                  )}
                </div>
                <p className="text-xs text-cbox-muted">@{data.profile.username}</p>
              </div>

              <ProfileBadgeShelf badges={data.badges} />

              <ProfileMusicPill
                title={data.profile.profileMusicTitle}
                artist={data.profile.profileMusicArtist}
                preset={data.profile.profileMusicPreset}
                audioUrl={data.profile.profileMusicUrl}
              />

              {hasStories && (
                <p className="text-[11px] text-cbox-accent font-semibold">
                  Tap profile picture above to watch {stories.length} active story!
                </p>
              )}
              {data.profile.bio && <p className="text-xs text-cbox-text/90 whitespace-pre-wrap">{data.profile.bio}</p>}

              {data.profile.interestTags && data.profile.interestTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {data.profile.interestTags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cbox-elevated border border-cbox-border text-cbox-text/90">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {data.profile.bioLinks && data.profile.bioLinks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.profile.bioLinks.map((lnk, idx) => (
                    <a
                      key={`${lnk.url}-${idx}`}
                      href={lnk.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cbox-accent/10 border border-cbox-accent/30 text-[11px] font-semibold text-cbox-accent"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {lnk.label}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Mutual Friends & Joined Communities */}
            {!data.isSelf && ((data.mutualFriends && data.mutualFriends.length > 0) || (data.publicCommunities && data.publicCommunities.length > 0)) && (
              <div className="rounded-xl border border-cbox-border bg-cbox-elevated/40 p-2.5 space-y-2 text-xs">
                {data.mutualFriends && data.mutualFriends.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Users className="h-3.5 w-3.5 text-cbox-accent shrink-0" />
                    <span className="text-cbox-muted">Mutual friends:</span>
                    <span className="font-semibold text-cbox-text">
                      {data.mutualFriends.slice(0, 3).map((m) => m.primaryNickname).join(', ')}
                      {data.mutualFriends.length > 3 ? ` +${data.mutualFriends.length - 3} more` : ''}
                    </span>
                  </div>
                )}
                {data.publicCommunities && data.publicCommunities.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-cbox-muted">Communities:</span>
                    {data.publicCommunities.map((c) => (
                      <span key={c.id} className="px-2 py-0.5 rounded-full bg-cbox-surface border border-cbox-border text-[11px] font-semibold text-cbox-text">
                        {c.iconEmoji} {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Story Highlights Row */}
            {!data.isPrivateLocked && data.highlights && data.highlights.length > 0 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {data.highlights.map((hl) => (
                  <button
                    key={hl.id}
                    type="button"
                    disabled={hl.stories.length === 0}
                    onClick={() => setStoryQueue({ title: hl.title, items: hl.stories, idx: 0 })}
                    className="flex flex-col items-center gap-1 shrink-0 group"
                  >
                    <div className="h-12 w-12 rounded-full p-0.5 bg-gradient-to-tr from-cbox-accent to-cbox-violet group-hover:scale-105 transition">
                      <div className="h-full w-full rounded-full bg-cbox-surface flex items-center justify-center text-lg">
                        {hl.coverEmoji}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-cbox-text max-w-[60px] truncate">{hl.title}</span>
                  </button>
                ))}
              </div>
            )}

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

            {/* Instagram-Style Private Account Lock OR Posts Grid (with Pinned Badge) */}
            {data.isPrivateLocked ? (
              <div className="p-6 rounded-2xl border border-cbox-border bg-cbox-elevated/40 text-center space-y-2">
                <Lock className="h-6 w-6 text-cbox-muted mx-auto" />
                <p className="text-sm font-bold text-cbox-text">This Account is Private</p>
                <p className="text-xs text-cbox-muted">Add @{data.profile.username} as a friend to see their posts, highlights, and stories.</p>
              </div>
            ) : data.posts.length === 0 ? (
              <p className="text-xs text-cbox-muted text-center py-6">No visible posts yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 pt-2">
                {data.posts.map((p) => (
                  <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden border border-cbox-border bg-cbox-elevated">
                    <img src={p.imageUrl} alt={p.caption || 'Post'} className="h-full w-full object-cover" />
                    {p.isPinned && (
                      <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/70 text-amber-300 text-[9px] font-bold">
                        <Pin className="h-2.5 w-2.5" /> Pinned
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {data && (
        <ProfileShareCardModal open={shareOpen} onClose={() => setShareOpen(false)} user={data.profile} />
      )}
    </>
  );
};
