import React, { useState, useEffect } from 'react';
import { Challenge, Duel } from '../types.ts';
import { api } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Trophy,
  Swords,
  Flame,
  Zap,
  CheckCircle2,
  Users,
  Clock,
  Award
} from 'lucide-react';

export const ArenaView: React.FC = () => {
  const { user, refreshUser, showToast } = useAuth();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [loading, setLoading] = useState(true);

  const loadArena = async () => {
    setLoading(true);
    try {
      const data = await api.getArena();
      setLeaderboard(data.leaderboard);
      setChallenges(data.challenges);
      setDuels(data.duels);
    } catch (err) {
      console.error('Failed to load arena:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArena();
  }, []);

  const handleJoinChallenge = async (challengeId: string) => {
    try {
      await api.joinChallenge(challengeId);
      showToast('⚔️ Joined challenge! Track your progress on the leaderboard.');
      await loadArena();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 pb-16 max-w-6xl mx-auto text-white">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-white/10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold mb-2">
            <Trophy className="w-3.5 h-3.5" /> Builder Gamification &amp; Competitions
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            RiseUp Arena &amp; Leaderboards
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 leading-relaxed">
            Status here is derived from verified deep work, discipline streaks, tokens earned, and shipping speed.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Leaderboard (Cols 1 to 7) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-white" />
              Global Builder Rankings
            </h2>
            <span className="text-xs text-zinc-400 font-mono">Ranked by XP &amp; Tokens</span>
          </div>

          <div className="bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden divide-y divide-white/5">
            {leaderboard.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Trophy className="w-10 h-10 text-zinc-600 mx-auto" />
                <div>
                  <h4 className="text-sm font-bold text-white">No Ranked Builders Yet</h4>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                    Sign in, watch technical content to accumulate learning minutes, and earn your first XP to appear at #1 on the leaderboard!
                  </p>
                </div>
              </div>
            ) : (
              leaderboard.map((builder, idx) => {
                const isCurrentUser = builder.id === user?.id;
                const rank = idx + 1;
                const rankColor =
                  rank === 1
                    ? 'text-white bg-white/20 border-white'
                    : rank === 2
                    ? 'text-zinc-200 bg-white/10 border-white/40'
                    : rank === 3
                    ? 'text-zinc-300 bg-white/5 border-white/20'
                    : 'text-zinc-500 bg-zinc-900 border-white/5';

                return (
                  <div
                    key={builder.id}
                    className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                      isCurrentUser ? 'bg-white/10 border-l-4 border-white' : 'hover:bg-zinc-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-7 h-7 rounded-xl font-mono text-xs font-black flex items-center justify-center border shrink-0 ${rankColor}`}>
                        {rank}
                      </span>
                      <img
                        src={builder.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64'}
                        alt={builder.display_name}
                        className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate">
                            {builder.display_name}
                          </h4>
                          {isCurrentUser && (
                            <span className="text-[10px] font-bold text-black bg-white px-1.5 py-0.2 rounded">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate">{builder.focus || `@${builder.username}`}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div>
                        <div className="text-xs font-mono font-bold text-white flex items-center justify-end gap-1">
                          <Zap className="w-3 h-3 fill-white" />
                          {builder.tokens}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400 flex items-center justify-end gap-1">
                          <Flame className="w-3 h-3 fill-white text-white" />
                          {builder.streak_days}d streak
                        </div>
                      </div>
                      <div className="bg-zinc-900 border border-white/10 px-2.5 py-1 rounded-lg">
                        <span className="text-[11px] font-mono font-bold text-zinc-200">{builder.xp} XP</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Challenges & Duels (Cols 8 to 12) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Challenges */}
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-white" />
                Active Challenges
              </h2>
            </div>

            <div className="space-y-4">
              {challenges.length === 0 ? (
                <div className="p-6 bg-zinc-950 rounded-2xl border border-white/10 text-center text-xs text-zinc-400 space-y-1">
                  <p className="font-semibold text-white">No active challenges right now</p>
                  <p>Check back soon or start learning to boost your personal streak!</p>
                </div>
              ) : (
                challenges.map((c) => (
                  <div
                    key={c.id}
                    className="bg-zinc-950 border border-white/10 p-5 rounded-3xl space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white uppercase tracking-wider text-[10px] bg-white/10 px-2 py-0.5 rounded border border-white/20">
                        +{c.xp_reward} XP Reward
                      </span>
                      <span className="text-zinc-400 font-mono text-[11px] flex items-center gap-1">
                        <Users className="w-3 h-3" /> {c.participant_count} builders joined
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white">{c.title}</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">{c.description}</p>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Closes in 5 days
                      </span>
                      {c.is_joined ? (
                        <span className="text-xs font-bold text-white flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Joined
                        </span>
                      ) : (
                        <button
                          onClick={() => handleJoinChallenge(c.id)}
                          className="bg-white hover:bg-zinc-200 text-black font-bold text-xs px-4 py-1.5 rounded-xl transition-all shadow-md shadow-white/10 active:scale-95"
                        >
                          Join Challenge
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Duels */}
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Swords className="w-4 h-4 text-white" />
                Live 1v1 Duels
              </h2>
            </div>

            <div className="space-y-3">
              {duels.length === 0 ? (
                <div className="p-6 bg-zinc-950 rounded-2xl border border-white/10 text-center text-xs text-zinc-400 space-y-1">
                  <p className="font-semibold text-white">No active duels</p>
                  <p>Challenge other builders in your accountability rooms to deep work duels!</p>
                </div>
              ) : (
                duels.map((d) => (
                  <div key={d.id} className="bg-zinc-950 border border-white/10 p-4 rounded-2xl space-y-3">
                    <div className="text-[11px] font-bold text-white uppercase tracking-wider">
                      {d.topic}
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      {/* Challenger */}
                      <div className="flex items-center gap-2">
                        <img
                          src={d.challenger_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64'}
                          alt={d.challenger_name}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <div>
                          <p className="text-xs font-bold text-white">{d.challenger_name}</p>
                          <p className="text-[10px] font-mono text-white font-bold">{d.challenger_score} pts</p>
                        </div>
                      </div>

                      <span className="text-xs font-black text-zinc-500 uppercase">VS</span>

                      {/* Opponent */}
                      <div className="flex items-center gap-2 text-right">
                        <div>
                          <p className="text-xs font-bold text-white">{d.opponent_name}</p>
                          <p className="text-[10px] font-mono text-white font-bold">{d.opponent_score} pts</p>
                        </div>
                        <img
                          src={d.opponent_avatar || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=64'}
                          alt={d.opponent_name}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
