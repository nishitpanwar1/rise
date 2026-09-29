import React, { useState, useEffect } from 'react';
import { DisciplineData } from '../types.ts';
import { api } from '../api/client.ts';
import {
  Activity,
  Flame,
  Brain,
  Eye,
  TrendingUp,
  ShieldCheck,
  Zap
} from 'lucide-react';

export const DisciplineView: React.FC = () => {
  const [data, setData] = useState<DisciplineData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getDiscipline();
      setData(res);
    } catch (err) {
      console.error('Failed to load discipline stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto text-white">
      {/* Header */}
      <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-white/10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold mb-2">
            <Activity className="w-3.5 h-3.5" /> Cognitive Focus Analytics
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Learning vs. Scrolling Ratio
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 leading-relaxed">
            RiseUp quantifies your digital intake. Content categorized under Engineering, AI, Startups, and Focus counts toward Learning. Everything else is classified as Passive Scrolling.
          </p>
        </div>
      </div>

      {loading || !data ? (
        <div className="animate-pulse space-y-4">
          <div className="h-40 bg-zinc-950 rounded-3xl border border-white/10" />
          <div className="h-64 bg-zinc-950 rounded-3xl border border-white/10" />
        </div>
      ) : (
        <>
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: Ratio */}
            <div className="bg-zinc-950 border border-white/10 p-5 rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Learning Ratio</span>
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div className="text-3xl font-black text-white font-mono flex items-baseline gap-1">
                <span>{data.learning_ratio}%</span>
                <span className="text-xs text-zinc-400 font-sans font-normal">useful</span>
              </div>
              <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-white/10">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${data.learning_ratio}%` }}
                />
              </div>
            </div>

            {/* Metric 2: Learning Hours */}
            <div className="bg-zinc-950 border border-white/10 p-5 rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Deep Learning</span>
                <Zap className="w-4 h-4 fill-white text-white" />
              </div>
              <div className="text-3xl font-black text-white font-mono">
                {data.learning_hours} <span className="text-xs text-zinc-400 font-sans">hrs</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Classified from validated watch sessions.
              </p>
            </div>

            {/* Metric 3: Passive Scrolling */}
            <div className="bg-zinc-950 border border-white/10 p-5 rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Passive Scrolling</span>
                <Eye className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="text-3xl font-black text-white font-mono">
                {data.scrolling_hours} <span className="text-xs text-zinc-400 font-sans">hrs</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Kept strictly under target.
              </p>
            </div>

            {/* Metric 4: Streak */}
            <div className="bg-zinc-950 border border-white/10 p-5 rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Discipline Streak</span>
                <Flame className="w-4 h-4 fill-white text-white" />
              </div>
              <div className="text-3xl font-black text-white font-mono">
                {data.current_streak} <span className="text-xs text-zinc-400 font-sans">days</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Longest record: {data.longest_streak} days
              </p>
            </div>
          </div>

          {/* Daily Bar Chart */}
          <div className="bg-zinc-950 border border-white/10 p-6 sm:p-8 rounded-3xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-white" />
                14-Day Attention Breakdown
              </h3>
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-white" />
                  <span className="text-zinc-300">Learning (useful)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-zinc-800" />
                  <span className="text-zinc-500">Passive Scrolling</span>
                </div>
              </div>
            </div>

            {/* Bars */}
            <div className="h-56 flex items-end justify-between gap-2 pt-6">
              {data.daily_history.map((dayStat, idx) => {
                const totalMinutes = (dayStat.learning_ms + dayStat.scrolling_ms) / 60000;
                const learningMinutes = dayStat.learning_ms / 60000;
                const maxExpectedMinutes = 120;
                const heightPct = Math.min(100, Math.max(10, Math.round((totalMinutes / maxExpectedMinutes) * 100)));
                const learningRatio = totalMinutes > 0 ? (learningMinutes / totalMinutes) * 100 : 0;
                const dayLabel = dayStat.day.split('-').slice(1).join('/');

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                    <div className="text-[10px] font-mono text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {Math.round(learningMinutes)}m
                    </div>

                    <div
                      className="w-full max-w-[28px] rounded-lg overflow-hidden flex flex-col justify-end bg-zinc-900 border border-white/10 transition-all group-hover:brightness-125"
                      style={{ height: `${heightPct}%` }}
                    >
                      <div
                        className="bg-white w-full transition-all"
                        style={{ height: `${learningRatio}%` }}
                      />
                    </div>

                    <span className="text-[10px] font-mono text-zinc-500">
                      {dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Classification Transparency Card */}
          <div className="p-6 rounded-3xl bg-zinc-950 border border-white/10 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-white" />
              How Attention is Evaluated Server-Side
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-400 leading-relaxed">
              <p>
                Unlike generic social networks that reward endless time-on-app, RiseUp ranks and classifies watch sessions based on the creator's taxonomy. Videos in <span className="text-white font-semibold">Engineering &amp; Code, SaaS, AI, Mindset</span>, and <span className="text-white font-semibold">Fitness</span> are classified as intentional Learning.
              </p>
              <p>
                Qualified watch sessions of 15 seconds or more automatically yield <span className="text-white font-bold">+1 RiseUp token</span> to your wallet, aligning your digital habits with tangible platform assets.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
