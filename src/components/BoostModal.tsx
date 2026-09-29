import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../api/client.ts';
import { Rocket, X, Zap } from 'lucide-react';

interface BoostModalProps {
  videoId: string;
  videoTitle: string;
  onClose: () => void;
  onSuccess: (amount: number) => void;
}

export const BoostModal: React.FC<BoostModalProps> = ({
  videoId,
  videoTitle,
  onClose,
  onSuccess
}) => {
  const { user, refreshUser, showToast } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState<number>(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presets = [10, 25, 50, 100];

  const handleBoost = async () => {
    if ((user?.available_tokens || 0) < selectedAmount) {
      setError(`Insufficient token balance (${user?.available_tokens || 0} available)`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.boostVideo(videoId, selectedAmount);
      await refreshUser();
      showToast(`Video boosted with ${selectedAmount} tokens for 24h!`);
      onSuccess(selectedAmount);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Boost failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in text-white">
      <div className="bg-zinc-950 border border-white/15 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-900 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center mx-auto mb-3 shadow-lg shadow-white/10">
            <Rocket className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Boost Video Discovery</h3>
          <p className="text-xs text-zinc-400 mt-1 line-clamp-1">"{videoTitle}"</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Boosted videos are highlighted across category lanes and the global feed.
          </p>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-900/50 text-red-300 text-xs p-2.5 rounded-xl mb-4 text-center">
            {error}
          </div>
        )}

        {/* Presets */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {presets.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setSelectedAmount(amt)}
              className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                selectedAmount === amt
                  ? 'bg-white text-black border-white shadow-sm'
                  : 'bg-zinc-900 text-zinc-300 border-white/10 hover:border-white/20'
              }`}
            >
              +{amt}
            </button>
          ))}
        </div>

        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-3 mb-6 flex justify-between items-center text-xs">
          <span className="text-zinc-400">Available tokens:</span>
          <span className="font-mono font-bold text-white">
            {user?.available_tokens || 0}
          </span>
        </div>

        <button
          onClick={handleBoost}
          disabled={loading}
          className="w-full py-2.5 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-white/10"
        >
          <Zap className="w-4 h-4 fill-black" />
          {loading ? 'Boosting Video...' : `Boost with ${selectedAmount} Tokens`}
        </button>
      </div>
    </div>
  );
};
