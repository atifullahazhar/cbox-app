import React from 'react';

export interface TabOption<T extends string> {
  id: T;
  label: string;
  badge?: number;
}

interface TabsProps<T extends string> {
  options: TabOption<T>[];
  active: T;
  onChange: (id: T) => void;
}

export function Tabs<T extends string>({ options, active, onChange }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className="flex items-center gap-1 p-1 rounded-xl bg-cbox-elevated border border-cbox-border"
    >
      {options.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
              isActive
                ? 'bg-cbox-surface text-cbox-text shadow-sm border border-cbox-border'
                : 'text-cbox-muted hover:text-cbox-text'
            }`}
          >
            <span className="truncate">{tab.label}</span>
            {typeof tab.badge === 'number' && tab.badge > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-cbox-accent/15 text-cbox-accent">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
