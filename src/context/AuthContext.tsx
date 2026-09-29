import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types.ts';
import { api } from '../api/client.ts';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
  selectedVideoId: string | null;
  setSelectedVideoId: (id: string | null) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  showAuthModal: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  showUploadModal: boolean;
  uploadDefaultIsShort: boolean;
  openUploadModal: (isShort?: boolean) => void;
  closeUploadModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('feed');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDefaultIsShort, setUploadDefaultIsShort] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const refreshUser = async () => {
    try {
      const res = await api.getMe();
      setUser(res.user);
    } catch {
      setUser(null);
    }
  };

  const logout = () => {
    api.logout();
    setUser(null);
    showToast('Signed out successfully.');
  };

  useEffect(() => {
    setLoading(true);
    refreshUser().finally(() => setLoading(false));
  }, []);

  const openUploadModal = (isShort: boolean = false) => {
    setUploadDefaultIsShort(isShort);
    setShowUploadModal(true);
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        loading,
        activeTab,
        setActiveTab,
        refreshUser,
        logout,
        selectedVideoId,
        setSelectedVideoId,
        toastMessage,
        showToast,
        showAuthModal,
        openAuthModal: () => setShowAuthModal(true),
        closeAuthModal: () => setShowAuthModal(false),
        showUploadModal,
        uploadDefaultIsShort,
        openUploadModal,
        closeUploadModal
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
