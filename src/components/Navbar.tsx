import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Flame,
  Zap,
  Bell,
  Search,
  Upload,
  LogOut,
  LogIn,
  UserPlus,
  Settings,
  ChevronDown,
  Video as VideoIcon,
  Smartphone
} from 'lucide-react';

interface NavbarProps {
  onSearch: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onSearch }) => {
  const { user, isAuthenticated, logout, setActiveTab, openAuthModal, openUploadModal } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput.trim());
      setActiveTab('search');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-white/10 px-3 sm:px-6 py-2.5">
      <div className="flex items-center justify-between gap-3 max-w-[1920px] mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('feed')}
            className="flex items-center gap-2 group text-left transition-transform active:scale-95"
            title="RiseUp Home"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white text-black flex items-center justify-center shadow-lg shadow-white/10 transition-transform group-hover:scale-105">
              <Flame className="w-5 h-5 fill-black text-black stroke-[2]" />
            </div>
            <div>
              <span className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                RISEUP
                <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/20 hidden sm:inline-block">
                  OS
                </span>
              </span>
            </div>
          </button>
        </div>

        {/* Search Bar - Fluid on TV / PC / Laptop, responsive on mobile */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl relative mx-2">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search videos, shorts, builders, rooms..."
            className="w-full bg-zinc-900 border border-white/10 text-white placeholder-zinc-500 text-xs sm:text-sm rounded-full pl-9 sm:pl-10 pr-4 py-1.5 sm:py-2 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
          />
        </form>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Prominent Upload Button (Always Available) */}
          <div className="relative">
            <button
              onClick={() => setShowUploadMenu(!showUploadMenu)}
              className="flex items-center gap-1.5 bg-white hover:bg-zinc-200 text-black px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-md shadow-white/10 active:scale-95"
              title="Upload Video or Short"
            >
              <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Upload</span>
              <ChevronDown className="w-3 h-3 text-black/70 hidden sm:inline" />
            </button>

            {showUploadMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-zinc-950 border border-white/15 rounded-2xl shadow-2xl py-1.5 z-50 animate-fade-in text-white">
                <button
                  onClick={() => {
                    setShowUploadMenu(false);
                    openUploadModal(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold hover:bg-zinc-900 flex items-center gap-2.5 transition-colors"
                >
                  <VideoIcon className="w-4 h-4 text-white" />
                  <div>
                    <p className="text-white font-bold">16:9 Video</p>
                    <p className="text-[10px] text-zinc-400">Long-form engineering drop</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowUploadMenu(false);
                    openUploadModal(true);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold hover:bg-zinc-900 flex items-center gap-2.5 transition-colors border-t border-white/5"
                >
                  <Smartphone className="w-4 h-4 text-white" />
                  <div>
                    <p className="text-white font-bold">9:16 Short</p>
                    <p className="text-[10px] text-zinc-400">Quick builder insight</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {isAuthenticated && user ? (
            <>
              {/* Tokens Pill */}
              <button
                onClick={() => setActiveTab('wallet')}
                className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-white px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                title="Tokens Wallet"
              >
                <Zap className="w-3.5 h-3.5 fill-white text-white" />
                <span className="font-mono tracking-tight font-bold">{user.available_tokens}</span>
                <span className="hidden md:inline text-zinc-400 text-[11px]">Tokens</span>
              </button>

              {/* Streak Pill */}
              <button
                onClick={() => setActiveTab('discipline')}
                className="hidden sm:flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-white px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                title="Discipline Streak"
              >
                <Flame className="w-3.5 h-3.5 fill-white text-white" />
                <span className="font-mono font-bold">{user.streak_days}d</span>
              </button>

              {/* Notifications */}
              <button
                onClick={() => setActiveTab('notifications')}
                className="relative p-2 text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-full border border-white/10 transition-colors"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {user.unread_notifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-black rounded-full text-[10px] font-bold flex items-center justify-center shadow">
                    {user.unread_notifications}
                  </span>
                )}
              </button>

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-1 pl-2 rounded-full bg-zinc-900 border border-white/10 hover:border-white/30 transition-all"
                >
                  <span className="text-xs font-semibold text-zinc-200 hidden sm:inline max-w-[90px] truncate">
                    {user.display_name}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-white text-black font-black text-xs flex items-center justify-center overflow-hidden">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
                    ) : (
                      user.display_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <ChevronDown className="w-3 h-3 text-zinc-400 mr-1" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-52 bg-zinc-950 border border-white/15 rounded-2xl shadow-2xl py-2 z-50 animate-fade-in text-white">
                    <div className="px-4 py-2 border-b border-white/10 text-xs">
                      <p className="font-bold text-white truncate">{user.display_name}</p>
                      <p className="text-[11px] text-zinc-400 truncate">@{user.username}</p>
                    </div>

                    <button
                      onClick={() => {
                        setActiveTab('studio');
                        setShowUserMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-900 flex items-center gap-2 transition-colors"
                    >
                      <VideoIcon className="w-3.5 h-3.5 text-white" /> Creator Studio
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('settings');
                        setShowUserMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-900 flex items-center gap-2 transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5 text-zinc-400" /> Account Settings
                    </button>

                    <button
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 flex items-center gap-2 transition-colors border-t border-white/5 mt-1"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={openAuthModal}
                className="px-3 py-1.5 rounded-full text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-white/10 transition-colors flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
              <button
                onClick={openAuthModal}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold text-black bg-white hover:bg-zinc-200 transition-all shadow-md shadow-white/10 active:scale-95 flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Join</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
