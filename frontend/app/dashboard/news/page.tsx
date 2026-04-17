"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, Search, Globe, Calendar, ArrowRight, 
  Leaf, Cloud, Landmark, BarChart3, Binary, RefreshCw,
  ExternalLink, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { newsApi } from "@/lib/api";
import { NewsArticle } from "@/lib/types";

const CATEGORIES = [
  { id: "all", label: "All News", icon: Globe },
  { id: "Farming", label: "Farming", icon: Leaf },
  { id: "Weather", label: "Weather", icon: Cloud },
  { id: "Schemes", label: "Schemes", icon: Landmark },
  { id: "Market", label: "Market", icon: BarChart3 },
  { id: "Technology", label: "Technology", icon: Binary },
];

export default function DashboardNewsPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchNews = useCallback(async (cat = activeCategory, search = searchQuery) => {
    setLoading(true);
    setError(null);
    try {
      const res = await newsApi.getRealTime({
        category: cat === "all" ? undefined : cat,
        search: search || undefined,
        limit: 24,
      });
      setArticles(res.data);
    } catch (err) {
      console.error("Failed to load news", err);
      setError("Unable to fetch latest news. Showing offline records if available.");
      try {
        const fallback = await newsApi.getAll();
        setArticles(fallback.data);
      } catch (e) {}
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchNews();
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-950">
      {/* --- Header & Search Section --- */}
      <div className="bg-emerald-700 dark:bg-emerald-900 pt-12 pb-24 px-4 sm:px-6 relative overflow-hidden">
        {/* Background Patterns */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-400 rounded-full blur-3xl -ml-48 -mb-48" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <Button 
                variant="ghost" 
                onClick={() => router.push("/dashboard")}
                className="text-emerald-50 hover:bg-emerald-600/50 hover:text-white mb-4 -ml-2"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back to Dashboard
              </Button>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
                Agri News Hub <span className="bg-emerald-500 text-[10px] uppercase px-2 py-1 rounded-full border border-emerald-400">Live RSS</span>
              </h1>
              <p className="text-emerald-100 mt-2 text-lg font-medium opacity-90">
                Latest updates from across the agricultural landscape.
              </p>
            </div>

            <div className="relative max-w-md w-full">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-emerald-300" />
              </div>
              <input
                type="text"
                placeholder="Search news, crops, technology..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchNews()}
                className="block w-full pl-11 pr-4 py-3 bg-white/10 border border-emerald-400/30 backdrop-blur-md rounded-2xl text-white placeholder-emerald-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/20 transition-all font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* --- Filters & Content --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 -mt-12 relative z-20 pb-20">
        
        {/* Category Filters */}
        <div className="flex overflow-x-auto pb-4 gap-3 no-scrollbar scroll-smooth">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all shadow-sm whitespace-nowrap border-2 ${
                activeCategory === cat.id
                  ? "bg-white text-emerald-700 border-white ring-4 ring-emerald-500/10 shadow-xl scale-105"
                  : "bg-emerald-50 text-emerald-600 border-emerald-100/50 hover:bg-white hover:border-white dark:bg-gray-900 dark:border-gray-800 dark:text-emerald-400"
              }`}
            >
              <cat.icon className={`w-4 h-4 ${activeCategory === cat.id ? "text-emerald-600" : "text-emerald-400"}`} />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results Info */}
        <div className="flex items-center justify-between mt-8 mb-6">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 font-medium">
            <Globe className="w-4 h-4" />
            <span>Showing {articles.length} latest articles</span>
          </div>
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold hover:underline transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        </div>

        {/* Grid Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-sm border dark:border-gray-800 animate-pulse">
                <div className="h-56 bg-gray-200 dark:bg-gray-800" />
                <div className="p-6 space-y-4">
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/4" />
                  <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full" />
                  </div>
                  <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-xl w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error && articles.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-20 text-center shadow-sm border border-dashed dark:border-gray-800">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-950 rounded-full flex items-center justify-center mx-auto mb-6 transform transition hover:scale-110">
              <Cloud className="w-10 h-10 text-red-400" />
            </div>
            <h3 className="text-2xl font-extrabold text-gray-800 dark:text-white mb-2">Something went wrong</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-8 font-medium">
              We couldn't connect to the news servers. Please check your connection or try again.
            </p>
            <Button onClick={handleRefresh} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-10 py-6 h-auto font-bold shadow-lg shadow-emerald-600/20">
              <RefreshCw className="mr-2 h-5 w-5" /> Try Again
            </Button>
          </div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            <AnimatePresence mode="popLayout">
              {articles.map((article, index) => (
                <motion.div 
                  key={index} 
                  variants={itemVariants}
                  layout
                  className="group"
                >
                  <Card className="h-full bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-2xl hover:shadow-emerald-900/10 transition-all duration-500 rounded-3xl overflow-hidden relative border flex flex-col">
                    {/* Image Area */}
                    <div className="relative h-52 overflow-hidden">
                      <img 
                        src={article.image_url || [
                          "https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=800&q=80",
                          "https://images.unsplash.com/photo-1599839619722-39751411ea63?w=800&q=80",
                          "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&q=80",
                          "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80",
                          "https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=800&q=80",
                          "https://images.unsplash.com/photo-1586771107565-962cbce4e4ba?w=800&q=80"
                        ][index % 6]}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                        <span className="text-white text-xs font-bold flex items-center gap-1">
                          Source: {article.source} <ExternalLink className="w-3 h-3" />
                        </span>
                      </div>
                      <div className="absolute top-4 left-4">
                        <span className="bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-lg">
                          Agri News
                        </span>
                      </div>
                    </div>

                    {/* Content Area */}
                    <CardContent className="p-6 flex-1 flex flex-col">
                      <div className="flex items-center gap-4 text-[11px] font-bold text-gray-400 dark:text-gray-500 mb-4 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-md">
                          <Clock className="w-3 h-3 text-emerald-500" />
                          {new Date(article.published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-md">
                          <Globe className="w-3 h-3 text-blue-400" />
                          {article.source || "RSS Feed"}
                        </span>
                      </div>

                      <h3 className="text-xl font-extrabold text-gray-800 dark:text-gray-100 group-hover:text-emerald-600 transition-colors line-clamp-2 leading-tight mb-3">
                        {article.title}
                      </h3>
                      
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 mb-6 font-medium leading-relaxed">
                        {article.content?.replace(/<[^>]*>?/gm, '') || "No summary available for this article."}
                      </p>

                      <div className="mt-auto pt-6 border-t border-gray-50 dark:border-gray-800">
                        <Button 
                          onClick={() => window.open(article.url, "_blank")}
                          variant="ghost" 
                          className="w-full justify-between hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 px-4 rounded-xl font-bold group/btn transition-all py-6 h-auto border border-transparent hover:border-emerald-100"
                        >
                          <span className="flex items-center gap-2">
                            Read Full Story
                            <ExternalLink className="w-4 h-4 opacity-0 group-hover/btn:opacity-100 -translate-x-2 group-hover/btn:translate-x-0 transition-all" />
                          </span>
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center group-hover/btn:bg-emerald-600 group-hover/btn:text-white transition-colors">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>
    </div>
  );
}
