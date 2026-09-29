import React, { useState, useEffect, useRef } from 'react';
import { Video, Comment } from '../types.ts';
import { api } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { TipModal } from './TipModal.tsx';
import { BoostModal } from './BoostModal.tsx';
import { ReportModal } from './ReportModal.tsx';
import {
  X,
  Heart,
  Bookmark,
  Share2,
  Zap,
  Rocket,
  MessageSquare,
  AlertTriangle,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Settings as SettingsIcon,
  Send
} from 'lucide-react';

interface VideoPlayerModalProps {
  videoId: string;
  onClose: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ videoId, onClose }) => {
  const { user, refreshUser, showToast } = useAuth();
  const [video, setVideo] = useState<Video | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const watchTimerRef = useRef<number | null>(null);
  const watchAccumulatorRef = useRef<number>(0);

  // Load video details and comments
  const loadData = async () => {
    try {
      const [vData, cData] = await Promise.all([
        api.getVideo(videoId),
        api.getComments(videoId)
      ]);
      setVideo(vData);
      setComments(cData);
    } catch (err) {
      console.error('Failed to load video:', err);
    }
  };

  useEffect(() => {
    loadData();
    watchAccumulatorRef.current = 0;
    watchTimerRef.current = window.setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        watchAccumulatorRef.current += 1000;
        if (watchAccumulatorRef.current % 10000 === 0) {
          api.reportWatchSession(videoId, 10000, false, 'player_modal').then(() => {
            refreshUser();
          }).catch(() => {});
        }
      }
    }, 1000);

    // Keyboard navigation for TV & Desktop
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) videoRef.current.play();
          else videoRef.current.pause();
        }
      } else if (e.key === 'm') {
        setIsMuted((prev) => !prev);
      } else if (e.key === 'f') {
        if (videoRef.current) {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            videoRef.current.requestFullscreen().catch(() => {});
          }
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (watchTimerRef.current) clearInterval(watchTimerRef.current);
      if (watchAccumulatorRef.current % 10000 > 2000) {
        api.reportWatchSession(videoId, watchAccumulatorRef.current % 10000, false, 'player_modal');
      }
    };
  }, [videoId]);

  const handleLike = async () => {
    if (!video) return;
    const prevLiked = video.is_liked;
    const prevCount = video.likes_count;
    setVideo({
      ...video,
      is_liked: !prevLiked,
      likes_count: prevLiked ? prevCount - 1 : prevCount + 1
    });

    try {
      const res = await api.likeVideo(video.id);
      setVideo((curr) => curr ? { ...curr, is_liked: res.liked, likes_count: res.likes_count } : null);
    } catch {
      setVideo((curr) => curr ? { ...curr, is_liked: prevLiked, likes_count: prevCount } : null);
    }
  };

  const handleSave = async () => {
    if (!video) return;
    const prevSaved = video.is_saved;
    setVideo({ ...video, is_saved: !prevSaved });

    try {
      const res = await api.saveVideo(video.id);
      setVideo((curr) => curr ? { ...curr, is_saved: res.saved } : null);
      showToast(res.saved ? 'Saved to your Library' : 'Removed from Saved');
    } catch {
      setVideo((curr) => curr ? { ...curr, is_saved: prevSaved } : null);
    }
  };

  const handleShare = async () => {
    if (!video) return;
    try {
      const res = await api.shareVideo(video.id, 'copy');
      const shareUrl = `${window.location.origin}/?v=${video.id}&ref=${res.share_token}`;
      navigator.clipboard.writeText(shareUrl);
      showToast('Share link copied to clipboard!');
    } catch {
      showToast('Link copied');
    }
  };

  const handleFollow = async () => {
    if (!video) return;
    const prevFollowing = video.is_following;
    setVideo({ ...video, is_following: !prevFollowing });

    try {
      const res = await api.followUser(video.creator_id);
      setVideo((curr) => curr ? { ...curr, is_following: res.following } : null);
      showToast(res.following ? `Following ${video.creator_name}` : `Unfollowed ${video.creator_name}`);
    } catch {
      setVideo((curr) => curr ? { ...curr, is_following: prevFollowing } : null);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !video) return;

    try {
      const created = await api.addComment(video.id, newComment);
      setComments([created, ...comments]);
      setNewComment('');
      setVideo({ ...video, comments_count: video.comments_count + 1 });
      showToast('Comment posted!');
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  if (!video) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md">
        <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  const activeRendition = video.renditions?.find((r) => r.label === selectedQuality) || video.renditions?.[0];
  const videoSrc = activeRendition?.path || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-black/95 backdrop-blur-lg overflow-y-auto text-white animate-fade-in">
      <div className="relative w-full max-w-6xl 2xl:max-w-7xl bg-zinc-950 border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col my-auto max-h-[95vh]">
        {/* Top Close Button */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white flex items-center justify-center border border-white/10 backdrop-blur-md transition-all active:scale-95"
            title="Close Player"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto">
          {/* Main Video & Details (Cols 1 to 8) */}
          <div className="lg:col-span-8 p-4 lg:p-6 border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col">
            {/* Player Container */}
            <div className="relative aspect-video w-full bg-black rounded-2xl overflow-hidden border border-white/10 group shadow-inner">
              <video
                ref={videoRef}
                src={videoSrc}
                poster={video.thumbnail_url}
                autoPlay
                playsInline
                controls
                muted={isMuted}
                className="w-full h-full object-contain"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />

              {/* Quality Selector Badge */}
              <div className="absolute top-3 left-3 z-10">
                <button
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="bg-black/80 hover:bg-black text-white text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border border-white/20 backdrop-blur-md flex items-center gap-1.5 transition-colors"
                >
                  <SettingsIcon className="w-3 h-3 text-white" />
                  <span>{selectedQuality}</span>
                </button>

                {showQualityMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-zinc-950 border border-white/15 rounded-xl p-1 shadow-xl z-20">
                    {['1080p', '720p', '360p'].map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setSelectedQuality(q);
                          setShowQualityMenu(false);
                          showToast(`Switched playback to ${q}`);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-xs font-mono rounded-lg transition-colors ${
                          selectedQuality === q ? 'bg-white text-black font-bold' : 'text-zinc-300 hover:bg-zinc-900'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Video Info Header */}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white bg-white/10 px-2 py-0.5 rounded border border-white/20">
                  {video.category_name}
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  {video.views_count.toLocaleString()} views · {new Date(video.created_at).toLocaleDateString()}
                </span>
                {video.boost_score > 0 && (
                  <span className="text-[10px] font-bold text-white bg-white/15 px-1.5 py-0.5 rounded border border-white/20 flex items-center gap-1">
                    <Rocket className="w-3 h-3" /> Boosted +{video.boost_score}
                  </span>
                )}
              </div>

              <h1 className="text-lg lg:text-xl font-bold text-white tracking-tight leading-snug">
                {video.title}
              </h1>

              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-white/10">
                {/* Creator info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white text-black font-black text-sm flex items-center justify-center border border-white overflow-hidden shrink-0">
                    {video.creator_avatar ? (
                      <img src={video.creator_avatar} alt={video.creator_name} className="w-full h-full object-cover" />
                    ) : (
                      video.creator_name?.charAt(0).toUpperCase() || 'B'
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1">
                      {video.creator_name}
                    </h3>
                    <p className="text-[11px] text-zinc-400">@{video.creator_username}</p>
                  </div>
                  <button
                    onClick={handleFollow}
                    className={`ml-2 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                      video.is_following
                        ? 'bg-zinc-800 text-zinc-300 border border-white/10'
                        : 'bg-white text-black hover:bg-zinc-200'
                    }`}
                  >
                    {video.is_following ? 'Following' : 'Follow'}
                  </button>
                </div>

                {/* Engagement Actions */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={handleLike}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      video.is_liked
                        ? 'bg-white text-black border-white'
                        : 'bg-zinc-900 text-zinc-300 border-white/10 hover:text-white'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${video.is_liked ? 'fill-black' : ''}`} />
                    <span>{video.likes_count}</span>
                  </button>

                  <button
                    onClick={() => setShowTipModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white transition-all"
                  >
                    <Zap className="w-3.5 h-3.5 fill-white" />
                    <span>Tip</span>
                  </button>

                  <button
                    onClick={() => setShowBoostModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white transition-all hidden sm:flex"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    <span>Boost</span>
                  </button>

                  <button
                    onClick={handleSave}
                    className={`p-2 rounded-full border transition-all ${
                      video.is_saved
                        ? 'bg-white text-black border-white'
                        : 'bg-zinc-900 text-zinc-300 border-white/10 hover:text-white'
                    }`}
                    title="Save to Library"
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${video.is_saved ? 'fill-black' : ''}`} />
                  </button>

                  <button
                    onClick={handleShare}
                    className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white transition-all"
                    title="Share Video"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setShowReportModal(true)}
                    className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-500 hover:text-red-400 transition-all"
                    title="Report Content"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Description box */}
              {video.description && (
                <div className="mt-4 p-4 rounded-2xl bg-zinc-900 border border-white/5 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {video.description}
                </div>
              )}
            </div>
          </div>

          {/* Comments Column (Cols 9 to 12) */}
          <div className="lg:col-span-4 p-4 lg:p-6 flex flex-col justify-between bg-zinc-950/80">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-white" />
                  <span>Discussion ({comments.length})</span>
                </h3>
              </div>

              {/* Comments List */}
              <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <div className="text-center py-10 text-xs text-zinc-500">
                    No comments yet. Share your technical feedback or insights!
                  </div>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="text-xs space-y-1 bg-zinc-900/50 p-3 rounded-2xl border border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">@{c.username}</span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed">{c.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Comment Input */}
            <form onSubmit={handleCommentSubmit} className="mt-4 pt-3 border-t border-white/10">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a constructive builder note..."
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="p-2 rounded-xl bg-white hover:bg-zinc-200 text-black disabled:opacity-40 transition-colors"
                >
                  <Send className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Tip Modal */}
      {showTipModal && (
        <TipModal
          creatorId={video.creator_id}
          creatorName={video.creator_name}
          videoId={video.id}
          onClose={() => setShowTipModal(false)}
          onSuccess={() => {}}
        />
      )}

      {/* Boost Modal */}
      {showBoostModal && (
        <BoostModal
          videoId={video.id}
          videoTitle={video.title}
          onClose={() => setShowBoostModal(false)}
          onSuccess={() => {}}
        />
      )}

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          targetType="video"
          targetId={video.id}
          targetTitle={video.title}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
};
