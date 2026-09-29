import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Compass,
  Smartphone,
  Plus,
  Shield,
  Wallet,
  Video
} from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab, openUploadModal } = useAuth();

  const navItems = [
    { id: 'feed', label: 'Feed', icon: Compass },
    { id: 'shorts', label: 'Shorts', icon: Smartphone },
    { id: 'upload_action', label: 'Upload', isCenter: true },
    { id: 'rooms', label: 'Rooms', icon: Shield },
    { id: 'wallet', label: 'Wallet', icon: Wallet }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-lg border-t border-white/10 px-2 py-1.5 flex items-center justify-around safe-bottom">
      {navItems.map((item) => {
        if (item.isCenter) {
          return (
            <button
              key="center_upload"
              onClick={() => openUploadModal(false)}
              className="flex flex-col items-center justify-center -mt-5 group"
              title="Upload Video or Short"
            >
              <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg shadow-white/20 group-hover:scale-105 active:scale-95 transition-all border border-white">
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </div>
              <span className="text-[10px] font-bold text-white mt-1">Upload</span>
            </button>
          );
        }

        const Icon = item.icon!;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
              isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.7]'}`} />
            <span className={`text-[10px] mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
