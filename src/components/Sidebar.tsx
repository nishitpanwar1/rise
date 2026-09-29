import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Compass,
  Target,
  Smartphone,
  ShoppingBag,
  Trophy,
  Shield,
  Activity,
  Wallet,
  Video,
  Upload,
  Radio,
  Clock,
  Heart,
  Bookmark,
  Bell,
  Settings,
  Server,
  LogIn
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, user, isAuthenticated, openAuthModal, openUploadModal } = useAuth();

  const mainNav = [
    { id: 'feed', label: 'Feed', icon: Compass },
    { id: 'intent', label: 'Intent Gateway', icon: Target },
    { id: 'shorts', label: 'Shorts', icon: Smartphone },
    { id: 'shop', label: 'Shop', icon: ShoppingBag },
    { id: 'arena', label: 'Arena', icon: Trophy },
    { id: 'rooms', label: 'Rooms', icon: Shield },
    { id: 'discipline', label: 'Discipline', icon: Activity },
    { id: 'wallet', label: 'Wallet', icon: Wallet }
  ];

  const creatorNav = [
    { id: 'studio', label: 'Studio Dashboard', icon: Video },
    { id: 'upload_modal', label: 'Upload Video / Short', icon: Upload, isAction: true },
    { id: 'live', label: 'Go Live', icon: Radio }
  ];

  const libraryNav = [
    { id: 'history', label: 'History', icon: Clock },
    { id: 'liked', label: 'Liked', icon: Heart },
    { id: 'saved', label: 'Saved', icon: Bookmark },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'system', label: 'Database & Health', icon: Server }
  ];

  return (
    <aside className="hidden md:flex w-16 lg:w-60 bg-black border-r border-white/10 flex-col shrink-0 py-4 px-2 select-none">
      <div className="flex-1 space-y-6 overflow-y-auto scrollbar-none">
        {/* Main Section */}
        <div>
          <div className="hidden lg:block px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Discover
          </div>
          <nav className="space-y-1">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white text-black font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-zinc-400'}`} />
                  <span className="hidden lg:inline truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Creator Section */}
        <div>
          <div className="hidden lg:block px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Creator Suite
          </div>
          <nav className="space-y-1">
            {creatorNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.isAction) {
                      openUploadModal(false);
                    } else {
                      setActiveTab(item.id);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white text-black font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-zinc-400'}`} />
                  <span className="hidden lg:inline truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Library Section */}
        <div>
          <div className="hidden lg:block px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Library
          </div>
          <nav className="space-y-1">
            {libraryNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white text-black font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-zinc-400'}`} />
                  <span className="hidden lg:inline truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Quick Info */}
      <div className="pt-4 border-t border-white/10 hidden lg:block px-2">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white text-black font-black text-xs flex items-center justify-center shrink-0 overflow-hidden">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
              ) : (
                user.display_name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user.display_name}</p>
              <p className="text-[11px] text-zinc-400 font-mono truncate">{user.available_tokens} ⚡ • {user.streak_days}d 🔥</p>
            </div>
          </div>
        ) : (
          <button
            onClick={openAuthModal}
            className="w-full py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-white border border-white/10 flex items-center justify-center gap-1.5 transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" /> Sign In
          </button>
        )}
      </div>
    </aside>
  );
};
