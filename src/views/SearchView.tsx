import React, { useState, useEffect } from 'react';
import { Video, Product, Room } from '../types.ts';
import { api } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Search, Play, Users, ShoppingBag, Shield } from 'lucide-react';

interface SearchViewProps {
  query: string;
}

export const SearchView: React.FC<SearchViewProps> = ({ query: initialQuery }) => {
  const { setSelectedVideoId, setActiveTab } = useAuth();
  const [queryText, setQueryText] = useState(initialQuery);
  const [results, setResults] = useState<{
    videos: Video[];
    creators: any[];
    products: Product[];
    rooms: Room[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const executeSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const data = await api.search(q.trim());
      setResults(data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      setQueryText(initialQuery);
      executeSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(queryText);
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search videos, creators, products, rooms..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 shadow-xl"
        />
      </form>

      {loading ? (
        <div className="text-center py-16 text-zinc-500">Searching across RiseUp universe...</div>
      ) : !results ? (
        <div className="text-center py-16 text-zinc-500">Enter a query to search.</div>
      ) : (
        <div className="space-y-8">
          {/* Matched Videos */}
          {results.videos.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-amber-400" /> Videos ({results.videos.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.videos.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVideoId(v.id)}
                    className="cursor-pointer bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-2xl p-3 flex gap-3 transition-all group"
                  >
                    <div className="relative w-28 aspect-video bg-zinc-950 rounded-xl overflow-hidden shrink-0">
                      <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-5 h-5 text-amber-400 fill-amber-400" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-amber-400 font-bold uppercase">{v.category_name}</span>
                      <h4 className="text-xs font-bold text-white line-clamp-2 mt-0.5">{v.title}</h4>
                      <p className="text-[11px] text-zinc-500 mt-1 truncate">By {v.creator_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched Creators */}
          {results.creators.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" /> Builders &amp; Creators ({results.creators.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {results.creators.map((c) => (
                  <div key={c.user_id} className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3">
                    <img src={c.avatar_url} alt={c.display_name} className="w-10 h-10 rounded-full object-cover border border-zinc-700" />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{c.display_name}</h4>
                      <p className="text-[11px] text-zinc-400 truncate">@{c.username}</p>
                      <p className="text-[10px] text-amber-400 truncate">{c.focus}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched Products */}
          {results.products.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-purple-400" /> Digital Products ({results.products.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.products.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setActiveTab('shop')}
                    className="cursor-pointer p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-white">{p.title}</h4>
                      <p className="text-[11px] text-zinc-400">By {p.seller_name}</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">
                      {p.price_tokens} ⚡
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched Rooms */}
          {results.rooms.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-orange-400" /> Accountability Rooms ({results.rooms.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.rooms.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setActiveTab('rooms')}
                    className="cursor-pointer p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-white">{r.name}</h4>
                      <p className="text-[11px] text-zinc-400">{r.description}</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-1 rounded-lg">
                      {r.streak_days}d streak
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
