import React, { useState, useEffect } from 'react';
import { Video } from '../types.ts';
import { api } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Clock, Heart, Bookmark, Play } from 'lucide-react';

interface LibraryViewProps {
  initialTab?: 'history' | 'liked' | 'saved';
}

export const LibraryView: React.FC<LibraryViewProps> = ({ initialTab = 'history' }) => {
  const { setSelectedVideoId } = useAuth();
  const [tab, setTab] = useState<'history' | 'liked' | 'saved'>(initialTab);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLibrary = async () => {
    setLoading(true);
    try {
      let data: Video[] = [];
      if (tab === 'history') data = await api.getLibraryHistory();
      else if (tab === 'liked') data = await api.getLibraryLiked();
      else if (tab === 'saved') data = await api.getLibrarySaved();
      setVideos(data);
    } catch (err) {
      console.error('Failed to load library:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, [tab]);

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto text-white">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        {[
          { id: 'history', label: 'Watch History', icon: Clock },
          { id: 'liked', label: 'Liked Drops', icon: Heart },
          { id: 'saved', label: 'Saved for Later', icon: Bookmark }
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                active
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-video bg-zinc-950 rounded-2xl border border-white/10" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-16 bg-zinc-950 rounded-3xl border border-white/10 p-8">
          <p className="text-zinc-400 text-sm">No videos found in your {tab}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <div
              key={video.id}
              onClick={() => setSelectedVideoId(video.id)}
              className="cursor-pointer group flex flex-col bg-zinc-950 hover:bg-zinc-900 border border-white/10 hover:border-white/25 rounded-2xl overflow-hidden transition-all duration-200"
            >
              <div className="relative aspect-video bg-black overflow-hidden">
                <img
                  src={video.thumbnail_url}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play className="w-8 h-8 text-white fill-white" />
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-white bg-white/10 px-1.5 py-0.5 rounded border border-white/20">
                    {video.category_name}
                  </span>
                  <h3 className="text-xs font-bold text-white group-hover:text-zinc-200 transition-colors line-clamp-2 mt-1.5">
                    {video.title}
                  </h3>
                </div>
                <p className="text-[11px] text-zinc-400 font-mono mt-3">
                  By {video.creator_name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
