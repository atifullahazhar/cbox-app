import React, { useEffect, useRef, useState } from 'react';
import {
  Eye,
  Heart,
  Images,
  Music,
  Pin,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  PostAudience,
  PostItem,
  ProfileBadgeItem,
  ProfileStats,
  ProfileVisitorItem,
  SafeUser,
  StoryHighlightItem,
  StoryHighlightStory,
} from '../types';
import { apiFetch, apiUploadWithProgress } from '../lib/api';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { SettingsPanel } from '../components/profile/SettingsPanel';
import { UserProfileModal } from '../components/profile/UserProfileModal';
import { Modal } from '../components/ui/Modal';
import { Avatar } from '../components/ui/Avatar';
import {
  AVATAR_FRAMES,
  INTEREST_SUGGESTIONS,
  MUSIC_PRESETS,
  PROFILE_EFFECTS,
  ProfileShareCardModal,
  RankBadges,
} from '../components/ui/RankBadge';
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
const HIGHLIGHT_EMOJIS = ['✨', '🎮', '🌸', '🔥', '🎧', '📸', '🏆', '🫶', '🚀', '🌙'];
const STATUS_EMOJIS = ['🎮', '🎧', '📚', '☕', '🔥', '✨', '😴', '💻', '🌸', '🚀'];

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

  // CB2.1 State
  const [badges, setBadges] = useState<ProfileBadgeItem[]>([]);
  const [highlights, setHighlights] = useState<StoryHighlightItem[]>([]);
  const [viewsCount, setViewsCount] = useState<number | null>(stats.profileViewsCount ?? null);
  const [shareOpen, setShareOpen] = useState(false);
  const [visitorsOpen, setVisitorsOpen] = useState(false);
  const [visitors, setVisitors] = useState<ProfileVisitorItem[]>([]);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customTab, setCustomTab] = useState<'look' | 'music' | 'links'>('look');
  const [savingCustom, setSavingCustom] = useState(false);

  // Customize Form State
  const [avatarFrame, setAvatarFrame] = useState(user.avatarFrame || 'none');
  const [profileEffect, setProfileEffect] = useState(user.profileEffect || 'none');
  const [statusEmoji, setStatusEmoji] = useState(user.customStatusEmoji || '');
  const [statusText, setStatusText] = useState(user.customStatusText || '');
  const [musicPreset, setMusicPreset] = useState(user.profileMusicPreset || '');
  const [musicTitle, setMusicTitle] = useState(user.profileMusicTitle || '');
  const [musicArtist, setMusicArtist] = useState(user.profileMusicArtist || '');
  const [bioLinks, setBioLinks] = useState<Array<{ label: string; url: string }>>(user.bioLinks || []);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [interestTags, setInterestTags] = useState<string[]>(user.interestTags || []);
  const [customTagInput, setCustomTagInput] = useState('');
  const [showProfileViews, setShowProfileViews] = useState(user.showProfileViews !== false);

  // Highlights Create & Viewer State
  const [hlCreateOpen, setHlCreateOpen] = useState(false);
  const [hlTitle, setHlTitle] = useState('');
  const [hlEmoji, setHlEmoji] = useState('✨');
  const [allMyStories, setAllMyStories] = useState<StoryHighlightStory[]>([]);
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([]);
  const [activeHighlight, setActiveHighlight] = useState<{ hl: StoryHighlightItem; idx: number } | null>(null);

  const [cropAspect, setCropAspect] = useState<'avatar' | 'banner'>('avatar');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const musicInputRef = useRef<HTMLInputElement | null>(null);

  async function loadProfileMeta() {
    try {
      const res = await apiFetch<{
        stats: ProfileStats;
        badges?: ProfileBadgeItem[];
        highlights?: StoryHighlightItem[];
      }>('/api/profile/me');
      if (res.badges) setBadges(res.badges);
      if (res.highlights) setHighlights(res.highlights);
      if (typeof res.stats?.profileViewsCount === 'number') {
        setViewsCount(res.stats.profileViewsCount);
      }
    } catch {}
  }

  useEffect(() => {
    setLoadingPosts(true);
    apiFetch<{ posts: PostItem[] }>('/api/posts/mine')
      .then((res) => setOwnPosts(res.posts))
      .catch(() => {})
      .finally(() => setLoadingPosts(false));
    loadProfileMeta();
  }, [user.id]);

  function openCustomize() {
    setAvatarFrame(user.avatarFrame || 'none');
    setProfileEffect(user.profileEffect || 'none');
    setStatusEmoji(user.customStatusEmoji || '');
    setStatusText(user.customStatusText || '');
    setMusicPreset(user.profileMusicPreset || '');
    setMusicTitle(user.profileMusicTitle || '');
    setMusicArtist(user.profileMusicArtist || '');
    setBioLinks(user.bioLinks || []);
    setInterestTags(user.interestTags || []);
    setShowProfileViews(user.showProfileViews !== false);
    setCustomizeOpen(true);
  }

  async function handleSaveCustomize() {
    setSavingCustom(true);
    try {
      const res = await apiFetch<{ profile: SafeUser }>('/api/profile/me', {
        method: 'PATCH',
        body: JSON.stringify({
          avatarFrame,
          profileEffect,
          customStatusEmoji: statusEmoji,
          customStatusText: statusText,
          profileMusicPreset: musicPreset,
          profileMusicTitle: musicTitle,
          profileMusicArtist: musicArtist,
          bioLinks,
          interestTags,
          showProfileViews,
        }),
      });
      onUserUpdated(res.profile);
      setCustomizeOpen(false);
      onNotify('Profile customization saved!', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not save profile changes.', 'error');
    } finally {
      setSavingCustom(false);
    }
  }

  async function handleUploadMusic(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      onNotify('Audio file must be under 5 MB.', 'error');
      return;
    }
    setSavingCustom(true);
    try {
      const fd = new FormData();
      fd.append('audio', file);
      if (musicTitle.trim()) fd.append('title', musicTitle.trim());
      if (musicArtist.trim()) fd.append('artist', musicArtist.trim());
      const res = await apiUploadWithProgress<{ profile: SafeUser }>('/api/profile/me/music', fd);
      onUserUpdated(res.profile);
      setMusicPreset('');
      setMusicTitle(res.profile.profileMusicTitle || '');
      setMusicArtist(res.profile.profileMusicArtist || '');
      onNotify('Profile theme song uploaded!', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Audio upload failed.', 'error');
    } finally {
      setSavingCustom(false);
      if (musicInputRef.current) musicInputRef.current.value = '';
    }
  }

  async function handleClearMusic() {
    try {
      const res = await apiFetch<{ profile: SafeUser }>('/api/profile/me/music', { method: 'DELETE' });
      onUserUpdated(res.profile);
      setMusicPreset('');
      setMusicTitle('');
      setMusicArtist('');
      onNotify('Profile music removed.', 'info');
    } catch {}
  }

  async function handleOpenHighlightCreator() {
    setHlTitle('');
    setHlEmoji('✨');
    setSelectedStoryIds([]);
    setHlCreateOpen(true);
    try {
      const res = await apiFetch<{ stories: StoryHighlightStory[] }>('/api/profile/me/all-stories');
      setAllMyStories(res.stories);
    } catch {}
  }

  async function handleCreateHighlight(e: React.FormEvent) {
    e.preventDefault();
    if (!hlTitle.trim() || selectedStoryIds.length === 0) {
      onNotify('Add a title and pick at least 1 story.', 'error');
      return;
    }
    try {
      const res = await apiFetch<{ highlights: StoryHighlightItem[] }>('/api/profile/me/highlights', {
        method: 'POST',
        body: JSON.stringify({ title: hlTitle.trim(), coverEmoji: hlEmoji, storyIds: selectedStoryIds }),
      });
      setHighlights(res.highlights);
      setHlCreateOpen(false);
      loadProfileMeta();
      onNotify('Story Highlight created!', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to create highlight.', 'error');
    }
  }

  async function handleDeleteHighlight(id: string) {
    try {
      await apiFetch(`/api/profile/me/highlights/${id}`, { method: 'DELETE' });
      setHighlights((prev) => prev.filter((h) => h.id !== id));
      setActiveHighlight(null);
      onNotify('Highlight deleted.', 'info');
    } catch {}
  }

  async function handleToggleCloseFriend(friendId: string, currentlyClose: boolean) {
    try {
      await apiFetch(`/api/profile/me/close-friends/${friendId}`, {
        method: currentlyClose ? 'DELETE' : 'POST',
      });
      setMyFriends((prev) =>
        prev.map((f) => (f.id === friendId ? { ...f, isCloseFriend: !currentlyClose } : f))
      );
      onNotify(currentlyClose ? 'Removed from Close Friends.' : 'Added to Close Friends! 💚', 'success');
    } catch {}
  }

  async function handleTogglePinPost(postId: string) {
    try {
      const res = await apiFetch<{ post: PostItem }>(`/api/posts/${postId}/pin`, { method: 'PATCH' });
      setOwnPosts((prev) => {
        const updated = prev.map((p) => (p.id === postId ? res.post : p));
        return [...updated].sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)));
      });
      onNotify(res.post.isPinned ? 'Post pinned to top of Profile!' : 'Post unpinned.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not update pin.', 'error');
    }
  }

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

  const mergedStats: ProfileStats = {
    ...stats,
    profileViewsCount: viewsCount ?? stats.profileViewsCount,
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFilePicked}
        className="hidden"
      />
      <input
        ref={musicInputRef}
        type="file"
        accept="audio/mpeg,audio/ogg,audio/webm,audio/wav"
        onChange={handleUploadMusic}
        className="hidden"
      />

      <ProfileHeader
        user={user}
        stats={mergedStats}
        badges={badges}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenCustomize={openCustomize}
        onOpenShareCard={() => setShareOpen(true)}
        onOpenVisitors={async () => {
          setVisitorsOpen(true);
          try {
            const r = await apiFetch<{ totalViews: number; visitors: ProfileVisitorItem[] }>('/api/profile/me/visitors');
            setVisitors(r.visitors);
            setViewsCount(r.totalViews);
          } catch {}
        }}
        onOpenFriendsList={async () => {
          setFriendsListOpen(true);
          try {
            const r = await apiFetch<{ friends: SafeUser[] }>('/api/profile/me/friends');
            setMyFriends(r.friends);
          } catch {}
        }}
        onPickAvatar={() => openPicker('avatar')}
        onPickBanner={() => openPicker('banner')}
      />

      {/* CB2.1 Story Highlights Shelf */}
      <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-cbox-muted">Story Highlights</h2>
          <span className="text-[11px] text-cbox-muted">{highlights.length} saved</span>
        </div>
        <div className="flex items-center gap-3.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={handleOpenHighlightCreator}
            className="flex flex-col items-center gap-1 shrink-0 group"
          >
            <div className="h-14 w-14 rounded-full border-2 border-dashed border-cbox-accent/60 bg-cbox-elevated/60 group-hover:bg-cbox-accent/15 flex items-center justify-center text-cbox-accent transition">
              <Plus className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold text-cbox-text">New</span>
          </button>

          {highlights.map((hl) => (
            <button
              key={hl.id}
              type="button"
              onClick={() => hl.stories.length > 0 && setActiveHighlight({ hl, idx: 0 })}
              className="flex flex-col items-center gap-1 shrink-0 group"
            >
              <div className="h-14 w-14 rounded-full p-0.5 bg-gradient-to-tr from-cbox-accent via-cbox-violet to-pink-500 group-hover:scale-105 transition">
                <div className="h-full w-full rounded-full bg-cbox-surface flex items-center justify-center text-xl">
                  {hl.coverEmoji}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-cbox-text max-w-[68px] truncate">{hl.title}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Your Posts (with Pin/Unpin up to 3) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-cbox-text">Your Posts</h2>
          <span className="text-xs text-cbox-muted">{ownPosts.length} total · Pin up to 3</span>
        </div>

        {loadingPosts ? (
          <LoadingSkeleton variant="card" rows={2} />
        ) : ownPosts.length === 0 ? (
          <EmptyState
            icon={<Images className="h-6 w-6" />}
            title="No posts yet"
            description="Photos you share from the Posts tab will appear here with Pin, Edit, and Delete controls."
          />
        ) : (
          <div className="space-y-4">
            {ownPosts.map((post) => (
              <div key={post.id} className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  {post.isPinned ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                      <Pin className="h-3 w-3" /> Pinned Post
                    </span>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => handleTogglePinPost(post.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                      post.isPinned
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-400/30'
                        : 'bg-cbox-elevated text-cbox-muted hover:text-cbox-text'
                    }`}
                  >
                    <Pin className="h-3 w-3" />
                    {post.isPinned ? 'Unpin' : 'Pin to Top'}
                  </button>
                </div>
                <PostCard
                  post={post}
                  onEdit={handleEditPost}
                  onDelete={handleDeletePost}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CB2.1 Customize Profile Studio Modal */}
      <Modal open={customizeOpen} onClose={() => setCustomizeOpen(false)} title="Customize Profile (CB2.1)" maxWidthClass="max-w-lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-cbox-elevated text-xs font-bold">
            <button type="button" onClick={() => setCustomTab('look')} className={`py-1.5 rounded-lg ${customTab === 'look' ? 'bg-cbox-accent text-slate-950' : 'text-cbox-muted'}`}>
              Frames & Mood
            </button>
            <button type="button" onClick={() => setCustomTab('music')} className={`py-1.5 rounded-lg ${customTab === 'music' ? 'bg-cbox-accent text-slate-950' : 'text-cbox-muted'}`}>
              Profile Music
            </button>
            <button type="button" onClick={() => setCustomTab('links')} className={`py-1.5 rounded-lg ${customTab === 'links' ? 'bg-cbox-accent text-slate-950' : 'text-cbox-muted'}`}>
              Links & Tags
            </button>
          </div>

          {customTab === 'look' && (
            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
              <div className="space-y-2">
                <p className="text-xs font-bold text-cbox-text">Custom Mood / Status Bubble</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setStatusEmoji(statusEmoji === em ? '' : em)}
                      className={`h-8 w-8 rounded-lg text-base border ${statusEmoji === em ? 'border-cbox-accent bg-cbox-accent/20' : 'border-cbox-border bg-cbox-elevated'}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  maxLength={80}
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  placeholder="Playing Minecraft, Vibing, Busy..."
                  className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-cbox-text">Animated Avatar Frame</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AVATAR_FRAMES.filter((f) => !f.devOnly || user.role === 'DEVELOPER').map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setAvatarFrame(f.id)}
                      className={`p-2 rounded-xl border text-left flex items-center gap-2 text-xs font-semibold ${
                        avatarFrame === f.id ? 'border-cbox-accent bg-cbox-accent/10 text-cbox-text' : 'border-cbox-border text-cbox-muted'
                      }`}
                    >
                      <span>{f.emoji}</span>
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-cbox-text">Banner Profile Effect</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PROFILE_EFFECTS.map((ef) => (
                    <button
                      key={ef.id}
                      type="button"
                      onClick={() => setProfileEffect(ef.id)}
                      className={`p-2 rounded-xl border text-left flex items-center gap-2 text-xs font-semibold ${
                        profileEffect === ef.id ? 'border-cbox-accent bg-cbox-accent/10 text-cbox-text' : 'border-cbox-border text-cbox-muted'
                      }`}
                    >
                      <span>{ef.emoji}</span>
                      <span className="truncate">{ef.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between p-3 rounded-xl border border-cbox-border bg-cbox-elevated/40 text-xs cursor-pointer">
                <div>
                  <p className="font-bold text-cbox-text">Show Profile View Counter</p>
                  <p className="text-[11px] text-cbox-muted">Track & display profile visitor counts</p>
                </div>
                <input
                  type="checkbox"
                  checked={showProfileViews}
                  onChange={(e) => setShowProfileViews(e.target.checked)}
                  className="h-4 w-4 accent-cbox-accent"
                />
              </label>
            </div>
          )}

          {customTab === 'music' && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-cbox-text">Pick a Built-in Ambient Vibe Track</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MUSIC_PRESETS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMusicPreset(m.id);
                      setMusicTitle(m.title);
                      setMusicArtist(m.artist);
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 text-xs ${
                      musicPreset === m.id ? 'border-cbox-accent bg-cbox-accent/10' : 'border-cbox-border'
                    }`}
                  >
                    <Music className="h-4 w-4 text-cbox-accent shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-cbox-text truncate">{m.title}</p>
                      <p className="text-[10px] text-cbox-muted">{m.artist}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-cbox-border space-y-2">
                <p className="text-xs font-bold text-cbox-text">Or Upload Your Own Song Clip (MP3/OGG/WAV, max 5 MB)</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    maxLength={80}
                    value={musicTitle}
                    onChange={(e) => setMusicTitle(e.target.value)}
                    placeholder="Song title"
                    className="rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text"
                  />
                  <input
                    type="text"
                    maxLength={64}
                    value={musicArtist}
                    onChange={(e) => setMusicArtist(e.target.value)}
                    placeholder="Artist name"
                    className="rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => musicInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cbox-violet/15 border border-cbox-violet/40 text-cbox-violet text-xs font-bold"
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload Audio
                  </button>
                  {(user.profileMusicUrl || musicPreset) && (
                    <button
                      type="button"
                      onClick={handleClearMusic}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-cbox-danger/10 text-cbox-danger text-xs font-bold"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove Music
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {customTab === 'links' && (
            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
              <div className="space-y-2">
                <p className="text-xs font-bold text-cbox-text">Interest Tags (up to 8)</p>
                <div className="flex flex-wrap gap-1.5">
                  {INTEREST_SUGGESTIONS.map((tag) => {
                    const active = interestTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setInterestTags((prev) =>
                            active ? prev.filter((t) => t !== tag) : prev.length < 8 ? [...prev, tag] : prev
                          )
                        }
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          active ? 'bg-cbox-accent text-slate-950 border-cbox-accent' : 'border-cbox-border text-cbox-muted'
                        }`}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={24}
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    placeholder="Add custom tag..."
                    className="flex-1 rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-1.5 text-xs text-cbox-text"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = customTagInput.trim().replace(/^#/, '');
                      if (clean && !interestTags.includes(clean) && interestTags.length < 8) {
                        setInterestTags((prev) => [...prev, clean]);
                        setCustomTagInput('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cbox-elevated border border-cbox-border text-xs font-bold text-cbox-text"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-cbox-border">
                <p className="text-xs font-bold text-cbox-text">Clickable Bio Links (up to 5)</p>
                {bioLinks.map((lnk, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-cbox-elevated border border-cbox-border text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-cbox-text truncate">{lnk.label}</p>
                      <p className="text-[10px] text-cbox-muted truncate">{lnk.url}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBioLinks((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-cbox-danger"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {bioLinks.length < 5 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      maxLength={28}
                      value={newLinkLabel}
                      onChange={(e) => setNewLinkLabel(e.target.value)}
                      placeholder="Label (e.g. YouTube)"
                      className="rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-1.5 text-xs text-cbox-text"
                    />
                    <input
                      type="url"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="https://..."
                      className="rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-1.5 text-xs text-cbox-text"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newLinkLabel.trim() && /^https?:\/\//i.test(newLinkUrl.trim())) {
                          setBioLinks((prev) => [...prev, { label: newLinkLabel.trim(), url: newLinkUrl.trim() }]);
                          setNewLinkLabel('');
                          setNewLinkUrl('');
                        } else {
                          onNotify('Enter a label and valid https:// URL.', 'error');
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-cbox-accent/15 text-cbox-accent font-bold text-xs"
                    >
                      + Add Link
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-cbox-border">
            <button type="button" onClick={() => setCustomizeOpen(false)} className="px-4 py-2 rounded-xl border border-cbox-border text-xs font-semibold text-cbox-muted">
              Cancel
            </button>
            <button type="button" disabled={savingCustom} onClick={handleSaveCustomize} className="px-4 py-2 rounded-xl bg-cbox-accent text-slate-950 text-xs font-bold">
              {savingCustom ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Story Highlight Modal */}
      <Modal open={hlCreateOpen} onClose={() => setHlCreateOpen(false)} title="Create Story Highlight" maxWidthClass="max-w-md">
        <form onSubmit={handleCreateHighlight} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-cbox-text">Highlight Title</label>
            <input
              type="text"
              required
              maxLength={32}
              value={hlTitle}
              onChange={(e) => setHlTitle(e.target.value)}
              placeholder="e.g. Gaming Clips, Trips, Squad"
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-cbox-text">Cover Icon</label>
            <div className="flex flex-wrap gap-1.5">
              {HIGHLIGHT_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setHlEmoji(em)}
                  className={`h-9 w-9 rounded-xl border text-lg ${hlEmoji === em ? 'border-cbox-accent bg-cbox-accent/20' : 'border-cbox-border bg-cbox-elevated'}`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-cbox-text">Select Stories ({selectedStoryIds.length} picked)</label>
            {allMyStories.length === 0 ? (
              <p className="text-xs text-cbox-muted py-3">You haven't posted any stories yet. Post a story in the Posts tab first!</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {allMyStories.map((st) => {
                  const picked = selectedStoryIds.includes(st.id);
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() =>
                        setSelectedStoryIds((prev) =>
                          picked ? prev.filter((id) => id !== st.id) : [...prev, st.id]
                        )
                      }
                      className={`h-24 rounded-xl overflow-hidden border-2 p-2 text-[10px] text-white font-semibold bg-gradient-to-br ${st.bgGradient} ${
                        picked ? 'border-cbox-accent ring-2 ring-cbox-accent' : 'border-transparent opacity-75'
                      }`}
                    >
                      {st.imageUrl ? (
                        <img src={st.imageUrl} alt="Story" className="h-full w-full object-cover rounded-lg" />
                      ) : (
                        <span className="line-clamp-3">{st.textContent}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button type="submit" disabled={selectedStoryIds.length === 0} className="w-full py-2.5 rounded-xl bg-cbox-accent text-slate-950 text-xs font-bold disabled:opacity-40">
            Save Highlight
          </button>
        </form>
      </Modal>

      {/* Active Highlight Viewer Modal */}
      <Modal open={Boolean(activeHighlight)} onClose={() => setActiveHighlight(null)} title={activeHighlight ? `${activeHighlight.hl.coverEmoji} ${activeHighlight.hl.title}` : 'Highlight'} maxWidthClass="max-w-md">
        {activeHighlight && activeHighlight.hl.stories[activeHighlight.idx] && (
          <div className="space-y-3">
            <div className={`rounded-2xl min-h-[320px] p-5 text-white flex flex-col justify-between bg-gradient-to-br ${activeHighlight.hl.stories[activeHighlight.idx].bgGradient}`}>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold">{activeHighlight.idx + 1} / {activeHighlight.hl.stories.length}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteHighlight(activeHighlight.hl.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-black/40 text-rose-300 text-[11px]"
                >
                  <Trash2 className="h-3 w-3" /> Delete Highlight
                </button>
              </div>
              {activeHighlight.hl.stories[activeHighlight.idx].imageUrl ? (
                <img src={activeHighlight.hl.stories[activeHighlight.idx].imageUrl!} alt="Highlight" className="my-3 rounded-xl max-h-64 mx-auto object-contain" />
              ) : (
                <p className="text-center text-lg font-bold">{activeHighlight.hl.stories[activeHighlight.idx].textContent}</p>
              )}
              {activeHighlight.hl.stories.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setActiveHighlight((cur) =>
                      cur ? { ...cur, idx: (cur.idx + 1) % cur.hl.stories.length } : null
                    )
                  }
                  className="self-end px-3 py-1 rounded-full bg-black/40 text-xs font-semibold"
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Friends & Close Friends Modal */}
      <Modal open={friendsListOpen} onClose={() => setFriendsListOpen(false)} title={`Friends & Close Friends (${myFriends.length})`}>
        {myFriends.length === 0 ? (
          <p className="text-xs text-cbox-muted py-4 text-center">No friends yet. Accept a friend request to see them here!</p>
        ) : (
          <div className="divide-y divide-cbox-border max-h-80 overflow-y-auto">
            {myFriends.map((f) => (
              <div key={f.id} className="py-2.5 flex items-center justify-between gap-2 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setFriendsListOpen(false);
                    setViewUsername(f.username);
                  }}
                  className="flex items-center gap-2.5 min-w-0 text-left flex-1"
                >
                  <Avatar src={f.avatarUrl} name={f.primaryNickname} size="sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-cbox-text truncate">{f.primaryNickname}</span>
                      <RankBadges userRole={f.role} isVerified={f.isVerified} />
                    </div>
                    <p className="text-[11px] text-cbox-muted">@{f.username}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleCloseFriend(f.id, Boolean(f.isCloseFriend))}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition shrink-0 ${
                    f.isCloseFriend
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400/40'
                      : 'border-cbox-border text-cbox-muted hover:text-cbox-text'
                  }`}
                >
                  <Heart className="h-3 w-3" />
                  {f.isCloseFriend ? 'Close Friend' : 'Add Close'}
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Recent Profile Visitors Modal */}
      <Modal open={visitorsOpen} onClose={() => setVisitorsOpen(false)} title={`Recent Profile Visitors (${viewsCount ?? 0})`}>
        {visitors.length === 0 ? (
          <div className="py-6 text-center space-y-1">
            <Eye className="h-6 w-6 text-cbox-muted mx-auto" />
            <p className="text-xs text-cbox-muted">No profile visits recorded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-cbox-border max-h-80 overflow-y-auto">
            {visitors.map((v) => (
              <button
                key={`${v.viewer.id}-${v.viewedAt}`}
                type="button"
                onClick={() => {
                  setVisitorsOpen(false);
                  setViewUsername(v.viewer.username);
                }}
                className="w-full py-2.5 flex items-center justify-between gap-2 px-2 hover:bg-cbox-elevated/40 rounded-xl text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar src={v.viewer.avatarUrl} name={v.viewer.primaryNickname} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-cbox-text truncate">{v.viewer.primaryNickname}</p>
                    <p className="text-[11px] text-cbox-muted">@{v.viewer.username}</p>
                  </div>
                </div>
                <span className="text-[10px] text-cbox-muted shrink-0">
                  {new Date(v.viewedAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </Modal>

      <ProfileShareCardModal open={shareOpen} onClose={() => setShareOpen(false)} user={user} />

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
