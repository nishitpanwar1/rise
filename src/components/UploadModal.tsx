import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Category } from '../types.ts';
import {
  X,
  Upload,
  Video as VideoIcon,
  Smartphone,
  CheckCircle2,
  FileVideo,
  Image as ImageIcon,
  Zap,
  Play,
  RotateCcw,
  Sparkles,
  LogIn
} from 'lucide-react';

interface UploadModalProps {
  onClose: () => void;
  defaultIsShort?: boolean;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  onClose,
  defaultIsShort = false
}) => {
  const { user, isAuthenticated, refreshUser, showToast, openAuthModal, setActiveTab } = useAuth();
  const [isShort, setIsShort] = useState(defaultIsShort);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('cat-eng');
  const [categories, setCategories] = useState<Category[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const [usingSampleVideo, setUsingSampleVideo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const thumbInputRef = useRef<HTMLInputElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setIsShort(defaultIsShort);
  }, [defaultIsShort]);

  useEffect(() => {
    api.getCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0 && !categoryId) {
        setCategoryId(cats[0].id);
      }
    }).catch(console.error);
  }, []);

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
    };
  }, [videoPreviewUrl, thumbnailPreviewUrl]);

  const handleVideoSelect = (file: File) => {
    if (!file.type.startsWith('video/')) {
      showToast('Please select a valid video file (MP4, WebM, MOV, etc.)');
      return;
    }
    setVideoFile(file);
    setUsingSampleVideo(false);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);

    // Auto-populate title from filename if title is empty
    if (!title.trim()) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      setTitle(cleanName);
    }
  };

  const handleThumbSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file for thumbnail');
      return;
    }
    setThumbnailFile(file);
    if (thumbnailPreviewUrl) URL.revokeObjectURL(thumbnailPreviewUrl);
    const url = URL.createObjectURL(file);
    setThumbnailPreviewUrl(url);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleVideoSelect(e.dataTransfer.files[0]);
    }
  };

  const useSampleAsset = () => {
    setVideoFile(null);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(
      isShort
        ? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4'
        : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    );
    setUsingSampleVideo(true);
    if (!title.trim()) {
      setTitle(isShort ? 'High Performance Vite 6 Architecture in 60s' : 'Distributed SQLite Architecture in Pure TypeScript');
    }
    if (!description.trim()) {
      setDescription(
        isShort
          ? 'Quick breakdown of modern modular bundler pipeline for fast web apps. #webdev #engineering'
          : 'Detailed architectural walkthrough of zero-copy in-memory SQLite transactions with persistent buffer commits.'
      );
    }
    showToast('Ready with verified builder media asset.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please enter a video title');
      return;
    }
    if (!videoFile && !usingSampleVideo) {
      showToast('Please select a video file or click "Use Sample Video"');
      return;
    }

    if (!isAuthenticated) {
      showToast('Please sign in or register to publish your video');
      openAuthModal();
      return;
    }

    setUploading(true);
    setUploadProgress(15);

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('category_id', categoryId);
    formData.append('is_short', isShort ? '1' : '0');

    if (videoFile) {
      formData.append('video', videoFile);
    }
    if (thumbnailFile) {
      formData.append('thumbnail', thumbnailFile);
    }

    const interval = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 15 : prev));
    }, 300);

    try {
      const res = await api.uploadStudioVideo(formData);
      clearInterval(interval);
      setUploadProgress(100);
      showToast(res.message || 'Video published! +10 tokens added to your wallet.');
      await refreshUser();

      setTimeout(() => {
        onClose();
        if (isShort) {
          setActiveTab('shorts');
        } else {
          setActiveTab('feed');
        }
      }, 600);
    } catch (err: any) {
      clearInterval(interval);
      showToast(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/90 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-3xl p-5 sm:p-7 shadow-2xl my-auto text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 transition-colors border border-white/5"
          title="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold mb-2">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Media</span>
            <span className="text-zinc-400">·</span>
            <span className="text-white font-mono">+10 Tokens Reward</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Publish Video or Short
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Choose your video file from your device, choose format, and publish to the global community.
          </p>
        </div>

        {/* Guest Warning Banner */}
        {!isAuthenticated && (
          <div className="mb-5 p-3.5 rounded-2xl bg-zinc-900 border border-white/15 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-white shrink-0" />
              <span className="text-zinc-300">
                You are currently browsing as a guest. Sign in or register to publish and claim tokens.
              </span>
            </div>
            <button
              onClick={openAuthModal}
              className="px-3 py-1.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors shrink-0 flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Format Selector: 16:9 vs 9:16 */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Select Video Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsShort(false)}
                className={`py-3 px-4 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  !isShort
                    ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white hover:border-white/20'
                }`}
              >
                <VideoIcon className="w-4 h-4" />
                <span>16:9 Landscape Video</span>
              </button>
              <button
                type="button"
                onClick={() => setIsShort(true)}
                className={`py-3 px-4 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  isShort
                    ? 'bg-white text-black border-white shadow-lg shadow-white/10'
                    : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white hover:border-white/20'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>9:16 Vertical Short</span>
              </button>
            </div>
          </div>

          {/* Primary Video File Dropzone */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Video File (MP4, WebM, MOV)
            </label>

            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleVideoSelect(e.target.files[0]);
                }
              }}
            />

            {!videoPreviewUrl ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => videoInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-white bg-zinc-900'
                    : 'border-white/20 hover:border-white/50 bg-zinc-900/50 hover:bg-zinc-900'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center mx-auto mb-3 border border-white/10">
                  <FileVideo className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">
                  Click to select video or drag &amp; drop file here
                </h4>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                  Select any video from your phone, laptop, or PC. Automatic transcoding to 360p, 720p, and 1080p.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      videoInputRef.current?.click();
                    }}
                    className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors shadow-sm"
                  >
                    Browse Files
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      useSampleAsset();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 font-semibold text-xs border border-white/10 transition-colors"
                  >
                    Use Sample Video
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-white/15 rounded-3xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {videoFile ? videoFile.name : 'Verified Builder Sample Asset'}
                      </p>
                      <p className="text-[11px] text-zinc-400 font-mono">
                        {videoFile
                          ? `${(videoFile.size / (1024 * 1024)).toFixed(2)} MB · ${videoFile.type || 'video/mp4'}`
                          : 'High-speed cloud asset (sample)'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-white/10 transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Change</span>
                  </button>
                </div>

                {/* Video Preview Player */}
                <div
                  className={`relative rounded-2xl overflow-hidden bg-black border border-white/10 mx-auto ${
                    isShort ? 'w-48 aspect-[9/16]' : 'w-full aspect-video'
                  }`}
                >
                  <video
                    ref={previewVideoRef}
                    src={videoPreviewUrl}
                    controls
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Title and Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Title <span className="text-white">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  isShort
                    ? 'e.g. 3 Quick PostgreSQL Index Optimizations'
                    : 'e.g. Building an Event-Driven Architecture with Zero Dependencies'
                }
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Description &amp; Key Takeaways
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What did you build, what did you learn, or what problem did you solve?"
                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Category / Lane
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white transition-all"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Custom Thumbnail (Optional)
                </label>
                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleThumbSelect(e.target.files[0]);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => thumbInputRef.current?.click()}
                  className="w-full py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition-colors flex items-center justify-between"
                >
                  <span className="truncate">
                    {thumbnailFile ? thumbnailFile.name : 'Select Image (PNG, JPG)'}
                  </span>
                  <ImageIcon className="w-4 h-4 text-zinc-400 shrink-0 ml-2" />
                </button>
              </div>
            </div>
          </div>

          {/* Progress Bar during upload */}
          {uploading && (
            <div className="space-y-1.5 bg-zinc-900/80 p-3 rounded-2xl border border-white/10">
              <div className="flex justify-between text-xs text-zinc-300 font-mono">
                <span>Transcoding renditions (360p, 720p, 1080p)...</span>
                <span className="font-bold text-white">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl text-xs font-bold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || (!videoFile && !usingSampleVideo) || !title.trim()}
              className="flex-[2] py-3 rounded-2xl text-xs font-bold text-black bg-white hover:bg-zinc-200 disabled:opacity-40 transition-all shadow-xl shadow-white/10 flex items-center justify-center gap-2 active:scale-95"
            >
              <Zap className="w-4 h-4 fill-black" />
              <span>
                {uploading
                  ? 'Transcoding & Publishing...'
                  : `Publish ${isShort ? 'Short' : 'Video'} (+10 Tokens)`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
