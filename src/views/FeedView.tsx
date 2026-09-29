import React, { useState, useEffect } from 'react';
import { Video, Category } from '../types.ts';
import { api } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Flame,
  Play,
  Heart,
  Bookmark,
  Rocket,
  Sparkles,
  TrendingUp,
  Clock,
  Users,
  Target,
  Upload,
  Plus
} from 'lucide-react';

export const FeedView: React.FC = () => {
  const { setSelectedVideoId, setActiveTab, openUploadModal } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSort, setSelectedSort] = useState<string>('recommended');
  const [loading, setLoading] = useState(true);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const [cats, vids] = await Promise.all([
        api.getCategories(),
        api.getFeed(selectedCategory === 'all' ? undefined : selectedCategory, selectedSort)
      ]);
      setCategories(cats);
      setVideos(vids);
    } catch (err) {
      console.error('Failed to load feed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, [selectedCategory, selectedSort]);

  const handleInlineLike = async (e: React.MouseEvent, video: Video) => {
    e.stopPropagation();
    const prevLiked = video.is_liked;
    const prevCount = video.likes_count;

    setVideos((curr) =>
      curr.map((v) =>
        v.id === video.id
          ? { ...v, is_liked: !prevLiked, likes_count: prevLiked ? prevCount - 1 : prevCount + 1 }
          : v
      )
    );

    try {
      const res = await api.likeVideo(video.id);
      setVideos((curr) =>
        curr.map((v) =>
          v.id === video.id ? { ...v, is_liked: res.liked, likes_count: res.likes_count } : v
        )
      );
    } catch {
      setVideos((curr) =>
        curr.map((v) =>
          v.id === video.id ? { ...v, is_liked: prevLiked, likes_count: prevCount } : v
        )
      );
    }
  };

  const handleInlineSave = async (e: React.MouseEvent, video: Video) => {
    e.stopPropagation();
    const prevSaved = video.is_saved;
    setVideos((curr) =>
      curr.map((v) => (v.id === video.id ? { ...v, is_saved: !prevSaved } : v))
    );

    try {
      const res = await api.saveVideo(video.id);
      setVideos((curr) =>
        curr.map((v) => (v.id === video.id ? { ...v, is_saved: res.saved } : v))
      );
    } catch {
      setVideos((curr) =>
        curr.map((v) => (v.id === video.id ? { ...v, is_saved: prevSaved } : v))
      );
    }
  };

  return (
    <div className="space-y-6 pb-16 text-white">
      {/* Hero Intent / Builder Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-zinc-950 border border-white/10 p-5 sm:p-7 lg:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> High-Performance Builder OS
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
            Stop Doomscrolling. Start Shipping.
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
            Every minute of learning earns you RiseUp tokens. Set your learning intention, watch real engineering walkthroughs, and hold yourself accountable in builder rooms.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button
              onClick={() => openUploadModal(false)}
              className="bg-white hover:bg-zinc-200 text-black font-bold text-xs px-4 py-2.5 rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-white/10 active:scale-95"
            >
              <Upload className="w-4 h-4 stroke-[2.5]" />
              <span>Upload Video / Drop</span>
            </button>
            <button
              onClick={() => setActiveTab('intent')}
              className="bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs px-4 py-2.5 rounded-2xl border border-white/10 transition-colors flex items-center gap-2"
            >
              <Target className="w-4 h-4" /> State Your Daily Intent
            </button>
            <button
              onClick={() => setActiveTab('rooms')}
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs px-4 py-2.5 rounded-2xl border border-white/10 transition-colors hidden sm:inline-flex"
            >
              Join Accountability Rooms
            </button>
          </div>
        </div>

        {/* Minimal geometric backdrop */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-5 pointer-events-none bg-gradient-to-l from-white to-transparent" />
      </div>

      {/* Categories Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
            selectedCategory === 'all'
              ? 'bg-white text-black border-white shadow-sm'
              : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white hover:bg-zinc-800'
          }`}
        >
          All Lanes
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              selectedCategory === c.id
                ? 'bg-white text-black border-white shadow-sm'
                : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Sorting / Filter Bar */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
        <div className="flex items-center gap-4 text-xs font-semibold text-zinc-400">
          <span className="text-white font-bold">Sort By:</span>
          {(['recommended', 'recent', 'most_viewed', 'boosted'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSort(s)}
              className={`capitalize transition-colors ${
                selectedSort === s ? 'text-white underline underline-offset-4 decoration-2 font-bold' : 'hover:text-zinc-200'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <button
          onClick={() => openUploadModal(false)}
          className="text-xs text-white hover:text-zinc-300 font-bold flex items-center gap-1.5 bg-zinc-900 px-3 py-1.5 rounded-full border border-white/10 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Upload</span>
        </button>
      </div>

      {/* Video Grid - Highly responsive across Mobile, Tablet, Laptop, PC, TV */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-5 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse space-y-3">
              <div className="aspect-video bg-zinc-900 rounded-2xl border border-white/5" />
              <div className="h-4 bg-zinc-900 rounded w-3/4" />
              <div className="h-3 bg-zinc-900 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-20 bg-zinc-950 rounded-3xl border border-white/10 p-8 space-y-4 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No Videos Published Yet</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Be the first creator to upload a technical walkthrough or Short. Publishing grants you +10 RiseUp tokens!
            </p>
          </div>
          <button
            onClick={() => openUploadModal(false)}
            className="bg-white hover:bg-zinc-200 text-black font-bold text-xs px-5 py-2.5 rounded-2xl shadow-lg shadow-white/10 active:scale-95 transition-all inline-flex items-center gap-2"
          >
            <Upload className="w-4 h-4 stroke-[2.5]" />
            <span>Upload First Video</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-5 gap-4 sm:gap-6">
          {videos.map((video) => {
            const minutes = Math.floor(video.duration_ms / 60000);
            const seconds = Math.floor((video.duration_ms % 60000) / 1000);
            const durationStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

            return (
              <div
                key={video.id}
                onClick={() => setSelectedVideoId(video.id)}
                className="group cursor-pointer flex flex-col bg-zinc-950 hover:bg-zinc-900 border border-white/10 hover:border-white/25 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl hover:shadow-black"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-black overflow-hidden">
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg shadow-white/20 transform group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 fill-black ml-0.5" />
                    </div>
                  </div>

                  {/* Duration Badge */}
                  <div className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-sm text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/20">
                    {durationStr}
                  </div>

                  {/* Boost Tag */}
                  {video.boost_score > 0 && (
                    <div className="absolute top-2.5 left-2.5 bg-white text-black font-bold text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md">
                      <Rocket className="w-3 h-3" /> Boosted
                    </div>
                  )}
                </div>

                {/* Card Details */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] uppercase font-bold text-white bg-white/10 px-1.5 py-0.5 rounded border border-white/20">
                        {video.category_name}
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {video.views_count.toLocaleString()} views
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-zinc-200 transition-colors">
                      {video.title}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-white text-black font-black text-[10px] flex items-center justify-center overflow-hidden shrink-0">
                        {video.creator_avatar ? (
                          <img src={video.creator_avatar} alt={video.creator_name} className="w-full h-full object-cover" />
                        ) : (
                          video.creator_name?.charAt(0).toUpperCase() || 'B'
                        )}
                      </div>
                      <span className="text-xs text-zinc-400 truncate group-hover:text-zinc-300">
                        {video.creator_name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => handleInlineLike(e, video)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          video.is_liked ? 'text-white' : 'text-zinc-500 hover:text-white'
                        }`}
                        title="Like"
                      >
                        <Heart className={`w-3.5 h-3.5 ${video.is_liked ? 'fill-white' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => handleInlineSave(e, video)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          video.is_saved ? 'text-white' : 'text-zinc-500 hover:text-white'
                        }`}
                        title="Save"
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${video.is_saved ? 'fill-white' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
