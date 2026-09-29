import React, { useState } from 'react';
import { Video } from '../types.ts';
import { api } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Target, Play, CheckCircle2, Upload } from 'lucide-react';

export const IntentView: React.FC = () => {
  const { setSelectedVideoId, setActiveTab, openUploadModal, showToast } = useAuth();
  const [selectedLane, setSelectedLane] = useState('SaaS');
  const [intention, setIntention] = useState('');
  const [loading, setLoading] = useState(false);
  const [curatedResults, setCuratedResults] = useState<Video[] | null>(null);

  const lanes = [
    { id: 'SaaS', label: 'SaaS & Startups', desc: 'Validating, shipping & monetizing micro-products' },
    { id: 'AI', label: 'AI & Automation', desc: 'Autonomous swarms, tool calling & local LLMs' },
    { id: 'Code', label: 'Systems & Engineering', desc: 'Distributed architecture, SQLite, TypeScript' },
    { id: 'Focus', label: 'Mindset & Deep Work', desc: '4-hour focus protocols and cognitive stamina' },
    { id: 'Fitness', label: 'Physical Discipline', desc: 'Athletic habits and 5 AM morning routines' }
  ];

  const handleCurate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intention.trim()) {
      showToast('Please state what you want to learn or build.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.curateIntent(selectedLane, intention);
      setCuratedResults(res.results);
      showToast(`🎯 Intent recorded! Curated ${res.results.length} matched drops.`);
    } catch (err: any) {
      showToast(`Curation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 text-white">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold">
          <Target className="w-3.5 h-3.5" /> Intent Gateway
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          What are you building or mastering today?
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto">
          RiseUp replaces algorithm-driven distraction with user-driven intent. Choose your lane, state your goal, and receive a high-signal curriculum.
        </p>
      </div>

      {/* Lane Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {lanes.map((lane) => {
          const isSelected = selectedLane === lane.id;
          return (
            <button
              key={lane.id}
              type="button"
              onClick={() => setSelectedLane(lane.id)}
              className={`p-4 rounded-2xl text-left border transition-all ${
                isSelected
                  ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                  : 'bg-zinc-950 border-white/10 text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`font-bold text-sm ${isSelected ? 'text-black' : 'text-white'}`}>{lane.label}</span>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-black" />}
              </div>
              <p className={`text-xs ${isSelected ? 'text-zinc-700' : 'text-zinc-400'} leading-relaxed`}>{lane.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Intention Input Form */}
      <form onSubmit={handleCurate} className="bg-zinc-950 border border-white/10 p-6 sm:p-8 rounded-3xl shadow-xl space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              One-Sentence Intention
            </label>
            <span className="text-[11px] font-mono text-zinc-500">
              {intention.length}/180
            </span>
          </div>
          <textarea
            value={intention}
            onChange={(e) => setIntention(e.target.value.substring(0, 180))}
            placeholder="e.g. Learn how to design SQLite transaction-safe APIs without crashing on concurrent writes"
            rows={3}
            className="w-full bg-zinc-900 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white resize-none transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !intention.trim()}
          className="w-full py-3.5 rounded-2xl text-xs font-bold text-black bg-white hover:bg-zinc-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/10 active:scale-95"
        >
          <Target className="w-4 h-4" />
          <span>{loading ? 'Curating Deep Work Playlist...' : 'Generate High-Signal Curriculum'}</span>
        </button>
      </form>

      {/* Curated Results Display */}
      {curatedResults && (
        <div className="space-y-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-white" />
              Curated Curriculum for "{intention}"
            </h2>
            <span className="text-xs font-mono text-zinc-400">
              {curatedResults.length} matched drops
            </span>
          </div>

          {curatedResults.length === 0 ? (
            <div className="p-8 text-center bg-zinc-950 rounded-3xl border border-white/10 text-xs text-zinc-400 space-y-3">
              <p>No exact matched videos found for this specific query yet.</p>
              <button
                onClick={() => openUploadModal(false)}
                className="px-4 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200 transition-colors inline-flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" /> Upload Video on this Topic
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {curatedResults.map((v) => (
                <div
                  key={v.id}
                  onClick={() => setSelectedVideoId(v.id)}
                  className="cursor-pointer bg-zinc-950 border border-white/10 hover:border-white/30 rounded-2xl overflow-hidden p-3 flex gap-3 transition-all hover:bg-zinc-900 group"
                >
                  <img
                    src={v.thumbnail_url}
                    alt={v.title}
                    className="w-24 aspect-video rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-white bg-white/10 px-1.5 py-0.5 rounded border border-white/20">
                        {v.category_name}
                      </span>
                      <h4 className="text-xs font-bold text-white line-clamp-2 mt-1 group-hover:text-zinc-200">
                        {v.title}
                      </h4>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      By {v.creator_name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
