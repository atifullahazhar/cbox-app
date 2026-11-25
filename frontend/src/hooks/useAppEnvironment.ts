import { useEffect, useState } from 'react';
import { getThemeDefinition, type ThemeKey } from '../themes';

export function applyThemeKey(themeKey: ThemeKey): void {
  const def = getThemeDefinition(themeKey);
  localStorage.setItem('chatterbox_theme_key', def.key);
  const root = document.documentElement;
  root.setAttribute('data-theme', def.key);
  root.classList.toggle('dark', def.isDark);

  const p = def.palette;
  root.style.setProperty('--cbox-bg', p.bg);
  root.style.setProperty('--cbox-surface', p.surface);
  root.style.setProperty('--cbox-elevated', p.elevated);
  root.style.setProperty('--cbox-border', p.border);
  root.style.setProperty('--cbox-text', p.text);
  root.style.setProperty('--cbox-muted', p.muted);
  root.style.setProperty('--cbox-accent', p.accent);
  root.style.setProperty('--cbox-accent-hover', p.accentHover);
  root.style.setProperty('--cbox-violet', p.violet);
  root.style.setProperty('--cbox-success', p.success);
  root.style.setProperty('--cbox-danger', p.danger);
  root.style.setProperty('--cbox-warning', p.warning);
}

export function useThemeSync(themeKey: ThemeKey) {
  useEffect(() => {
    applyThemeKey(themeKey);
  }, [themeKey]);
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(
    () => window.matchMedia('(display-mode: standalone)').matches
  );

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function triggerInstall(): Promise<boolean> {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === 'accepted';
  }

  return { canInstall: Boolean(deferredPrompt) && !isInstalled, isInstalled, triggerInstall };
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => navigator.onLine);
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  return online;
}
