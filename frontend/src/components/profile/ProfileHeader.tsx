import React from 'react';
import {
  Camera,
  Eye,
  ExternalLink,
  QrCode,
  Settings,
  Sparkles,
} from 'lucide-react';
import type { ProfileBadgeItem, ProfileStats, SafeUser } from '../../types';
import { Avatar } from '../ui/Avatar';
import {
  getAvatarFrameClass,
  ProfileBadgeShelf,
  ProfileEffectOverlay,
  ProfileMusicPill,
  RankBadges,
} from '../ui/RankBadge';

interface ProfileHeaderProps {
  user: SafeUser;
  stats: ProfileStats;
  badges?: ProfileBadgeItem[];
  onOpenSettings: () => void;
  onOpenFriendsList?: () => void;
  onOpenVisitors?: () => void;
  onOpenCustomize?: () => void;
  onOpenShareCard?: () => void;
  onPickAvatar: () => void;
  onPickBanner: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  user,
  stats,
  badges,
  onOpenSettings,
  onOpenFriendsList,
  onOpenVisitors,
  onOpenCustomize,
  onOpenShareCard,
  onPickAvatar,
  onPickBanner,
}) => {
  const frameCls = getAvatarFrameClass(user.avatarFrame);

  return (
    <section className="relative rounded-2xl border border-cbox-border bg-cbox-surface overflow-hidden shadow-soft">
      {/* Wide Customizable Banner + CB2.1 Profile Effect Overlay */}
      <div className="relative h-40 sm:h-52 w-full bg-gradient-to-r from-slate-900 via-sky-950 to-indigo-950 overflow-hidden">
        {user.bannerUrl && (
          <img
            src={user.bannerUrl}
            alt="Profile banner"
            className="h-full w-full object-cover"
          />
        )}
        <ProfileEffectOverlay effect={user.profileEffect} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

        <div className="absolute top-3 right-3 flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onPickBanner}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/55 hover:bg-black/75 text-white text-xs font-medium backdrop-blur-md transition"
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Banner</span>
          </button>
          {onOpenCustomize && (
            <button
              type="button"
              onClick={onOpenCustomize}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cbox-accent/90 hover:bg-cbox-accent text-slate-950 text-xs font-bold backdrop-blur-md transition"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Customize
            </button>
          )}
          {onOpenShareCard && (
            <button
              type="button"
              onClick={onOpenShareCard}
              title="Share Profile & QR Card"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-black/55 hover:bg-black/75 text-white text-xs font-medium backdrop-blur-md transition"
            >
              <QrCode className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cbox-surface/90 hover:bg-cbox-surface text-cbox-text border border-cbox-border text-xs font-medium backdrop-blur-md transition"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* Avatar + Mood Status + Stats Row */}
      <div className="px-5 sm:px-6 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4 -mt-12 sm:-mt-14 mb-3">
          <div className="relative flex items-end gap-3">
            <div className={`relative rounded-full p-1 ${frameCls || 'bg-cbox-surface'}`}>
              <div className="rounded-full bg-cbox-surface p-0.5">
                <Avatar src={user.avatarUrl} name={user.primaryNickname} size="xl" />
              </div>
              <button
                type="button"
                onClick={onPickAvatar}
                title="Change profile photo"
                className="absolute bottom-1 right-1 h-8 w-8 rounded-full bg-cbox-accent text-slate-950 flex items-center justify-center shadow-lg hover:opacity-90 transition"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>

            {(user.customStatusEmoji || user.customStatusText) && (
              <div className="mb-1 px-3 py-1 rounded-2xl bg-cbox-elevated border border-cbox-border shadow-md text-xs font-semibold text-cbox-text flex items-center gap-1.5 max-w-[200px]">
                {user.customStatusEmoji && <span>{user.customStatusEmoji}</span>}
                <span className="truncate">{user.customStatusText}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 pt-2">
            <div className="text-center px-1">
              <p className="text-lg font-bold text-cbox-text">{stats.postCount}</p>
              <p className="text-xs text-cbox-muted">Posts</p>
            </div>
            <div className="h-7 w-px bg-cbox-border" />
            <button
              type="button"
              onClick={onOpenFriendsList}
              className="text-center rounded-xl px-2 py-1 hover:bg-cbox-elevated transition"
              title="View Friends & Close Friends"
            >
              <p className="text-lg font-bold text-cbox-text">{stats.friendCount}</p>
              <p className="text-xs text-cbox-accent font-medium">Friends</p>
            </button>
            {user.showProfileViews !== false && typeof stats.profileViewsCount === 'number' && (
              <>
                <div className="h-7 w-px bg-cbox-border" />
                <button
                  type="button"
                  onClick={onOpenVisitors}
                  className="text-center rounded-xl px-2 py-1 hover:bg-cbox-elevated transition"
                  title="Recent Profile Visitors"
                >
                  <p className="text-lg font-bold text-cbox-text flex items-center justify-center gap-1">
                    <Eye className="h-3.5 w-3.5 text-cbox-violet" />
                    {stats.profileViewsCount}
                  </p>
                  <p className="text-xs text-cbox-muted">Views</p>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Identity, Badges, Music, Bio, Tags, Links */}
        <div className="space-y-2.5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-cbox-text">{user.primaryNickname}</h1>
              <RankBadges userRole={user.role} isVerified={user.isVerified} />
            </div>
            <p className="text-sm text-cbox-muted">@{user.username}</p>
          </div>

          <ProfileBadgeShelf badges={badges} />

          <ProfileMusicPill
            title={user.profileMusicTitle}
            artist={user.profileMusicArtist}
            preset={user.profileMusicPreset}
            audioUrl={user.profileMusicUrl}
          />

          {user.bio ? (
            <p className="text-sm text-cbox-text/90 leading-relaxed max-w-2xl whitespace-pre-wrap">
              {user.bio}
            </p>
          ) : (
            <p className="text-xs text-cbox-muted italic">
              Add a bio, mood status, theme song, or interest tags using Customize.
            </p>
          )}

          {user.interestTags && user.interestTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {user.interestTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cbox-elevated border border-cbox-border text-cbox-text/90"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {user.bioLinks && user.bioLinks.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-0.5">
              {user.bioLinks.map((lnk, idx) => (
                <a
                  key={`${lnk.url}-${idx}`}
                  href={lnk.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cbox-accent/10 border border-cbox-accent/30 text-xs font-semibold text-cbox-accent hover:bg-cbox-accent/20 transition"
                >
                  <ExternalLink className="h-3 w-3" />
                  {lnk.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
