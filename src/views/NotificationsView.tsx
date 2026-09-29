import React, { useState, useEffect } from 'react';
import { NotificationItem } from '../types.ts';
import { api } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Bell,
  CheckCircle,
  Zap,
  Shield,
  UserPlus,
  MessageSquare,
  ShoppingBag
} from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const { refreshUser, showToast, setActiveTab } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifs = async () => {
    setLoading(true);
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifs();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      await refreshUser();
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
      );
      await refreshUser();
      showToast('All notifications marked as read.');
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" /> Notifications Center
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Persisted across server restarts and devices.
          </p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="text-xs font-semibold text-amber-400 hover:underline"
        >
          Mark all as read
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-zinc-900 rounded-2xl border border-zinc-800" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 bg-zinc-950/60 rounded-3xl border border-zinc-900 p-8">
          <p className="text-zinc-400 text-sm">No notifications yet. You are completely caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            let parsedPayload: any = {};
            try {
              parsedPayload = JSON.parse(n.payload || '{}');
            } catch {
              parsedPayload = { message: n.payload };
            }

            const isRead = Boolean(n.read_at);

            return (
              <div
                key={n.id}
                onClick={() => !isRead && handleMarkRead(n.id)}
                className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all cursor-pointer ${
                  isRead
                    ? 'bg-zinc-900/30 border-zinc-850 opacity-70'
                    : 'bg-zinc-900 border-zinc-800 shadow-md border-l-4 border-l-amber-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-amber-400 shrink-0">
                    {n.type === 'tip_received' && <Zap className="w-4 h-4 fill-amber-400" />}
                    {n.type === 'room_checkin_reminder' && <Shield className="w-4 h-4" />}
                    {n.type === 'new_follower' && <UserPlus className="w-4 h-4" />}
                    {n.type === 'new_comment' && <MessageSquare className="w-4 h-4" />}
                    {n.type === 'product_sale' && <ShoppingBag className="w-4 h-4" />}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-white">
                      {parsedPayload.message || 'New activity on your account'}
                    </p>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {!isRead && (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
