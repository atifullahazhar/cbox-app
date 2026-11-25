import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Flag,
  Lock,
  LogOut,
  Megaphone,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Terminal,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type { SafetyReportItem } from '../types';
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
  };
  announcement: string;
  customBlockedWords: string[];
  featureFlags: {
    eventsEnabled: boolean;
    storiesEnabled: boolean;
    callsEnabled: boolean;
    signupsEnabled: boolean;
  };
  users: Array<{
    id: string;
    username: string;
    primaryNickname: string;
    role: 'USER' | 'DEVELOPER';
    isPrivateProfile: boolean;
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

export const DeveloperSpaceScreen: React.FC = () => {
  const [data, setData] = useState<DevControlStatus | null>(null);
  const [reports, setReports] = useState<SafetyReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcementInput, setAnnouncementInput] = useState('');
  const [newBlockedWord, setNewBlockedWord] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

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

  async function toggleFlag(key: keyof DevControlStatus['featureFlags']) {
    if (!data) return;
    const nextVal = !data.featureFlags[key];
    const res = await apiFetch<{ featureFlags: DevControlStatus['featureFlags'] }>('/api/developer/feature-flags', {
      method: 'PATCH',
      body: JSON.stringify({ [key]: nextVal }),
    });
    setData((prev) => (prev ? { ...prev, featureFlags: res.featureFlags } : prev));
    flash(`Updated ${key}.`);
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
    flash('All active sessions revoked for user.');
  }

  async function toggleUserDevRole(userId: string) {
    const res = await apiFetch<{ role: 'USER' | 'DEVELOPER' }>(`/api/developer/users/${userId}/toggle-role`, {
      method: 'POST',
    });
    setData((prev) =>
      prev ? { ...prev, users: prev.users.map((u) => (u.id === userId ? { ...u, role: res.role } : u)) } : prev
    );
    flash(`User role updated to ${res.role}.`);
  }

  async function updateReportStatus(id: string, status: 'REVIEWED' | 'DISMISSED') {
    await apiFetch(`/api/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
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

  return (
    <div className="space-y-6">
      {/* Header & Telemetry KPIs */}
      <div className="rounded-2xl border border-cbox-violet/35 bg-cbox-surface p-6 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cbox-violet/15 text-cbox-violet flex items-center justify-center">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-cbox-text">Chatterbox Developer Control</h1>
              <p className="text-xs text-cbox-muted">
                Exclusive command center for @{data.account.username} · Private 1:1 DMs remain strictly isolated
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cbox-success/15 text-cbox-success border border-cbox-success/30">
            <ShieldCheck className="h-3.5 w-3.5" />
            {data.accessStatus}
          </span>
        </div>

        {statusMsg && (
          <div className="p-2.5 rounded-xl bg-cbox-accent/15 border border-cbox-accent/40 text-xs font-semibold text-cbox-text">
            {statusMsg}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
          {[
            { label: 'Users', val: data.telemetry.totalUsers },
            { label: 'Sessions', val: data.telemetry.activeSessions },
            { label: 'Posts', val: data.telemetry.totalPosts },
            { label: 'Events', val: data.telemetry.totalEvents },
            { label: 'Groups', val: data.telemetry.totalGroups },
            { label: 'Open Reports', val: data.telemetry.openReports },
            { label: 'Safety Blocks', val: data.telemetry.safetyBlocksCount },
          ].map((k) => (
            <div key={k.label} className="p-3 rounded-xl bg-cbox-elevated border border-cbox-border">
              <span className="text-[11px] text-cbox-muted block">{k.label}</span>
              <strong className="text-lg font-bold text-cbox-text">{k.val}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Global Announcement Banner + Live Feature Flags */}
      <div className="grid lg:grid-cols-2 gap-5">
        <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold text-cbox-text flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-cbox-accent" /> Global System Announcement Banner
          </h2>
          <textarea
            rows={2}
            maxLength={240}
            value={announcementInput}
            onChange={(e) => setAnnouncementInput(e.target.value)}
            placeholder="Broadcast a live announcement to every Chatterbox user…"
            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => saveAnnouncement(announcementInput)}
              className="px-4 py-2 rounded-xl bg-cbox-accent text-slate-950 font-bold text-xs"
            >
              Publish Banner
            </button>
            {data.announcement && (
              <button
                type="button"
                onClick={() => saveAnnouncement('')}
                className="px-3 py-2 rounded-xl border border-cbox-border text-xs text-cbox-muted"
              >
                Clear
              </button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold text-cbox-text flex items-center gap-2">
            <Sliders className="h-4 w-4 text-cbox-violet" /> Live Feature Flags
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {(
              [
                ['eventsEnabled', 'Public Events'],
                ['storiesEnabled', '24h Stories'],
                ['callsEnabled', 'Voice/Video Calls'],
                ['signupsEnabled', 'New Sign-Ups'],
              ] as Array<[keyof DevControlStatus['featureFlags'], string]>
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => toggleFlag(k)}
                className={`p-3 rounded-xl border text-left flex items-center justify-between transition ${
                  data.featureFlags[k]
                    ? 'border-cbox-success/40 bg-cbox-success/10 text-cbox-text'
                    : 'border-cbox-danger/40 bg-cbox-danger/10 text-cbox-muted'
                }`}
              >
                <span className="font-semibold">{label}</span>
                <span className="text-[10px] font-bold uppercase">
                  {data.featureFlags[k] ? 'ON' : 'OFF'}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Live Dynamic Safety Word-Filter */}
      <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-cbox-text flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-cbox-danger" /> Dynamic Safety Word &amp; Domain Blocker
        </h2>
        <form onSubmit={addWord} className="flex gap-2 max-w-md">
          <input
            type="text"
            value={newBlockedWord}
            onChange={(e) => setNewBlockedWord(e.target.value)}
            placeholder="Add abusive word or bad domain to block live…"
            className="flex-1 rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text"
          />
          <button type="submit" className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-cbox-danger text-white text-xs font-bold">
            <Plus className="h-3.5 w-3.5" /> Block
          </button>
        </form>
        {data.customBlockedWords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.customBlockedWords.map((w) => (
              <span key={w} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-cbox-danger/15 text-cbox-danger border border-cbox-danger/30">
                {w}
                <button type="button" onClick={() => removeWord(w)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* User Directory & Account Controls */}
      <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-cbox-text flex items-center gap-2">
          <Users className="h-4 w-4 text-cbox-accent" /> User Directory &amp; Device-Lock Controls ({data.users.length})
        </h2>
        <div className="divide-y divide-cbox-border text-xs">
          {data.users.map((u) => (
            <div key={u.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-cbox-text">{u.primaryNickname}</span>{' '}
                <span className="text-cbox-muted">@{u.username}</span>{' '}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.role === 'DEVELOPER' ? 'bg-cbox-violet/20 text-cbox-violet' : 'bg-cbox-elevated text-cbox-muted'}`}>
                  {u.role}
                </span>
              </div>
              {u.id !== data.account.id && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {u.hasDeviceLock && (
                    <button
                      type="button"
                      onClick={() => resetDeviceLock(u.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-cbox-border text-cbox-text hover:border-cbox-accent"
                    >
                      <RefreshCw className="h-3 w-3" /> Reset Device Lock
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => forceLogoutUser(u.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-cbox-danger/40 text-cbox-danger"
                  >
                    <LogOut className="h-3 w-3" /> Force Logout
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleUserDevRole(u.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-cbox-violet/40 text-cbox-violet"
                  >
                    {u.role === 'DEVELOPER' ? 'Revoke Dev' : 'Grant Dev'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Safety Reports Moderation Queue */}
      <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-cbox-text flex items-center gap-2">
          <Flag className="h-4 w-4 text-cbox-danger" />
          Safety Reports Moderation Queue ({reports.filter((r) => r.status === 'OPEN').length} open)
        </h2>
        {reports.length === 0 ? (
          <p className="text-xs text-cbox-muted">No user or post safety reports submitted yet.</p>
        ) : (
          <div className="space-y-2.5">
            {reports.map((r) => (
              <div key={r.id} className="p-3.5 rounded-xl border border-cbox-border bg-cbox-elevated/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-cbox-text">{r.reason}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cbox-surface border border-cbox-border">{r.status}</span>
                  </div>
                  <p className="text-cbox-muted">
                    Reported by @{r.reporter.username}
                    {r.targetUser ? ` · Target: @${r.targetUser.username}` : ''}
                  </p>
                  {r.details && <p className="text-cbox-text/90">{r.details}</p>}
                </div>
                {r.status === 'OPEN' && (
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => updateReportStatus(r.id, 'REVIEWED')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cbox-success/15 text-cbox-success font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Reviewed
                    </button>
                    <button type="button" onClick={() => updateReportStatus(r.id, 'DISMISSED')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-cbox-border text-cbox-muted">
                      <XCircle className="h-3.5 w-3.5" /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Audit Trail */}
      <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-cbox-text flex items-center gap-2">
          <Activity className="h-4 w-4 text-cbox-accent" /> Recent Developer Audit Trail
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
  );
};
