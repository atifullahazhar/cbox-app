import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { Modal } from './Modal';

const REASONS = [
  'Spam or scam',
  'Harassment or hate speech',
  'Impersonation',
  'Inappropriate content',
  'Other safety concern',
];

interface ReportModalProps {
  open: boolean;
  targetLabel: string;
  targetUserId?: string;
  targetPostId?: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  open,
  targetLabel,
  targetUserId,
  targetPostId,
  onClose,
  onSubmitted,
}) => {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify({ targetUserId, targetPostId, reason, details }),
      });
      setDetails('');
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Report ${targetLabel}`}
      description="Reports are logged for audited safety review."
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-cbox-muted">Reason</span>
          <div className="space-y-1.5">
            {REASONS.map((r) => (
              <label
                key={r}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                  reason === r
                    ? 'border-cbox-danger bg-cbox-danger/10 text-cbox-text font-semibold'
                    : 'border-cbox-border bg-cbox-elevated/40 text-cbox-muted'
                }`}
              >
                <input
                  type="radio"
                  name="reportReason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-cbox-danger"
                />
                <span>{r}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-cbox-muted">Additional details (optional)</span>
          <textarea
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
            placeholder="Describe what happened…"
            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-sm text-cbox-text"
          />
        </label>

        {error && <p className="text-xs text-cbox-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm border border-cbox-border text-cbox-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-cbox-danger text-white disabled:opacity-50"
          >
            <Flag className="h-4 w-4" />
            {busy ? 'Submitting…' : 'Submit Report'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
