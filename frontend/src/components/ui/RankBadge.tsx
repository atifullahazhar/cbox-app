import React, { useState } from 'react';
import { BadgeCheck, Crown, Shield, Sparkles, Star } from 'lucide-react';
import type { GroupRank, UserRole } from '../../types';

// ===================== COOL RANK & EXCLUSIVE DEVELOPER BADGES =====================
export const RankBadges: React.FC<{
  userRole?: UserRole;
  groupRank?: GroupRank | null;
  isVerified?: boolean;
}> = ({ userRole, groupRank, isVerified }) => {
  return (
    <span className="inline-flex items-center gap-1 align-middle flex-wrap">
      {isVerified && (
        <span title="Verified Account" className="inline-flex text-sky-400">
          <BadgeCheck className="h-3.5 w-3.5" />
        </span>
      )}

      {/* Exclusive Animated Holographic Developer Badge — Coolest Badge in Chatterbox */}
      {userRole === 'DEVELOPER' && (
        <span
          title="Chatterbox Developer"
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-fuchsia-600 via-cyan-500 to-violet-600 shadow-[0_0_10px_rgba(168,85,247,0.65)] ring-1 ring-white/30 animate-pulse"
        >
          <Sparkles className="h-2.5 w-2.5" />
          DEV
        </span>
      )}

      {/* Group / Community Rank Badges */}
      {groupRank === 'OWNER' && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-400/40">
          <Crown className="h-2.5 w-2.5" />
          OWNER
        </span>
      )}
      {groupRank === 'ADMIN' && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-400/40">
          <Shield className="h-2.5 w-2.5" />
          ADMIN
        </span>
      )}
      {groupRank === 'VICE_ADMIN' && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-cyan-500/20 text-cyan-400 border border-cyan-400/40">
          <Star className="h-2.5 w-2.5" />
          VICE ADMIN
        </span>
      )}
    </span>
  );
};

// ===================== CHAT WALLPAPERS (1:1 & GROUP) =====================
export const CHAT_WALLPAPERS: Array<{ id: string; name: string; className: string; preview: string }> = [
  { id: 'default', name: 'Theme Default', className: 'bg-cbox-bg/40', preview: 'linear-gradient(135deg,#1e293b,#0f172a)' },
  { id: 'sakura-glow', name: 'Sakura Glow', className: 'bg-gradient-to-br from-pink-500/15 via-rose-400/10 to-fuchsia-500/15', preview: 'linear-gradient(135deg,#ec4899,#f472b6)' },
  { id: 'cyber-grid', name: 'Cyber Pulse', className: 'bg-gradient-to-br from-cyan-500/15 via-indigo-900/25 to-fuchsia-600/20', preview: 'linear-gradient(135deg,#06b6d4,#a855f7)' },
  { id: 'aurora-night', name: 'Aurora Night', className: 'bg-gradient-to-br from-emerald-500/15 via-teal-900/25 to-indigo-600/20', preview: 'linear-gradient(135deg,#10b981,#6366f1)' },
  { id: 'sunset-warm', name: 'Sunset Warm', className: 'bg-gradient-to-br from-amber-500/15 via-orange-600/15 to-rose-600/20', preview: 'linear-gradient(135deg,#f59e0b,#e11d48)' },
  { id: 'royal-velvet', name: 'Royal Velvet', className: 'bg-gradient-to-br from-purple-700/20 via-violet-900/25 to-amber-500/15', preview: 'linear-gradient(135deg,#7c3aed,#eab308)' },
  { id: 'ocean-deep', name: 'Deep Ocean', className: 'bg-gradient-to-br from-sky-600/20 via-blue-900/25 to-cyan-500/15', preview: 'linear-gradient(135deg,#0284c7,#06b6d4)' },
  { id: 'pitch-oled', name: 'Pitch OLED', className: 'bg-black/90', preview: '#000000' },
];

export function getWallpaperClass(id?: string): string {
  return CHAT_WALLPAPERS.find((w) => w.id === id)?.className || CHAT_WALLPAPERS[0].className;
}

// ===================== EMOJIS & CURATED STICKERS =====================
export const QUICK_EMOJIS = [
  '😀', '😂', '🤣', '😍', '🥰', '😎', '🔥', '❤️', '💯', '🎉',
  '🙌', '👏', '🤝', '✨', '🌸', '⚡', '👑', '🎮', '🎧', '🚀',
  '😭', '😮', '🤔', '🫡', '🥳', '💀', '👀', '🫶', '☕', '🌙',
];

export const CHAT_STICKERS: Array<{ id: string; label: string; badge: string; text: string }> = [
  { id: 'gg', label: 'GG WP', badge: '🎮', text: '[STICKER:🎮 GG WP!]' },
  { id: 'op', label: 'OP Bro!', badge: '🔥', text: '[STICKER:🔥 OP BRO!]' },
  { id: 'sakura', label: 'Sakura Vibes', badge: '🌸', text: '[STICKER:🌸 Sakura Vibes]' },
  { id: 'crown', label: 'Legend', badge: '👑', text: '[STICKER:👑 Certified Legend]' },
  { id: 'chai', label: 'Chai Time', badge: '☕', text: '[STICKER:☕ Chai Pe Charcha]' },
  { id: 'party', label: 'Party On', badge: '🥳', text: '[STICKER:🥳 Let’s Celebrate!]' },
  { id: 'rocket', label: 'To The Moon', badge: '🚀', text: '[STICKER:🚀 Full Speed Ahead!]' },
  { id: 'heart', label: 'Much Love', badge: '🫶', text: '[STICKER:🫶 Much Love!]' },
];

export function isStickerMessage(content: string): { emoji: string; label: string } | null {
  const m = content.match(/^\[STICKER:(\S+)\s+(.+)\]$/);
  if (!m) return null;
  return { emoji: m[1], label: m[2] };
}

export const EmojiStickerPicker: React.FC<{
  onPickEmoji: (emoji: string) => void;
  onPickSticker: (stickerText: string) => void;
}> = ({ onPickEmoji, onPickSticker }) => {
  const [tab, setTab] = useState<'emoji' | 'sticker'>('emoji');
  return (
    <div className="w-72 rounded-2xl border border-cbox-border bg-cbox-surface shadow-2xl p-2.5 space-y-2">
      <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-cbox-elevated text-[11px] font-bold">
        <button
          type="button"
          onClick={() => setTab('emoji')}
          className={`py-1 rounded-lg ${tab === 'emoji' ? 'bg-cbox-accent text-slate-950' : 'text-cbox-muted'}`}
        >
          Emojis
        </button>
        <button
          type="button"
          onClick={() => setTab('sticker')}
          className={`py-1 rounded-lg ${tab === 'sticker' ? 'bg-cbox-accent text-slate-950' : 'text-cbox-muted'}`}
        >
          Stickers
        </button>
      </div>

      {tab === 'emoji' ? (
        <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto">
          {QUICK_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => onPickEmoji(em)}
              className="h-9 rounded-lg hover:bg-cbox-elevated text-lg flex items-center justify-center transition"
            >
              {em}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
          {CHAT_STICKERS.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => onPickSticker(st.text)}
              className="p-2 rounded-xl border border-cbox-border bg-cbox-elevated/60 hover:border-cbox-accent text-left flex items-center gap-2 transition"
            >
              <span className="text-xl">{st.badge}</span>
              <span className="text-[11px] font-bold text-cbox-text truncate">{st.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
