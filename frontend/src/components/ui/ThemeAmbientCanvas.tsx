import React from 'react';
import { getThemeDefinition, type ThemeKey } from '../../lib/themes';

interface ThemeAmbientCanvasProps {
  themeKey: ThemeKey;
}

const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: `${(i * 7.3 + 3) % 96}%`,
  top: `${(i * 11.7 + 5) % 90}%`,
  delay: `${(i * 0.85) % 8}s`,
  duration: `${8 + (i % 6) * 2.2}s`,
  size: 10 + (i % 4) * 5,
}));

export const ThemeAmbientCanvas: React.FC<ThemeAmbientCanvasProps> = ({ themeKey }) => {
  const theme = getThemeDefinition(themeKey);
  if (theme.effect === 'none' || theme.effectTier === 'normal') return null;
  const activeParticles = theme.effectTier === 'lite' ? PARTICLES.slice(0, 6) : PARTICLES;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none"
    >
      {/* Cherry Blossom Falling Sakura Petals */}
      {theme.effect === 'petals' &&
        activeParticles.map((p) => (
          <span
            key={p.id}
            style={{
              left: p.left,
              width: p.size,
              height: p.size * 0.72,
              animation: `petalFall ${p.duration} linear ${p.delay} infinite`,
            }}
            className="absolute -top-8 rounded-tl-full rounded-br-full bg-gradient-to-br from-pink-300 via-rose-300 to-pink-400/80 shadow-sm opacity-0 will-change-transform"
          />
        ))}

      {/* Mystic Forest Drifting Leaves */}
      {theme.effect === 'leaves' &&
        activeParticles.map((p) => (
          <span
            key={p.id}
            style={{
              left: p.left,
              width: p.size,
              height: p.size * 0.65,
              animation: `petalFall ${p.duration} linear ${p.delay} infinite`,
            }}
            className="absolute -top-8 rounded-tl-full rounded-br-full bg-gradient-to-br from-emerald-400/50 to-lime-300/40 opacity-0 will-change-transform"
          />
        ))}

      {/* Deep Ocean Rising Glowing Bubbles */}
      {theme.effect === 'bubbles' &&
        activeParticles.map((p) => (
          <span
            key={p.id}
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              animation: `bubbleRise ${p.duration} ease-in ${p.delay} infinite`,
            }}
            className="absolute bottom-0 rounded-full border border-cyan-300/45 bg-cyan-400/15 opacity-0 will-change-transform"
          />
        ))}

      {/* Sunset Ember Floating Fireflies */}
      {theme.effect === 'fireflies' &&
        activeParticles.map((p) => (
          <span
            key={p.id}
            style={{
              left: p.left,
              top: p.top,
              width: 6 + (p.id % 3) * 3,
              height: 6 + (p.id % 3) * 3,
              animation: `fireflyFloat ${p.duration} ease-in-out ${p.delay} infinite`,
            }}
            className="absolute rounded-full bg-amber-300 shadow-[0_0_12px_rgba(251,146,60,0.8)] will-change-transform"
          />
        ))}

      {/* AMOLED Starlight Twinkling Stars */}
      {theme.effect === 'stars' &&
        activeParticles.map((p) => (
          <span
            key={p.id}
            style={{
              left: p.left,
              top: p.top,
              width: 3 + (p.id % 3),
              height: 3 + (p.id % 3),
              animation: `starTwinkle ${3 + (p.id % 4)}s ease-in-out ${p.delay} infinite`,
            }}
            className="absolute rounded-full bg-sky-200 shadow-[0_0_8px_rgba(186,230,253,0.9)] will-change-transform"
          />
        ))}

      {/* Aurora / Midnight Neon / Cyber Neon / Lavender Orbs */}
      {(theme.effect === 'aurora' || theme.effect === 'neon' || theme.effect === 'orbs') && (
        <>
          <div
            style={{ animation: 'auroraDrift 14s ease-in-out infinite' }}
            className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-cbox-accent/20 blur-3xl will-change-transform"
          />
          <div
            style={{ animation: 'auroraDrift 18s ease-in-out 2s infinite reverse' }}
            className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-cbox-violet/20 blur-3xl will-change-transform"
          />
        </>
      )}
    </div>
  );
};
