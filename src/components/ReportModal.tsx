import React, { useState } from 'react';
import { api } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { AlertTriangle, X, ShieldCheck } from 'lucide-react';

interface ReportModalProps {
  targetType: 'video' | 'comment' | 'room' | 'user';
  targetId: string;
  targetTitle?: string;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  targetType,
  targetId,
  targetTitle,
  onClose
}) => {
  const { showToast } = useAuth();
  const [reason, setReason] = useState('Low Quality AI Slop / Spam');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const reasons = [
    'Low Quality AI Slop / Generic Scraping',
    'False Claims / Scam / Unauthorized Token Schemes',
    'Harassment / Hate Speech / Hostility',
    'Copyright Infringement / Stolen Media',
    'Dangerous or Harmful Content'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.reportContent(targetType, targetId, reason, description);
      showToast('🛡️ Report submitted to human moderation queue.');
      onClose();
    } catch (err: any) {
      showToast(`Report failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in text-white">
      <div className="bg-zinc-950 border border-white/15 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-900 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Report Content</h3>
            <p className="text-xs text-zinc-400">
              {targetTitle ? `"${targetTitle}"` : `Target ${targetType} ID: ${targetId.substring(0, 8)}...`}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Reason for Report
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
            >
              {reasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Additional Details (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide timestamps or context to assist community review..."
              rows={3}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 border border-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-xs font-bold text-black disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
