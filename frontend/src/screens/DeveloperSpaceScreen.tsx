import React, { useEffect, useState } from 'react';
import { ShieldCheck, Lock, Activity, Terminal } from 'lucide-react';
import type { DeveloperStatusResponse } from '../types';
import { apiFetch } from '../lib/api';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';

export const DeveloperSpaceScreen: React.FC = () => {
  const [data, setData] = useState<DeveloperStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<DeveloperStatusResponse>('/api/developer/status')
      .then((res) => setData(res))
      .catch((err) => setError(err instanceof Error ? err.message : 'Access denied.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingSkeleton variant="card" rows={2} />;
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={<Lock className="h-6 w-6" />}
        title="Developer Space Restricted"
        description={error || 'Server verification is required to view Developer Space.'}
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
              <h1 className="text-xl font-bold text-cbox-text">Developer Space</h1>
              <p className="text-xs text-cbox-muted">
                Server-verified workspace for @{data.account.username}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cbox-success/15 text-cbox-success border border-cbox-success/30">
            <ShieldCheck className="h-3.5 w-3.5" />
            {data.accessStatus}
          </span>
        </div>

        <p className="text-xs text-cbox-muted leading-relaxed">
          Privacy boundary enforced: Developer Space is strictly audited and never grants access to
          private one-to-one messages or friends-only posts belonging to other users.
        </p>

        <div className="grid sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-cbox-elevated border border-cbox-border">
            <span className="text-cbox-muted block">Developer Code Policy</span>
            <strong className="text-cbox-text mt-0.5 block">{data.policies.developerCodeMode}</strong>
          </div>
          <div className="p-3 rounded-xl bg-cbox-elevated border border-cbox-border">
            <span className="text-cbox-muted block">Allow Blocking Developers</span>
            <strong className="text-cbox-text mt-0.5 block">
              {data.policies.allowBlockingDevelopers ? 'Enabled (Prod Recommended)' : 'Disabled (Prototype Flag)'}
            </strong>
          </div>
          <div className="p-3 rounded-xl bg-cbox-elevated border border-cbox-border">
            <span className="text-cbox-muted block">Media Storage Driver</span>
            <strong className="text-cbox-text mt-0.5 block uppercase">
              {data.policies.storageDriver}
            </strong>
          </div>
        </div>
      </div>

      {/* Modular Placeholder Cards for Future Settings */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-cbox-muted">
          Upcoming Developer Modules
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {data.upcomingModules.map((mod) => (
            <div
              key={mod.id}
              className="p-5 rounded-2xl border border-cbox-border bg-cbox-surface/80 flex flex-col justify-between gap-4 opacity-85"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-cbox-text">{mod.title}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cbox-violet/15 text-cbox-violet">
                    Coming soon
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-cbox-muted leading-relaxed">{mod.description}</p>
              </div>
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="self-start px-3 py-1.5 rounded-lg text-xs font-medium border border-cbox-border text-cbox-muted cursor-not-allowed opacity-60"
              >
                Locked until specified
              </button>
            </div>
          ))}
        </div>
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
