import React, { useState, useEffect } from 'react';
import { api } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Wallet,
  Zap,
  Lock,
  ArrowUpRight,
  ArrowDownLeft,
  History
} from 'lucide-react';

export const WalletView: React.FC = () => {
  const { user, refreshUser, showToast } = useAuth();
  const [walletData, setWalletData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [vaultAmount, setVaultAmount] = useState<number>(50);
  const [vaultTerm, setVaultTerm] = useState<number>(30);
  const [isLocking, setIsLocking] = useState(false);

  const loadWallet = async () => {
    setLoading(true);
    try {
      const data = await api.getWallet();
      setWalletData(data);
    } catch (err) {
      console.error('Failed to load wallet:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, []);

  const handleLockVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((walletData?.available_tokens || 0) < vaultAmount) {
      showToast(`Insufficient tokens! (Available: ${walletData?.available_tokens || 0})`);
      return;
    }

    setIsLocking(true);
    try {
      const res = await api.lockVault(vaultAmount, vaultTerm);
      showToast(`Locked ${vaultAmount} tokens for ${vaultTerm} days (+${res.yield_tokens} yield)!`);
      await refreshUser();
      await loadWallet();
    } catch (err: any) {
      showToast(`Vault error: ${err.message}`);
    } finally {
      setIsLocking(false);
    }
  };

  const yieldPct = vaultTerm === 90 ? 35 : vaultTerm === 30 ? 15 : 5;
  const projectedYield = Math.round(vaultAmount * (yieldPct / 100));

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto text-white">
      {/* Header */}
      <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold mb-2">
            <Wallet className="w-3.5 h-3.5" /> Append-Only Token Ledger
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            RiseUp Wallet &amp; Vault
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
            Tokens are non-custodial cryptographic platform points earned by learning, publishing, and peer grants. Every mutation is immutably journaled.
          </p>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Available Card */}
        <div className="bg-zinc-950 border border-white/10 p-6 sm:p-8 rounded-3xl space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold uppercase tracking-wider">Available Balance</span>
            <Zap className="w-4 h-4 fill-white text-white" />
          </div>

          <div className="text-4xl sm:text-5xl font-black text-white font-mono flex items-baseline gap-2">
            <span>{walletData?.available_tokens ?? user?.available_tokens ?? 0}</span>
            <span className="text-sm text-zinc-400 font-sans font-medium">Tokens</span>
          </div>

          <p className="text-xs text-zinc-400">
            Spendable on tips, video boosts, and digital products in the Shop.
          </p>

          <div className="pt-2 flex gap-2">
            <button
              onClick={() => showToast('Earn tokens by watching learning videos (+1) or publishing (+10)!')}
              className="text-xs text-white bg-white/10 border border-white/20 hover:bg-white/20 px-3.5 py-1.5 rounded-xl font-bold transition-all"
            >
              How to Earn More ⚡
            </button>
          </div>
        </div>

        {/* Vault Locked Card */}
        <div className="bg-zinc-950 border border-white/10 p-6 sm:p-8 rounded-3xl space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold uppercase tracking-wider">Locked in RiseUp Vault</span>
            <Lock className="w-4 h-4 text-white" />
          </div>

          <div className="text-4xl sm:text-5xl font-black text-white font-mono flex items-baseline gap-2">
            <span>{walletData?.locked_tokens ?? 0}</span>
            <span className="text-sm text-zinc-400 font-sans font-medium">Tokens</span>
          </div>

          <p className="text-xs text-zinc-400">
            Staked for fixed durations to unlock creator reputation and yield rewards.
          </p>

          <div className="text-xs font-mono text-zinc-300">
            {walletData?.active_locks?.length || 0} Active Vault Locks
          </div>
        </div>
      </div>

      {/* Vault Staking Form */}
      <div className="bg-zinc-950 border border-white/10 p-6 sm:p-8 rounded-3xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-white" /> Lock Tokens in RiseUp Vault
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Lock tokens to prove commitment and earn bonus platform tokens on maturity.
            </p>
          </div>
          <span className="text-xs font-mono text-white font-bold bg-white/10 px-2 py-0.5 rounded border border-white/20">
            Up to +35% Yield
          </span>
        </div>

        <form onSubmit={handleLockVault} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Amount to Lock (Tokens)
              </label>
              <input
                type="number"
                min="10"
                max={walletData?.available_tokens || 100}
                value={vaultAmount}
                onChange={(e) => setVaultAmount(Math.max(10, parseInt(e.target.value) || 10))}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-white"
              />
            </div>

            {/* Term */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Lock Term Duration
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { days: 7, yield: '+5%' },
                  { days: 30, yield: '+15%' },
                  { days: 90, yield: '+35%' }
                ].map((t) => (
                  <button
                    key={t.days}
                    type="button"
                    onClick={() => setVaultTerm(t.days)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                      vaultTerm === t.days
                        ? 'bg-white text-black border-white shadow-md'
                        : 'bg-zinc-900 text-zinc-400 border-white/10 hover:bg-zinc-800'
                    }`}
                  >
                    {t.days} Days ({t.yield})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Projection Banner */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900 border border-white/10 text-xs">
            <span className="text-zinc-300">Projected Yield on Unlock:</span>
            <span className="font-mono font-bold text-white">
              +{projectedYield} Bonus Tokens (Total Return: {vaultAmount + projectedYield} ⚡)
            </span>
          </div>

          <button
            type="submit"
            disabled={isLocking || (walletData?.available_tokens || 0) < vaultAmount}
            className="w-full py-3 rounded-2xl text-xs font-bold text-black bg-white hover:bg-zinc-200 disabled:opacity-50 transition-all shadow-md shadow-white/10 flex items-center justify-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            {isLocking ? 'Journaling Lock to Ledger...' : `Lock ${vaultAmount} Tokens for ${vaultTerm} Days`}
          </button>
        </form>

        {/* Active Locks Table */}
        {walletData?.active_locks?.length > 0 && (
          <div className="pt-4 border-t border-white/10 space-y-2">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Active Locks
            </h4>
            <div className="space-y-2">
              {walletData.active_locks.map((lock: any) => (
                <div key={lock.id} className="p-3 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-white" />
                    <span className="text-white font-bold">{lock.amount} Tokens</span>
                    <span className="text-zinc-500">({lock.term_days}d lock)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-white font-bold">+{lock.yield_tokens} yield</span>
                    <span className="text-[10px] text-zinc-500 ml-2">Unlocks: {new Date(lock.unlock_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Append-Only Ledger History */}
      <div className="bg-zinc-950 border border-white/10 p-6 sm:p-8 rounded-3xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-white" />
            Append-Only Transaction Ledger
          </h3>
          <span className="text-xs text-zinc-400 font-mono">
            {walletData?.ledger?.length || 0} Transactions Verified
          </span>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {!walletData?.ledger || walletData.ledger.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-6">No ledger entries recorded yet.</p>
          ) : (
            walletData.ledger.map((entry: any) => {
              const isCredit = entry.delta > 0;
              return (
                <div
                  key={entry.id}
                  className="p-3 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isCredit
                          ? 'bg-white/15 text-white border border-white/30'
                          : 'bg-zinc-800 text-zinc-400 border border-white/10'
                      }`}
                    >
                      {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-semibold text-white capitalize">
                        {entry.source_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono truncate max-w-xs">
                        Key: {entry.idempotency_key}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={`font-mono font-bold text-sm ${
                        isCredit ? 'text-white' : 'text-zinc-400'
                      }`}
                    >
                      {isCredit ? `+${entry.delta}` : entry.delta} ⚡
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono">
                      {new Date(entry.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
