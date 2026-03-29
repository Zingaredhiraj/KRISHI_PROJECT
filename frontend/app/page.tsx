'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sprout, Scan, Bot, TrendingUp, Cloud, Users, Shield, ChevronRight,
  Leaf, Zap, BarChart3, MessageSquare, Award, ArrowRight, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const FEATURES = [
  {
    icon: Scan,
    title: 'AI Disease Detection',
    desc: 'Upload crop photos and get instant disease identification with treatment recommendations using advanced AI.',
    gradient: 'from-rose-500 to-orange-400',
    bg: 'bg-rose-50',
  },
  {
    icon: Bot,
    title: 'Smart Farming Assistant',
    desc: 'Ask any farming question in your language. Get expert guidance on crops, pests, fertilizers & more.',
    gradient: 'from-blue-500 to-cyan-400',
    bg: 'bg-blue-50',
  },
  {
    icon: TrendingUp,
    title: 'Live Market Prices',
    desc: 'Track real-time prices of crops from major Indian markets. Make informed selling decisions.',
    gradient: 'from-emerald-500 to-green-400',
    bg: 'bg-emerald-50',
  },
  {
    icon: Cloud,
    title: 'Weather Forecasts',
    desc: 'Accurate weather forecasts tailored to your location. Plan sowing, irrigation & harvest perfectly.',
    gradient: 'from-violet-500 to-purple-400',
    bg: 'bg-violet-50',
  },
  {
    icon: Users,
    title: 'Farmer Community',
    desc: 'Connect with fellow farmers, share experiences, ask questions and learn from each other.',
    gradient: 'from-amber-500 to-yellow-400',
    bg: 'bg-amber-50',
  },
  {
    icon: Shield,
    title: 'Govt Schemes',
    desc: 'Discover and apply for government agricultural schemes. Never miss a subsidy or benefit.',
    gradient: 'from-teal-500 to-emerald-400',
    bg: 'bg-teal-50',
  },
];

const STATS = [
  { value: '10,000+', label: 'Active Farmers' },
  { value: '38+', label: 'Crop Diseases Detected' },
  { value: '24/7', label: 'AI Support' },
  { value: '15+', label: 'Markets Tracked' },
];

export default function LandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // If already logged in, go to dashboard
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      router.replace('/dashboard');
    }
  }, []);

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* ========= NAVBAR ========= */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-krishi-green to-emerald-400 rounded-xl flex items-center justify-center shadow-lg shadow-green-200">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold text-gray-900">Digital <span className="text-krishi-green">Krishi</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-krishi-green transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-krishi-green transition-colors">How It Works</a>
            <a href="#stats" className="hover:text-krishi-green transition-colors">Impact</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.push('/login')} className="hidden sm:flex text-gray-600">
              Login
            </Button>
            <Button onClick={() => router.push('/login')} className="bg-krishi-green hover:bg-krishi-dark shadow-lg shadow-green-200 gap-2">
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ========= HERO SECTION ========= */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-50/80 via-white to-emerald-50/60" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-gradient-to-br from-krishi-green/10 to-emerald-300/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-amber-200/20 to-yellow-100/20 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left Content */}
            <div className={`space-y-8 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
              <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5">
                <Zap className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700">AI-Powered Farming Platform</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-tight">
                Grow Smarter with{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-krishi-green via-emerald-500 to-teal-500">
                  Digital Krishi
                </span>
              </h1>

              <p className="text-lg text-gray-600 max-w-xl leading-relaxed">
                India's most advanced AI farming assistant. Detect crop diseases instantly,
                get real-time market prices, weather forecasts, and expert guidance — all in your language.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  onClick={() => router.push('/login')}
                  className="h-14 px-8 bg-gradient-to-r from-krishi-green to-emerald-500 hover:from-krishi-dark hover:to-emerald-600 shadow-xl shadow-green-200 text-lg gap-2"
                >
                  <Sprout className="w-5 h-5" /> Start Free — Join Now
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  className="h-14 px-8 text-lg border-2"
                >
                  Explore Features
                </Button>
              </div>

              {/* Trust badges */}
              <div className="flex items-center gap-6 pt-4">
                <div className="flex -space-x-2">
                  {['bg-green-400', 'bg-blue-400', 'bg-amber-400', 'bg-rose-400', 'bg-purple-400'].map((bg, i) => (
                    <div key={i} className={`w-8 h-8 ${bg} rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold`}>
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                  </div>
                  <p className="text-sm text-gray-500">Trusted by 10,000+ farmers</p>
                </div>
              </div>
            </div>

            {/* Right - Hero Visual */}
            <div className={`relative ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
              <div className="relative bg-gradient-to-br from-krishi-green via-emerald-500 to-teal-500 rounded-3xl p-8 shadow-2xl shadow-green-200/50">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] rounded-3xl" />

                <div className="relative space-y-6 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <Scan className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-lg">Crop Disease Detection</p>
                      <p className="text-sm opacity-80">93.46% accuracy • 38 diseases</p>
                    </div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium opacity-90">Detection Result</span>
                      <span className="bg-green-400 text-green-900 text-xs font-bold px-2 py-1 rounded-full">93.46%</span>
                    </div>
                    <p className="text-xl font-bold">Northern Leaf Blight</p>
                    <p className="text-sm opacity-70 mt-1">Crop: Corn (Maize)</p>
                    <div className="mt-3 flex gap-2">
                      <span className="bg-white/20 text-xs px-3 py-1 rounded-full">Treatment ✓</span>
                      <span className="bg-white/20 text-xs px-3 py-1 rounded-full">Fertilizer ✓</span>
                      <span className="bg-white/20 text-xs px-3 py-1 rounded-full">Prevention ✓</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                      <Cloud className="w-5 h-5 mb-2 opacity-80" />
                      <p className="text-2xl font-bold">28°C</p>
                      <p className="text-xs opacity-70">Pune, MH</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                      <TrendingUp className="w-5 h-5 mb-2 opacity-80" />
                      <p className="text-2xl font-bold">₹2,450</p>
                      <p className="text-xs opacity-70">Wheat/quintal</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating cards */}
              <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl p-4 flex items-center gap-3 border border-gray-100">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                  <Award className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">PM-KISAN</p>
                  <p className="text-xs text-gray-500">₹6,000/year benefit</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========= STATS ========= */}
      <section id="stats" className="py-16 bg-gradient-to-r from-krishi-green via-emerald-600 to-teal-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMyIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA2KSIvPjwvc3ZnPg==')]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl sm:text-4xl font-black text-white">{stat.value}</p>
                <p className="text-sm font-medium text-white/70 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========= FEATURES ========= */}
      <section id="features" className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block bg-green-100 text-green-700 text-sm font-bold px-4 py-1.5 rounded-full mb-4">
              Powerful Features
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
              Everything a Modern Farmer Needs
            </h2>
            <p className="text-lg text-gray-600">
              From AI-powered crop analysis to real-time market intelligence — we've got you covered.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat, i) => (
              <div
                key={i}
                className="group bg-white rounded-2xl p-7 shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100 hover:border-transparent hover:-translate-y-1"
              >
                <div className={`w-14 h-14 ${feat.bg} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <feat.icon className={`w-7 h-7 bg-gradient-to-br ${feat.gradient} bg-clip-text`} style={{ color: 'inherit' }} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{feat.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========= HOW IT WORKS ========= */}
      <section id="how-it-works" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block bg-blue-100 text-blue-700 text-sm font-bold px-4 py-1.5 rounded-full mb-4">
              Simple Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
              Get Started in 3 Easy Steps
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Register with Phone', desc: 'Enter your mobile number and verify with OTP. Complete your farmer profile with crop preferences.', icon: '📱' },
              { step: '02', title: 'Explore Features', desc: 'Access AI assistant, scan crops for diseases, check market prices and weather forecasts.', icon: '🌾' },
              { step: '03', title: 'Grow Your Farm', desc: 'Get personalized recommendations, connect with community, and apply for government schemes.', icon: '🚀' },
            ].map((item, i) => (
              <div key={i} className="relative text-center">
                <div className="text-6xl mb-4">{item.icon}</div>
                <span className="inline-block text-xs font-black text-krishi-green bg-green-50 px-3 py-1 rounded-full mb-3">
                  STEP {item.step}
                </span>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
                {i < 2 && (
                  <ChevronRight className="hidden md:block absolute top-1/4 -right-4 w-8 h-8 text-gray-300" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========= CTA ========= */}
      <section className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-krishi-green/10 to-emerald-500/10" />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Ready to Transform Your Farming?
          </h2>
          <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
            Join thousands of Indian farmers who are already using AI to grow better crops,
            earn more, and farm smarter.
          </p>
          <Button
            size="lg"
            onClick={() => router.push('/login')}
            className="h-14 px-10 bg-gradient-to-r from-krishi-green to-emerald-500 hover:from-krishi-dark hover:to-emerald-600 shadow-xl text-lg gap-2"
          >
            <Sprout className="w-5 h-5" /> Join Digital Krishi — It's Free
          </Button>
        </div>
      </section>

      {/* ========= FOOTER ========= */}
      <footer className="bg-gray-900 border-t border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-krishi-green to-emerald-400 rounded-lg flex items-center justify-center">
                <Sprout className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white">Digital Krishi</span>
            </div>
            <p className="text-sm text-gray-500">© 2026 Digital Krishi. Empowering Indian Agriculture with AI.</p>
            <div className="flex gap-4 text-sm text-gray-500">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
