import React from 'react';
import { Settings, Camera, ShieldCheck } from 'lucide-react';
import type { ProfileStats, SafeUser } from '../../types';
import { Avatar } from '../ui/Avatar';

interface ProfileHeaderProps {
  user: SafeUser;
  stats: ProfileStats;
  onOpenSettings: () => void;
  onPickAvatar: () => void;
  onPickBanner: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  user,
  stats,
  onOpenSettings,
  onPickAvatar,
  onPickBanner,
}) => {
  return (
    <section className="rounded-2xl border border-cbox-border bg-cbox-surface overflow-hidden shadow-soft">
      {/* Wide Customizable Banner */}
      <div className="relative h-40 sm:h-52 w-full bg-gradient-to-r from-slate-900 via-sky-950 to-indigo-950">
        {user.bannerUrl && (
          <img
            src={user.bannerUrl}
            alt="Profile banner"
            className="h-full w-full object-cover"
          />
        )}

        <div className="absolute top-3 right-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onPickBanner}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/65 hover:bg-slate-950/85 text-white text-xs font-medium backdrop-blur-sm transition"
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Change banner</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open profile settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cbox-surface/90 hover:bg-cbox-surface text-cbox-text border border-cbox-border text-xs font-semibold backdrop-blur-sm transition"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Overlapping Circular Avatar & Identity */}
      <div className="px-5 sm:px-6 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4 -mt-12 mb-4">
          <div className="relative">
            <div className="rounded-full p-1 bg-cbox-surface inline-block">
              <Avatar src={user.avatarUrl} name={user.primaryNickname} size="xl" />
            </div>
            <button
              type="button"
              onClick={onPickAvatar}
              aria-label="Change profile picture"
              className="absolute bottom-1 right-1 h-8 w-8 rounded-full bg-cbox-accent text-slate-950 hover:bg-cbox-accentHover flex items-center justify-center shadow border-2 border-cbox-surface transition"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-5 pt-2">
            <div className="text-center">
              <p className="text-lg font-bold text-cbox-text">{stats.postCount}</p>
              <p className="text-xs text-cbox-muted">Posts</p>
            </div>
            <div className="h-7 w-px bg-cbox-border" />
            <div className="text-center">
              <p className="text-lg font-bold text-cbox-text">{stats.friendCount}</p>
              <p className="text-xs text-cbox-muted">Friends</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-cbox-text">{user.primaryNickname}</h1>
            {user.role === 'DEVELOPER' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cbox-violet/15 text-cbox-violet border border-cbox-violet/30">
                <ShieldCheck className="h-3.5 w-3.5" />
                Developer
              </span>
            )}
            {user.isDemo && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-cbox-elevated text-cbox-muted border border-cbox-border">
                Demo Account
              </span>
            )}
          </div>

          <p className="text-sm font-medium text-cbox-accent">@{user.username}</p>

          {user.alternateNicknames.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-xs text-cbox-muted mr-1">Also known as:</span>
              {user.alternateNicknames.map((alias) => (
                <span
                  key={alias}
                  className="px-2.5 py-0.5 rounded-full text-xs bg-cbox-elevated text-cbox-text border border-cbox-border"
                >
                  {alias}
                </span>
              ))}
            </div>
          )}

          <p className="text-sm text-cbox-text/90 leading-relaxed pt-1 max-w-2xl">
            {user.bio || 'No bio yet. Open Settings to introduce yourself.'}
          </p>
        </div>
      </div>
    </section>
  );
};
