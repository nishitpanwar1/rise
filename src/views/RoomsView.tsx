import React, { useState, useEffect } from 'react';
import { Room } from '../types.ts';
import { api } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Shield,
  Flame,
  Users,
  CheckCircle2,
  PlusCircle,
  MessageSquare,
  Send,
  Calendar,
  X
} from 'lucide-react';

export const RoomsView: React.FC = () => {
  const { user, refreshUser, showToast } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [activeRoomDetail, setActiveRoomDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkinNote, setCheckinNote] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');

  const loadRooms = async () => {
    setLoading(true);
    try {
      const data = await api.getRooms();
      setRooms(data);
      if (data.length > 0 && !selectedRoomId) {
        setSelectedRoomId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRoomDetail = async (id: string) => {
    try {
      const detail = await api.getRoom(id);
      setActiveRoomDetail(detail);
    } catch (err) {
      console.error('Failed to load room details:', err);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (selectedRoomId) {
      loadRoomDetail(selectedRoomId);
    }
  }, [selectedRoomId]);

  const handleJoin = async (id: string) => {
    try {
      const res = await api.joinRoom(id);
      showToast(res.message);
      await loadRooms();
      if (selectedRoomId === id) await loadRoomDetail(id);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId) return;

    try {
      const res = await api.checkinRoom(selectedRoomId, checkinNote || 'Daily milestone verified');
      showToast(res.message);
      setCheckinNote('');
      await refreshUser();
      await loadRooms();
      await loadRoomDetail(selectedRoomId);
    } catch (err: any) {
      showToast(`Check-in failed: ${err.message}`);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId || !newMessage.trim()) return;

    try {
      await api.sendRoomMessage(selectedRoomId, newMessage.trim());
      setNewMessage('');
      await loadRoomDetail(selectedRoomId);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    try {
      const res = await api.createRoom(newRoomName.trim(), newRoomDesc.trim());
      showToast('🛡️ Accountability room created!');
      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomDesc('');
      await loadRooms();
      setSelectedRoomId(res.id);
    } catch (err: any) {
      showToast(`Creation failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-white/10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold mb-2">
            <Shield className="w-3.5 h-3.5" /> Peer Accountability &amp; Streaks
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Accountability Rooms
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
            Solitary willpower fails. Commit to daily check-ins with peer builders. Check in every 24 hours to protect your streak.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-white hover:bg-zinc-200 text-black font-bold text-xs px-4 py-2.5 rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-white/10 active:scale-95 shrink-0"
        >
          <PlusCircle className="w-4 h-4" /> Create Room
        </button>
      </div>

      {/* Main Rooms Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List of Rooms (Cols 1 to 5) */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
            Active Rooms ({rooms.length})
          </h3>

          <div className="space-y-2.5">
            {rooms.length === 0 ? (
              <div className="p-8 bg-zinc-950 rounded-3xl border border-white/10 text-center space-y-3">
                <Shield className="w-10 h-10 text-zinc-600 mx-auto" />
                <div>
                  <h4 className="text-sm font-bold text-white">No Accountability Rooms Yet</h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    Create the first sprint room, invite peer builders, and lock in daily check-in habits.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-white hover:bg-zinc-200 text-black font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-white/10 active:scale-95 inline-flex items-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Create First Room
                </button>
              </div>
            ) : (
              rooms.map((room) => {
                const isSelected = selectedRoomId === room.id;
                return (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-white/10 border-white shadow-lg shadow-white/5'
                        : 'bg-zinc-950 border-white/10 hover:bg-zinc-900 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-white line-clamp-1">{room.name}</span>
                      <span className="flex items-center gap-1 font-mono text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded-md border border-white/20 shrink-0">
                        <Flame className="w-3.5 h-3.5 fill-white" />
                        {room.streak_days}d
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                      {room.description}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-white/10">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {room.member_count} members
                      </span>
                      {room.checked_in_today ? (
                        <span className="text-white font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" /> Checked in today
                        </span>
                      ) : room.is_member ? (
                        <span className="text-zinc-200 font-semibold underline">
                          Check-in required!
                        </span>
                      ) : (
                        <span className="text-zinc-400">Click to view</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Active Room Board (Cols 6 to 12) */}
        <div className="lg:col-span-7 bg-zinc-950 border border-white/10 rounded-3xl p-6 flex flex-col justify-between min-h-[500px]">
          {activeRoomDetail ? (
            <div className="space-y-6">
              {/* Room Header Info */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-white">{activeRoomDetail.name}</h2>
                    <span className="text-xs font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded border border-white/20 flex items-center gap-1">
                      <Flame className="w-3 h-3 fill-white" /> {activeRoomDetail.streak_days}-day room streak
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
                    {activeRoomDetail.description}
                  </p>
                </div>

                <button
                  onClick={() => handleJoin(activeRoomDetail.id)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all shrink-0 ${
                    activeRoomDetail.is_member
                      ? 'bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 border border-white/10'
                      : 'bg-white text-black hover:bg-zinc-200'
                  }`}
                >
                  {activeRoomDetail.is_member ? 'Leave Room' : 'Join Room'}
                </button>
              </div>

              {/* Check-in Box */}
              {activeRoomDetail.is_member && (
                <div className="p-4 rounded-2xl bg-zinc-900 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-white" /> Today's Check-in
                    </span>
                    {activeRoomDetail.checked_in_today ? (
                      <span className="text-white font-bold flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded border border-white/20">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" /> Streak Safe (+10 XP)
                      </span>
                    ) : (
                      <span className="text-zinc-300 font-semibold text-[11px]">
                        Pending your verification
                      </span>
                    )}
                  </div>

                  {!activeRoomDetail.checked_in_today ? (
                    <form onSubmit={handleCheckin} className="flex gap-2">
                      <input
                        type="text"
                        value={checkinNote}
                        onChange={(e) => setCheckinNote(e.target.value)}
                        placeholder="What milestone did you build or ship today?..."
                        className="flex-1 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                      />
                      <button
                        type="submit"
                        className="bg-white hover:bg-zinc-200 text-black font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-white/10"
                      >
                        Verify Check-in
                      </button>
                    </form>
                  ) : (
                    <p className="text-xs text-zinc-400 italic">
                      You are checked in for today! Return tomorrow to keep the flame alive.
                    </p>
                  )}
                </div>
              )}

              {/* Check-in History Stream */}
              <div>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                  Recent Check-ins
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {activeRoomDetail.checkins?.length === 0 ? (
                    <p className="text-xs text-zinc-500">No check-ins yet today.</p>
                  ) : (
                    activeRoomDetail.checkins?.map((ck: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <img
                            src={ck.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64'}
                            alt={ck.display_name}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                          <span className="font-semibold text-white">{ck.display_name}</span>
                          <span className="text-zinc-400 truncate max-w-xs">{ck.note}</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono">{ck.day}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Chat Stream */}
              <div className="pt-2 border-t border-white/10">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Room Live Message Board
                </h4>

                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1 mb-3">
                  {activeRoomDetail.messages?.map((msg: any) => (
                    <div key={msg.id} className="text-xs p-2.5 rounded-xl bg-zinc-900 border border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-zinc-200">{msg.display_name}</span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-zinc-300">{msg.body}</p>
                    </div>
                  ))}
                </div>

                {/* Send Message */}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Encourage a fellow builder or post an update..."
                    className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="bg-white hover:bg-zinc-200 disabled:opacity-40 text-black font-bold p-2 rounded-xl transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-3 text-zinc-500">
              <Shield className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-xs max-w-xs">
                {rooms.length === 0
                  ? 'Create an accountability room to start tracking streaks and collaborating with peer builders.'
                  : 'Select a room from the left to view active streaks, verify daily check-ins, and chat.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in text-white">
          <div className="bg-zinc-950 border border-white/15 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Create Accountability Room</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Gather peers around a shared discipline sprint.
            </p>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Room Name
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. #night-owls-indie-sprint"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Mission &amp; Check-in Requirement
                </label>
                <textarea
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  placeholder="e.g. Write code for at least 2 hours every evening before midnight..."
                  rows={3}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 border border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newRoomName.trim()}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                >
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
