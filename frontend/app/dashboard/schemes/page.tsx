"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { schemesApi } from "@/lib/api";
import { GovernmentScheme } from "@/lib/types";
import { Search, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_ICONS: Record<string, string> = {
  Central: '🏛️', State: '📍', All: '📋',
};

function SchemeSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 h-64 flex flex-col">
      <div className="animate-pulse flex-1">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-3" />
        <div className="h-3 bg-gray-200 rounded w-full mb-1.5" />
        <div className="h-3 bg-gray-200 rounded w-5/6 mb-5" />
        <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-1/3 mb-4" />
      </div>
      <div className="h-10 bg-gray-200 rounded-xl w-full animate-pulse mt-auto" />
    </div>
  );
}

export default function SchemesPage() {
  const router = useRouter();
  const [allSchemes, setAllSchemes] = useState<GovernmentScheme[]>([]);
  const [filtered, setFiltered] = useState<GovernmentScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeLang, setActiveLang] = useState("English");

  const loadSchemes = async () => {
    setLoading(true);
    try {
      const res = await schemesApi.getAll({ limit: 100 });
      setAllSchemes(res.data || []);
      setFiltered(res.data || []);
    } catch (error) {
      console.error("Failed to load schemes", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchemes();
  }, []);

  const applyFilters = useCallback(() => {
    let result = [...allSchemes];

    if (activeCategory !== "All") {
      result = result.filter((s) => s.category === activeCategory);
    }

    if (search.trim()) {
      result = result.filter((s) =>
        s.title?.toLowerCase().includes(search.toLowerCase()) ||
        s.description?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Sort featured (PM Kisan) to top if present
    result.sort((a, b) => {
      const aFeatured = a.title.toLowerCase().includes("pm kisan") ? 1 : 0;
      const bFeatured = b.title.toLowerCase().includes("pm kisan") ? 1 : 0;
      return bFeatured - aFeatured;
    });

    setFiltered(result);
  }, [allSchemes, activeCategory, search]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // UI mapping for mock fields (department & helpline) based on scheme title text
  const getSchemeDetails = (scheme: GovernmentScheme) => {
    const isKisan = scheme.title.toLowerCase().includes("pm kisan");
    const isBima = scheme.title.toLowerCase().includes("bima");
    const isSoil = scheme.title.toLowerCase().includes("soil");

    return {
      isFeatured: isKisan,
      badgeText: isKisan ? "Direct Benefit" : isBima ? "Crop Insurance" : isSoil ? "Soil Testing" : "Support",
      department: "Ministry of Agriculture",
      helpline: isKisan ? "155261" : isBima ? "1800-180-1551" : "1800-180-1551"
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ── Page Header ── */}
      <div className="bg-[#2e7d32] text-white pt-8 pb-10 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <button 
            onClick={() => router.push("/dashboard")}
            className="flex items-center text-green-100 hover:text-white mb-4 text-sm font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
          </button>
          <h1 className="text-3xl sm:text-4xl font-bold mb-1 tracking-tight">Government Schemes</h1>
          <p className="text-green-100 text-lg mb-6 shadow-sm">
            Government schemes for farmers - Get information and apply
          </p>

          {/* Language Toggle */}
          <div className="flex bg-[#3b9f40] rounded-md w-fit p-1 shadow-inner">
            {["English", "हिंदी", "मराठी"].map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveLang(lang)}
                className={`px-6 py-1.5 rounded text-sm font-semibold transition-colors ${
                  activeLang === lang
                    ? "bg-white text-gray-800 shadow"
                    : "text-white hover:bg-white/20"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* ── Search & Filters ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8">
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search schemes by name, department, or keyword..."
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors bg-gray-50"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-sm font-bold text-gray-500 mr-2 uppercase tracking-wide">Filters:</span>
            {["All", "Central", "State"].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all whitespace-nowrap
                  ${activeCategory === cat
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-700"
                  }`}
              >
                {CATEGORY_ICONS[cat]} {cat}
              </button>
            ))}
            <div className="ml-auto text-sm font-medium text-gray-500 hidden sm:block">
              {filtered.length} scheme(s) found
            </div>
          </div>
        </div>

        {/* ── Schemes Grid ── */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => <SchemeSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-xl font-bold text-gray-700">No schemes found</p>
            <p className="text-gray-500 mt-2">Try adjusting your filters or search term.</p>
            <button 
              onClick={() => { setSearch(""); setActiveCategory("All"); }}
              className="mt-4 text-green-600 font-semibold hover:underline"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {filtered.map((scheme) => {
              const details = getSchemeDetails(scheme);
              const headerColors = details.isFeatured 
                ? "bg-orange-500 text-white" 
                : "bg-gray-100 hidden"; // Hide header if not featured to match design

              return (
                <div key={scheme.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col h-full hover:shadow-lg transition-shadow">
                  
                  {/* Top Featured Banner */}
                  {details.isFeatured && (
                    <div className="bg-[#f97316] text-white text-center py-1.5 text-sm font-bold flex items-center justify-center gap-1">
                      ⭐ Featured Scheme
                    </div>
                  )}

                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="text-[17px] font-bold text-[#1e40af] mb-2 leading-tight">
                      {scheme.title}
                    </h3>
                    
                    <div className="mb-3">
                      <span className="inline-block bg-[#dcfce7] text-[#166534] text-xs font-semibold px-2.5 py-1 rounded-sm">
                        {details.badgeText}
                      </span>
                    </div>

                    <p className="text-gray-600 text-sm flex-1 leading-relaxed mb-4">
                      {scheme.description}
                    </p>

                    <div className="space-y-2 mb-6 mt-auto">
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="mr-2 text-gray-400">🏛️</span> 
                        <span className="font-semibold mr-1">Department:</span> {details.department}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="mr-2 text-gray-400">📞</span> 
                        <span className="font-semibold mr-1 text-blue-600">Helpline:</span> 
                        <span className="text-blue-600">{details.helpline}</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => router.push(`/dashboard/schemes/${scheme.id}`)}
                      className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold py-2.5 rounded-lg transition-colors shadow-sm"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
