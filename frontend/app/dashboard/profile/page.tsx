'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    Sprout, Scan, Bot, Users, FileText, TrendingUp, MapPin, Phone, Mail,
    Calendar, Edit3, Camera, ArrowLeft, Clock, CheckCircle, ChevronRight,
    Leaf, MessageSquare, Shield, Award, Activity, Save, X, User as UserIcon,
    Globe, LogOut, Settings, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileDashboard, ActivitySummary, UserActivity, User } from '@/lib/types';
import { profileApi, authApi, uploadApi, API_BASE_URL } from '@/lib/api';

const ACTIVITY_ICONS: Record<string, any> = {
    disease_scan: Scan,
    ai_query: Bot,
    community_post: Users,
    community_like: CheckCircle,
    community_comment: MessageSquare,
    profile_update: Edit3,
    scheme_view: FileText,
    document_upload: FileText,
    market_search: TrendingUp,
    login: Shield,
};

const ACTIVITY_COLORS: Record<string, string> = {
    disease_scan: 'bg-red-100 text-red-600',
    ai_query: 'bg-blue-100 text-blue-600',
    community_post: 'bg-purple-100 text-purple-600',
    community_like: 'bg-pink-100 text-pink-600',
    community_comment: 'bg-indigo-100 text-indigo-600',
    profile_update: 'bg-amber-100 text-amber-600',
    scheme_view: 'bg-teal-100 text-teal-600',
    document_upload: 'bg-cyan-100 text-cyan-600',
    market_search: 'bg-green-100 text-green-600',
    login: 'bg-gray-100 text-gray-600',
};

const CROP_OPTIONS = [
    { name: 'Wheat', emoji: '🌾' },
    { name: 'Rice', emoji: '🍚' },
    { name: 'Tomato', emoji: '🍅' },
    { name: 'Potato', emoji: '🥔' },
    { name: 'Onion', emoji: '🧅' },
    { name: 'Corn', emoji: '🌽' },
    { name: 'Cotton', emoji: '🏵️' },
    { name: 'Sugarcane', emoji: '🎋' },
    { name: 'Soybean', emoji: '🫘' },
    { name: 'Groundnut', emoji: '🥜' },
    { name: 'Chilli', emoji: '🌶️' },
    { name: 'Mango', emoji: '🥭' },
    { name: 'Banana', emoji: '🍌' },
];

export default function ProfilePage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(true);
    const [dashboard, setDashboard] = useState<ProfileDashboard | null>(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Edit form
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editLocation, setEditLocation] = useState('');
    const [editCrops, setEditCrops] = useState<string[]>([]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { router.replace('/login'); return; }
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const res = await profileApi.getDashboard();
            setDashboard(res.data);
            const u = res.data.user;
            setEditName(u.name || '');
            setEditEmail(u.email || '');
            setEditLocation(u.location || '');
            setEditCrops(u.crop_preferences || []);
        } catch {
            toast.error('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editName.trim()) { toast.error('Name is required'); return; }
        setSaving(true);
        try {
            await authApi.updateProfile({
                name: editName.trim(),
                email: editEmail.trim() || undefined,
                location: editLocation.trim() || undefined,
                crop_preferences: editCrops,
            } as any);
            toast.success('Profile updated!');
            setEditing(false);
            loadProfile();
        } catch {
            toast.error('Update failed');
        } finally {
            setSaving(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const res = await uploadApi.uploadFile(file);
            await authApi.updateProfile({ avatar_url: res.data.url } as any);
            toast.success('Photo updated!');
            loadProfile();
        } catch {
            toast.error('Upload failed');
        }
    };

    const toggleCrop = (crop: string) => {
        setEditCrops(prev =>
            prev.includes(crop) ? prev.filter(c => c !== crop) : [...prev, crop]
        );
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.replace('/login');
        toast.success('Logged out');
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatJoinDate = (dateStr?: string) => {
        if (!dateStr) return 'Recently';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return 'Recently';
            return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        } catch { return 'Recently'; }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-green-50">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-krishi-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Loading profile...</p>
                </div>
            </div>
        );
    }

    const user = dashboard?.user;
    const summary = dashboard?.activity_summary;

    const statCards = [
        { label: 'Disease Scans', value: summary?.total_scans || 0, icon: Scan, gradient: 'from-rose-500 to-pink-500', bg: 'bg-rose-50', iconColor: 'text-rose-500' },
        { label: 'AI Queries', value: summary?.total_ai_queries || 0, icon: Bot, gradient: 'from-blue-500 to-indigo-500', bg: 'bg-blue-50', iconColor: 'text-blue-500' },
        { label: 'Posts', value: summary?.total_community_posts || 0, icon: MessageSquare, gradient: 'from-purple-500 to-violet-500', bg: 'bg-purple-50', iconColor: 'text-purple-500' },
        { label: 'Documents', value: summary?.total_documents || 0, icon: FileText, gradient: 'from-amber-500 to-orange-500', bg: 'bg-amber-50', iconColor: 'text-amber-500' },
    ];

    const avatarSrc = user?.avatar_url
        ? (user.avatar_url.startsWith('/') ? `${API_BASE_URL}${user.avatar_url}` : user.avatar_url)
        : null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50/30">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100">
                <div className="flex items-center justify-between h-16 px-4 max-w-6xl mx-auto">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')} className="hover:bg-green-50">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-krishi-green to-emerald-400 rounded-lg flex items-center justify-center">
                                <Sprout className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-bold text-lg text-gray-900">My Profile</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!editing ? (
                            <>
                                <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-2 rounded-xl">
                                    <Edit3 className="w-4 h-4" /> Edit
                                </Button>
                                <Button size="sm" variant="ghost" onClick={handleLogout} className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50">
                                    <LogOut className="w-4 h-4" />
                                </Button>
                            </>
                        ) : (
                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); loadProfile(); }} className="gap-1">
                                    <X className="w-4 h-4" /> Cancel
                                </Button>
                                <Button size="sm" onClick={handleSave} disabled={saving}
                                    className="bg-gradient-to-r from-krishi-green to-emerald-500 hover:from-krishi-dark hover:to-emerald-600 gap-2 rounded-xl shadow-md shadow-green-200">
                                    <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* ====== Profile Hero ====== */}
                <Card className="border-0 shadow-xl overflow-hidden rounded-3xl">
                    {/* Cover */}
                    <div className="h-44 relative bg-gradient-to-r from-krishi-green via-emerald-500 to-teal-500">
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-50" />
                        {/* Stats in cover */}
                        <div className="absolute bottom-4 right-6 hidden sm:flex items-center gap-6 text-white/80">
                            <div className="text-center">
                                <p className="text-xl font-bold text-white">{summary?.total_scans || 0}</p>
                                <p className="text-[10px] uppercase tracking-wider">Scans</p>
                            </div>
                            <div className="w-px h-8 bg-white/20" />
                            <div className="text-center">
                                <p className="text-xl font-bold text-white">{summary?.total_ai_queries || 0}</p>
                                <p className="text-[10px] uppercase tracking-wider">AI Queries</p>
                            </div>
                            <div className="w-px h-8 bg-white/20" />
                            <div className="text-center">
                                <p className="text-xl font-bold text-white">{summary?.total_community_posts || 0}</p>
                                <p className="text-[10px] uppercase tracking-wider">Posts</p>
                            </div>
                        </div>
                    </div>

                    <CardContent className="relative px-6 sm:px-8 pb-8">
                        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 -mt-16">
                            {/* Avatar */}
                            <div className="relative group">
                                <div className="w-32 h-32 rounded-2xl border-4 border-white shadow-xl bg-gradient-to-br from-krishi-green to-emerald-400 flex items-center justify-center overflow-hidden">
                                    {avatarSrc ? (
                                        <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-5xl font-bold text-white">{user?.name?.[0]?.toUpperCase() || 'F'}</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute bottom-2 right-2 w-9 h-9 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all hover:scale-110 border border-gray-100"
                                >
                                    <Camera className="w-4 h-4 text-gray-600" />
                                </button>
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                            </div>

                            {/* User Info */}
                            <div className="flex-1 pt-2">
                                {editing ? (
                                    <Input value={editName} onChange={e => setEditName(e.target.value)}
                                        className="text-2xl font-bold h-12 mb-2 border-krishi-green/30" placeholder="Your name" />
                                ) : (
                                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900">{user?.name || 'Farmer'}</h1>
                                )}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                                    <span className="flex items-center gap-1.5">
                                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                                        +91 {user?.phone}
                                    </span>
                                    {editing ? (
                                        <Input value={editLocation} onChange={e => setEditLocation(e.target.value)}
                                            className="h-8 w-44 text-sm" placeholder="Location (city, state)" />
                                    ) : user?.location && user.location !== 'Unknown' ? (
                                        <span className="flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                            {user.location}
                                        </span>
                                    ) : null}
                                    {user?.email && !editing && (
                                        <span className="flex items-center gap-1.5">
                                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                                            {user.email}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                        Joined {formatJoinDate(user?.created_at)}
                                    </span>
                                </div>
                            </div>

                            {/* Badge */}
                            <div className="hidden lg:flex items-center gap-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/50 rounded-2xl px-5 py-3 shadow-sm">
                                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-yellow-400 rounded-xl flex items-center justify-center shadow-md">
                                    <Award className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-amber-700">Active Farmer</p>
                                    <p className="text-xs text-amber-600">{summary?.member_since_days || 0} days</p>
                                </div>
                            </div>
                        </div>

                        {/* Email edit */}
                        {editing && (
                            <div className="mt-5 flex gap-3">
                                <div className="flex-1">
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Email</label>
                                    <Input value={editEmail} onChange={e => setEditEmail(e.target.value)}
                                        className="h-10 text-sm" placeholder="Email (optional)" type="email" />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ====== Crop Preferences ====== */}
                <Card className="border-0 shadow-lg rounded-2xl">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
                                    <Leaf className="w-5 h-5 text-krishi-green" />
                                </div>
                                <CardTitle className="text-lg">My Crops</CardTitle>
                            </div>
                            {!editing && (user?.crop_preferences?.length || 0) > 0 && (
                                <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                                    {user?.crop_preferences?.length} crops
                                </span>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {editing ? (
                            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                                {CROP_OPTIONS.map(crop => (
                                    <button key={crop.name} onClick={() => toggleCrop(crop.name)}
                                        className={`p-3 rounded-xl text-center transition-all duration-200 border-2 ${editCrops.includes(crop.name)
                                                ? 'border-krishi-green bg-krishi-green text-white shadow-md scale-105'
                                                : 'border-gray-100 hover:border-gray-200 bg-white'
                                            }`}
                                    >
                                        <span className="text-lg block">{crop.emoji}</span>
                                        <p className={`text-[10px] font-medium mt-0.5 ${editCrops.includes(crop.name) ? 'text-white' : 'text-gray-600'}`}>
                                            {crop.name}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <>
                                {user?.crop_preferences && user.crop_preferences.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {user.crop_preferences.map(crop => {
                                            const c = CROP_OPTIONS.find(o => o.name === crop);
                                            return (
                                                <span key={crop} className="bg-green-50 border border-green-200 px-4 py-2 rounded-xl text-sm font-medium text-gray-700 flex items-center gap-1.5">
                                                    {c?.emoji || '🌱'} {crop}
                                                </span>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">No crops set yet. Click Edit to add your crops.</p>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* ====== Activity Stats ====== */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {statCards.map((stat, idx) => (
                        <Card key={idx} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group rounded-2xl overflow-hidden">
                            <CardContent className="p-5 relative">
                                <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${stat.gradient} opacity-5 rounded-bl-[40px] group-hover:opacity-10 transition-opacity`} />
                                <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
                                    <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                                </div>
                                <p className="text-3xl font-black text-gray-800">{stat.value}</p>
                                <p className="text-xs font-medium text-gray-500 mt-1">{stat.label}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* ====== Activity & Sidebar ====== */}
                <div className="grid lg:grid-cols-5 gap-6">
                    {/* Activity Timeline */}
                    <div className="lg:col-span-3">
                        <Card className="border-0 shadow-lg rounded-2xl">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                                            <Activity className="w-5 h-5 text-indigo-500" />
                                        </div>
                                        <CardTitle className="text-lg">Recent Activity</CardTitle>
                                    </div>
                                    <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                                        {dashboard?.recent_activities?.length || 0} events
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {(!dashboard?.recent_activities || dashboard.recent_activities.length === 0) ? (
                                    <div className="text-center py-14">
                                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                            <Activity className="w-8 h-8 text-gray-300" />
                                        </div>
                                        <p className="text-gray-400 font-medium text-lg">No activity yet</p>
                                        <p className="text-gray-300 text-sm mt-1 max-w-xs mx-auto">
                                            Start using the app to see your activity here
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {dashboard.recent_activities.map((act, idx) => {
                                            const Icon = ACTIVITY_ICONS[act.activity_type] || Activity;
                                            const colorClass = ACTIVITY_COLORS[act.activity_type] || 'bg-gray-100 text-gray-600';
                                            return (
                                                <div key={act.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                                                        <Icon className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-gray-800 truncate">{act.title}</p>
                                                        {act.description && (
                                                            <p className="text-xs text-gray-500 truncate mt-0.5">{act.description}</p>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{timeAgo(act.created_at)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Sidebar */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Recent Scans */}
                        <Card className="border-0 shadow-lg rounded-2xl">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                                        <Scan className="w-4 h-4 text-red-500" />
                                    </div>
                                    <CardTitle className="text-base">Recent Scans</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {(!dashboard?.recent_scans || dashboard.recent_scans.length === 0) ? (
                                    <div className="text-center py-6">
                                        <Scan className="w-8 h-8 mx-auto text-gray-200 mb-2" />
                                        <p className="text-sm text-gray-400">No scans yet</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {dashboard.recent_scans.slice(0, 4).map(scan => (
                                            <div key={scan.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center shrink-0 border border-red-100">
                                                    <Scan className="w-4 h-4 text-red-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{scan.detected_disease || 'Unknown'}</p>
                                                    <p className="text-xs text-gray-400">{scan.crop_type} · {scan.confidence}%</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Recent AI Queries */}
                        <Card className="border-0 shadow-lg rounded-2xl">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                        <Bot className="w-4 h-4 text-blue-500" />
                                    </div>
                                    <CardTitle className="text-base">Recent AI Queries</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {(!dashboard?.recent_ai_queries || dashboard.recent_ai_queries.length === 0) ? (
                                    <div className="text-center py-6">
                                        <Bot className="w-8 h-8 mx-auto text-gray-200 mb-2" />
                                        <p className="text-sm text-gray-400">No queries yet</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {dashboard.recent_ai_queries.slice(0, 4).map(q => (
                                            <div key={q.id} className="p-3 rounded-xl bg-blue-50/50 border border-blue-100/50">
                                                <p className="text-sm text-gray-700 line-clamp-2">{q.content}</p>
                                                <p className="text-xs text-gray-400 mt-1">{timeAgo(q.created_at)}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Quick Actions */}
                        <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 text-white">
                            <CardContent className="p-5 space-y-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Zap className="w-5 h-5 text-amber-400" />
                                    <p className="font-bold">Quick Actions</p>
                                </div>
                                <button onClick={() => router.push('/dashboard')}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/15 transition-colors text-left">
                                    <Scan className="w-5 h-5 text-rose-400" />
                                    <span className="text-sm font-medium">Scan a Crop</span>
                                    <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                                </button>
                                <button onClick={() => router.push('/dashboard')}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/15 transition-colors text-left">
                                    <Bot className="w-5 h-5 text-blue-400" />
                                    <span className="text-sm font-medium">Ask AI Assistant</span>
                                    <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                                </button>
                                <button onClick={() => router.push('/dashboard')}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/15 transition-colors text-left">
                                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                                    <span className="text-sm font-medium">Check Prices</span>
                                    <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                                </button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
