'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Sprout, Cloud, TrendingUp, Users, Scan, FileText,
  Sun, Wind, Droplets, ArrowUp, ArrowDown, Send,
  Upload, CheckCircle, Bell, Menu, X, LogOut,
  Home, Bot, ThumbsUp, MessageSquare, Download,
  ChevronRight, MapPin, Phone, Headphones, User as UserIcon,
  Navigation, RefreshCw, AlertCircle, Thermometer, Eye,
  Image as ImageIcon, Video, Mic, Share2, Bookmark,
  MoreHorizontal, Heart, MessageCircle, Newspaper, Calendar, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  User, WeatherData, MarketPrice, ChatMessage, CommunityPost,
  GovernmentScheme, Notification, DiseaseDetection, NewsArticle
} from '@/lib/types';
import {
  authApi, weatherApi, marketApi, chatApi, communityApi,
  schemesApi, newsApi, notificationsApi, uploadApi, diseaseApi, profileApi, cropApi, API_BASE_URL
} from '@/lib/api';

const languages = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'hi', label: 'हिंदी', short: 'हि' },
  { code: 'ta', label: 'தமிழ்', short: 'த' },
  { code: 'te', label: 'తెలుగు', short: 'తె' },
  { code: 'mr', label: 'मराठी', short: 'म' },
];

const AI_SUGGESTIONS: Record<string, string[]> = {
  en: ['Wheat farming tips', 'How to control pests?', 'Best fertilizer for rice', 'Market prices today'],
  hi: ['गेहूं की खेती कैसे करें?', 'कीट नियंत्रण कैसे करें?', 'धान के लिए सबसे अच्छा खाद', 'आज के बाजार भाव'],
  ta: ['கோதுமை சாகுபடி குறிப்புகள்', 'பூச்சி கட்டுப்பாடு', 'சிறந்த உரம்', 'சந்தை விலைகள்'],
  te: ['గోధుమ సాగు చిట్కాలు', 'పీడకుల నియంత్రణ', 'ఉత్తమ ఎరువు', 'మార్కెట్ ధరలు'],
  mr: ['गहू लागवड टिप्स', 'कीड नियंत्रण कसे करावे?', 'सर्वोत्तम खत', 'आजचे बाजार भाव'],
};



export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [language, setLanguage] = useState('en');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false); // No longer blocks the initial render
  const [dataLoading, setDataLoading] = useState(true); // Background data loading
  const [aiLoading, setAiLoading] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  // Data states
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const weatherIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatImageUrl, setChatImageUrl] = useState<string | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [schemes, setSchemes] = useState<GovernmentScheme[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [diseaseImage, setDiseaseImage] = useState<string | null>(null);
  const [diseaseResult, setDiseaseResult] = useState<DiseaseDetection | null>(null);
  const [selectedCropHint, setSelectedCropHint] = useState<string>('');
  const [isDetectingDisease, setIsDetectingDisease] = useState(false);
  const [postMediaUrl, setPostMediaUrl] = useState<string | null>(null);
  const [postMediaType, setPostMediaType] = useState<'text' | 'image' | 'video'>('text');
  const [isUploading, setIsUploading] = useState(false);
  
  // Instagram-like Community States
  const [postComments, setPostComments] = useState<{ [postId: number]: any[] }>({});
  const [commentInputs, setCommentInputs] = useState<{ [postId: number]: string }>({});
  const [commentLoading, setCommentLoading] = useState<{ [postId: number]: boolean }>({});
  const [shareModalPostId, setShareModalPostId] = useState<number | null>(null);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  // Crop Predictor States
  const [showCropPredictor, setShowCropPredictor] = useState(false);
  const [soilType, setSoilType] = useState('Loamy');
  const [waterLevel, setWaterLevel] = useState('Moderate');
  const [cropPrediction, setCropPrediction] = useState<any>(null);
  const [predictingCrop, setPredictingCrop] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      router.replace('/login');
      return;
    }

    // ── STEP 1: Load from localStorage IMMEDIATELY (no loading state) ──
    const savedLang = localStorage.getItem('language');
    if (savedLang) setLanguage(savedLang);

    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        if (!savedLang && parsedUser.language) setLanguage(parsedUser.language);
      } catch (e) { /* stale cache */ }
    }

    // ── STEP 2: Background refresh (non-blocking) ──
    initializeDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── GPS Weather fetch ────────────────────────────────────────────
  const fetchWeather = useCallback(async (lat?: number, lon?: number) => {
    setWeatherLoading(true);
    try {
      const params = lat !== undefined && lon !== undefined
        ? { lat, lon }
        : { location: 'Pune' };
      const res = await weatherApi.getCurrent(params);
      setWeather(res.data);
      setLastUpdated(new Date());
    } catch (e) {
      // silently fail — keep stale weather data
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  const requestGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      fetchWeather();
      return;
    }
    setGpsStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setGpsCoords({ lat, lon });
        setGpsStatus('granted');
        fetchWeather(lat, lon);
      },
      (_err) => {
        setGpsStatus('denied');
        fetchWeather(); // fallback to default location
        toast('Location access denied. Showing default weather.', { icon: '📍' });
      },
      { enableHighAccuracy: false, timeout: 5000 } // Reduced timeout: 5s (was 10s)
    );
  }, [fetchWeather]);

  const initializeDashboard = async () => {
    // Run auth refresh + data load + GPS in parallel (non-blocking)
    const authRefresh = authApi.getMe()
      .then((userRes) => {
        setUser(userRes.data);
        localStorage.setItem('user', JSON.stringify(userRes.data));
      })
      .catch(() => {
        // If token is completely invalid (not just slow), check cached user
        const cached = localStorage.getItem('user');
        if (!cached) {
          localStorage.removeItem('token');
          router.replace('/login');
        }
      });

    // Start GPS immediately — doesn't need to wait for auth
    requestGPS();

    // Load dashboard data + auth refresh in parallel
    await Promise.all([authRefresh, loadDashboardData()]);
    setDataLoading(false);
  };

  // Auto-refresh weather every 5 minutes
  useEffect(() => {
    if (gpsStatus === 'granted' && gpsCoords) {
      weatherIntervalRef.current = setInterval(() => {
        fetchWeather(gpsCoords.lat, gpsCoords.lon);
      }, 5 * 60 * 1000);
    } else if (gpsStatus === 'denied') {
      weatherIntervalRef.current = setInterval(() => {
        fetchWeather();
      }, 5 * 60 * 1000);
    }
    return () => {
      if (weatherIntervalRef.current) clearInterval(weatherIntervalRef.current);
    };
  }, [gpsStatus, gpsCoords, fetchWeather]);

  const loadDashboardData = async () => {
    try {
      const [marketRes, postsRes, schemesRes, newsRes] = await Promise.allSettled([
        marketApi.getPrices(),
        communityApi.getPosts(),
        schemesApi.getAll(),
        newsApi.getAll(),
      ]);

      if (marketRes.status === 'fulfilled') setMarketPrices(marketRes.value.data);
      if (postsRes.status === 'fulfilled') setPosts(postsRes.value.data.posts || []);
      if (schemesRes.status === 'fulfilled') setSchemes(schemesRes.value.data);
      if (newsRes.status === 'fulfilled') setNews(newsRes.value.data);

      // Notifications require auth, fetch separately
      try {
        const notifRes = await notificationsApi.getAll();
        setNotifications(notifRes.data);
      } catch (e) {
        // Notifications may fail if not fully authenticated
      }
    } catch (error) {
      toast.error('Failed to load dashboard data');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const handleLanguageChange = (code: string) => {
    setLanguage(code);
    localStorage.setItem('language', code);
    setLangDropdownOpen(false);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() && !chatImageUrl) return;

    const currentInput = chatInput.trim() || 'Analyze this image:';
    const currentImageUrl = chatImageUrl;

    const userMsg: ChatMessage = {
      id: Date.now(),
      type: 'user',
      content: currentInput,
      image_url: currentImageUrl || undefined,
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatImageUrl(null);
    setAiLoading(true);

    try {
      const response = await chatApi.sendMessage(currentInput, language as any, currentImageUrl || undefined);
      const aiMsg: ChatMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: response.data.response,
        created_at: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      toast.error('Failed to get AI response');
    } finally {
      setAiLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const response = await uploadApi.uploadFile(file);
      setDiseaseImage(response.data.url);
      setDiseaseResult(null);
    } catch (error) {
      toast.error('Failed to upload image');
    }
  };

  const handleCropPrediction = async () => {
    setPredictingCrop(true);
    try {
      // Create mock 15-day history based on current weather +- some variance
      const currentTemp = weather?.temperature || 28;
      const currentHum = weather?.humidity || 65;
      
      const tempHistory = Array.from({length: 15}, () => Math.max(10, Math.min(50, Number(currentTemp) + (Math.random() * 6 - 3))));
      const humHistory = Array.from({length: 15}, () => Math.max(20, Math.min(100, Number(currentHum) + (Math.random() * 20 - 10))));

      const res = await cropApi.predict({
        soil_type: soilType,
        water_level: waterLevel,
        temperature_history: tempHistory,
        humidity_history: humHistory
      });
      setCropPrediction(res.data);
      toast.success("AI prediction complete!");
    } catch (e) {
      toast.error('Failed to get crop prediction. Using fallback.');
      setCropPrediction({
        recommended_crop: "Wheat or Mustard",
        reasoning: "Fallback recommendation.",
        best_practices: "Monitor conditions."
      });
    } finally {
      setPredictingCrop(false);
    }
  };

  const handleDiseaseDetect = async () => {
    if (!diseaseImage) return;

    setIsDetectingDisease(true);
    try {
      const response = await diseaseApi.detect(diseaseImage, selectedCropHint || undefined);
      setDiseaseResult(response.data);
    } catch (error) {
      toast.error('Failed to detect disease');
    } finally {
      setIsDetectingDisease(false);
    }
  };

  const handlePostMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await uploadApi.uploadFile(file);
      setPostMediaUrl(response.data.url);
      
      const fileType = file.type;
      if (fileType.startsWith('image/')) setPostMediaType('image');
      else if (fileType.startsWith('video/')) setPostMediaType('video');
      else if (fileType.startsWith('audio/')) setPostMediaType('video'); // audio treated as video type
      else setPostMediaType('text');
      
      toast.success('Media uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload media');
    } finally {
      setIsUploading(false);
    }
  };

  const loadComments = async (postId: number) => {
    // Toggle off if already loaded
    if (postComments[postId]) {
      const newComments = { ...postComments };
      delete newComments[postId];
      setPostComments(newComments);
      return;
    }
    
    try {
      const res = await communityApi.getComments(postId);
      setPostComments(prev => ({ ...prev, [postId]: res.data }));
    } catch {
      toast.error('Failed to load comments');
    }
  };

  const handleAiSuggestPost = async () => {
    setIsAiSuggesting(true);
    try {
      const response = await chatApi.sendMessage(
        `Please write a short, engaging farming community post. Keep it very brief, include a farming emoji and a couple of relevant hashtags at the end. Language: ${language}. Do not include any greeting or conversational filler like 'Here is your post:'`,
        language as any
      );
      const textarea = document.getElementById('new-post-input') as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = response.data.response || '';
      }
      toast.success("AI generated content!");
    } catch (error) {
      toast.error("AI couldn't generate a suggestion right now.");
    } finally {
      setIsAiSuggesting(false);
    }
  };

  const submitComment = async (postId: number) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    setCommentLoading(prev => ({ ...prev, [postId]: true }));
    try {
      await communityApi.addComment(postId, text);
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      
      // Refresh comments and post count
      const commRes = await communityApi.getComments(postId);
      setPostComments(prev => ({ ...prev, [postId]: commRes.data }));
      
      setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p
      ));
      toast.success('Comment posted');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setCommentLoading(prev => ({ ...prev, [postId]: false }));
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'weather', label: 'Weather', icon: Cloud },
    { id: 'market', label: 'Market Prices', icon: TrendingUp },
    { id: 'ai', label: 'AI Assistant', icon: Bot },
    { id: 'news', label: 'Agri News', icon: Newspaper },
    { id: 'disease', label: 'Disease Detection', icon: Scan },
    { id: 'community', label: 'Community', icon: Users },
    { id: 'schemes', label: 'Govt Schemes', icon: FileText },
    { id: 'profile', label: 'My Profile', icon: UserIcon },
  ];

  // Skeleton card component for loading state
  const SkeletonCard = () => (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="skeleton skeleton-card mb-3" />
      <div className="skeleton skeleton-text w-3/4" />
      <div className="skeleton skeleton-text w-1/2" />
    </div>
  );

  const SkeletonStat = () => (
    <div className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
      <div className="skeleton w-10 h-10 rounded-lg" />
      <div className="flex-1">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-text w-1/3" />
      </div>
    </div>
  );

  // No full-screen loading block — dashboard renders immediately from cache

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-krishi-green rounded-lg flex items-center justify-center">
                <Sprout className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg font-display text-krishi-dark hidden sm:block">
                Digital Krishi
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Selector - Dropdown */}
            <div className="relative">
              <button
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-medium transition-all"
              >
                <span className="text-xs">{languages.find(l => l.code === language)?.label || 'English'}</span>
                <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {langDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLangDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in slide-in-from-top-2">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${language === lang.code
                          ? 'bg-krishi-green/10 text-krishi-green font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        <span className="font-medium">{lang.label}</span>
                        {language === lang.code && (
                          <svg className="w-4 h-4 ml-auto text-krishi-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Button>

            {/* User */}
            <div className="flex items-center gap-2">
              <button onClick={() => router.push('/dashboard/profile')} className="w-8 h-8 bg-krishi-green rounded-full flex items-center justify-center text-white font-medium hover:ring-2 hover:ring-krishi-green/30 transition-all">
                {user?.name?.[0] || 'U'}
              </button>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r transform transition-transform duration-300 lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
        >
          <div className="h-full flex flex-col">
            <div className="p-4 border-b lg:hidden">
              <div className="flex items-center justify-between">
                <span className="font-bold text-lg font-display">Digital Krishi</span>
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <nav className="flex-1 py-4 px-3 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'market') {
                        router.push('/market');
                        setSidebarOpen(false);
                        return;
                      }
                      if (item.id === 'profile') {
                        router.push('/dashboard/profile');
                        setSidebarOpen(false);
                        return;
                      }
                      if (item.id === 'news') {
                        router.push('/dashboard/news');
                        setSidebarOpen(false);
                        return;
                      }
                      if (item.id === 'schemes') {
                        router.push('/dashboard/schemes');
                        setSidebarOpen(false);
                        return;
                      }
                      if (item.id === 'dashboard') {
                        setActiveTab('dashboard');
                        setSidebarOpen(false);
                        router.push('/dashboard');
                        return;
                      }

                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === item.id ? 'bg-krishi-green text-white' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t">
              <div className="bg-krishi-sand rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Headphones className="w-5 h-5 text-krishi-green" />
                  <span className="font-medium text-sm">Talk to Expert</span>
                </div>
                <p className="text-xs text-gray-600 mb-3">Get help from agricultural experts</p>
                <Button size="sm" className="w-full bg-krishi-green hover:bg-krishi-dark">
                  <Phone className="w-4 h-4 mr-1" />
                  Call Now
                </Button>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-hidden">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Welcome Banner */}
              <div className="bg-gradient-to-r from-krishi-green to-krishi-green-light rounded-2xl p-6 text-white">
                <h1 className="text-2xl font-bold font-display mb-2">
                  Welcome back, {user?.name || 'Farmer'}! 👋
                </h1>
                <p className="text-white/80">Here are your farming insights and updates for today</p>
              </div>

              {/* Quick Stats — show skeleton while loading, real data once ready */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {dataLoading ? (
                  [0, 1, 2, 3].map(i => <SkeletonStat key={i} />)
                ) : (
                  [
                    { label: 'Weather', value: `${weather?.temperature || '—'}°C`, icon: Sun, color: 'text-yellow-500', bg: 'bg-yellow-50' },
                    { label: 'Market', value: '+2.5%', icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50' },
                    { label: 'Community', value: posts.length.toString(), icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Schemes', value: schemes.length.toString(), icon: FileText, color: 'text-purple-500', bg: 'bg-purple-50' },
                  ].map((stat, idx) => (
                    <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center`}>
                            <stat.icon className={`w-5 h-5 ${stat.color}`} />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{stat.value}</p>
                            <p className="text-xs text-gray-500">{stat.label}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>


              {/* Main Grid */}
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Best Crop Suggestion */}
                <div className="lg:col-span-2">
                  <Card className="border-0 shadow-lg h-[500px] flex flex-col overflow-hidden relative group rounded-3xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-krishi-green/5 via-krishi-lime/5 to-emerald-500/10 group-hover:scale-105 transition-transform duration-700" />
                    <CardHeader className="bg-gradient-to-r from-krishi-green to-krishi-green-light text-white z-10 relative py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                          <Sprout className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl">Best Crop Suggestion</CardTitle>
                          <p className="text-xs text-white/90 font-medium mt-0.5">Real-time dynamic recommendation based on your localized weather</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-6 sm:p-8 z-10 relative justify-center bg-white/40 backdrop-blur-sm overflow-hidden">
                      {weatherLoading ? (
                         <div className="flex flex-col items-center justify-center space-y-4">
                            <span className="relative flex h-14 w-14 items-center justify-center">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-krishi-green opacity-20"></span>
                              <RefreshCw className="w-8 h-8 animate-spin text-krishi-green relative" />
                            </span>
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Analyzing Data...</p>
                         </div>
                      ) : showCropPredictor ? (
                         <div className="w-full flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto pr-2 custom-scrollbar">
                             <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-800">Advanced AI Predictor</h3>
                                <Button variant="ghost" size="sm" onClick={() => setShowCropPredictor(false)} className="text-gray-500 hover:text-gray-700">Back</Button>
                             </div>
                             
                             <div className="grid grid-cols-2 gap-4 mb-4">
                               <div className="space-y-1">
                                 <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Soil Type</label>
                                 <select className="w-full border-2 border-gray-100 rounded-xl p-2.5 text-sm font-medium focus:border-krishi-green focus:ring-0 outline-none text-gray-700 bg-white shadow-sm" value={soilType} onChange={(e) => setSoilType(e.target.value)}>
                                   <option value="Loamy">🌱 Loamy</option>
                                   <option value="Clay">🧱 Clay</option>
                                   <option value="Sandy">🏖️ Sandy</option>
                                   <option value="Black Soil">🌑 Black Soil</option>
                                   <option value="Alluvial">🌊 Alluvial</option>
                                 </select>
                               </div>
                               <div className="space-y-1">
                                 <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Water Level</label>
                                 <select className="w-full border-2 border-gray-100 rounded-xl p-2.5 text-sm font-medium focus:border-krishi-green focus:ring-0 outline-none text-gray-700 bg-white shadow-sm" value={waterLevel} onChange={(e) => setWaterLevel(e.target.value)}>
                                   <option value="High">🌊 High (Abundant)</option>
                                   <option value="Moderate">💧 Moderate (Average)</option>
                                   <option value="Low">🏜️ Low (Scarce)</option>
                                 </select>
                               </div>
                             </div>
                             
                             <Button onClick={handleCropPrediction} disabled={predictingCrop} className="w-full bg-krishi-green hover:bg-emerald-600 text-white rounded-xl py-6 shadow-md mb-6 font-bold text-md transition-all">
                               {predictingCrop ? <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Analyzing 15-Day Data...</> : <><Bot className="w-6 h-6 mr-2" /> Generate AI Suggestion</>}
                             </Button>

                             {cropPrediction && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-5 sm:p-6 rounded-[1.5rem] shadow-xl border border-krishi-green/30 flex-1 flex flex-col relative overflow-hidden group">
                                   <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-krishi-green/10 to-transparent rounded-bl-full pointer-events-none" />
                                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5"><Scan className="w-3.5 h-3.5 text-krishi-green" /> AI Recommended Crop</p>
                                   <h3 className="text-3xl font-black text-krishi-dark mb-4 bg-gradient-to-r from-krishi-dark to-emerald-600 bg-clip-text text-transparent">{cropPrediction.recommended_crop}</h3>
                                   <div className="space-y-3 relative z-10">
                                     <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl text-sm text-gray-600 leading-relaxed shadow-sm">
                                        <div className="flex items-center gap-2 mb-1.5"><AlertCircle className="w-4 h-4 text-amber-500" /><strong className="text-gray-800 font-bold">Why this crop?</strong></div>
                                        {cropPrediction.reasoning}
                                     </div>
                                     <div className="bg-krishi-green/5 border border-krishi-green/20 p-3.5 rounded-xl text-sm text-gray-700 leading-relaxed shadow-sm">
                                        <div className="flex items-center gap-2 mb-1.5"><CheckCircle className="w-4 h-4 text-emerald-500" /><strong className="text-krishi-dark font-bold">Best Practices</strong></div>
                                        {cropPrediction.best_practices}
                                     </div>
                                   </div>
                                </motion.div>
                             )}
                         </div>
                      ) : (
                         <div className="space-y-6 flex flex-col items-center text-center w-full">
                            <div className="flex gap-4 sm:gap-6 w-full max-w-sm mx-auto">
                              <div className="flex flex-col items-center justify-center bg-white h-28 rounded-[1.5rem] shadow-sm border border-gray-100 flex-1 hover:-translate-y-1 transition-transform">
                                <Thermometer className="w-7 h-7 text-orange-500 mb-2" />
                                <span className="text-2xl font-black text-gray-800 leading-none">{weather?.temperature || 28}°C</span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Temp</span>
                              </div>
                              <div className="flex flex-col items-center justify-center bg-white h-28 rounded-[1.5rem] shadow-sm border border-gray-100 flex-1 hover:-translate-y-1 transition-transform">
                                <Droplets className="w-7 h-7 text-blue-500 mb-2" />
                                <span className="text-2xl font-black text-gray-800 leading-none">{weather?.humidity || 65}%</span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Humidity</span>
                              </div>
                            </div>
                            
                            <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-xl border border-krishi-green/20 w-full max-w-xl hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 mx-auto group/crop relative overflow-hidden">
                               <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-krishi-green to-emerald-400 opacity-80" />
                               <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Quick Recommendation</p>
                               <h3 className="text-3xl sm:text-4xl font-black bg-gradient-to-br from-green-600 to-emerald-500 bg-clip-text text-transparent mb-3 py-1">
                                  {Number(weather?.temperature || 28) > 30 ? 'Cotton or Maize' : Number(weather?.temperature || 28) < 20 ? 'Wheat or Mustard' : 'Rice or Soyabean'}
                               </h3>
                               <p className="text-gray-500 font-medium text-xs sm:text-[14px] leading-relaxed max-w-md mx-auto mb-5">
                                 {Number(weather?.temperature || 28) > 30 
                                     ? "Current high temperatures and humidity levels make it ideal to focus on heat-tolerant crops to maximize yield." 
                                     : Number(weather?.temperature || 28) < 20 
                                     ? "Cooler patterns detected. Perfect for rabi crops requiring less irrigation and lower baseline temperatures." 
                                     : "Optimal moderate climate detected. Great conditions for water-intensive staple crops."}
                               </p>
                               <Button onClick={() => setShowCropPredictor(true)} variant="outline" className="rounded-full w-full border-krishi-green text-krishi-dark hover:bg-krishi-green hover:text-white font-bold transition-all shadow-sm">
                                 <Scan className="w-4 h-4 mr-2" /> Detailed 15-Day AI Predictor
                               </Button>
                            </div>
                         </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Weather & Market */}
                <div className="space-y-6">
                  {/* Weather Widget */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-5 h-5 text-krishi-green" />
                        <CardTitle className="text-lg">Weather</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-4xl font-bold">{weather?.temperature || 28}°C</p>
                          <p className="text-gray-600">{weather?.condition || 'Partly Cloudy'}</p>
                        </div>
                        <Sun className="w-12 h-12 text-yellow-500" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <Droplets className="w-5 h-5 mx-auto text-blue-500 mb-1" />
                          <p className="text-sm font-medium">{weather?.humidity || 65}%</p>
                          <p className="text-xs text-gray-500">Humidity</p>
                        </div>
                        <div>
                          <Wind className="w-5 h-5 mx-auto text-gray-500 mb-1" />
                          <p className="text-sm font-medium">{weather?.wind_speed || 12} km/h</p>
                          <p className="text-xs text-gray-500">Wind</p>
                        </div>
                        <div>
                          <Cloud className="w-5 h-5 mx-auto text-blue-400 mb-1" />
                          <p className="text-sm font-medium">{weather?.condition?.toLowerCase().includes('rain') ? '80%' : '10%'}</p>
                          <p className="text-xs text-gray-500">Rain</p>
                        </div>
                      </div>

                      {weather?.water_level_suggestion && (
                        <div className="mt-5 pt-5 border-t space-y-3">
                          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-start gap-3">
                            <div className="mt-0.5 bg-blue-100 flex items-center justify-center w-6 h-6 rounded-full shrink-0">
                              <Droplets className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-blue-800 uppercase tracking-tight mb-0.5">Water Management</p>
                              <p className="text-xs text-blue-900 leading-snug">{weather.water_level_suggestion}</p>
                            </div>
                          </div>
                          <div className="bg-green-50 p-3 rounded-xl border border-green-100 flex items-start gap-3">
                            <div className="mt-0.5 bg-green-100 flex items-center justify-center w-6 h-6 rounded-full shrink-0">
                              <Sprout className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-green-800 uppercase tracking-tight mb-0.5">Fertilizer Timing</p>
                              <p className="text-xs text-green-900 leading-snug">{weather.fertilizer_suggestion}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Market Prices */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-krishi-green" />
                          <CardTitle className="text-lg">Market Prices</CardTitle>
                        </div>
                        <Button variant="ghost" size="sm" className="text-krishi-green">
                          View All
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {marketPrices.slice(0, 4).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{item.crop}</p>
                              <p className="text-xs text-gray-500">{item.market}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">₹{item.price}/{item.unit}</p>
                              <p className={`text-xs flex items-center justify-end gap-1 ${item.change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {item.change_percent >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                {Math.abs(item.change_percent)}%
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'disease' && (
            <div className="max-w-3xl mx-auto">
              <Card className="border-0 shadow-xl overflow-hidden rounded-2xl">
                <CardHeader className="bg-gradient-to-r from-krishi-green to-krishi-lime text-white py-6">
                  <div className="flex items-center gap-3">
                    <Scan className="w-8 h-8 text-white" />
                    <div>
                      <CardTitle className="text-2xl font-bold font-display">Disease & Fertilizer AI</CardTitle>
                      <p className="text-sm opacity-90 font-medium">Instantly detect crop diseases and get expert fertilizer solutions</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  {!diseaseImage ? (
                    <label className="block border-3 border-dashed border-krishi-green/40 hover:border-krishi-green bg-krishi-lime/5 rounded-2xl p-12 text-center cursor-pointer transition-all duration-300">
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      <div className="w-20 h-20 mx-auto bg-krishi-green/10 rounded-full flex items-center justify-center mb-6">
                        <Upload className="w-10 h-10 text-krishi-green" />
                      </div>
                      <p className="font-bold text-xl text-gray-800 mb-2">Upload Crop Image</p>
                      <p className="text-gray-500">Supported formats: JPG, PNG, WEBP</p>
                    </label>
                  ) : (
                    <div className="space-y-8">
                      <div className="relative rounded-2xl overflow-hidden shadow-lg border-4 border-white bg-gray-100 flex items-center justify-center">
                        <img src={diseaseImage?.startsWith('/') ? `${API_BASE_URL}${diseaseImage}` : diseaseImage} alt="Crop" className="w-full h-80 object-cover" />
                        <button
                          onClick={() => { setDiseaseImage(null); setDiseaseResult(null); }}
                          className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {!diseaseResult && (
                        <div className="space-y-4">
                          <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Crop Type (Optional — select to help AI pinpoint the exact variety):
                            </label>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {['Auto-Detect (AI)', 'Soybean', 'Cotton', 'Wheat', 'Rice', 'Tomato', 'Corn (Maize)', 'Sugarcane', 'Chili', 'Potato'].map((cropName) => {
                                const isAuto = cropName.startsWith('Auto-Detect');
                                const val = isAuto ? '' : cropName.split(' ')[0];
                                const isSelected = selectedCropHint === val || (isAuto && !selectedCropHint);
                                return (
                                  <button
                                    key={cropName}
                                    type="button"
                                    onClick={() => setSelectedCropHint(isAuto ? '' : val)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                      isSelected
                                        ? 'bg-krishi-green text-white shadow-sm'
                                        : 'bg-white text-gray-700 hover:bg-emerald-100/50 border border-gray-200'
                                    }`}
                                  >
                                    {cropName}
                                  </button>
                                );
                              })}
                            </div>
                            <input
                              type="text"
                              value={selectedCropHint}
                              onChange={(e) => setSelectedCropHint(e.target.value)}
                              placeholder="Or type crop name (e.g. Soybean, Mustard, Groundnut)..."
                              className="w-full px-4 py-2 text-sm bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-krishi-green/40"
                            />
                          </div>

                          <Button 
                            onClick={handleDiseaseDetect} 
                            disabled={isDetectingDisease}
                            size="lg" 
                            className="w-full h-16 text-lg font-bold bg-krishi-green hover:bg-krishi-dark shadow-md"
                          >
                            <Scan className={`w-6 h-6 mr-3 ${isDetectingDisease ? 'animate-spin' : ''}`} />
                            {isDetectingDisease ? 'Analyzing Crop Image...' : 'Start AI Analysis'}
                          </Button>
                        </div>
                      )}

                      {diseaseResult && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, staggerChildren: 0.15 }}
                          className="space-y-6"
                        >
                          {/* Alert Banner */}
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`p-6 sm:p-8 rounded-[2rem] border bg-gradient-to-br ${(diseaseResult.detected_disease ?? '').toLowerCase().includes('healthy') ? 'from-green-50/80 via-emerald-100/50 to-green-100 border-green-300' : 'from-red-50/80 via-rose-100/50 to-red-100 border-red-300'} shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden backdrop-blur-xl`}
                          >
                            <div className="absolute -right-12 -top-12 opacity-[0.07] pointer-events-none">
                              <Scan className="w-64 h-64" />
                            </div>
                            <div className="relative z-10 text-center sm:text-left">
                              <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                                <span className="flex h-2 w-2 relative">
                                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${(diseaseResult.detected_disease ?? '').toLowerCase().includes('healthy') ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                  <span className={`relative inline-flex rounded-full h-2 w-2 ${(diseaseResult.detected_disease ?? '').toLowerCase().includes('healthy') ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                </span>
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">AI Diagnosis Complete</p>
                              </div>
                              <h3 className={`text-3xl sm:text-4xl font-black mb-1 tracking-tight ${(diseaseResult.detected_disease ?? '').toLowerCase().includes('healthy') ? 'text-green-900' : 'text-red-900'}`}>
                                {diseaseResult.detected_disease}
                              </h3>
                              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
                                <span className="px-5 py-2 bg-white/60 backdrop-blur-md rounded-2xl text-[13px] font-bold shadow-sm border border-white/50 text-gray-800">Crop: {diseaseResult.crop_type}</span>
                                <span className={`px-5 py-2 rounded-2xl text-[13px] font-bold shadow-sm border ${(diseaseResult.confidence ?? 0) > 90 ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-200' : 'bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 border-yellow-200'}`}>
                                  {(diseaseResult.confidence ?? 0) > 90 ? 'High Confidence' : 'Moderate Confidence'}
                                </span>
                              </div>
                            </div>
                            <div className="text-center bg-white/90 backdrop-blur-xl p-6 rounded-[1.5em] shadow-2xl border border-white/50 min-w-[140px] relative z-10 transform hover:scale-105 transition-transform duration-300 group">
                              <div className="absolute inset-0 bg-gradient-to-br from-krishi-green/5 to-emerald-500/5 rounded-[1.5em]"></div>
                              <p className="text-5xl font-black bg-gradient-to-br from-krishi-green to-teal-600 bg-clip-text text-transparent group-hover:scale-110 transition-transform">{diseaseResult.confidence ?? 0}%</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Accuracy Score</p>
                            </div>
                          </motion.div>

                          {/* Treatment Box */}
                          <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-xl shadow-krishi-green/5 border border-krishi-green/10 relative overflow-hidden group hover:shadow-2xl hover:shadow-krishi-green/10 transition-all duration-500"
                          >
                            <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-krishi-green via-emerald-400 to-krishi-green group-hover:w-3 transition-all duration-500"></div>
                            <div className="flex flex-col sm:flex-row items-start gap-6">
                              <div className="w-16 h-16 bg-gradient-to-br from-krishi-green to-emerald-400 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-green-200/50 transform group-hover:rotate-12 group-hover:scale-110 transition-all duration-500">
                                <CheckCircle className="w-8 h-8 text-white" />
                              </div>
                              <div className="flex-1 w-full">
                                <h4 className="text-2xl font-black text-gray-900 mb-6 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Recommended Treatment & Fertilizers</h4>
                                <div className="space-y-4">
                                  {diseaseResult.treatment?.split('\n').map((line: string, i: number) => {
                                    const trimmed = line.trim();
                                    if (!trimmed) return null;

                                    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
                                      const text = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '');
                                      return <h5 key={i} className="text-xl font-black text-krishi-dark mt-6 mb-2 border-b-2 border-krishi-green/10 pb-2">{text}</h5>;
                                    }

                                    if (trimmed.includes('**Recommended Fertilizers:**')) {
                                      const ferts = trimmed.replace('**Recommended Fertilizers:**', '').trim();
                                      return (
                                        <div key={i} className="mt-6 p-6 sm:p-8 bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-[1.5rem] border border-amber-200/50 flex flex-col sm:flex-row items-center gap-6 shadow-inner hover:shadow-md transition-shadow">
                                          <div className="w-16 h-16 bg-white rounded-2xl shadow-md flex items-center justify-center shrink-0 border border-amber-100 relative">
                                            <div className="absolute inset-0 bg-amber-400/20 rounded-2xl animate-ping"></div>
                                            <Sprout className="w-8 h-8 text-amber-500 relative z-10" />
                                          </div>
                                          <div className="text-center sm:text-left flex-1">
                                            <p className="text-[11px] font-black text-amber-800/60 uppercase tracking-[0.2em] mb-2">Optimal Fertilizer Mix</p>
                                            <p className="text-2xl sm:text-3xl font-black text-amber-900 leading-tight">{ferts}</p>
                                          </div>
                                        </div>
                                      );
                                    }

                                    const numberedMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
                                    if (numberedMatch) {
                                      const content = numberedMatch[2].replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900 font-bold">$1</strong>');
                                      return (
                                        <motion.div whileHover={{ x: 8 }} key={i} className="flex items-start gap-4 py-2 group/item">
                                          <span className="w-8 h-8 bg-krishi-green/10 text-krishi-green rounded-xl flex items-center justify-center text-sm font-black shrink-0 mt-0.5 group-hover/item:bg-krishi-green group-hover/item:text-white group-hover/item:shadow-lg transition-all duration-300">{numberedMatch[1]}</span>
                                          <p className="text-[16px] leading-relaxed text-gray-600 pt-1" dangerouslySetInnerHTML={{ __html: content }} />
                                        </motion.div>
                                      );
                                    }

                                    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                                      const content = trimmed.replace(/^[-*]\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900 font-bold">$1</strong>');
                                      return (
                                        <div key={i} className="flex items-start gap-4 pl-3 py-1.5 group/bullet">
                                          <div className="w-6 h-6 rounded-full bg-krishi-green/10 flex items-center justify-center shrink-0 mt-0.5 group-hover/bullet:bg-krishi-green transition-colors duration-300">
                                            <span className="w-2 h-2 bg-krishi-green rounded-full group-hover/bullet:bg-white transition-colors duration-300"></span>
                                          </div>
                                          <p className="text-[16px] leading-relaxed text-gray-600 pt-0.5" dangerouslySetInnerHTML={{ __html: content }} />
                                        </div>
                                      );
                                    }

                                    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                                      const text = trimmed.replace(/\*\*/g, '');
                                      return <h5 key={i} className="text-lg font-black text-gray-900 mt-6 mb-2">{text}</h5>;
                                    }

                                    const content = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900 font-bold">$1</strong>');
                                    return <p key={i} className="text-[16px] leading-relaxed text-gray-600" dangerouslySetInnerHTML={{ __html: content }} />;
                                  })}
                                </div>
                              </div>
                            </div>
                          </motion.div>

                          {/* Prevention Box */}
                          {diseaseResult.prevention && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="bg-gradient-to-br from-blue-50/80 to-cyan-50/50 rounded-[2rem] p-6 sm:p-8 border border-blue-100 flex flex-col sm:flex-row items-center sm:items-start gap-6 shadow-lg shadow-blue-500/5 hover:shadow-xl hover:shadow-blue-500/10 transition-shadow backdrop-blur-sm"
                            >
                              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-blue-200/50 border-2 border-blue-50 text-blue-500">
                                <AlertCircle className="w-8 h-8" />
                              </div>
                              <div className="text-center sm:text-left">
                                <h4 className="text-xl font-black text-blue-900 mb-3">Prevention Measures</h4>
                                <p className="text-blue-800/80 leading-relaxed text-[16px] font-medium">{diseaseResult.prevention}</p>
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      )}

                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'community' && (
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Create Post */}
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-krishi-green rounded-full flex items-center justify-center text-white font-medium shrink-0">
                      {user?.name?.[0] || 'U'}
                    </div>
                    <div className="flex-1 space-y-3">
                      <textarea
                        id="new-post-input"
                        placeholder="Share your farming experience, ask a question, or upload media..."
                        className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-krishi-green/30"
                        rows={3}
                      />
                      
                      {/* Media Preview inside the compose box */}
                      {postMediaUrl && (
                        <div className="relative rounded-lg overflow-hidden border bg-gray-50 flex items-center justify-center max-h-64 mb-2">
                          {postMediaType === 'image' && (
                            <img src={postMediaUrl?.startsWith('/') ? `${API_BASE_URL}${postMediaUrl}` : postMediaUrl} alt="Preview" className="max-h-64 object-contain" />
                          )}
                          {postMediaType === 'video' && (
                            <video src={postMediaUrl?.startsWith('/') ? `${API_BASE_URL}${postMediaUrl}` : postMediaUrl} controls className="max-h-64 w-full" />
                          )}
                        
                          <button
                            onClick={() => { setPostMediaUrl(null); setPostMediaType('text'); }}
                            className="absolute top-2 right-2 w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t pt-3">
                        <div className="flex gap-2">
                          <label className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                            <input type="file" accept="image/*" className="hidden" onChange={handlePostMediaUpload} disabled={isUploading} />
                            <ImageIcon className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-semibold text-gray-600">Photo</span>
                          </label>
                          <label className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                            <input type="file" accept="video/*" className="hidden" onChange={handlePostMediaUpload} disabled={isUploading} />
                            <Video className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-semibold text-gray-600">Video</span>
                          </label>
                          <label className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                            <input type="file" accept="audio/*" className="hidden" onChange={handlePostMediaUpload} disabled={isUploading} />
                            <Mic className="w-4 h-4 text-amber-600" />
                            <span className="text-xs font-semibold text-gray-600 hidden sm:inline">Voice</span>
                          </label>
                          <button
                            type="button"
                            onClick={handleAiSuggestPost}
                            disabled={isAiSuggesting}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-purple-50 transition-colors ${isAiSuggesting ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            <Bot className="w-4 h-4 text-purple-600" />
                            <span className="text-xs font-semibold text-purple-700 hidden sm:inline">{isAiSuggesting ? 'Thinking...' : 'AI Suggest'}</span>
                          </button>
                        </div>
                        <Button
                          size="sm"
                          className="bg-krishi-green hover:bg-krishi-dark"
                          disabled={isUploading}
                          onClick={async () => {
                            const textarea = document.getElementById('new-post-input') as HTMLTextAreaElement;
                            const content = textarea?.value?.trim();
                            if (!content && !postMediaUrl) return;
                            try {
                              const postObj: any = { content, media_type: postMediaType };
                              if (postMediaType === 'image') postObj.image_url = postMediaUrl;
                              if (postMediaType === 'video') postObj.video_url = postMediaUrl;
                              if (postMediaType === 'video') postObj.video_url = postMediaUrl; // audio/video stored as video_url

                              await communityApi.createPost(postObj);
                              
                              textarea.value = '';
                              setPostMediaUrl(null);
                              setPostMediaType('text');
                              
                              const postsRes = await communityApi.getPosts();
                              setPosts(postsRes.data.posts || []);
                              toast.success('Post created!');
                            } catch { toast.error('Failed to create post'); }
                          }}
                        >
                          <Send className="w-4 h-4 mr-1" /> Post
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {posts.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-medium mb-1">No posts yet</p>
                  <p className="text-sm">Be the first to share something with the community!</p>
                </div>
              )}

              {posts.map((post) => (
                <Card key={post.id} className="border border-gray-200 shadow-sm overflow-hidden mb-6 bg-white rounded-xl">
                  {/* Instagram-style Header */}
                  <div className="p-3 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-krishi-green rounded-full flex items-center justify-center text-white font-medium text-sm">
                        {post.user?.name?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-sm leading-none text-gray-900">{post.user?.name || 'Farmer'}</p>
                        <span className="text-[11px] text-gray-500">
                           {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {post.user?.id !== user?.id && (
                        <button
                          onClick={async () => {
                            try {
                              await communityApi.followUser(post.user.id);
                              const postsRes = await communityApi.getPosts();
                              setPosts(postsRes.data.posts || []);
                              toast.success(post.is_following_author ? `Unsubscribed from ${post.user.name}` : `Subscribed to ${post.user.name}`);
                            } catch { toast.error('Failed to update subscription'); }
                          }}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all border ${post.is_following_author ? 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white'}`}
                        >
                          {post.is_following_author ? 'Unsubscribe' : 'Subscribe'}
                        </button>
                      )}
                      <button className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Media Content (Full Width) */}
                  {post.image_url && post.media_type === 'image' && (
                    <div className="w-full bg-gray-50 flex items-center justify-center border-y border-gray-100">
                      <img src={post.image_url.startsWith('/') ? `${API_BASE_URL}${post.image_url}` : post.image_url} alt="Post media" className="w-full max-h-[500px] object-contain" />
                    </div>
                  )}
                  {post.video_url && post.media_type === 'video' && (
                    <div className="w-full bg-black flex items-center justify-center border-y border-gray-100">
                      <video src={post.video_url.startsWith('/') ? `${API_BASE_URL}${post.video_url}` : post.video_url} controls className="w-full max-h-[500px]" />
                    </div>
                  )}
                  {post.media_urls && post.media_urls.length > 0 && post.media_type === 'image_video' && (
                    <div className="w-full bg-gray-50 p-6 border-y border-gray-100 flex items-center justify-center">
                      <audio src={post.media_urls[0].startsWith('/') ? `${API_BASE_URL}${post.media_urls[0]}` : post.media_urls[0]} controls className="w-full max-w-sm" />
                    </div>
                  )}
                  {(!post.image_url && !post.video_url && (!post.media_urls || post.media_urls.length === 0)) && post.content && (
                     <div className="px-4 py-6 bg-white">
                         <p className="text-[15px] text-gray-800 whitespace-pre-wrap">{post.content}</p>
                     </div>
                  )}

                  {/* Actions & Meta */}
                  <div className="p-4 bg-white">
                    {/* Action Bar */}
                    <div className="flex items-center justify-between mb-3">
                       <div className="flex gap-4 items-center">
                         <button
                           className="text-gray-900 hover:text-gray-500 transition-colors"
                           onClick={async () => {
                             try {
                               const res = await communityApi.likePost(post.id);
                               setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes_count: res.data.new_count, is_liked: res.data.liked } : p));
                             } catch { }
                           }}
                         >
                           <Heart className={`w-6 h-6 ${post.is_liked ? 'fill-red-500 text-red-500 outline-none' : ''}`} />
                         </button>
                         <button className="text-gray-900 hover:text-gray-500 transition-colors" onClick={() => loadComments(post.id)}>
                           <MessageCircle className="w-6 h-6" />
                         </button>
                         <button className="text-gray-900 hover:text-gray-500 transition-colors" onClick={() => setShareModalPostId(post.id)}>
                           <Send className="w-6 h-6" />
                         </button>
                       </div>
                       <button className="text-gray-900 hover:text-gray-500 transition-colors">
                         <Bookmark className="w-6 h-6" />
                       </button>
                    </div>

                    {/* Likes Count */}
                    <p className="font-semibold text-sm mb-1 text-gray-900">{(post.likes_count || 0).toLocaleString()} likes</p>

                    {/* Caption / Content for Media Posts */}
                    {(post.media_type !== 'text' || post.video_url || post.image_url) && post.content && (
                       <p className="text-sm mb-2 text-gray-900">
                         <span className="font-semibold mr-2">{post.user?.name || 'Farmer'}</span>
                         <span className="whitespace-pre-wrap">{post.content}</span>
                       </p>
                    )}

                    {/* Comments Summary & View */}
                    {post.comments_count > 0 && !postComments[post.id] && (
                      <button className="text-sm text-gray-500 mb-2 hover:underline inline-block" onClick={() => loadComments(post.id)}>
                         View all {post.comments_count} comments
                      </button>
                    )}

                    {/* Render Fetched Comments */}
                    {postComments[post.id] && (
                       <div className="my-3 space-y-2">
                          {postComments[post.id].map(c => (
                            <p key={c.id} className="text-sm">
                              <span className="font-semibold mr-2 text-gray-900">{c.user?.name || 'User'}</span>
                              <span className="text-gray-800">{c.content}</span>
                            </p>
                          ))}
                          
                          {/* Hide comments button */}
                          <button className="text-[13px] text-gray-500 hover:underline pt-1" onClick={() => loadComments(post.id)}>
                            Hide comments
                          </button>
                       </div>
                    )}

                    {/* Comment Input */}
                    <div className="flex items-center gap-2 mt-2 pt-3 border-t border-gray-100">
                       <div className="w-6 h-6 bg-krishi-green rounded-full flex items-center justify-center text-white font-medium text-[10px] shrink-0">
                         {user?.name?.[0] || 'U'}
                       </div>
                       <input 
                          type="text" 
                          placeholder="Add a comment..."
                          className="flex-1 text-sm bg-transparent border-none outline-none focus:ring-0 px-1 placeholder-gray-400"
                          value={commentInputs[post.id] || ''}
                          onChange={(e) => setCommentInputs(prev => ({...prev, [post.id]: e.target.value}))}
                          onKeyDown={(e) => {
                             if (e.key === 'Enter') submitComment(post.id);
                          }}
                       />
                       {(commentInputs[post.id] || '').trim().length > 0 && (
                          <button 
                            className="text-blue-500 font-semibold text-sm hover:text-blue-700 disabled:opacity-50 px-2"
                            onClick={() => submitComment(post.id)}
                            disabled={commentLoading[post.id]}
                          >
                            Post
                          </button>
                       )}
                    </div>
                  </div>
                </Card>
              ))}

              {/* Share Modal */}
              <AnimatePresence>
                {shareModalPostId && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setShareModalPostId(null)}
                  >
                    <motion.div
                      initial={{ y: 50, scale: 0.95 }}
                      animate={{ y: 0, scale: 1 }}
                      exit={{ y: 20, scale: 0.95 }}
                      className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg">Share with Farmers</h3>
                        <button onClick={() => setShareModalPostId(null)} className="p-1 hover:bg-gray-100 rounded-full">
                          <X className="w-5 h-5 text-gray-500" />
                        </button>
                      </div>
                      <div className="space-y-4 mb-4 max-h-[60vh] overflow-y-auto">
                        {['Rajesh Kumar', 'Suman Devi', 'Amit Singh', 'Priya Patel'].map((name, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold">
                                {name[0]}
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{name}</p>
                                <p className="text-xs text-gray-500">Connected</p>
                              </div>
                            </div>
                            <Button size="sm" variant="outline" className="rounded-full h-8 text-xs font-semibold border-gray-300" onClick={async () => {
                               if (shareModalPostId) {
                                  try { await communityApi.sharePost(shareModalPostId, "in_app"); } catch {}
                                  const postsRes = await communityApi.getPosts();
                                  setPosts(postsRes.data.posts || []);
                               }
                               toast.success(`Post shared with ${name}`);
                               setShareModalPostId(null);
                            }}>
                              Send
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button className="w-full rounded-xl bg-gray-100 text-black hover:bg-gray-200" variant="ghost" onClick={async () => {
                         navigator.clipboard.writeText(`http://localhost:3000/dashboard?post=${shareModalPostId}`);
                         if (shareModalPostId) {
                           try { await communityApi.sharePost(shareModalPostId, "external"); } catch {}
                           const postsRes = await communityApi.getPosts();
                           setPosts(postsRes.data.posts || []);
                         }
                         toast.success("Link copied!");
                         setShareModalPostId(null);
                      }}>
                        Copy Link
                      </Button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {activeTab === 'schemes' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schemes.map((scheme) => (
                <Card key={scheme.id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-krishi-dark">{scheme.title}</h4>
                      <span className="px-2 py-1 bg-krishi-green/10 text-krishi-green text-xs rounded">New</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{scheme.description}</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 bg-krishi-green hover:bg-krishi-dark">
                        Apply
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ============ WEATHER FULL PAGE (GPS REALTIME) ============ */}
          {activeTab === 'weather' && (
            <div className="max-w-3xl mx-auto space-y-5">

              {/* GPS Status Bar */}
              <div className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium shadow-sm ${gpsStatus === 'granted' ? 'bg-green-50 border-green-200 text-green-700' :
                  gpsStatus === 'requesting' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                    gpsStatus === 'denied' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                      'bg-gray-50 border-gray-200 text-gray-600'
                }`}>
                <div className="flex items-center gap-2">
                  {gpsStatus === 'granted' && (
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                    </span>
                  )}
                  {gpsStatus === 'requesting' && <Navigation className="w-4 h-4 animate-pulse" />}
                  {gpsStatus === 'denied' && <AlertCircle className="w-4 h-4" />}
                  {gpsStatus === 'idle' && <Navigation className="w-4 h-4" />}
                  <span>
                    {gpsStatus === 'granted' ? `📍 Live GPS Location — ${weather?.location || ''}` :
                      gpsStatus === 'requesting' ? 'Requesting GPS location...' :
                        gpsStatus === 'denied' ? 'Location denied — showing default city weather' :
                          'Detecting your location...'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {lastUpdated && (
                    <span className="text-xs opacity-70">
                      Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (gpsStatus === 'denied') fetchWeather();
                      else requestGPS();
                    }}
                    disabled={weatherLoading || gpsStatus === 'requesting'}
                    className="flex items-center gap-1 px-2 py-1 bg-white/70 hover:bg-white rounded-lg text-xs border font-semibold transition disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3 h-3 ${weatherLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  {gpsStatus === 'denied' && (
                    <button
                      onClick={requestGPS}
                      className="flex items-center gap-1 px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-xs border border-amber-300 font-semibold transition"
                    >
                      <Navigation className="w-3 h-3" />
                      Enable GPS
                    </button>
                  )}
                </div>
              </div>

              {/* Main Weather Hero */}
              <div className={`relative bg-gradient-to-br ${weather?.condition?.toLowerCase().includes('rain') || weather?.condition?.toLowerCase().includes('thunder')
                  ? 'from-slate-600 to-blue-900'
                  : weather?.condition?.toLowerCase().includes('cloud')
                    ? 'from-slate-500 to-blue-600'
                    : 'from-blue-400 to-cyan-400'
                } rounded-2xl p-8 text-white shadow-xl overflow-hidden`}>
                {/* Animated background blobs */}
                <div className="absolute inset-0 overflow-hidden opacity-20">
                  <div className="absolute -top-8 -right-8 w-48 h-48 bg-white rounded-full" />
                  <div className="absolute bottom-0 -left-10 w-32 h-32 bg-white rounded-full" />
                </div>
                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3 opacity-80">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm font-medium">{weather?.location || 'Detecting...'}</span>
                      {gpsStatus === 'granted' && (
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">GPS</span>
                      )}
                    </div>
                    <p className="text-7xl font-black tracking-tight leading-none">
                      {weatherLoading && !weather ? '—' : `${Math.round(Number(weather?.temperature || 28))}`}
                      <span className="text-4xl font-light">°C</span>
                    </p>
                    <p className="text-xl mt-3 font-semibold opacity-90">{weather?.condition || 'Loading...'}</p>
                    {gpsCoords && (
                      <p className="text-xs mt-1 opacity-60">
                        {gpsCoords.lat.toFixed(4)}°N, {gpsCoords.lon.toFixed(4)}°E
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    {weatherLoading ? (
                      <div className="w-20 h-20 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        {(weather?.condition?.toLowerCase().includes('rain') || weather?.condition?.toLowerCase().includes('thunder')) && (
                          <Droplets className="w-20 h-20 opacity-80" />
                        )}
                        {weather?.condition?.toLowerCase().includes('cloud') && !weather?.condition?.toLowerCase().includes('rain') && (
                          <Cloud className="w-20 h-20 opacity-80" />
                        )}
                        {(!weather?.condition || (!weather.condition.toLowerCase().includes('rain') && !weather.condition.toLowerCase().includes('cloud') && !weather.condition.toLowerCase().includes('thunder'))) && (
                          <Sun className="w-20 h-20 opacity-80" />
                        )}
                      </>
                    )}
                    <p className="text-xs opacity-60 text-center">Real-time</p>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: Droplets, label: 'Humidity', value: `${weather?.humidity || '—'}%`, color: 'text-blue-500', bg: 'bg-blue-50' },
                  { icon: Wind, label: 'Wind', value: `${weather?.wind_speed || '—'} km/h`, color: 'text-gray-500', bg: 'bg-gray-50' },
                  { icon: Thermometer, label: 'Feels Like', value: `${Math.round(Number(weather?.temperature || 28))}°C`, color: 'text-orange-500', bg: 'bg-orange-50' },
                  { icon: Eye, label: 'Rain Chance', value: weather?.condition?.toLowerCase().includes('rain') ? '80%' : weather?.condition?.toLowerCase().includes('drizzle') ? '50%' : '10%', color: 'text-cyan-500', bg: 'bg-cyan-50' },
                ].map((s, i) => (
                  <Card key={i} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-5 text-center">
                      <div className={`w-12 h-12 ${s.bg} rounded-full flex items-center justify-center mx-auto mb-3`}>
                        <s.icon className={`w-6 h-6 ${s.color}`} />
                      </div>
                      <p className="text-2xl font-bold">{s.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Agricultural Advice */}
              {(weather?.water_level_suggestion || weather?.fertilizer_suggestion) && (
                <div className="grid md:grid-cols-2 gap-4">
                  {weather?.water_level_suggestion && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <Droplets className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">💧 Water Management</p>
                        <p className="text-sm text-blue-900 leading-snug">{weather.water_level_suggestion}</p>
                      </div>
                    </div>
                  )}
                  {weather?.fertilizer_suggestion && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-start gap-4">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                        <Sprout className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-1">🌿 Fertilizer Timing</p>
                        <p className="text-sm text-green-900 leading-snug">{weather.fertilizer_suggestion}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5-Day Forecast */}
              {weather?.forecast && weather.forecast.length > 0 && (
                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Cloud className="w-5 h-5 text-blue-400" />
                      5-Day Forecast
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-5 gap-3 text-center">
                      {weather.forecast.map((f, idx) => {
                        const cond = (f.condition || '').toLowerCase();
                        return (
                          <div key={idx} className="p-3 rounded-xl bg-gradient-to-b from-gray-50 to-white border border-gray-100">
                            <p className="text-xs font-semibold text-gray-500 mb-2">{f.day?.slice(0, 3)}</p>
                            {(cond.includes('rain') || cond.includes('thunder') || cond.includes('drizzle'))
                              ? <Droplets className="w-7 h-7 mx-auto text-blue-500 my-2" />
                              : cond.includes('cloud')
                                ? <Cloud className="w-7 h-7 mx-auto text-gray-400 my-2" />
                                : <Sun className="w-7 h-7 mx-auto text-yellow-500 my-2" />
                            }
                            <p className="text-lg font-bold">{f.temp}°</p>
                            <p className="text-xs text-gray-400 mt-1">{f.condition}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Auto-refresh note */}
              <p className="text-center text-xs text-gray-400">
                🔄 Weather auto-refreshes every 5 minutes using your GPS location
              </p>
            </div>
          )}


          {/* ============ MARKET FULL PAGE ============ */}
          {activeTab === 'market' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl p-6 text-white shadow-xl">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-8 h-8" />
                  <div>
                    <h2 className="text-2xl font-bold">Market Prices</h2>
                    <p className="text-sm opacity-80">Live crop prices from major Indian markets</p>
                  </div>
                </div>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {marketPrices.map((item, idx) => (
                  <Card key={idx} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-lg text-krishi-dark">{item.crop}</h4>
                        <span className={`flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-full ${item.change_percent >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {item.change_percent >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                          {Math.abs(item.change_percent)}%
                        </span>
                      </div>
                      <p className="text-3xl font-black text-krishi-green mb-1">₹{item.price}</p>
                      <p className="text-sm text-gray-500">per {item.unit}</p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                        <MapPin className="w-3 h-3" />
                        {item.market}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {marketPrices.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No market prices available</p>
                </div>
              )}
            </div>
          )}

          {/* ============ AGRI NEWS FULL PAGE ============ */}
          {activeTab === 'news' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-indigo-500 via-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl flex items-center justify-between overflow-hidden relative border border-indigo-400/50">
                <div className="absolute -right-16 -top-16 opacity-[0.07] transform rotate-12"><Newspaper className="w-80 h-80" /></div>
                <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')]" />
                <div className="relative z-10 flex items-center gap-5">
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
                    <Newspaper className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black font-display tracking-tight mb-1">Agri News & Trends</h2>
                    <p className="text-[15px] opacity-90 font-medium">Stay updated with the latest in agriculture, subsidies, and global markets.</p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {news.length > 0 ? news.map((article, idx) => (
                  <Card key={idx} className="border-0 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-500 group overflow-hidden rounded-3xl flex flex-col h-full bg-white transform hover:-translate-y-1">
                    <div className="h-48 overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent z-10" />
                      <img 
                        src={article.image_url || "https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=800&q=80"} 
                        alt={article.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" 
                      />
                      <div className="absolute bottom-4 left-4 z-20 flex gap-2">
                        <span className="bg-indigo-600/90 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">{article.source}</span>
                      </div>
                    </div>
                    <CardContent className="p-6 flex flex-col flex-1">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                         <Calendar className="w-3.5 h-3.5" /> 
                         {new Date(article.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      </p>
                      <h3 className="font-bold text-gray-900 text-lg leading-snug mb-3 group-hover:text-indigo-600 transition-colors">{article.title}</h3>
                      <p className="text-gray-600 text-sm leading-relaxed mb-6 flex-1 line-clamp-3">{article.content}</p>
                      
                      <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                        <a 
                          href={article.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-indigo-600 font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all"
                        >
                          Read More <ArrowRight className="w-4 h-4" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                )) : (
                  [1,2,3,4,5,6].map(i => (
                    <div key={i} className="animate-pulse bg-white rounded-3xl h-80 shadow-sm border border-gray-100" />
                  ))
                )}
              </div>
            </div>
          )}

          {/* ============ AI ASSISTANT FULL PAGE ============ */}
          {activeTab === 'ai' && (
            <div className="max-w-3xl mx-auto">
              <Card className="border-0 shadow-xl h-[calc(100vh-140px)] flex flex-col rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-krishi-green to-krishi-green-light text-white py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <Bot className="w-7 h-7" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">AI Farming Assistant</CardTitle>
                      <p className="text-sm opacity-80">Ask anything about crops, pests, fertilizers & more</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-4 overflow-hidden">
                  {/* Language indicator */}
                  <div className="flex items-center justify-between px-2 pb-2 border-b mb-3">
                    <span className="text-xs text-gray-400">AI responses in: <strong className="text-krishi-green">{languages.find(l => l.code === language)?.label}</strong></span>
                    <span className="text-xs text-gray-300">Powered by Gemini AI</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4 px-3 pr-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-50 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-krishi-green/30 hover:[&::-webkit-scrollbar-thumb]:bg-krishi-green/60 [&::-webkit-scrollbar-thumb]:rounded-full transition-all">
                    {chatMessages.length === 0 && (
                      <div className="text-center text-gray-400 py-16">
                        <Bot className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium mb-2">
                          {language === 'hi' ? 'खेती के बारे में कुछ भी पूछें!' :
                            language === 'ta' ? 'விவசாயம் பற்றி எதையும் கேளுங்கள்!' :
                              language === 'te' ? 'వ్యవసాయం గురించి ఏదైనా అడగండి!' :
                                language === 'mr' ? 'शेतीबद्दल काहीही विचारा!' :
                                  'Ask me anything about farming!'}
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center mt-4">
                          {(AI_SUGGESTIONS[language] || AI_SUGGESTIONS['en']).map((suggestion) => (
                            <button
                              key={suggestion}
                              onClick={() => { setChatInput(suggestion); }}
                              className="px-4 py-2 bg-krishi-green/10 text-krishi-green rounded-full text-sm font-medium hover:bg-krishi-green/20 transition-colors"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${msg.type === 'user' ? 'bg-krishi-green text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                          {msg.image_url && (
                             <img src={msg.image_url.startsWith('/') ? `${API_BASE_URL}${msg.image_url}` : msg.image_url} alt="Uploaded" className="max-w-xs object-cover rounded-lg mb-2" />
                          )}
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    {aiLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-krishi-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-krishi-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-krishi-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            <span className="text-xs text-gray-400 ml-1">AI is thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 border-t pt-4 shrink-0">
                    {chatImageUrl && (
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden border ml-2">
                        <img src={chatImageUrl.startsWith('/') ? `${API_BASE_URL}${chatImageUrl}` : chatImageUrl} alt="Upload preview" className="w-full h-full object-cover" />
                        <button onClick={() => setChatImageUrl(null)} className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black text-white rounded-full flex items-center justify-center transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2 w-full items-center">
                      <label className={`cursor-pointer shrink-0 p-3 bg-gray-50 hover:bg-gray-100 border rounded-lg transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                         <input type="file" accept="image/*" className="hidden" 
                           onChange={async (e) => {
                             if (!e.target.files?.[0]) return;
                             setIsUploading(true);
                             try {
                               const res = await uploadApi.uploadFile(e.target.files[0]);
                               setChatImageUrl(res.data.url);
                             } catch {
                               toast.error('Image upload failed');
                             } finally { setIsUploading(false); }
                           }} 
                         />
                         <ImageIcon className="w-5 h-5 text-krishi-green" />
                      </label>
                      <Input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={language === 'hi' ? 'अपना सवाल पूछें...' : language === 'ta' ? 'உங்கள் கேள்வியைக் கேளுங்கள்...' : language === 'te' ? 'మీ ప్రశ్న అడగండి...' : language === 'mr' ? 'तुमचा प्रश्न विचारा...' : 'Ask your farming question...'}
                        className="h-12 text-base flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && !aiLoading && handleSendMessage()}
                        disabled={aiLoading}
                      />
                      <Button onClick={handleSendMessage} disabled={aiLoading || (!chatInput.trim() && !chatImageUrl)} className="h-12 px-6 bg-krishi-green hover:bg-krishi-dark shrink-0">
                        {aiLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
