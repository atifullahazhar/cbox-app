import React, { useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  Check,
  Copy,
  Crown,
  Download,
  Music,
  Pause,
  Play,
  Shield,
  Bug,
  Image as ImageIcon,
  Plus,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import type { GroupRank, ProfileBadgeItem, SafeUser, UserRole } from '../../types';
import { Modal } from './Modal';
import { apiFetch, apiUploadWithProgress } from '../../lib/api';

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

export function isCustomStickerMessage(content: string): { url: string; label: string } | null {
  const m = content.match(/^\[CUSTOM_STICKER:([^|\]]+)\|([^\]]*)\]$/);
  if (!m) return null;
  return { url: m[1], label: m[2] || 'Sticker' };
}

interface CustomStickerItem {
  id: string;
  label: string;
  imageUrl: string;
}

const STICKER_BGS = [
  ['#0f172a', '#6366f1'],
  ['#db2777', '#f59e0b'],
  ['#059669', '#06b6d4'],
  ['#7c3aed', '#ec4899'],
  ['#111827', '#000000'],
];

const STICKER_TEXT_COLORS = ['#ffffff', '#fde047', '#38bdf8', '#f472b6', '#4ade80'];

export const EmojiStickerPicker: React.FC<{
  onPickEmoji: (emoji: string) => void;
  onPickSticker: (stickerText: string) => void;
}> = ({ onPickEmoji, onPickSticker }) => {
  const [tab, setTab] = useState<'emoji' | 'sticker' | 'custom'>('emoji');
  const [myStickers, setMyStickers] = useState<CustomStickerItem[]>([]);
  const [loadedCustom, setLoadedCustom] = useState(false);
  const [makerOpen, setMakerOpen] = useState(false);
  const [makerText, setMakerText] = useState('OP BRO!');
  const [makerEmoji, setMakerEmoji] = useState('🔥');
  const [makerBgIdx, setMakerBgIdx] = useState(0);
  const [makerColor, setMakerColor] = useState('#ffffff');
  const [makerImgUrl, setMakerImgUrl] = useState<string | null>(null);
  const [savingSticker, setSavingSticker] = useState(false);
  const [makerErr, setMakerErr] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgElRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (tab === 'custom' && !loadedCustom) {
      apiFetch<{ stickers: CustomStickerItem[] }>('/api/profile/me/stickers')
        .then((r) => setMyStickers(r.stickers || []))
        .catch(() => {})
        .finally(() => setLoadedCustom(true));
    }
  }, [tab, loadedCustom]);

  function drawStickerCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const S = 256;
    ctx.clearRect(0, 0, S, S);

    // Rounded sticker base
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(10, 10, S - 20, S - 20, 44);
    ctx.clip();

    if (imgElRef.current) {
      const img = imgElRef.current;
      const scale = Math.max((S - 20) / img.width, (S - 20) / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
    } else {
      const [c1, c2] = STICKER_BGS[makerBgIdx] || STICKER_BGS[0];
      const grad = ctx.createLinearGradient(0, 0, S, S);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.fillRect(10, 10, S - 20, S - 20);

      if (makerEmoji) {
        ctx.font = '88px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(makerEmoji, S / 2, makerText.trim() ? S / 2 - 22 : S / 2);
      }
    }

    if (makerText.trim()) {
      ctx.font = '900 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.fillStyle = makerColor;
      const label = makerText.trim().slice(0, 22);
      ctx.strokeText(label, S / 2, S - 24);
      ctx.fillText(label, S / 2, S - 24);
    }
    ctx.restore();

    // Crisp white sticker border
    ctx.beginPath();
    ctx.roundRect(10, 10, S - 20, S - 20, 44);
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
  }

  useEffect(() => {
    if (makerOpen) drawStickerCanvas();
  }, [makerOpen, makerText, makerEmoji, makerBgIdx, makerColor, makerImgUrl]);

  function handlePickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgElRef.current = img;
      setMakerImgUrl(url);
      drawStickerCanvas();
    };
    img.src = url;
  }

  async function handleSaveCustomSticker() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSavingSticker(true);
    setMakerErr(null);
    try {
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to render sticker'))), 'image/png')
      );
      const fd = new FormData();
      fd.append('image', blob, 'custom-sticker.png');
      fd.append('label', makerText.trim() || makerEmoji || 'Custom Sticker');
      const res = await apiUploadWithProgress<{ sticker: CustomStickerItem }>('/api/profile/me/stickers', fd);
      setMyStickers((prev) => [res.sticker, ...prev]);
      setMakerOpen(false);
      imgElRef.current = null;
      setMakerImgUrl(null);
      onPickSticker(`[CUSTOM_STICKER:${res.sticker.imageUrl}|${res.sticker.label}]`);
    } catch (err) {
      setMakerErr(err instanceof Error ? err.message : 'Could not save sticker.');
    } finally {
      setSavingSticker(false);
    }
  }

  async function handleDeleteSticker(id: string) {
    try {
      await apiFetch(`/api/profile/me/stickers/${id}`, { method: 'DELETE' });
      setMyStickers((prev) => prev.filter((s) => s.id !== id));
    } catch {}
  }

  return (
    <>
      <div className="w-72 rounded-2xl border border-cbox-border bg-cbox-surface shadow-2xl p-2.5 space-y-2">
        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-cbox-elevated text-[10px] font-bold">
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
          <button
            type="button"
            onClick={() => setTab('custom')}
            className={`py-1 rounded-lg ${tab === 'custom' ? 'bg-cbox-accent text-slate-950' : 'text-cbox-muted'}`}
          >
            My Stickers
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
        ) : tab === 'sticker' ? (
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
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setMakerOpen(true)}
              className="w-full py-1.5 rounded-xl bg-cbox-accent text-slate-950 text-[11px] font-bold flex items-center justify-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Create Custom Sticker
            </button>
            {myStickers.length === 0 ? (
              <p className="text-[11px] text-cbox-muted text-center py-4">No custom stickers yet. Create one from any photo or emoji!</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                {myStickers.map((st) => (
                  <div key={st.id} className="relative group rounded-xl border border-cbox-border bg-cbox-elevated/50 p-1">
                    <button
                      type="button"
                      onClick={() => onPickSticker(`[CUSTOM_STICKER:${st.imageUrl}|${st.label}]`)}
                      className="w-full aspect-square flex items-center justify-center overflow-hidden rounded-lg"
                    >
                      <img src={st.imageUrl} alt={st.label} loading="lazy" decoding="async" className="h-full w-full object-contain" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSticker(st.id)}
                      title="Delete sticker"
                      className="absolute top-1 right-1 p-0.5 rounded-md bg-black/70 text-rose-400 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={makerOpen} onClose={() => setMakerOpen(false)} title="Custom Sticker Maker (CB2.2)" maxWidthClass="max-w-md">
        <div className="space-y-4">
          <div className="flex justify-center">
            <canvas ref={canvasRef} width={256} height={256} className="h-44 w-44 rounded-3xl shadow-xl border border-cbox-border bg-cbox-elevated" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-cbox-text block">Sticker Text</label>
            <input
              type="text"
              maxLength={22}
              value={makerText}
              onChange={(e) => setMakerText(e.target.value)}
              placeholder="Write bold sticker text..."
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cbox-accent/40 bg-cbox-accent/10 text-cbox-accent text-xs font-bold cursor-pointer">
              <ImageIcon className="h-3.5 w-3.5" />
              {makerImgUrl ? 'Change Photo' : 'Pick Photo'}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePickPhoto} className="hidden" />
            </label>
            {makerImgUrl && (
              <button
                type="button"
                onClick={() => {
                  imgElRef.current = null;
                  setMakerImgUrl(null);
                }}
                className="text-xs text-cbox-muted hover:text-cbox-danger"
              >
                Use Emoji BG
              </button>
            )}
            <div className="flex items-center gap-1.5">
              {STICKER_TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setMakerColor(c)}
                  style={{ backgroundColor: c }}
                  className={`h-5 w-5 rounded-full border-2 ${makerColor === c ? 'border-cbox-accent scale-110' : 'border-black/30'}`}
                />
              ))}
            </div>
          </div>

          {!makerImgUrl && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {['🔥', '😂', '👑', '🎮', '🌸', '⚡', '🫶', '💀', '🚀', '😎'].map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setMakerEmoji(em)}
                    className={`h-8 w-8 rounded-lg text-base border shrink-0 ${makerEmoji === em ? 'border-cbox-accent bg-cbox-accent/20' : 'border-cbox-border bg-cbox-elevated'}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {STICKER_BGS.map(([c1, c2], idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMakerBgIdx(idx)}
                    style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
                    className={`h-7 flex-1 rounded-xl border-2 ${makerBgIdx === idx ? 'border-white' : 'border-transparent'}`}
                  />
                ))}
              </div>
            </div>
          )}

          {makerErr && <p className="text-xs text-cbox-danger">{makerErr}</p>}

          <button
            type="button"
            disabled={savingSticker}
            onClick={handleSaveCustomSticker}
            className="w-full py-2.5 rounded-xl bg-cbox-accent text-slate-950 text-xs font-bold disabled:opacity-50"
          >
            {savingSticker ? 'Saving Sticker...' : 'Save & Send Sticker'}
          </button>
        </div>
      </Modal>
    </>
  );
};

export const ReportBugModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onNotify: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}> = ({ open, onClose, onNotify }) => {
  const [title, setTitle] = useState('');
  const [section, setSection] = useState('Profile');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3 || description.trim().length < 5) {
      onNotify('Please write a short bug title and description.', 'error');
      return;
    }
    setBusy(true);
    try {
      const deviceInfo = `${window.innerWidth}x${window.innerHeight} · ${navigator.userAgent.slice(0, 180)}`;
      await apiFetch('/api/developer/bugs', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          section,
          severity,
          description: description.trim(),
          deviceInfo,
        }),
      });
      setTitle('');
      setDescription('');
      onClose();
      onNotify('Bug report sent to Developer Control! Thank you.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to submit bug report.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Report a Bug" description="Help improve Chatterbox by reporting issues directly to the Developer." maxWidthClass="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="space-y-1">
          <label className="text-xs font-bold text-cbox-text">Bug Title</label>
          <input
            type="text"
            required
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Chat message not scrolling on mobile"
            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-cbox-text">Section</label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text"
            >
              {['Profile', 'Chat', 'Groups', 'Communities', 'Posts', 'Themes', 'Other'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-cbox-text">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as any)}
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-cbox-text">What happened?</label>
          <textarea
            required
            rows={4}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what went wrong and how to reproduce it..."
            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Bug className="h-4 w-4" />
          {busy ? 'Submitting...' : 'Submit Bug Report'}
        </button>
      </form>
    </Modal>
  );
};

// ===================== CB2.1 ULTIMATE PROFILE CONSTANTS & WIDGETS =====================
export const AVATAR_FRAMES: Array<{ id: string; name: string; emoji: string; devOnly?: boolean; cls: string }> = [
  { id: 'none', name: 'None', emoji: '⭕', cls: '' },
  { id: 'neon-pulse', name: 'Neon Pulse', emoji: '💫', cls: 'cb-frame-neon-pulse' },
  { id: 'sakura-bloom', name: 'Sakura Bloom', emoji: '🌸', cls: 'cb-frame-sakura-bloom' },
  { id: 'golden-crown', name: 'Golden Crown', emoji: '👑', cls: 'cb-frame-golden-crown' },
  { id: 'cyber-ring', name: 'Cyber Ring', emoji: '⚡', cls: 'cb-frame-cyber-ring' },
  { id: 'aurora-glow', name: 'Aurora Glow', emoji: '🌌', cls: 'cb-frame-aurora-glow' },
  { id: 'dev-holo', name: 'DEV Hologram', emoji: '🛸', devOnly: true, cls: 'cb-frame-dev-holo' },
];

export const PROFILE_EFFECTS: Array<{ id: string; name: string; emoji: string; cls: string }> = [
  { id: 'none', name: 'None', emoji: '✨', cls: '' },
  { id: 'sparkle-dust', name: 'Sparkle Dust', emoji: '🌟', cls: 'cb-effect-sparkle-dust' },
  { id: 'sakura-petals', name: 'Sakura Petals', emoji: '🌸', cls: 'cb-effect-sakura-petals' },
  { id: 'cyber-grid', name: 'Cyber Grid', emoji: '🔷', cls: 'cb-effect-cyber-grid' },
  { id: 'aurora-wave', name: 'Aurora Wave', emoji: '🌈', cls: 'cb-effect-aurora-wave' },
  { id: 'starfield', name: 'Starfield', emoji: '🌠', cls: 'cb-effect-starfield' },
];

export const MUSIC_PRESETS: Array<{ id: string; title: string; artist: string; notes: number[] }> = [
  { id: 'lofi-chill', title: 'Midnight Lo-Fi Chill', artist: 'Chatterbox Synth', notes: [261.63, 329.63, 392.0, 493.88] },
  { id: 'cyber-synth', title: 'Neon Cyberwave', artist: 'Chatterbox Synth', notes: [220.0, 261.63, 329.63, 440.0] },
  { id: 'sakura-piano', title: 'Sakura Breeze', artist: 'Chatterbox Synth', notes: [293.66, 349.23, 440.0, 523.25] },
  { id: 'midnight-ambient', title: 'Deep Space Drift', artist: 'Chatterbox Synth', notes: [196.0, 246.94, 293.66, 392.0] },
  { id: 'gaming-arcade', title: '8-Bit Victory Loop', artist: 'Chatterbox Synth', notes: [329.63, 392.0, 523.25, 659.25] },
];

export const INTEREST_SUGGESTIONS = [
  'Minecraft', 'Gaming', 'Coding', 'Anime', 'Music', 'Cricket',
  'Photography', 'Design', 'Movies', 'Football', 'Tech', 'Travel',
];

export function getAvatarFrameClass(frame?: string): string {
  return AVATAR_FRAMES.find((f) => f.id === frame)?.cls || '';
}

export function getProfileEffectClass(effect?: string): string {
  return PROFILE_EFFECTS.find((e) => e.id === effect)?.cls || '';
}

export const ProfileEffectOverlay: React.FC<{ effect?: string }> = ({ effect }) => {
  const cls = getProfileEffectClass(effect);
  if (!cls) return null;
  return <div className={`pointer-events-none absolute inset-0 ${cls}`} />;
};

export const ProfileMusicPill: React.FC<{
  title?: string;
  artist?: string;
  preset?: string;
  audioUrl?: string | null;
}> = ({ title, artist, preset, audioUrl }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const presetObj = MUSIC_PRESETS.find((p) => p.id === preset);
  const displayTitle = title || presetObj?.title || '';
  const displayArtist = artist || presetObj?.artist || '';

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (ctxRef.current) ctxRef.current.close().catch(() => {});
    };
  }, []);

  if (!audioUrl && !presetObj) return null;

  function stopPlayback() {
    setPlaying(false);
    if (audioRef.current) audioRef.current.pause();
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
  }

  function togglePlay() {
    if (playing) {
      stopPlayback();
      return;
    }
    if (audioUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
        audioRef.current.loop = true;
      }
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
      return;
    }
    if (presetObj) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        ctxRef.current = ctx;
        let step = 0;
        const playNote = () => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = presetObj.id === 'gaming-arcade' ? 'triangle' : 'sine';
          osc.frequency.value = presetObj.notes[step % presetObj.notes.length];
          gain.gain.setValueAtTime(0.001, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.75);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.8);
          step++;
        };
        playNote();
        timerRef.current = window.setInterval(playNote, 850);
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={togglePlay}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cbox-accent/40 bg-cbox-accent/10 hover:bg-cbox-accent/20 text-xs transition"
    >
      <span className="h-5 w-5 rounded-full bg-cbox-accent text-slate-950 flex items-center justify-center">
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
      </span>
      <Music className={`h-3.5 w-3.5 text-cbox-accent ${playing ? 'animate-bounce' : ''}`} />
      <span className="font-semibold text-cbox-text truncate max-w-[160px]">{displayTitle}</span>
      {displayArtist && <span className="text-[11px] text-cbox-muted hidden sm:inline">· {displayArtist}</span>}
    </button>
  );
};

export const ProfileBadgeShelf: React.FC<{ badges?: ProfileBadgeItem[] }> = ({ badges }) => {
  if (!badges || badges.length === 0) return null;
  const toneCls: Record<ProfileBadgeItem['tone'], string> = {
    dev: 'bg-gradient-to-r from-fuchsia-600 via-cyan-500 to-violet-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]',
    verified: 'bg-sky-500/15 text-sky-400 border border-sky-400/40',
    gold: 'bg-amber-500/15 text-amber-400 border border-amber-400/40',
    violet: 'bg-violet-500/15 text-violet-400 border border-violet-400/40',
    emerald: 'bg-emerald-500/15 text-emerald-400 border border-emerald-400/40',
    sky: 'bg-cyan-500/15 text-cyan-400 border border-cyan-400/40',
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      {badges.map((b) => (
        <span
          key={b.id}
          title={b.description}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${toneCls[b.tone]}`}
        >
          <span>{b.emoji}</span>
          <span>{b.label}</span>
        </span>
      ))}
    </div>
  );
};

// Deterministic compact visual QR pattern + downloadable Share Card Modal
export const ProfileShareCardModal: React.FC<{
  open: boolean;
  onClose: () => void;
  user: SafeUser;
}> = ({ open, onClose, user }) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/?u=${encodeURIComponent(user.username)}`;

  // Generate a crisp 21x21 QR-style matrix with standard 3 finder patterns + deterministic data bits
  const size = 21;
  const cells: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const border = r === 0 || r === 6 || c === 0 || c === 6;
        const center = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        cells[r0 + r][c0 + c] = border || center;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);
  let seed = 0;
  for (let i = 0; i < shareUrl.length; i++) seed = (seed * 31 + shareUrl.charCodeAt(i)) >>> 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inFinder = (r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8);
      if (!inFinder) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        cells[r][c] = (seed & 1) === 1;
      }
    }
  }

  function handleCopyLink() {
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleDownloadCard() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 640, 360);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(1, '#312e81');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 360);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('CHATTERBOX PROFILE CARD', 36, 48);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(user.primaryNickname.slice(0, 22), 36, 118);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px sans-serif';
    ctx.fillText(`@${user.username}`, 36, 152);

    if (user.customStatusText) {
      ctx.fillStyle = '#f472b6';
      ctx.font = '16px sans-serif';
      ctx.fillText(`${user.customStatusEmoji || ''} ${user.customStatusText}`.slice(0, 38), 36, 192);
    }

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '15px sans-serif';
    ctx.fillText((user.bio || 'Connect with me on Chatterbox!').slice(0, 44), 36, 238);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '13px monospace';
    ctx.fillText(shareUrl.slice(0, 48), 36, 318);

    // Draw QR box on right
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(430, 82, 174, 174);
    ctx.fillStyle = '#0f172a';
    const cellPx = 7;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (cells[r][c]) {
          ctx.fillRect(443 + c * cellPx, 95 + r * cellPx, cellPx, cellPx);
        }
      }
    }

    const link = document.createElement('a');
    link.download = `chatterbox-${user.username}-card.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <Modal open={open} onClose={onClose} title="Share Profile & QR Card" maxWidthClass="max-w-md">
      <div className="space-y-4">
        <div className="rounded-2xl p-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 border border-white/15 text-white flex flex-col items-center text-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-400">Chatterbox ID Card</span>
          <div>
            <p className="text-lg font-bold">{user.primaryNickname}</p>
            <p className="text-xs text-slate-300">@{user.username}</p>
          </div>
          <div className="p-3 bg-white rounded-2xl shadow-lg">
            <svg width="147" height="147" viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges">
              <rect width={size} height={size} fill="#ffffff" />
              {cells.map((row, r) =>
                row.map((on, c) => (on ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0f172a" /> : null))
              )}
            </svg>
          </div>
          <p className="text-[11px] text-slate-300 break-all">{shareUrl}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-cbox-elevated border border-cbox-border text-xs font-bold text-cbox-text hover:border-cbox-accent"
          >
            {copied ? <Check className="h-4 w-4 text-cbox-success" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Link Copied!' : 'Copy Profile Link'}
          </button>
          <button
            type="button"
            onClick={handleDownloadCard}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-cbox-accent text-slate-950 text-xs font-bold"
          >
            <Download className="h-4 w-4" />
            Download Card
          </button>
        </div>
      </div>
    </Modal>
  );
};
