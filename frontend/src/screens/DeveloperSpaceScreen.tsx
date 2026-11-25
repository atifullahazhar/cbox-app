import React, { useEffect, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Ban,
  CheckCircle2,
  Database,
  Flag,
  Inbox,
  Lock,
  LogOut,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Terminal,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type { SafetyReportItem } from '../types';
import { CHATTERBOX_THEMES } from '../lib/themes';
import { apiFetch } from '../lib/api';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';

interface DevControlStatus {
  accessStatus: string;
  account: { id: string; username: string; role: 'USER' | 'DEVELOPER' };
  telemetry: {
    totalUsers: number;
    activeSessions: number;
    totalPosts: number;
    totalEvents: number;
    totalGroups: number;
    openReports: number;
    safetyBlocksCount: number;
    mediaCount: number;
    mediaMb: number;
  };
  themeStats: Array<{ themeKey: string; count: number }>;
  announcement: string;
  customBlockedWords: string[];
  reservedUsernames: string[];
  featureFlags: {
    eventsEnabled: boolean;
    storiesEnabled: boolean;
    callsEnabled: boolean;
    signupsEnabled: boolean;
    mediaUploadsEnabled: boolean;
    maintenanceMode: boolean;
    publicFeedFreeze: boolean;
  };
  config: {
    defaultThemeKey: string;
    maxUploadMb: number;
    nsfwSensitivity: 'strict' | 'balanced' | 'relaxed';
    welcomeMessage: string;
  };
  feedbackInbox: Array<{
    id: string;
    username: string;
    category: string;
    message: string;
    createdAt: string;
  }>;
  publicPosts: Array<{
    id: string;
    caption: string;
    authorUsername: string;
    authorNickname: string;
    createdAt: string;
  }>;
  users: Array<{
    id: string;
    username: string;
    primaryNickname: string;
    role: 'USER' | 'DEVELOPER';
    isPrivateProfile: boolean;
    isSuspended: boolean;
    isVerified: boolean;
    customFlair: string;
    hasDeviceLock: boolean;
    createdAt: string;
  }>;
  recentAuditEvents: Array<{
    id: string;
    action: string;
    outcome: string;
    createdAt: string;
  }>;
}

type DevTab = 'overview' | 'safety' | 'platform' | 'users' | 'inbox';

export const DeveloperSpaceScreen: React.FC = () => {
  const [tab, setTab] = useState<DevTab>('overview');
  const [data, setData] = useState<DevControlStatus | null>(null);
  const [reports, setReports] = useState<SafetyReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [announcementInput, setAnnouncementInput] = useState('');
  const [newBlockedWord, setNewBlockedWord] = useState('');
  const [newReservedHandle, setNewReservedHandle] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [dbPingMs, setDbPingMs] = useState<number | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [statusRes, repRes] = await Promise.all([
        apiFetch<DevControlStatus>('/api/developer/status'),
        apiFetch<{ reports: SafetyReportItem[] }>('/api/reports/queue').catch(() => ({ reports: [] })),
      ]);
      setData(statusRes);
      setAnnouncementInput(statusRes.announcement || '');
      setReports(repRes.reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Access denied.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function flash(msg: string) {
    setStatusMsg(msg);
    window.setTimeout(() => setStatusMsg(null), 3500);
  }

  async function runDbProbe() {
    const res = await apiFetch<{ latencyMs: number }>('/api/developer/health-probe', { method: 'POST' });
    setDbPingMs(res.latencyMs);
    flash(`PostgreSQL healthy (${res.latencyMs}ms ping)`);
  }

  async function runOrphanCleanup() {
    const res = await apiFetch<{ removedCount: number }>('/api/developer/cleanup-media', { method: 'POST' });
    flash(`Removed ${res.removedCount} orphan media records.`);
    loadAll();
  }

  async function saveAnnouncement(text: string) {
    const res = await apiFetch<{ announcement: string }>('/api/developer/announcement', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    setAnnouncementInput(res.announcement);
    setData((prev) => (prev ? { ...prev, announcement: res.announcement } : prev));
    flash(res.announcement ? 'Global announcement published!' : 'Announcement cleared.');
  }

  async function addWord(e: React.FormEvent) {
    e.preventDefault();
    if (!newBlockedWord.trim()) return;
    const res = await apiFetch<{ customBlockedWords: string[] }>('/api/developer/word-filter', {
      method: 'POST',
      body: JSON.stringify({ word: newBlockedWord.trim() }),
    });
    setNewBlockedWord('');
    setData((prev) => (prev ? { ...prev, customBlockedWords: res.customBlockedWords } : prev));
    flash('Added to live Safety Filter.');
  }

  async function removeWord(word: string) {
    const res = await apiFetch<{ customBlockedWords: string[] }>(
      `/api/developer/word-filter/${encodeURIComponent(word)}`,
      { method: 'DELETE' }
    );
    setData((prev) => (prev ? { ...prev, customBlockedWords: res.customBlockedWords } : prev));
  }

  async function addReserved(e: React.FormEvent) {
    e.preventDefault();
    if (!newReservedHandle.trim()) return;
    const res = await apiFetch<{ reservedUsernames: string[] }>('/api/developer/reserved-usernames', {
      method: 'POST',
      body: JSON.stringify({ handle: newReservedHandle.trim() }),
    });
    setNewReservedHandle('');
    setData((prev) => (prev ? { ...prev, reservedUsernames: res.reservedUsernames } : prev));
    flash('Handle added to Reserved Registry.');
  }

  async function removeReserved(handle: string) {
    const res = await apiFetch<{ reservedUsernames: string[] }>(
      `/api/developer/reserved-usernames/${encodeURIComponent(handle)}`,
      { method: 'DELETE' }
    );
    setData((prev) => (prev ? { ...prev, reservedUsernames: res.reservedUsernames } : prev));
  }

  async function toggleFlag(key: keyof DevControlStatus['featureFlags']) {
    if (!data) return;
    const res = await apiFetch<{ featureFlags: DevControlStatus['featureFlags'] }>('/api/developer/feature-flags', {
      method: 'PATCH',
      body: JSON.stringify({ [key]: !data.featureFlags[key] }),
    });
    setData((prev) => (prev ? { ...prev, featureFlags: res.featureFlags } : prev));
    flash(`Updated ${key}.`);
  }

  async function updateConfig(patch: Partial<DevControlStatus['config']>) {
    const res = await apiFetch<{ config: DevControlStatus['config'] }>('/api/developer/config', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    setData((prev) => (prev ? { ...prev, config: res.config } : prev));
    flash('Platform config saved.');
  }

  async function takedownPublicPost(id: string) {
    await apiFetch(`/api/developer/public-posts/${id}`, { method: 'DELETE' });
    setData((prev) => (prev ? { ...prev, publicPosts: prev.publicPosts.filter((p) => p.id !== id) } : prev));
    flash('Public post removed.');
  }

  async function resetDeviceLock(userId: string) {
    await apiFetch(`/api/developer/users/${userId}/reset-device-lock`, { method: 'POST' });
    setData((prev) =>
      prev ? { ...prev, users: prev.users.map((u) => (u.id === userId ? { ...u, hasDeviceLock: false } : u)) } : prev
    );
    flash('Device lock cleared for user.');
  }

  async function forceLogoutUser(userId: string) {
    await apiFetch(`/api/developer/users/${userId}/force-logout`, { method: 'POST' });
    flash('All active sessions revoked.');
  }

  async function toggleSuspend(userId: string) {
    const res = await apiFetch<{ isSuspended: boolean }>(`/api/developer/users/${userId}/toggle-suspend`, {
      method: 'POST',
    });
    setData((prev) =>
      prev ? { ...prev, users: prev.users.map((u) => (u.id === userId ? { ...u, isSuspended: res.isSuspended } : u)) } : prev
    );
    flash(res.isSuspended ? 'User suspended & logged out.' : 'User unbanned.');
  }

  async function toggleVerified(userId: string) {
    const res = await apiFetch<{ isVerified: boolean }>(`/api/developer/users/${userId}/toggle-verified`, {
      method: 'POST',
    });
    setData((prev) =>
      prev ? { ...prev, users: prev.users.map((u) => (u.id === userId ? { ...u, isVerified: res.isVerified } : u)) } : prev
    );
    flash(res.isVerified ? 'Verified badge granted!' : 'Verified badge removed.');
  }

  async function toggleUserDevRole(userId: string) {
    const res = await apiFetch<{ role: 'USER' | 'DEVELOPER' }>(`/api/developer/users/${userId}/toggle-role`, {
      method: 'POST',
    });
    setData((prev) =>
      prev ? { ...prev, users: prev.users.map((u) => (u.id === userId ? { ...u, role: res.role } : u)) } : prev
    );
    flash(`Role updated to ${res.role}.`);
  }

  async function updateReportStatus(id: string, status: 'REVIEWED' | 'DISMISSED') {
    await apiFetch(`/api/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  async function dismissFeedback(id: string) {
    const res = await apiFetch<{ feedbackInbox: DevControlStatus['feedbackInbox'] }>(`/api/developer/feedback/${id}`, {
      method: 'DELETE',
    });
    setData((prev) => (prev ? { ...prev, feedbackInbox: res.feedbackInbox } : prev));
  }

  if (loading) return <LoadingSkeleton variant="card" rows={3} />;
  if (error || !data) {
    return (
      <EmptyState
        icon={<Lock className="h-6 w-6" />}
        title="Developer Control Restricted"
        description={error || 'Server verification is required to view Developer Control.'}
      />
    );
  }

  const filteredUsers = data.users.filter(
    (u) =>
      !userSearch.trim() ||
      u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.primaryNickname.toLowerCase().includes(userSearch.toLowerCase())
  );

  const navTabs: Array<{ id: DevTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview & Ops', icon: <Activity className="h-3.5 w-3.5" /> },
    { id: 'safety', label: 'Safety & Moderation', icon: <ShieldAlert className="h-3.5 w-3.5" /> },
    { id: 'platform', label: 'Platform Controls', icon: <Sliders className="h-3.5 w-3.5" /> },
    { id: 'users', label: `Users (${data.users.length})`, icon: <Users className="h-3.5 w-3.5" /> },
    { id: 'inbox', label: `Inbox & Audit (${data.feedbackInbox.length})`, icon: <Inbox className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Command Center Header */}
      <div className="rounded-2xl border border-cbox-violet/40 bg-cbox-surface p-5 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cbox-violet/15 text-cbox-violet flex items-center justify-center">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-cbox-text">Chatterbox CB1.1 · Developer Control</h1>
              <p className="text-xs text-cbox-muted">
                Admin command center for @{data.account.username} · Private 1:1 DMs remain strictly isolated
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cbox-success/15 text-cbox-success border border-cbox-success/30">
            <ShieldCheck className="h-3.5 w-3.5" /> {data.accessStatus}
          </span>
        </div>

        {statusMsg && (
          <div className="p-2.5 rounded-xl bg-cbox-accent/15 border border-cbox-accent/40 text-xs font-semibold text-cbox-text">
            {statusMsg}
          </div>
        )}

        {/* Structured Section Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
          {navTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                tab === t.id
                  ? 'bg-cbox-violet text-white shadow'
                  : 'bg-cbox-elevated/60 text-cbox-muted hover:text-cbox-text'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===================== TAB 1: OVERVIEW & OPS ===================== */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {[
              { label: 'Total Users', val: data.telemetry.totalUsers },
              { label: 'Active Sessions', val: data.telemetry.activeSessions },
              { label: 'Posts', val: data.telemetry.totalPosts },
              { label: 'Official Events', val: data.telemetry.totalEvents },
              { label: 'Groups', val: data.telemetry.totalGroups },
              { label: 'Open Reports', val: data.telemetry.openReports },
              { label: 'Safety Filter Blocks', val: data.telemetry.safetyBlocksCount },
              { label: 'Persistent DB Media', val: `${data.telemetry.mediaMb} MB (${data.telemetry.mediaCount})` },
            ].map((k) => (
              <div key={k.label} className="p-3.5 rounded-2xl bg-cbox-surface border border-cbox-border">
                <span className="text-[11px] text-cbox-muted block">{k.label}</span>
                <strong className="text-lg font-bold text-cbox-text">{k.val}</strong>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
              <h2 className="text-sm font-semibold text-cbox-text flex items-center gap-2">
                <Database className="h-4 w-4 text-cbox-accent" /> System Diagnostics &amp; Maintenance
              </h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={runDbProbe} className="px-3.5 py-2 rounded-xl bg-cbox-accent text-slate-950 font-bold text-xs">
                  Ping PostgreSQL {dbPingMs !== null ? `(${dbPingMs}ms)` : ''}
                </button>
                <button type="button" onClick={runOrphanCleanup} className="px-3.5 py-2 rounded-xl border border-cbox-border text-xs font-semibold text-cbox-text">
                  Clean Orphan Media
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-2.5">
              <h2 className="text-sm font-semibold text-cbox-text">Theme Adoption Analytics</h2>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {data.themeStats.map((t) => (
                  <span key={t.themeKey} className="px-2.5 py-1 rounded-full bg-cbox-elevated border border-cbox-border">
                    {t.themeKey}: <strong>{t.count}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: SAFETY & MODERATION ===================== */}
      {tab === 'safety' && (
        <div className="space-y-5">
          <div className="grid lg:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
              <h2 className="text-sm font-semibold text-cbox-text flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-cbox-danger" /> Dynamic Word &amp; Domain Blocker
              </h2>
              <form onSubmit={addWord} className="flex gap-2">
                <input
                  type="text"
                  value={newBlockedWord}
                  onChange={(e) => setNewBlockedWord(e.target.value)}
                  placeholder="Add abusive word or domain…"
                  className="flex-1 rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text"
                />
                <button type="submit" className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-cbox-danger text-white text-xs font-bold">
                  <Plus className="h-3.5 w-3.5" /> Block
                </button>
              </form>
              <div className="flex flex-wrap gap-1.5">
                {data.customBlockedWords.map((w) => (
                  <span key={w} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-cbox-danger/15 text-cbox-danger">
                    {w}
                    <button type="button" onClick={() => removeWord(w)}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
              <h2 className="text-sm font-semibold text-cbox-text">NSFW Filter Sensitivity</h2>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['strict', 'balanced', 'relaxed'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => updateConfig({ nsfwSensitivity: level })}
                    className={`py-2.5 rounded-xl border font-bold capitalize ${
                      data.config.nsfwSensitivity === level
                        ? 'border-cbox-accent bg-cbox-accent/15 text-cbox-accent'
                        : 'border-cbox-border bg-cbox-elevated/40 text-cbox-muted'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => toggleFlag('mediaUploadsEnabled')}
                className={`w-full py-2.5 rounded-xl border text-xs font-bold ${
                  data.featureFlags.mediaUploadsEnabled
                    ? 'border-cbox-success/40 bg-cbox-success/10 text-cbox-success'
                    : 'border-cbox-danger/40 bg-cbox-danger/15 text-cbox-danger'
                }`}
              >
                Global Photo Uploads: {data.featureFlags.mediaUploadsEnabled ? 'ENABLED (Click to Pause)' : 'PAUSED (Kill-Switch Active)'}
              </button>
            </section>
          </div>

          <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold text-cbox-text flex items-center gap-2">
              <Flag className="h-4 w-4 text-cbox-danger" /> Safety Reports Queue ({reports.filter((r) => r.status === 'OPEN').length} open)
            </h2>
            {reports.length === 0 ? (
              <p className="text-xs text-cbox-muted">No safety reports submitted.</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="p-3 rounded-xl border border-cbox-border bg-cbox-elevated/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-bold text-cbox-text">{r.reason} <span className="text-[10px] font-normal text-cbox-muted">({r.status})</span></p>
                    <p className="text-cbox-muted">By @{r.reporter.username}{r.targetUser ? ` · Target @${r.targetUser.username}` : ''}</p>
                    {r.details && <p className="text-cbox-text/90 mt-0.5">{r.details}</p>}
                  </div>
                  {r.status === 'OPEN' && (
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => updateReportStatus(r.id, 'REVIEWED')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cbox-success/15 text-cbox-success font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Reviewed
                      </button>
                      <button type="button" onClick={() => updateReportStatus(r.id, 'DISMISSED')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-cbox-border text-cbox-muted">
                        <XCircle className="h-3.5 w-3.5" /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </section>

          <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold text-cbox-text">Public Feed Live Takedown</h2>
            {data.publicPosts.length === 0 ? (
              <p className="text-xs text-cbox-muted">No public posts right now.</p>
            ) : (
              <div className="divide-y divide-cbox-border text-xs">
                {data.publicPosts.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-cbox-text truncate">@{p.authorUsername}: {p.caption || '(Photo post)'}</p>
                      <p className="text-[11px] text-cbox-muted">{new Date(p.createdAt).toLocaleString()}</p>
                    </div>
                    <button type="button" onClick={() => takedownPublicPost(p.id)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cbox-danger/15 text-cbox-danger font-semibold shrink-0">
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ===================== TAB 3: PLATFORM CONTROLS ===================== */}
      {tab === 'platform' && (
        <div className="space-y-5">
          <div className="grid lg:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
              <h2 className="text-sm font-semibold text-cbox-text flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-cbox-accent" /> Global System Announcement
              </h2>
              <textarea
                rows={2}
                maxLength={240}
                value={announcementInput}
                onChange={(e) => setAnnouncementInput(e.target.value)}
                placeholder="Broadcast a live notice across every user's screen…"
                className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => saveAnnouncement(announcementInput)} className="px-4 py-2 rounded-xl bg-cbox-accent text-slate-950 font-bold text-xs">
                  Publish Banner
                </button>
                {data.announcement && (
                  <button type="button" onClick={() => saveAnnouncement('')} className="px-3 py-2 rounded-xl border border-cbox-border text-xs text-cbox-muted">
                    Clear
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
              <h2 className="text-sm font-semibold text-cbox-text">Live Feature Flags &amp; Emergency Switches</h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(
                  [
                    ['eventsEnabled', 'Public Events'],
                    ['storiesEnabled', '24h Stories'],
                    ['callsEnabled', 'Voice/Video Calls'],
                    ['signupsEnabled', 'New Sign-Ups'],
                    ['publicFeedFreeze', 'Feed Read-Only'],
                    ['maintenanceMode', 'Maintenance Mode'],
                  ] as Array<[keyof DevControlStatus['featureFlags'], string]>
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleFlag(k)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between ${
                      data.featureFlags[k]
                        ? 'border-cbox-accent/40 bg-cbox-accent/10 text-cbox-text'
                        : 'border-cbox-border bg-cbox-elevated/40 text-cbox-muted'
                    }`}
                  >
                    <span className="font-semibold">{label}</span>
                    <span className="text-[10px] font-bold">{data.featureFlags[k] ? 'ON' : 'OFF'}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
              <h2 className="text-sm font-semibold text-cbox-text">Default Theme &amp; Upload Limit</h2>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-cbox-muted">Default New-User Theme</label>
                  <select
                    value={data.config.defaultThemeKey}
                    onChange={(e) => updateConfig({ defaultThemeKey: e.target.value })}
                    className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-cbox-text"
                  >
                    {CHATTERBOX_THEMES.map((t) => (
                      <option key={t.key} value={t.key}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-cbox-muted">Max Upload Size ({data.config.maxUploadMb} MB)</label>
                  <input
                    type="range"
                    min={1}
                    max={16}
                    value={data.config.maxUploadMb}
                    onChange={(e) => updateConfig({ maxUploadMb: Number(e.target.value) })}
                    className="w-full accent-cbox-accent mt-2"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
              <h2 className="text-sm font-semibold text-cbox-text">Reserved Usernames Registry</h2>
              <form onSubmit={addReserved} className="flex gap-2">
                <input
                  type="text"
                  value={newReservedHandle}
                  onChange={(e) => setNewReservedHandle(e.target.value)}
                  placeholder="Lock VIP handle…"
                  className="flex-1 rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text"
                />
                <button type="submit" className="px-3.5 py-2 rounded-xl bg-cbox-violet text-white text-xs font-bold">
                  Reserve
                </button>
              </form>
              <div className="flex flex-wrap gap-1.5">
                {data.reservedUsernames.map((h) => (
                  <span key={h} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-cbox-elevated border border-cbox-border">
                    @{h}
                    <button type="button" onClick={() => removeReserved(h)}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ===================== TAB 4: USERS & SECURITY ===================== */}
      {tab === 'users' && (
        <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-cbox-text">User Directory &amp; Governance</h2>
            <div className="relative w-full sm:w-64">
              <Search className="h-3.5 w-3.5 text-cbox-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search username or nickname…"
                className="w-full rounded-xl bg-cbox-elevated border border-cbox-border pl-8 pr-3 py-1.5 text-xs text-cbox-text"
              />
            </div>
          </div>

          <div className="divide-y divide-cbox-border text-xs">
            {filteredUsers.map((u) => (
              <div key={u.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-cbox-text">{u.primaryNickname}</span>
                  {u.isVerified && <BadgeCheck className="h-4 w-4 text-cbox-accent" />}
                  <span className="text-cbox-muted">@{u.username}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.role === 'DEVELOPER' ? 'bg-cbox-violet/20 text-cbox-violet' : 'bg-cbox-elevated text-cbox-muted'}`}>
                    {u.role}
                  </span>
                  {u.isSuspended && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cbox-danger/20 text-cbox-danger">
                      SUSPENDED
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => toggleVerified(u.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-cbox-accent/40 text-cbox-accent">
                    <BadgeCheck className="h-3 w-3" /> {u.isVerified ? 'Unverify' : 'Verify'}
                  </button>
                  {u.id !== data.account.id && (
                    <>
                      {u.hasDeviceLock && (
                        <button type="button" onClick={() => resetDeviceLock(u.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-cbox-border text-cbox-text">
                          <RefreshCw className="h-3 w-3" /> Reset Device
                        </button>
                      )}
                      <button type="button" onClick={() => toggleSuspend(u.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-cbox-danger/40 text-cbox-danger">
                        <Ban className="h-3 w-3" /> {u.isSuspended ? 'Unban' : 'Suspend'}
                      </button>
                      <button type="button" onClick={() => forceLogoutUser(u.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-cbox-border text-cbox-muted">
                        <LogOut className="h-3 w-3" /> Logout
                      </button>
                      <button type="button" onClick={() => toggleUserDevRole(u.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-cbox-violet/40 text-cbox-violet">
                        {u.role === 'DEVELOPER' ? 'Revoke Dev' : 'Grant Dev'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===================== TAB 5: INBOX & AUDIT ===================== */}
      {tab === 'inbox' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold text-cbox-text flex items-center gap-2">
              <Inbox className="h-4 w-4 text-cbox-accent" /> User Feedback &amp; Bug Inbox ({data.feedbackInbox.length})
            </h2>
            {data.feedbackInbox.length === 0 ? (
              <p className="text-xs text-cbox-muted">No user feedback submissions yet.</p>
            ) : (
              data.feedbackInbox.map((f) => (
                <div key={f.id} className="p-3 rounded-xl border border-cbox-border bg-cbox-elevated/40 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-cbox-text">@{f.username} · <span className="text-cbox-accent">{f.category}</span></p>
                    <p className="text-cbox-text/90 mt-1">{f.message}</p>
                    <p className="text-[10px] text-cbox-muted mt-1">{new Date(f.createdAt).toLocaleString()}</p>
                  </div>
                  <button type="button" onClick={() => dismissFeedback(f.id)} className="text-cbox-muted hover:text-cbox-danger">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </section>

          <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
            <h2 className="text-sm font-semibold text-cbox-text flex items-center gap-2">
              <Activity className="h-4 w-4 text-cbox-accent" /> Immutable Developer Audit Trail
            </h2>
            <div className="divide-y divide-cbox-border text-xs">
              {data.recentAuditEvents.map((ev) => (
                <div key={ev.id} className="py-2 flex items-center justify-between gap-3">
                  <span className="font-mono text-cbox-text">{ev.action}</span>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${ev.outcome === 'SUCCESS' ? 'bg-cbox-success/15 text-cbox-success' : 'bg-cbox-danger/15 text-cbox-danger'}`}>
                      {ev.outcome}
                    </span>
                    <span className="text-cbox-muted">{new Date(ev.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
