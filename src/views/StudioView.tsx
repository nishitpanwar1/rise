import React, { useState, useEffect, useRef } from 'react';
import { Video, Category } from '../types.ts';
import { api } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Video as VideoIcon,
  Upload,
  PlusCircle,
  Radio,
  Eye,
  Heart,
  Users,
  Trash2,
  CheckCircle2,
  Sparkles,
  Zap,
  ShoppingBag,
  Camera,
  Layers,
  FileVideo,
  Smartphone,
  RotateCcw,
  Image as ImageIcon
} from 'lucide-react';

export const StudioView: React.FC = () => {
  const { user, activeTab, refreshUser, showToast, setActiveTab } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'upload' | 'sell' | 'live'>('dashboard');
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload Form State
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadCategory, setUploadCategory] = useState('cat-eng');
  const [isShort, setIsShort] = useState(false);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [selectedThumbFile, setSelectedThumbFile] = useState<File | null>(null);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState<string | null>(null);
  const [usingSampleVideo, setUsingSampleVideo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbInputRef = useRef<HTMLInputElement | null>(null);

  // Sell Product Form State
  const [prodTitle, setProdTitle] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('25');
  const [prodCategory, setProdCategory] = useState('cat-saas');
  const [prodFile, setProdFile] = useState<File | null>(null);
  const [isSelling, setIsSelling] = useState(false);

  // Live Stream State
  const [liveTitle, setLiveTitle] = useState('');
  const [liveActive, setLiveActive] = useState(false);
  const [streamKey, setStreamKey] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Automatically select upload subtab if navigated via activeTab === 'upload'
  useEffect(() => {
    if (activeTab === 'upload') {
      setActiveSubTab('upload');
    } else if (activeTab === 'live') {
      setActiveSubTab('live');
    }
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dash, vids, cats] = await Promise.all([
        api.getStudioDashboard(),
        api.getStudioVideos(),
        api.getCategories()
      ]);
      setDashboardData(dash);
      setVideos(vids);
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load studio data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      if (thumbPreviewUrl) URL.revokeObjectURL(thumbPreviewUrl);
    };
  }, [videoPreviewUrl, thumbPreviewUrl]);

  const handleVideoSelect = (file: File) => {
    if (!file.type.startsWith('video/')) {
      showToast('Please select a valid video file');
      return;
    }
    setSelectedVideoFile(file);
    setUsingSampleVideo(false);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(URL.createObjectURL(file));

    if (!uploadTitle.trim()) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      setUploadTitle(cleanName);
    }
  };

  const handleThumbSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file');
      return;
    }
    setSelectedThumbFile(file);
    if (thumbPreviewUrl) URL.revokeObjectURL(thumbPreviewUrl);
    setThumbPreviewUrl(URL.createObjectURL(file));
  };

  const useSampleAsset = () => {
    setSelectedVideoFile(null);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(
      isShort
        ? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4'
        : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    );
    setUsingSampleVideo(true);
    if (!uploadTitle.trim()) {
      setUploadTitle(isShort ? 'Interactive Web Worker Pipelines in 60s' : 'Distributed SQLite Transaction Commits');
    }
    if (!uploadDesc.trim()) {
      setUploadDesc('Technical breakdown of zero-lock transaction guarantees and memory mapping.');
    }
    showToast('Sample builder asset loaded.');
  };

  const handleVideoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      showToast('Video title is required');
      return;
    }
    if (!selectedVideoFile && !usingSampleVideo) {
      showToast('Please select a video file or use sample asset');
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    const formData = new FormData();
    formData.append('title', uploadTitle.trim());
    formData.append('description', uploadDesc.trim());
    formData.append('category_id', uploadCategory);
    formData.append('is_short', isShort ? '1' : '0');

    if (selectedVideoFile) {
      formData.append('video', selectedVideoFile);
    }
    if (selectedThumbFile) {
      formData.append('thumbnail', selectedThumbFile);
    }

    const interval = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 20 : prev));
    }, 350);

    try {
      const res = await api.uploadStudioVideo(formData);
      clearInterval(interval);
      setUploadProgress(100);
      showToast(res.message || 'Video published! +10 tokens granted.');
      await refreshUser();
      await loadData();
      setActiveSubTab('dashboard');
      // Reset form
      setUploadTitle('');
      setUploadDesc('');
      setSelectedVideoFile(null);
      setSelectedThumbFile(null);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
      if (thumbPreviewUrl) URL.revokeObjectURL(thumbPreviewUrl);
      setThumbPreviewUrl(null);
    } catch (err: any) {
      clearInterval(interval);
      showToast(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSellProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodTitle.trim() || !prodDesc.trim()) {
      showToast('Title and description required');
      return;
    }

    setIsSelling(true);
    const formData = new FormData();
    formData.append('title', prodTitle.trim());
    formData.append('description', prodDesc.trim());
    formData.append('price_tokens', prodPrice);
    formData.append('category_id', prodCategory);
    if (prodFile) {
      formData.append('file', prodFile);
    }

    try {
      const res = await api.createProduct(formData);
      showToast(res.message);
      setProdTitle('');
      setProdDesc('');
      setProdFile(null);
      setActiveTab('shop');
    } catch (err: any) {
      showToast(`Failed: ${err.message}`);
    } finally {
      setIsSelling(false);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;
    try {
      await api.deleteStudioVideo(videoId);
      showToast('Video removed from library');
      await loadData();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      setCameraActive(true);
    } catch {
      showToast('Camera access denied or unavailable in this environment.');
    }
  };

  const stopCamera = () => {
    if (videoPreviewRef.current && videoPreviewRef.current.srcObject) {
      const stream = videoPreviewRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoPreviewRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const handleGoLive = async () => {
    try {
      const res = await api.startLiveSession(liveTitle || 'Live Builder Session', '16:9', 'ultra-low');
      setStreamKey(res.stream_key);
      setLiveActive(true);
      showToast('You are now broadcasting live.');
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto text-white">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-zinc-950 border border-white/10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold mb-2">
            <VideoIcon className="w-3.5 h-3.5" /> Creator Studio OS
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Creator Studio &amp; Publishing
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Publish long-form engineering drops, 9:16 Shorts, digital downloads, and host live accountability sessions.
          </p>
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-2xl border border-white/10 shrink-0">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Layers },
            { id: 'upload', label: 'Upload Video', icon: Upload },
            { id: 'sell', label: 'Sell Product', icon: ShoppingBag },
            { id: 'live', label: 'Go Live', icon: Radio }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  active ? 'bg-white text-black shadow-md' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Dashboard Overview */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Analytics Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-zinc-950 border border-white/10 p-5 rounded-3xl space-y-1">
              <span className="text-xs text-zinc-400">Total Views</span>
              <p className="text-2xl font-black text-white font-mono flex items-center gap-2">
                <Eye className="w-4 h-4 text-white" />
                {dashboardData?.total_views?.toLocaleString() || 0}
              </p>
            </div>
            <div className="bg-zinc-950 border border-white/10 p-5 rounded-3xl space-y-1">
              <span className="text-xs text-zinc-400">Total Likes</span>
              <p className="text-2xl font-black text-white font-mono flex items-center gap-2">
                <Heart className="w-4 h-4 text-white" />
                {dashboardData?.total_likes?.toLocaleString() || 0}
              </p>
            </div>
            <div className="bg-zinc-950 border border-white/10 p-5 rounded-3xl space-y-1">
              <span className="text-xs text-zinc-400">Followers</span>
              <p className="text-2xl font-black text-white font-mono flex items-center gap-2">
                <Users className="w-4 h-4 text-white" />
                {dashboardData?.followers_count || 0}
              </p>
            </div>
            <div className="bg-zinc-950 border border-white/10 p-5 rounded-3xl space-y-1">
              <span className="text-xs text-zinc-400">Videos Published</span>
              <p className="text-2xl font-black text-white font-mono flex items-center gap-2">
                <FileVideo className="w-4 h-4 text-white" />
                {dashboardData?.videos_count || 0}
              </p>
            </div>
          </div>

          {/* Videos Table */}
          <div className="bg-zinc-950 border border-white/10 p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Your Uploaded Videos</h3>
              <button
                onClick={() => setActiveSubTab('upload')}
                className="text-xs text-white font-bold hover:underline flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Upload New
              </button>
            </div>

            <div className="divide-y divide-white/5">
              {videos.length === 0 ? (
                <div className="text-center py-10 text-zinc-400 text-xs space-y-3">
                  <p>You haven't uploaded any videos yet. Click below to publish your first drop!</p>
                  <button
                    onClick={() => setActiveSubTab('upload')}
                    className="px-4 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-zinc-200 transition-colors"
                  >
                    Select Video to Upload
                  </button>
                </div>
              ) : (
                videos.map((vid) => (
                  <div key={vid.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={vid.thumbnail_url || 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=120'}
                        alt={vid.title}
                        className="w-16 aspect-video rounded-xl object-cover border border-white/10 shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{vid.title}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                          <span className="text-white font-semibold">{vid.category_name}</span>
                          <span>·</span>
                          <span>{vid.is_short ? 'Short (9:16)' : '16:9'}</span>
                          <span>·</span>
                          <span>{new Date(vid.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right text-xs font-mono hidden sm:block">
                        <p className="text-white font-bold">{vid.views_count.toLocaleString()} views</p>
                        <p className="text-zinc-500">{vid.likes_count} likes</p>
                      </div>

                      <span className="text-[10px] uppercase font-bold text-white bg-white/10 px-2 py-0.5 rounded border border-white/20">
                        Published
                      </span>

                      <button
                        onClick={() => handleDeleteVideo(vid.id)}
                        className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors"
                        title="Delete video"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Upload Video */}
      {activeSubTab === 'upload' && (
        <div className="bg-zinc-950 border border-white/10 p-6 sm:p-8 rounded-3xl max-w-2xl mx-auto space-y-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-white" /> Upload Video or Short
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Select any video file to transcode and publish. Earn <span className="text-white font-bold">+10 tokens</span> on publish!
            </p>
          </div>

          <form onSubmit={handleVideoUpload} className="space-y-5">
            {/* Format Toggle */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Video Format
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsShort(false)}
                  className={`py-2.5 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    !isShort
                      ? 'bg-white text-black border-white shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                  }`}
                >
                  <VideoIcon className="w-4 h-4" />
                  <span>16:9 Standard Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsShort(true)}
                  className={`py-2.5 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    isShort
                      ? 'bg-white text-black border-white shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>9:16 Short</span>
                </button>
              </div>
            </div>

            {/* Video File Dropzone */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Select Video File (MP4, WebM, MOV)
              </label>

              <input
                ref={fileInputRef}
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
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleVideoSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-white bg-zinc-900'
                      : 'border-white/20 hover:border-white/50 bg-zinc-900/40 hover:bg-zinc-900'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center mx-auto mb-3 border border-white/10">
                    <FileVideo className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    Click to select video or drag &amp; drop file here
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                    Choose video file from your computer or phone.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-4 py-2 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors shadow-sm"
                    >
                      Browse Video
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        useSampleAsset();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white font-semibold text-xs border border-white/10 transition-colors"
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
                          {selectedVideoFile ? selectedVideoFile.name : 'Verified Builder Sample Media'}
                        </p>
                        <p className="text-[11px] text-zinc-400 font-mono">
                          {selectedVideoFile
                            ? `${(selectedVideoFile.size / (1024 * 1024)).toFixed(2)} MB`
                            : 'High-speed cloud asset (sample)'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-white/10 transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Change</span>
                    </button>
                  </div>

                  <div
                    className={`relative rounded-2xl overflow-hidden bg-black border border-white/10 mx-auto ${
                      isShort ? 'w-44 aspect-[9/16]' : 'w-full aspect-video'
                    }`}
                  >
                    <video
                      src={videoPreviewUrl}
                      controls
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Metadata Fields */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Video Title <span className="text-white">*</span>
              </label>
              <input
                type="text"
                required
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g. Distributed SQLite Architecture in Pure TypeScript"
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Description &amp; Key Milestones
              </label>
              <textarea
                value={uploadDesc}
                onChange={(e) => setUploadDesc(e.target.value)}
                placeholder="Break down what you shipped, code architecture, or takeaways for other builders..."
                rows={3}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white resize-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Category / Focus
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
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
                    {selectedThumbFile ? selectedThumbFile.name : 'Upload Thumbnail (PNG, JPG)'}
                  </span>
                  <ImageIcon className="w-4 h-4 text-zinc-400 shrink-0 ml-2" />
                </button>
              </div>
            </div>

            {/* Transcoding Progress Bar */}
            {uploading && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs text-zinc-400 font-mono">
                  <span>Transcoding 360p / 720p / 1080p pipeline...</span>
                  <span className="text-white font-bold">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || !uploadTitle.trim() || (!selectedVideoFile && !usingSampleVideo)}
              className="w-full py-3 rounded-2xl text-xs font-bold text-black bg-white hover:bg-zinc-200 disabled:opacity-40 transition-all shadow-lg shadow-white/10 flex items-center justify-center gap-2 active:scale-95"
            >
              <Zap className="w-4 h-4 fill-black" />
              <span>{uploading ? 'Transcoding & Publishing...' : 'Publish Video (+10 Tokens Reward)'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Sell Digital Product */}
      {activeSubTab === 'sell' && (
        <div className="bg-zinc-950 border border-white/10 p-6 rounded-3xl max-w-2xl mx-auto space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-white" /> List Product in Shop
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Monetize code templates, prompt eval suites, Notion boards, or design tokens. Buyers pay tokens directly into your wallet.
            </p>
          </div>

          <form onSubmit={handleSellProduct} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Product Title
              </label>
              <input
                type="text"
                value={prodTitle}
                onChange={(e) => setProdTitle(e.target.value)}
                placeholder="e.g. Distributed Consensus Engine Starter Kit"
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Description &amp; What's Included
              </label>
              <textarea
                value={prodDesc}
                onChange={(e) => setProdDesc(e.target.value)}
                placeholder="Full source code, Docker compose files, test suites, architecture notes..."
                rows={3}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Price (RiseUp Tokens)
                </label>
                <input
                  type="number"
                  min="5"
                  max="1000"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Category
                </label>
                <select
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Deliverable Asset (ZIP, JSON, PDF)
              </label>
              <input
                type="file"
                onChange={(e) => setProdFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-900 file:text-zinc-200 hover:file:bg-zinc-800 cursor-pointer"
              />
            </div>

            <button
              type="submit"
              disabled={isSelling || !prodTitle.trim()}
              className="w-full py-3 rounded-2xl text-xs font-bold text-black bg-white hover:bg-zinc-200 disabled:opacity-50 transition-all shadow-md shadow-white/10 flex items-center justify-center gap-1.5"
            >
              <ShoppingBag className="w-4 h-4" />
              {isSelling ? 'Listing Item...' : 'Publish Product to Shop'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 4: Live Broadcasting */}
      {activeSubTab === 'live' && (
        <div className="bg-zinc-950 border border-white/10 p-6 rounded-3xl max-w-2xl mx-auto space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-white" /> Live Broadcast &amp; Co-Working
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Broadcast live deep-work sessions directly from your browser. Viewers earn learning tokens in real-time.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Session Title
              </label>
              <input
                type="text"
                value={liveTitle}
                onChange={(e) => setLiveTitle(e.target.value)}
                placeholder="e.g. 3-Hour Deep Work: Shipping Async Queue System"
                className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-white"
              />
            </div>

            {/* Camera Preview */}
            <div className="aspect-video w-full bg-black rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center relative">
              <video
                ref={videoPreviewRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              />

              {!cameraActive && (
                <div className="text-center p-6 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 text-white flex items-center justify-center mx-auto">
                    <Camera className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-zinc-400">
                    Camera inactive. Click "Test Camera" below to verify video capture.
                  </p>
                </div>
              )}

              {liveActive && (
                <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  LIVE
                </div>
              )}
            </div>

            <div className="flex gap-3">
              {!cameraActive ? (
                <button
                  onClick={startCamera}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-white border border-white/10 transition-colors"
                >
                  Test Camera &amp; Mic
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 border border-white/10 transition-colors"
                >
                  Turn Off Camera
                </button>
              )}

              <button
                onClick={handleGoLive}
                disabled={liveActive}
                className="flex-1 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-colors shadow-md shadow-white/10 disabled:opacity-50"
              >
                {liveActive ? 'Broadcast in Progress' : 'Start Live Stream'}
              </button>
            </div>

            {streamKey && (
              <div className="p-4 bg-zinc-900 rounded-2xl border border-white/10 space-y-2">
                <span className="text-xs font-bold text-zinc-300">Your Broadcast Stream Key:</span>
                <p className="font-mono text-xs text-white select-all break-all bg-black p-2.5 rounded-xl border border-white/10">
                  {streamKey}
                </p>
                <p className="text-[11px] text-zinc-500">
                  You can also paste this RTMP key into OBS Studio or streaming software.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
