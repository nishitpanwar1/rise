import React, { useState } from 'react';
import { api } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { X, Flame, LogIn, UserPlus } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, initialMode = 'login' }) => {
  const { refreshUser, showToast } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [focus, setFocus] = useState('Full-Stack Engineering');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        const res = await api.register({
          email: email.trim(),
          password,
          username: username.trim(),
          display_name: displayName.trim(),
          focus: focus.trim()
        });
        await refreshUser();
        showToast(`Welcome to RiseUp, ${res.user.display_name}! 50 tokens granted.`);
      } else {
        const res = await api.login({
          emailOrUsername: email.trim(),
          password
        });
        await refreshUser();
        showToast(`Welcome back, ${res.user.display_name}!`);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in text-white">
      <div className="bg-zinc-950 border border-white/15 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1.5 rounded-xl hover:bg-zinc-900 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center mx-auto mb-3 shadow-lg shadow-white/10">
            <Flame className="w-6 h-6 fill-black" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            {mode === 'register' ? 'Join RiseUp OS' : 'Sign in to RiseUp'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {mode === 'register'
              ? 'Real builder accounts. Turn your attention into real tokens and streaks.'
              : 'Access your persistent wallet, uploaded content, and accountability rooms.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-900/50 text-red-300 text-xs p-3 rounded-xl mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Jordan Reed"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="jordan_builder"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Primary Focus</label>
                  <input
                    type="text"
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    placeholder="AI & Systems"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              {mode === 'register' ? 'Email Address' : 'Email or Username'}
            </label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-white/10 active:scale-95 mt-4"
          >
            {mode === 'register' ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            {loading ? 'Processing...' : mode === 'register' ? 'Create Account (+50 Tokens)' : 'Sign In'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-white/10 text-center">
          {mode === 'register' ? (
            <p className="text-xs text-zinc-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className="text-white font-bold hover:underline"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p className="text-xs text-zinc-400">
              New to RiseUp?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className="text-white font-bold hover:underline"
              >
                Create Account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
