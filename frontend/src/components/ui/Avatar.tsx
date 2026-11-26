import React from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-24 w-24 text-2xl',
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  online,
  className = '',
}) => {
  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {src ? (
        <img
          loading="lazy"
          decoding="async"
          src={src}
          alt={`${name}'s avatar`}
          className={`${SIZE_CLASSES[size]} rounded-full object-cover border border-cbox-border bg-cbox-elevated`}
        />
      ) : (
        <div
          aria-label={`${name} avatar`}
          className={`${SIZE_CLASSES[size]} rounded-full flex items-center justify-center font-semibold bg-gradient-to-br from-cbox-accent/25 to-cbox-violet/25 text-cbox-text border border-cbox-border`}
        >
          {initialsFrom(name)}
        </div>
      )}
      {typeof online === 'boolean' && (
        <span
          title={online ? 'Online' : 'Offline'}
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-cbox-surface ${
            online ? 'bg-cbox-success' : 'bg-cbox-muted/50'
          }`}
        />
      )}
    </div>
  );
};
