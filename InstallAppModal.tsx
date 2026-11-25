import React from 'react';
import { Download, Smartphone, Share2, MoreVertical, CheckCircle2 } from 'lucide-react';
import { Modal } from './Modal';

interface InstallAppModalProps {
  open: boolean;
  onClose: () => void;
  canNativeInstall: boolean;
  isInstalled: boolean;
  onNativeInstall: () => Promise<void>;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  open,
  onClose,
  canNativeInstall,
  isInstalled,
  onNativeInstall,
}) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Install Cbox App"
      description="Install Cbox directly from the browser for a full-screen, app-like experience on Android, iPhone, and Desktop."
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        {isInstalled ? (
          <div className="p-4 rounded-xl bg-cbox-success/10 border border-cbox-success/30 flex items-center gap-3 text-sm text-cbox-text">
            <CheckCircle2 className="h-5 w-5 text-cbox-success shrink-0" />
            <span>Cbox is already installed on this device.</span>
          </div>
        ) : canNativeInstall ? (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-cbox-accent/10 border border-cbox-accent/30 flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-cbox-accent shrink-0 mt-0.5" />
              <p className="text-xs text-cbox-text leading-relaxed">
                Your device supports one-tap installation. Tap below to add Cbox to your home
                screen with its own app icon and standalone window.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await onNativeInstall();
                onClose();
              }}
              className="w-full py-3 rounded-xl bg-cbox-accent text-slate-950 hover:bg-cbox-accentHover font-semibold text-sm flex items-center justify-center gap-2 transition"
            >
              <Download className="h-4 w-4" />
              Install Cbox Now
            </button>
          </div>
        ) : (
          <div className="space-y-3 text-xs text-cbox-text">
            <div className="p-3.5 rounded-xl bg-cbox-elevated border border-cbox-border space-y-1.5">
              <p className="font-semibold flex items-center gap-1.5">
                <MoreVertical className="h-4 w-4 text-cbox-accent" />
                Android (Chrome / Edge)
              </p>
              <ol className="list-decimal list-inside space-y-1 text-cbox-muted">
                <li>Open Cbox over HTTPS in Chrome or Edge.</li>
                <li>Tap the top-right browser menu (⋮).</li>
                <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
              </ol>
            </div>

            <div className="p-3.5 rounded-xl bg-cbox-elevated border border-cbox-border space-y-1.5">
              <p className="font-semibold flex items-center gap-1.5">
                <Share2 className="h-4 w-4 text-cbox-violet" />
                iPhone / iPad (Safari)
              </p>
              <ol className="list-decimal list-inside space-y-1 text-cbox-muted">
                <li>Tap the <strong>Share</strong> icon at the bottom of Safari.</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                <li>Tap <strong>Add</strong> to launch Cbox like a native app.</li>
              </ol>
            </div>
          </div>
        )}

        <p className="text-[11px] text-cbox-muted text-center">
          Same account, messages, and posts sync automatically across mobile and desktop.
        </p>
      </div>
    </Modal>
  );
};
