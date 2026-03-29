'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
    Sprout, User, Mail, MapPin, Camera, Check, ArrowRight,
    Leaf, ChevronLeft, ChevronRight, Upload, Globe, X
} from 'lucide-react';
import { authApi, uploadApi, API_BASE_URL } from '@/lib/api';

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
    { name: 'Apple', emoji: '🍎' },
    { name: 'Grape', emoji: '🍇' },
];

const LANGUAGES = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'hi', name: 'Hindi', native: 'हिंदी' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
    { code: 'te', name: 'Telugu', native: 'తెలుగు' },
    { code: 'mr', name: 'Marathi', native: 'मराठी' },
];

export default function RegisterPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setSaving] = useState(false);

    // Form fields
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [location, setLocation] = useState('');
    const [language, setLanguage] = useState('en');
    const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarPreview, setAvatarPreview] = useState('');
    const [phone, setPhone] = useState('');

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) {
            router.replace('/login');
            return;
        }
        // Get phone from stored user
        const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
        if (storedUser) {
            try {
                const u = JSON.parse(storedUser);
                setPhone(u.phone || '');
                // If user already has a real name, prefill
                if (u.name && u.name !== 'Farmer User' && u.name !== 'Farmer') {
                    setName(u.name);
                }
                if (u.email) setEmail(u.email);
                if (u.location && u.location !== 'Unknown') setLocation(u.location);
                if (u.language) setLanguage(u.language);
                if (u.avatar_url) { setAvatarUrl(u.avatar_url); setAvatarPreview(u.avatar_url); }
            } catch { }
        }
    }, []);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Preview
        const reader = new FileReader();
        reader.onloadend = () => setAvatarPreview(reader.result as string);
        reader.readAsDataURL(file);

        try {
            const res = await uploadApi.uploadFile(file);
            setAvatarUrl(res.data.url);
            toast.success('Photo uploaded!');
        } catch {
            toast.error('Failed to upload photo');
        }
    };

    const toggleCrop = (crop: string) => {
        setSelectedCrops(prev =>
            prev.includes(crop) ? prev.filter(c => c !== crop) : [...prev, crop]
        );
    };

    const handleComplete = async () => {
        if (!name.trim()) {
            toast.error('Please enter your name');
            setCurrentStep(1);
            return;
        }

        setSaving(true);
        try {
            const updateData: any = {
                name: name.trim(),
                location: location.trim() || undefined,
                language: language as any,
                crop_preferences: selectedCrops,
            };
            if (email.trim()) updateData.email = email.trim();
            if (avatarUrl) updateData.avatar_url = avatarUrl;

            const res = await authApi.updateProfile(updateData);
            localStorage.setItem('user', JSON.stringify(res.data));
            toast.success('Profile completed! Welcome to Digital Krishi 🌾');
            setTimeout(() => router.replace('/dashboard'), 500);
        } catch {
            toast.error('Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    const steps = [
        { num: 1, label: 'Personal Info' },
        { num: 2, label: 'Preferences' },
        { num: 3, label: 'Complete' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-krishi-green/8 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-amber-100/20 to-transparent rounded-full blur-3xl" />

            <div className="w-full max-w-2xl relative z-10">
                {/* Logo */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-krishi-green to-emerald-400 rounded-xl flex items-center justify-center shadow-lg shadow-green-200">
                        <Sprout className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-2xl font-black text-gray-900">Digital <span className="text-krishi-green">Krishi</span></span>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    {steps.map((s, i) => (
                        <div key={s.num} className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentStep(s.num)}
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${currentStep >= s.num
                                        ? 'bg-gradient-to-br from-krishi-green to-emerald-500 text-white shadow-md shadow-green-200'
                                        : 'bg-gray-100 text-gray-400'
                                    }`}
                            >
                                {currentStep > s.num ? <Check className="w-5 h-5" /> : s.num}
                            </button>
                            <span className={`text-xs font-medium hidden sm:block ${currentStep >= s.num ? 'text-krishi-green' : 'text-gray-400'}`}>
                                {s.label}
                            </span>
                            {i < steps.length - 1 && <div className={`w-12 h-0.5 ${currentStep > s.num ? 'bg-krishi-green' : 'bg-gray-200'}`} />}
                        </div>
                    ))}
                </div>

                <Card className="shadow-2xl border-0 rounded-3xl overflow-hidden">
                    {/* Step 1: Personal Info */}
                    {currentStep === 1 && (
                        <>
                            <div className="bg-gradient-to-r from-krishi-green to-emerald-500 px-8 py-6 text-white">
                                <h2 className="text-xl font-bold">Let's set up your profile</h2>
                                <p className="text-sm opacity-80 mt-1">Tell us about yourself so we can personalize your experience</p>
                            </div>
                            <CardContent className="p-8 space-y-6">
                                {/* Avatar Upload */}
                                <div className="flex justify-center">
                                    <div className="relative">
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-28 h-28 rounded-full bg-gradient-to-br from-krishi-green/20 to-emerald-100 border-4 border-white shadow-xl flex items-center justify-center cursor-pointer overflow-hidden group hover:shadow-2xl transition-all duration-300"
                                        >
                                            {avatarPreview ? (
                                                <img src={avatarPreview.startsWith('/') ? `${API_BASE_URL}${avatarPreview}` : avatarPreview}
                                                    alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-center">
                                                    <Camera className="w-8 h-8 text-krishi-green mx-auto group-hover:scale-110 transition-transform" />
                                                    <span className="text-[10px] text-gray-500 mt-1 block">Add Photo</span>
                                                </div>
                                            )}
                                        </div>
                                        {avatarPreview && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setAvatarPreview(''); setAvatarUrl(''); }}
                                                className="absolute top-0 right-0 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                    </div>
                                </div>

                                {/* Name */}
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                                        <User className="w-4 h-4 text-gray-400" /> Full Name <span className="text-red-400">*</span>
                                    </label>
                                    <Input
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Enter your full name"
                                        className="h-12 text-base"
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                                        <Mail className="w-4 h-4 text-gray-400" /> Email <span className="text-gray-400 text-xs font-normal">(optional)</span>
                                    </label>
                                    <Input
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="farmer@email.com"
                                        type="email"
                                        className="h-12 text-base"
                                    />
                                </div>

                                {/* Location */}
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                                        <MapPin className="w-4 h-4 text-gray-400" /> Location <span className="text-gray-400 text-xs font-normal">(village/city, state)</span>
                                    </label>
                                    <Input
                                        value={location}
                                        onChange={e => setLocation(e.target.value)}
                                        placeholder="e.g. Pune, Maharashtra"
                                        className="h-12 text-base"
                                    />
                                </div>

                                {/* Phone (read-only) */}
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                                        <Sprout className="w-4 h-4 text-gray-400" /> Phone Number
                                    </label>
                                    <Input
                                        value={`+91 ${phone}`}
                                        readOnly
                                        className="h-12 text-base bg-gray-50 text-gray-500 cursor-not-allowed"
                                    />
                                </div>

                                <Button
                                    onClick={() => {
                                        if (!name.trim()) { toast.error('Name is required'); return; }
                                        setCurrentStep(2);
                                    }}
                                    className="w-full h-12 bg-gradient-to-r from-krishi-green to-emerald-500 hover:from-krishi-dark hover:to-emerald-600 text-base font-semibold gap-2"
                                >
                                    Continue <ArrowRight className="w-4 h-4" />
                                </Button>
                            </CardContent>
                        </>
                    )}

                    {/* Step 2: Preferences */}
                    {currentStep === 2 && (
                        <>
                            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-6 text-white">
                                <h2 className="text-xl font-bold">Your Farming Preferences</h2>
                                <p className="text-sm opacity-80 mt-1">Select your crops and preferred language</p>
                            </div>
                            <CardContent className="p-8 space-y-6">
                                {/* Language Selection */}
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                                        <Globe className="w-4 h-4 text-gray-400" /> Preferred Language
                                    </label>
                                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                        {LANGUAGES.map(lang => (
                                            <button
                                                key={lang.code}
                                                onClick={() => setLanguage(lang.code)}
                                                className={`p-3 rounded-xl text-center transition-all duration-200 border-2 ${language === lang.code
                                                        ? 'border-krishi-green bg-krishi-green/10 shadow-md'
                                                        : 'border-gray-100 hover:border-gray-200 bg-white'
                                                    }`}
                                            >
                                                <p className="text-sm font-bold text-gray-800">{lang.native}</p>
                                                <p className="text-[10px] text-gray-400">{lang.name}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Crop Selection */}
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                                        <Leaf className="w-4 h-4 text-gray-400" /> Your Crops
                                    </label>
                                    <p className="text-xs text-gray-400 mb-3">Select the crops you grow (you can change later)</p>
                                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                        {CROP_OPTIONS.map(crop => (
                                            <button
                                                key={crop.name}
                                                onClick={() => toggleCrop(crop.name)}
                                                className={`p-3 rounded-xl text-center transition-all duration-200 border-2 ${selectedCrops.includes(crop.name)
                                                        ? 'border-krishi-green bg-krishi-green text-white shadow-md scale-105'
                                                        : 'border-gray-100 hover:border-gray-200 bg-white'
                                                    }`}
                                            >
                                                <span className="text-xl block mb-1">{crop.emoji}</span>
                                                <p className={`text-xs font-medium ${selectedCrops.includes(crop.name) ? 'text-white' : 'text-gray-600'}`}>
                                                    {crop.name}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                    {selectedCrops.length > 0 && (
                                        <p className="text-xs text-krishi-green font-medium mt-2">
                                            ✓ {selectedCrops.length} crop{selectedCrops.length > 1 ? 's' : ''} selected
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => setCurrentStep(1)}
                                        className="flex-1 h-12 gap-1"
                                    >
                                        <ChevronLeft className="w-4 h-4" /> Back
                                    </Button>
                                    <Button
                                        onClick={() => setCurrentStep(3)}
                                        className="flex-1 h-12 bg-gradient-to-r from-krishi-green to-emerald-500 hover:from-krishi-dark hover:to-emerald-600 font-semibold gap-2"
                                    >
                                        Review <ArrowRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </>
                    )}

                    {/* Step 3: Review & Complete */}
                    {currentStep === 3 && (
                        <>
                            <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-8 py-6 text-white">
                                <h2 className="text-xl font-bold">Review Your Profile</h2>
                                <p className="text-sm opacity-80 mt-1">Make sure everything looks good</p>
                            </div>
                            <CardContent className="p-8 space-y-5">
                                {/* Profile Preview */}
                                <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-2xl p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-krishi-green to-emerald-400 flex items-center justify-center overflow-hidden shadow-lg border-4 border-white">
                                            {avatarPreview ? (
                                                <img src={avatarPreview.startsWith('/') ? `${API_BASE_URL}${avatarPreview}` : avatarPreview}
                                                    alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-3xl font-bold text-white">{name?.[0]?.toUpperCase() || 'F'}</span>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900">{name || 'Farmer'}</h3>
                                            <p className="text-sm text-gray-500">+91 {phone}</p>
                                            {location && (
                                                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                                    <MapPin className="w-3 h-3" /> {location}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-blue-50 rounded-xl p-4">
                                        <p className="text-xs font-medium text-blue-600 mb-1">Email</p>
                                        <p className="text-sm font-bold text-gray-800">{email || 'Not set'}</p>
                                    </div>
                                    <div className="bg-purple-50 rounded-xl p-4">
                                        <p className="text-xs font-medium text-purple-600 mb-1">Language</p>
                                        <p className="text-sm font-bold text-gray-800">
                                            {LANGUAGES.find(l => l.code === language)?.name || 'English'}
                                        </p>
                                    </div>
                                </div>

                                {/* Crops */}
                                {selectedCrops.length > 0 && (
                                    <div className="bg-green-50 rounded-xl p-4">
                                        <p className="text-xs font-medium text-green-600 mb-2">Crops ({selectedCrops.length})</p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedCrops.map(crop => {
                                                const c = CROP_OPTIONS.find(o => o.name === crop);
                                                return (
                                                    <span key={crop} className="bg-white border border-green-200 px-3 py-1 rounded-full text-sm font-medium text-gray-700">
                                                        {c?.emoji} {crop}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setCurrentStep(2)}
                                        className="flex-1 h-12 gap-1"
                                    >
                                        <ChevronLeft className="w-4 h-4" /> Edit
                                    </Button>
                                    <Button
                                        onClick={handleComplete}
                                        disabled={loading}
                                        className="flex-1 h-12 bg-gradient-to-r from-krishi-green to-emerald-500 hover:from-krishi-dark hover:to-emerald-600 font-semibold gap-2 shadow-lg shadow-green-200"
                                    >
                                        {loading ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <><Check className="w-5 h-5" /> Complete Profile</>
                                        )}
                                    </Button>
                                </div>

                                <button
                                    onClick={() => router.replace('/dashboard')}
                                    className="text-sm text-gray-400 hover:text-gray-600 w-full text-center mt-2"
                                >
                                    Skip for now →
                                </button>
                            </CardContent>
                        </>
                    )}
                </Card>
            </div>
        </div>
    );
}
