import React, { useState, useEffect } from 'react';
import { Product } from '../types.ts';
import { api } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  ShoppingBag,
  Zap,
  Download,
  CheckCircle2,
  PlusCircle
} from 'lucide-react';

export const ShopView: React.FC = () => {
  const { user, refreshUser, setActiveTab, showToast } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await api.getProducts();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleBuy = async (product: Product) => {
    if ((user?.available_tokens || 0) < product.price_tokens) {
      showToast(`Insufficient tokens! You need ${product.price_tokens} ⚡ (Have: ${user?.available_tokens || 0})`);
      return;
    }

    setPurchasingId(product.id);
    try {
      await api.buyProduct(product.id);
      await refreshUser();
      await loadProducts();
      showToast(`Entitlement granted! You now own "${product.title}".`);
    } catch (err: any) {
      showToast(`Purchase error: ${err.message}`);
    } finally {
      setPurchasingId(null);
    }
  };

  const handleDownload = async (productId: string, title: string) => {
    try {
      const res = await api.downloadProduct(productId);
      showToast(`Initiating signed download for ${res.file_name}...`);
      const a = document.createElement('a');
      a.href = res.download_url;
      a.download = res.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      showToast(`Download failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto text-white">
      {/* Shop Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-white/10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-bold mb-2">
            <ShoppingBag className="w-3.5 h-3.5" /> Tokenized Builder Economy
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Digital Product Marketplace
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
            Spend earned RiseUp tokens on production boilerplates, agent evaluation test suites, Notion operating systems, and developer design tokens.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('studio')}
          className="bg-white hover:bg-zinc-200 text-black font-bold text-xs px-4 py-2.5 rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-white/10 active:scale-95 shrink-0"
        >
          <PlusCircle className="w-4 h-4" /> Sell Digital Product
        </button>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse bg-zinc-950 rounded-3xl p-5 border border-white/10 space-y-4">
              <div className="aspect-video bg-zinc-900 rounded-2xl" />
              <div className="h-4 bg-zinc-900 rounded w-3/4" />
              <div className="h-3 bg-zinc-900 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-zinc-950 rounded-3xl border border-white/10 p-8 space-y-4 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center mx-auto">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">No Digital Products Listed Yet</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Monetize your boilerplates, evaluation test harnesses, and design systems for RiseUp tokens.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('studio')}
            className="bg-white hover:bg-zinc-200 text-black font-bold text-xs px-5 py-2.5 rounded-2xl shadow-lg shadow-white/10 active:scale-95 transition-all inline-flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" /> List First Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => {
            const isSeller = product.seller_id === user?.id;
            const canDownload = product.is_owned || isSeller;

            return (
              <div
                key={product.id}
                className="bg-zinc-950 border border-white/10 hover:border-white/25 rounded-3xl overflow-hidden flex flex-col justify-between transition-all duration-200 hover:shadow-xl group"
              >
                <div>
                  {/* Cover Image */}
                  <div className="relative aspect-video bg-black overflow-hidden">
                    <img
                      src={product.cover_url || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600'}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-white/20">
                      {product.category_name}
                    </div>

                    {canDownload && (
                      <div className="absolute top-3 right-3 bg-white text-black text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md">
                        <CheckCircle2 className="w-3 h-3" /> Entitled
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={product.seller_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64'}
                        alt={product.seller_name}
                        className="w-5 h-5 rounded-full object-cover border border-white/10"
                      />
                      <span className="text-xs text-zinc-400 font-medium">
                        By {product.seller_name} {isSeller && '(You)'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white group-hover:text-zinc-200 transition-colors line-clamp-2 leading-snug">
                      {product.title}
                    </h3>

                    <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                      {product.description}
                    </p>
                  </div>
                </div>

                {/* Footer Price & Action */}
                <div className="p-5 pt-0 border-t border-white/10 mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-1 text-white font-mono font-bold">
                    <span className="text-lg">{product.price_tokens}</span>
                    <span className="text-xs text-zinc-400">Tokens</span>
                  </div>

                  {canDownload ? (
                    <button
                      onClick={() => handleDownload(product.id, product.title)}
                      className="bg-white hover:bg-zinc-200 text-black font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-white/10 active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBuy(product)}
                      disabled={purchasingId === product.id}
                      className="bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-white/10 active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5 fill-black" />
                      {purchasingId === product.id ? 'Purchasing...' : 'Buy Now'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
