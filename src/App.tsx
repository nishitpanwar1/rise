/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { MobileBottomNav } from './components/MobileBottomNav.tsx';
import { UploadModal } from './components/UploadModal.tsx';
import { VideoPlayerModal } from './components/VideoPlayerModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { FeedView } from './views/FeedView.tsx';
import { IntentView } from './views/IntentView.tsx';
import { ShortsView } from './views/ShortsView.tsx';
import { ShopView } from './views/ShopView.tsx';
import { ArenaView } from './views/ArenaView.tsx';
import { RoomsView } from './views/RoomsView.tsx';
import { DisciplineView } from './views/DisciplineView.tsx';
import { WalletView } from './views/WalletView.tsx';
import { StudioView } from './views/StudioView.tsx';
import { LibraryView } from './views/LibraryView.tsx';
import { NotificationsView } from './views/NotificationsView.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import { SearchView } from './views/SearchView.tsx';

function MainApp() {
  const {
    activeTab,
    selectedVideoId,
    setSelectedVideoId,
    toastMessage,
    showAuthModal,
    closeAuthModal,
    showUploadModal,
    uploadDefaultIsShort,
    closeUploadModal
  } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const renderActiveView = () => {
    switch (activeTab) {
      case 'feed':
        return <FeedView />;
      case 'intent':
        return <IntentView />;
      case 'shorts':
        return <ShortsView />;
      case 'shop':
        return <ShopView />;
      case 'arena':
        return <ArenaView />;
      case 'rooms':
        return <RoomsView />;
      case 'discipline':
        return <DisciplineView />;
      case 'wallet':
        return <WalletView />;
      case 'studio':
      case 'upload':
      case 'live':
        return <StudioView />;
      case 'history':
        return <LibraryView initialTab="history" />;
      case 'liked':
        return <LibraryView initialTab="liked" />;
      case 'saved':
        return <LibraryView initialTab="saved" />;
      case 'notifications':
        return <NotificationsView />;
      case 'settings':
      case 'system':
        return <SettingsView />;
      case 'search':
        return <SearchView query={searchQuery} />;
      default:
        return <FeedView />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-white selection:text-black">
      {/* Top Navbar */}
      <Navbar onSearch={(q) => setSearchQuery(q)} />

      {/* Main Body Layout - Responsive across Mobile, Tablet, Laptop, PC, TV */}
      <div className="flex-1 flex max-w-[1920px] 3xl:max-w-[2560px] w-full mx-auto overflow-hidden">
        {/* Navigation Sidebar (hidden on mobile, visible md+) */}
        <Sidebar />

        {/* Content View Container */}
        <main className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8">
          {renderActiveView()}
        </main>
      </div>

      {/* Mobile Bottom Thumb Bar */}
      <MobileBottomNav />

      {/* Global Upload Video & Shorts Modal */}
      {showUploadModal && (
        <UploadModal
          onClose={closeUploadModal}
          defaultIsShort={uploadDefaultIsShort}
        />
      )}

      {/* Global Video Modal */}
      {selectedVideoId && (
        <VideoPlayerModal
          videoId={selectedVideoId}
          onClose={() => setSelectedVideoId(null)}
        />
      )}

      {/* Auth Modal for Sign in / Sign up */}
      {showAuthModal && (
        <AuthModal onClose={closeAuthModal} />
      )}

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 bg-zinc-950 border border-white/20 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
