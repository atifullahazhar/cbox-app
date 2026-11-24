import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-2xl border border-dashed border-cbox-border bg-cbox-surface/60">
    <div className="h-12 w-12 rounded-2xl bg-cbox-elevated flex items-center justify-center text-cbox-accent mb-4">
      {icon}
    </div>
    <h3 className="text-base font-semibold text-cbox-text">{title}</h3>
    <p className="mt-1.5 text-sm text-cbox-muted max-w-sm leading-relaxed">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);
