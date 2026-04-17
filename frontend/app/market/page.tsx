"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { marketApi } from "@/lib/api";
import {
  Search, MapPin, Calendar, ArrowUpDown, Loader2, Frown,
  Filter, ArrowLeft, TrendingUp, LayoutGrid, LayoutList,
  ChevronDown, Building2, Wheat, RefreshCw, BarChart3,
  IndianRupee, Clock,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════
interface MarketPrice {
  id: number;
  state: string;
  district: string;
  taluka: string;
  market: string;
  crop: string;
  min_price: string | number;
  max_price: string | number;
  modal_price: string | number;
  unit: string;
  date: string;
  recorded_at: string;
}

interface DashboardStats {
  total_records: number;
  distinct_districts: number;
  distinct_talukas: number;
  distinct_markets: number;
  distinct_crops: number;
  latest_date: string | null;
}

// ═══════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════
const CROPS_LIST = ["Soybean", "Wheat", "Harbhara", "Vatane", "Rice"];
const STATES_LIST = ["Maharashtra", "Punjab", "Uttar Pradesh", "Madhya Pradesh", "Karnataka", "Rajasthan", "Gujarat"];

const CROP_EMOJIS: Record<string, string> = {
  Soybean: "🫘",
  Wheat: "🌾",
  Harbhara: "🟤",
  Vatane: "🟢",
  Rice: "🍚",
};

const SORT_OPTIONS = [
  { value: "date_desc", label: "Latest Date" },
  { value: "date_asc", label: "Oldest Date" },
  { value: "modal_price_desc", label: "Price: High → Low" },
  { value: "modal_price_asc", label: "Price: Low → High" },
  { value: "max_price_desc", label: "Max Price: High → Low" },
  { value: "min_price_asc", label: "Min Price: Low → High" },
];

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════
function formatPrice(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function priceColor(modal: number): string {
  if (modal >= 5000) return "text-emerald-600 dark:text-emerald-400";
  if (modal >= 3000) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function priceBadgeBg(modal: number): string {
  if (modal >= 5000) return "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-700";
  if (modal >= 3000) return "bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-700";
  return "bg-rose-50 border-rose-200 dark:bg-rose-900/30 dark:border-rose-700";
}

// ═══════════════════════════════════════════════════════════════
//  Component
// ═══════════════════════════════════════════════════════════════
export default function MarketPricesDashboard() {
  // Data
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [districts, setDistricts] = useState<string[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Filters
  const [taluka, setTaluka] = useState("");
  const [crop, setCrop] = useState("");
  const [state, setState] = useState("Maharashtra");
  const [district, setDistrict] = useState("");
  const [date, setDate] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");

  // Debounce ref for taluka search
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Fetch prices ───────────────────────────────────────────
  const fetchPrices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await marketApi.getMarketPrices({
        taluka: taluka || undefined,
        crop: crop || undefined,
        district: district || undefined,
        state: state || undefined,
        date: date || undefined,
        sort_by: sortBy || undefined,
        limit: 200,
      });
      setPrices(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch market prices. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [taluka, crop, district, state, date, sortBy]);

  // ─── Fetch metadata on mount ─────────────────────────────────
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [statsRes, distRes] = await Promise.allSettled([
          marketApi.getStats({ state: state !== "all" ? state : undefined }),
          marketApi.getDistricts({ state: state !== "all" ? state : undefined }),
        ]);
        if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
        if (distRes.status === "fulfilled") setDistricts(distRes.value.data);
      } catch {}
    };
    loadMeta();
  }, [state]);

  // ─── Fetch prices when filters change ─────────────────────────
  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // ─── Debounced taluka input ───────────────────────────────────
  const handleTalukaChange = (val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setTaluka(val);
    }, 400);
  };

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">

      {/* ────── Hero Header ────── */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600" />
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23fff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
          {/* Navigation */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-6 text-sm font-medium bg-white/10 hover:bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-2 tracking-tight">
                India Mandi Prices
              </h1>
              <p className="text-emerald-100 font-medium text-base md:text-lg max-w-xl">
                State-wise daily agricultural market prices from APMC mandis across India
              </p>
            </div>

            {/* Live badge */}
            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm px-5 py-3 rounded-2xl border border-white/20">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400" />
              </span>
              <span className="text-white font-semibold text-sm">Live from AGMARKNET</span>
            </div>
          </div>

          {/* Stats Row */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
              {[
                { icon: Building2, label: "APMC Markets", value: stats.distinct_markets },
                { icon: MapPin, label: "Districts", value: stats.distinct_districts },
                { icon: Wheat, label: "Crops Tracked", value: stats.distinct_crops },
                { icon: Clock, label: "Latest Data", value: stats.latest_date || "—" },
              ].map((s, i) => (
                <div
                  key={i}
                  className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-4 flex items-center gap-3 hover:bg-white/20 transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                    <s.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-extrabold text-xl leading-none">{s.value}</p>
                    <p className="text-emerald-200 text-xs font-medium mt-0.5">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ────── Main Content ────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-6 relative z-10 pb-12">

        {/* ────── Filters Section ────── */}
        <section className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-5 md:p-7 shadow-xl border border-white/40 dark:border-gray-700 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-emerald-600" />
              <span className="font-bold text-gray-800 dark:text-gray-200">Filters</span>
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === "table"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                }`}
                title="Table View"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === "cards"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                }`}
                title="Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              {/* Refresh */}
              <button
                onClick={fetchPrices}
                disabled={loading}
                className="p-2 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
            {/* State Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                State
              </label>
              <select
                id="filter-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer"
              >
                {STATES_LIST.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Taluka Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-emerald-500" />
                Search Taluka
              </label>
              <input
                type="text"
                id="filter-taluka"
                placeholder="e.g. Baramati, Latur..."
                defaultValue=""
                onChange={(e) => handleTalukaChange(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-gray-400"
              />
            </div>

            {/* Crop Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wheat className="w-3.5 h-3.5 text-emerald-500" />
                Crop
              </label>
              <select
                id="filter-crop"
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer"
              >
                <option value="">All Crops</option>
                {CROPS_LIST.map((c) => (
                  <option key={c} value={c}>
                    {CROP_EMOJIS[c] || ""} {c}
                  </option>
                ))}
              </select>
            </div>

            {/* District Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                District
              </label>
              <select
                id="filter-district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer"
              >
                <option value="">All Districts</option>
                {districts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Date Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                Date
              </label>
              <input
                type="date"
                id="filter-date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all cursor-pointer"
              />
            </div>

            {/* Sort */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-500" />
                Sort By
              </label>
              <select
                id="filter-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active filter chips */}
          {(taluka || crop || district || state || date) && (
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              {state && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 rounded-full text-xs font-semibold">
                  State: {state}
                  <button onClick={() => setState("Maharashtra")} className="ml-1 hover:text-green-600">×</button>
                </span>
              )}
              {taluka && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 rounded-full text-xs font-semibold">
                  Taluka: {taluka}
                  <button onClick={() => setTaluka("")} className="ml-1 hover:text-emerald-600">×</button>
                </span>
              )}
              {crop && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 rounded-full text-xs font-semibold">
                  {CROP_EMOJIS[crop]} {crop}
                  <button onClick={() => setCrop("")} className="ml-1 hover:text-amber-600">×</button>
                </span>
              )}
              {district && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded-full text-xs font-semibold">
                  District: {district}
                  <button onClick={() => setDistrict("")} className="ml-1 hover:text-blue-600">×</button>
                </span>
              )}
              {date && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 rounded-full text-xs font-semibold">
                  Date: {date}
                  <button onClick={() => setDate("")} className="ml-1 hover:text-purple-600">×</button>
                </span>
              )}
              <button
                onClick={() => { setTaluka(""); setCrop(""); setDistrict(""); setState("Maharashtra"); setDate(""); setSortBy("date_desc"); }}
                className="text-xs text-gray-500 hover:text-red-500 font-medium transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </section>

        {/* ────── Data Display ────── */}
        <section>
          {loading ? (
            /* Loading State */
            <div className="flex flex-col items-center justify-center py-24">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-200 dark:border-emerald-800" />
                <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-emerald-500 animate-spin" />
              </div>
              <p className="mt-6 text-emerald-700 dark:text-emerald-300 font-semibold animate-pulse">
                Fetching latest market prices...
              </p>
              <p className="text-sm text-gray-400 mt-1">Connecting to Maharashtra APMC data</p>
            </div>
          ) : error ? (
            /* Error State */
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-3xl p-12 text-center">
              <Frown className="w-16 h-16 text-red-400 mx-auto mb-4 opacity-70" />
              <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">
                Oops! Something went wrong
              </h3>
              <p className="text-red-600/80 dark:text-red-300/80 mb-4">{error}</p>
              <button
                onClick={fetchPrices}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full font-medium text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
            </div>
          ) : prices.length === 0 ? (
            /* Empty State */
            <div className="bg-white/60 dark:bg-gray-800/50 backdrop-blur rounded-3xl p-16 text-center border border-dashed border-gray-300 dark:border-gray-700">
              <Search className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-600 dark:text-gray-300 mb-2">
                No Records Found
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Try adjusting your filters or search query.
              </p>
              <button
                onClick={() => { setTaluka(""); setCrop(""); setDistrict(""); setDate(""); }}
                className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-medium text-sm transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : viewMode === "table" ? (
            /* ────── TABLE VIEW ────── */
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              {/* Result count */}
              <div className="px-6 py-4 bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Showing <span className="text-emerald-600 dark:text-emerald-400 font-bold">{prices.length}</span> records
                  </span>
                </div>
                <span className="text-xs text-gray-400">Prices in ₹ per Quintal</span>
              </div>

              {/* Desktop Table */}
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      {["District", "Taluka", "Market (APMC)", "Crop", "Min Price", "Max Price", "Modal Price", "Date"].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((item, idx) => {
                      const modal = typeof item.modal_price === "string" ? parseFloat(item.modal_price) : item.modal_price;
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-gray-50 dark:border-gray-700/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors duration-150 ${
                            idx % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50/50 dark:bg-gray-800/80"
                          }`}
                        >
                          <td className="px-5 py-3.5">
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-gray-400" />
                              <span className="font-medium text-gray-700 dark:text-gray-200">{item.district}</span>
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300 font-medium">
                            {item.taluka}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-gray-800 dark:text-gray-100 font-semibold">{item.market}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold">
                              {CROP_EMOJIS[item.crop] || "🌱"} {item.crop}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-gray-700 dark:text-gray-300">
                            {formatPrice(item.min_price)}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-gray-700 dark:text-gray-300">
                            {formatPrice(item.max_price)}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg border text-sm font-bold ${priceBadgeBg(modal)} ${priceColor(modal)}`}>
                              <IndianRupee className="w-3 h-3" />
                              {formatPrice(item.modal_price).replace("₹", "")}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md font-medium">
                              {item.date}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List (inside table view) */}
              <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
                {prices.map((item) => {
                  const modal = typeof item.modal_price === "string" ? parseFloat(item.modal_price) : item.modal_price;
                  return (
                    <div key={item.id} className="p-4 hover:bg-emerald-50/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-md text-xs font-bold mb-1">
                            {CROP_EMOJIS[item.crop] || "🌱"} {item.crop}
                          </span>
                          <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm">{item.market}</h4>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {item.taluka}, {item.district}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-extrabold ${priceColor(modal)}`}>
                            {formatPrice(item.modal_price)}
                          </p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">/{item.unit}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex gap-3">
                          <span>Min: <b className="text-gray-700 dark:text-gray-300">{formatPrice(item.min_price)}</b></span>
                          <span>Max: <b className="text-gray-700 dark:text-gray-300">{formatPrice(item.max_price)}</b></span>
                        </div>
                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-[11px] font-medium">
                          {item.date}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ────── CARD VIEW ────── */
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Showing <span className="text-emerald-600 dark:text-emerald-400 font-bold">{prices.length}</span> records
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {prices.map((item) => {
                  const modal = typeof item.modal_price === "string" ? parseFloat(item.modal_price) : item.modal_price;
                  return (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg shadow-emerald-900/5 border border-gray-100 dark:border-gray-700 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group relative overflow-hidden"
                    >
                      {/* Decorative corner */}
                      <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-50 dark:bg-emerald-900/20 rounded-bl-[4rem] -z-0 transition-transform group-hover:scale-110" />

                      <div className="relative z-10">
                        {/* Top section */}
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 rounded-lg text-xs font-bold tracking-wider uppercase mb-2">
                              {CROP_EMOJIS[item.crop] || "🌱"} {item.crop}
                            </span>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 leading-tight">
                              {item.market}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {item.taluka}, {item.district}
                            </p>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="mt-4 flex items-end justify-between">
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">Modal Price</p>
                            <p className={`text-3xl font-extrabold ${priceColor(modal)}`}>
                              {formatPrice(item.modal_price)}
                              <span className="text-sm font-medium text-gray-400 ml-1">/{item.unit}</span>
                            </p>
                          </div>
                        </div>

                        {/* Divider */}
                        <hr className="my-3 border-gray-100 dark:border-gray-700" />

                        {/* Min/Max row */}
                        <div className="flex justify-between text-sm">
                          <div className="text-gray-500 dark:text-gray-400">
                            Min: <span className="font-semibold text-gray-700 dark:text-gray-200">{formatPrice(item.min_price)}</span>
                          </div>
                          <div className="text-gray-500 dark:text-gray-400">
                            Max: <span className="font-semibold text-gray-700 dark:text-gray-200">{formatPrice(item.max_price)}</span>
                          </div>
                        </div>

                        {/* Date badge */}
                        <div className="flex justify-end mt-3">
                          <span className="bg-gray-50 dark:bg-gray-700 px-2.5 py-1 rounded-lg text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 font-medium">
                            <Calendar className="w-3 h-3" /> {item.date}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
