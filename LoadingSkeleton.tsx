import React from 'react';

interface LoadingSkeletonProps {
  rows?: number;
  variant?: 'list' | 'card' | 'profile';
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  rows = 3,
  variant = 'list',
}) => {
  if (variant === 'profile') {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-44 rounded-2xl bg-cbox-elevated" />
        <div className="flex items-center gap-4 px-4 -mt-12">
          <div className="h-24 w-24 rounded-full bg-cbox-surface border-4 border-cbox-bg" />
          <div className="space-y-2 pt-8">
            <div className="h-5 w-40 rounded bg-cbox-elevated" />
            <div className="h-4 w-28 rounded bg-cbox-elevated" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-cbox-border bg-cbox-surface p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-cbox-elevated" />
              <div className="space-y-2">
                <div className="h-3.5 w-32 rounded bg-cbox-elevated" />
                <div className="h-3 w-20 rounded bg-cbox-elevated" />
              </div>
            </div>
            <div className="h-64 w-full rounded-xl bg-cbox-elevated" />
            <div className="h-3.5 w-3/4 rounded bg-cbox-elevated" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-xl border border-cbox-border bg-cbox-surface"
        >
          <div className="h-11 w-11 rounded-full bg-cbox-elevated" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-36 rounded bg-cbox-elevated" />
            <div className="h-3 w-24 rounded bg-cbox-elevated" />
          </div>
        </div>
      ))}
    </div>
  );
};
