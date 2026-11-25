import React, { useEffect, useState } from 'react';
import { ShieldCheck, Lock, Activity, Terminal, Flag, CheckCircle2, XCircle } from 'lucide-react';
import type { DeveloperStatusResponse, SafetyReportItem } from '../types';
import { apiFetch } from '../lib/api';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';

export const DeveloperSpaceScreen: React.FC = () => {
  const [data, setData] = useState<DeveloperStatusResponse | null>(null);
  const [reports, setReports] = useState<SafetyReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<DeveloperStatusResponse>('/api/developer/status'),
      apiFetch<{ reports: SafetyReportItem[] }>('/api/reports/queue').catch(() => ({ reports: [] })),
    ])
      .then(([statusRes, repRes]) => {
        setData(statusRes);
        setReports(repRes.reports);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Access denied.'))
      .finally(() => setLoading(false));
  }, []);

  async function updateReportStatus(id: string, status: 'REVIEWED' | 'DISMISSED') {
    try {
      await apiFetch(`/api/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch {
      // Ignore
    }
  }

  if (loading) return <LoadingSkeleton variant="card" rows={2} />;
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
      <div className="rounded-2xl border border-cbox-violet/35 bg-cbox-surface p-6 shadow-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cbox-violet/15 text-cbox-violet flex items-center justify-center">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-cbox-text">Chatterbox Developer Control</h1>
              <p className="text-xs text-cbox-muted">
                Server-verified control panel for @{data.account.username}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cbox-success/15 text-cbox-success border border-cbox-success/30">
            <ShieldCheck className="h-3.5 w-3.5" />
            {data.accessStatus}
          </span>
        </div>

        <p className="text-xs text-cbox-muted leading-relaxed">
          Privacy boundary enforced: Developer Control is strictly audited and never grants access to
          private one-to-one messages or friends-only posts.
        </p>

        <div className="grid sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-cbox-elevated border border-cbox-border">
            <span className="text-cbox-muted block">Developer Code Policy</span>
            <strong className="text-cbox-text mt-0.5 block">{data.policies.developerCodeMode}</strong>
          </div>
          <div className="p-3 rounded-xl bg-cbox-elevated border border-cbox-border">
            <span className="text-cbox-muted block">Allow Blocking Developers</span>
            <strong className="text-cbox-text mt-0.5 block">
              {data.policies.allowBlockingDevelopers ? 'Enabled (Prod)' : 'Disabled (Prototype)'}
            </strong>
          </div>
          <div className="p-3 rounded-xl bg-cbox-elevated border border-cbox-border">
            <span className="text-cbox-muted block">Auth Security Engine</span>
            <strong className="text-cbox-text mt-0.5 block">Python Argon2id + OTP</strong>
          </div>
        </div>
      </div>

      {/* Live Audited Safety Reports Queue */}
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
              <div
                key={r.id}
                className="p-3.5 rounded-xl border border-cbox-border bg-cbox-elevated/40 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-cbox-text">{r.reason}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cbox-surface border border-cbox-border">
                      {r.status}
                    </span>
                  </div>
                  <p className="text-cbox-muted">
                    Reported by @{r.reporter.username}
                    {r.targetUser ? ` · Target: @${r.targetUser.username}` : ''}
                    {r.targetPostId ? ` · Post ID: ${r.targetPostId.slice(0, 8)}…` : ''}
                  </p>
                  {r.details && <p className="text-cbox-text/90">{r.details}</p>}
                </div>

                {r.status === 'OPEN' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateReportStatus(r.id, 'REVIEWED')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cbox-success/15 text-cbox-success font-semibold"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark Reviewed
                    </button>
                    <button
                      type="button"
                      onClick={() => updateReportStatus(r.id, 'DISMISSED')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-cbox-border text-cbox-muted"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Non-sensitive Audit Log */}
      <section className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-cbox-text flex items-center gap-2">
          <Activity className="h-4 w-4 text-cbox-accent" />
          Recent Developer Audit Trail
        </h2>
        {data.recentAuditEvents.length === 0 ? (
          <p className="text-xs text-cbox-muted">No developer audit events recorded yet.</p>
        ) : (
          <div className="divide-y divide-cbox-border text-xs">
            {data.recentAuditEvents.map((ev) => (
              <div key={ev.id} className="py-2.5 flex items-center justify-between gap-3">
                <span className="font-mono text-cbox-text">{ev.action}</span>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded-full font-semibold ${
                      ev.outcome === 'SUCCESS'
                        ? 'bg-cbox-success/15 text-cbox-success'
                        : 'bg-cbox-danger/15 text-cbox-danger'
                    }`}
                  >
                    {ev.outcome}
                  </span>
                  <span className="text-cbox-muted">
                    {new Date(ev.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
