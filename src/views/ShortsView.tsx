import React, { useState, useEffect, useRef } from 'react';
import { Video } from '../types.ts';
import { api } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { TipModal } from '../components/TipModal.tsx';
import {
  Heart,
  Bookmark,
  Share2,
  Zap,
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
  Play,
  Pause,
  MessageSquare,
  Smartphone,
  Plus
} from 'lucide-react';

export const ShortsView: React.FC = () => {
  const { user, refreshUser, showToast, openUploadModal } = useAuth();
  const [shorts, setShorts] = useState<Video[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [subTab, setSubTab] = useState<'new' | 'following' | 'challenges'>('new');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showTipModal, setShowTipModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const loadShorts = async () => {
    setLoading(true);
    try {
      const data = await api.getShorts(subTab);
      setShorts(data);
      setCurrentIndex(0);
    } catch (err) {
      console.error('Failed to load shorts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShorts();
  }, [subTab]);

  const currentShort = shorts[currentIndex];

  useEffect(() => {
    if (currentShort) {
      api.reportWatchSession(currentShort.id, 5000, false, 'shorts').then(() => {
        refreshUser();
      }).catch(() => {});
    }
  }, [currentIndex, currentShort]);

  const handleNext = () => {
    if (currentIndex < shorts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleLike = async () => {
    if (!currentShort) return;
    const prevLiked = currentShort.is_liked;
    const prevCount = currentShort.likes_count;

    setShorts((prev) =>
      prev.map((s, idx) =>
        idx === currentIndex
          ? { ...s, is_liked: !prevLiked, likes_count: prevLiked ? prevCount - 1 : prevCount + 1 }
          : s
      )
    );

    try {
      const res = await api.likeVideo(currentShort.id);
      setShorts((prev) =>
        prev.map((s, idx) =>
          idx === currentIndex ? { ...s, is_liked: res.liked, likes_count: res.likes_count } : s
        )
      );
    } catch {
      setShorts((prev) =>
        prev.map((s, idx) =>
          idx === currentIndex ? { ...s, is_liked: prevLiked, likes_count: prevCount } : s
        )
      );
    }
  };

  const handleSave = async () => {
    if (!currentShort) return;
    const prevSaved = currentShort.is_saved;

    setShorts((prev) =>
      prev.map((s, idx) => (idx === currentIndex ? { ...s, is_saved: !prevSaved } : s))
    );

    try {
      const res = await api.saveVideo(currentShort.id);
      setShorts((prev) =>
        prev.map((s, idx) => (idx === currentIndex ? { ...s, is_saved: res.saved } : s))
      );
      showToast(res.saved ? 'Saved to library' : 'Removed from saved');
    } catch {
      setShorts((prev) =>
        prev.map((s, idx) => (idx === currentIndex ? { ...s, is_saved: prevSaved } : s))
      );
    }
  };

  const handleShare = async () => {
    if (!currentShort) return;
    try {
      await api.shareVideo(currentShort.id, 'shorts_copy');
      navigator.clipboard.writeText(window.location.href);
      showToast('🔗 Short link copied to clipboard!');
    } catch {
      showToast('🔗 Link copied');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] pb-16 md:pb-12 text-white">
      {/* Top Bar with Filter Tabs and Upload Short Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 w-full max-w-[420px] px-2">
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-2xl border border-white/10">
          {(['new', 'following', 'challenges'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                subTab === tab
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Prominent Upload Short Button */}
        <button
          onClick={() => openUploadModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all shadow-md shadow-white/10 active:scale-95"
          title="Upload Short"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Upload Short</span>
        </button>
      </div>

      {loading ? (
        <div className="w-[320px] sm:w-[380px] h-[600px] sm:h-[640px] bg-zinc-950 rounded-3xl border border-white/10 flex items-center justify-center animate-pulse">
          <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full" />
        </div>
      ) : !currentShort ? (
        <div className="w-[320px] sm:w-[380px] h-[480px] bg-zinc-950 rounded-3xl border border-white/10 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center">
            <Smartphone className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No Shorts Published Yet</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
              Vertical 9:16 engineering breakdowns and shipping highlights appear here. Earn +10 tokens on publish!
            </p>
          </div>
          <button
            onClick={() => openUploadModal(true)}
            className="bg-white hover:bg-zinc-200 text-black font-bold text-xs px-5 py-2.5 rounded-2xl shadow-lg shadow-white/10 transition-all inline-flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Upload First Short</span>
          </button>
        </div>
      ) : (
        <div className="relative flex items-center gap-3 sm:gap-4">
          {/* Vertical Video Frame (9:16) */}
          <div className="relative w-[320px] sm:w-[380px] h-[580px] sm:h-[640px] bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/15 flex flex-col justify-end">
            <video
              ref={videoRef}
              src={
                currentShort.renditions?.[0]?.path ||
                'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4'
              }
              poster={currentShort.thumbnail_url}
              autoPlay
              loop
              muted={isMuted}
              playsInline
              className="absolute inset-0 w-full h-full object-cover cursor-pointer"
              onClick={() => {
                if (videoRef.current) {
                  if (isPlaying) videoRef.current.pause();
                  else videoRef.current.play();
                  setIsPlaying(!isPlaying);
                }
              }}
            />

            {/* Top Tag and Mute Controls */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
              <span className="bg-black/70 backdrop-blur-md text-white font-mono text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/20">
                {currentShort.category_name}
              </span>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="w-8 h-8 rounded-full bg-black/70 backdrop-blur-md text-white flex items-center justify-center border border-white/20 hover:bg-black transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-zinc-400" /> : <Volume2 className="w-4 h-4 text-white" />}
              </button>
            </div>

            {/* Bottom Gradient Details */}
            <div className="relative z-10 p-5 bg-gradient-to-t from-black via-black/70 to-transparent space-y-2 pointer-events-none">
              <div className="flex items-center gap-2.5 pointer-events-auto">
                <div className="w-8 h-8 rounded-full bg-white text-black font-black text-xs flex items-center justify-center border border-white shrink-0 overflow-hidden">
                  {currentShort.creator_avatar ? (
                    <img src={currentShort.creator_avatar} alt={currentShort.creator_name} className="w-full h-full object-cover" />
                  ) : (
                    currentShort.creator_name?.charAt(0).toUpperCase() || 'B'
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1">
                    {currentShort.creator_name}
                  </h4>
                  <p className="text-[10px] text-zinc-400">@{currentShort.creator_username}</p>
                </div>
              </div>

              <h2 className="text-sm font-bold text-white leading-snug">
                {currentShort.title}
              </h2>
              <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                {currentShort.description}
              </p>
            </div>
          </div>

          {/* Action Column on Right */}
          <div className="flex flex-col gap-3 py-2 items-center">
            {/* Upload Short Icon Button */}
            <button
              onClick={() => openUploadModal(true)}
              className="flex flex-col items-center gap-1 group"
              title="Upload your short"
            >
              <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg shadow-white/10 active:scale-95">
                <Plus className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-[10px] text-zinc-300 font-semibold">Post</span>
            </button>

            {/* Like */}
            <button
              onClick={handleLike}
              className="flex flex-col items-center gap-1 group"
              title="Like"
            >
              <div className="w-11 h-11 rounded-full bg-zinc-900 border border-white/10 text-white flex items-center justify-center transition-transform group-hover:scale-110">
                <Heart
                  className={`w-5 h-5 ${
                    currentShort.is_liked ? 'text-white fill-white' : 'text-zinc-300'
                  }`}
                />
              </div>
              <span className="text-[10px] text-zinc-400 font-mono font-bold">
                {currentShort.likes_count}
              </span>
            </button>

            {/* Tip Tokens */}
            <button
              onClick={() => setShowTipModal(true)}
              className="flex flex-col items-center gap-1 group"
              title="Tip tokens"
            >
              <div className="w-11 h-11 rounded-full bg-zinc-900 border border-white/10 text-white flex items-center justify-center transition-transform group-hover:scale-110">
                <Zap className="w-5 h-5 text-white fill-white" />
              </div>
              <span className="text-[10px] text-zinc-400 font-mono font-bold">Tip</span>
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              className="flex flex-col items-center gap-1 group"
              title="Save to Library"
            >
              <div className="w-11 h-11 rounded-full bg-zinc-900 border border-white/10 text-white flex items-center justify-center transition-transform group-hover:scale-110">
                <Bookmark
                  className={`w-5 h-5 ${
                    currentShort.is_saved ? 'text-white fill-white' : 'text-zinc-300'
                  }`}
                />
              </div>
              <span className="text-[10px] text-zinc-400 font-mono font-bold">Save</span>
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="flex flex-col items-center gap-1 group"
              title="Share"
            >
              <div className="w-11 h-11 rounded-full bg-zinc-900 border border-white/10 text-white flex items-center justify-center transition-transform group-hover:scale-110">
                <Share2 className="w-5 h-5 text-zinc-300" />
              </div>
              <span className="text-[10px] text-zinc-400 font-mono font-bold">Share</span>
            </button>

            {/* Navigation Up / Down */}
            <div className="flex flex-col gap-1.5 mt-2 border-t border-white/10 pt-2">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="w-9 h-9 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors"
                title="Previous Short"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex === shorts.length - 1}
                className="w-9 h-9 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white disabled:opacity-30 flex items-center justify-center transition-colors"
                title="Next Short"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tip Modal */}
      {showTipModal && currentShort && (
        <TipModal
          creatorId={currentShort.creator_id}
          creatorName={currentShort.creator_name}
          videoId={currentShort.id}
          onClose={() => setShowTipModal(false)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
};
