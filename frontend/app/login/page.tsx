'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sprout, ChevronRight, CheckCircle, Phone, ArrowLeft,
  Shield, Scan, Bot, TrendingUp
} from 'lucide-react';
import { authApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) router.replace('/dashboard');
  }, []);

  const handleSendOtp = async () => {
    if (phone.length < 10) {
      toast.error('Enter valid 10-digit phone number');
      return;
    }
    setLoading(true);
    try {
      const response = await authApi.sendOTP(phone);
      if (response.data.otp) {
        setDemoOtp(response.data.otp);
        toast.success(`OTP sent! (Demo: ${response.data.otp})`);
      } else {
        toast.success('OTP sent successfully');
      }
      setStep('otp');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 4) {
      toast.error('Enter valid OTP');
      return;
    }
    setLoading(true);
    try {
      const response = await authApi.verifyOTP(phone, otp);
      const { access_token, user } = response.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));

      // Check if user is new (default name = "Farmer User") → send to registration
      if (user.name === 'Farmer User' || user.name === 'Farmer') {
        toast.success('Welcome! Please complete your profile.');
        setTimeout(() => router.replace('/register'), 300);
      } else {
        toast.success(`Welcome back, ${user.name}!`);
        setTimeout(() => router.replace('/dashboard'), 300);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 p-4 relative overflow-hidden">
      {/* Background blurs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-krishi-green/10 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-amber-100/30 to-transparent rounded-full blur-3xl" />

      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center relative z-10">

        {/* LEFT HERO */}
        <div className="hidden lg:block">
          <div className="bg-gradient-to-br from-krishi-green via-emerald-600 to-teal-600 text-white rounded-3xl p-10 shadow-2xl shadow-green-200/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')]" />

            <div className="relative">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
                <Sprout className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-black mb-2">Digital Krishi</h2>
              <p className="text-lg opacity-90 mb-8">India's Smartest AI Farming Platform</p>

              <div className="space-y-4">
                {[
                  { icon: Scan, text: 'Detect 38+ crop diseases instantly' },
                  { icon: Bot, text: 'AI assistant in your language' },
                  { icon: TrendingUp, text: 'Live market prices from 15+ markets' },
                  { icon: Shield, text: 'Government schemes & subsidies' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
                      <item.icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium opacity-90">{item.text}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-8 mt-10 pt-8 border-t border-white/20">
                <div>
                  <p className="text-3xl font-black">10K+</p>
                  <p className="text-xs opacity-70 mt-0.5">Active Farmers</p>
                </div>
                <div>
                  <p className="text-3xl font-black">93%</p>
                  <p className="text-xs opacity-70 mt-0.5">Detection Accuracy</p>
                </div>
                <div>
                  <p className="text-3xl font-black">24/7</p>
                  <p className="text-xs opacity-70 mt-0.5">AI Support</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LOGIN CARD */}
        <div>
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-krishi-green to-emerald-400 rounded-xl flex items-center justify-center shadow-lg shadow-green-200">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-black text-gray-900">Digital <span className="text-krishi-green">Krishi</span></span>
          </div>

          <Card className="shadow-2xl border-0 rounded-2xl overflow-hidden">
            {/* Card header */}
            <div className="bg-gradient-to-r from-krishi-green to-emerald-500 px-8 py-6 text-white">
              <h2 className="text-2xl font-bold">
                {step === 'phone' ? 'Welcome Back' : 'Verify Your Number'}
              </h2>
              <p className="text-sm opacity-80 mt-1">
                {step === 'phone'
                  ? 'Enter your mobile number to continue'
                  : `OTP sent to +91 ${phone}`}
              </p>
            </div>

            <CardContent className="p-8 space-y-6">
              {step === 'phone' ? (
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Mobile Number</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        <span className="text-lg">🇮🇳</span>
                        <span className="text-sm font-medium text-gray-500">+91</span>
                        <div className="w-px h-5 bg-gray-300 ml-1" />
                      </div>
                      <Input
                        type="tel"
                        placeholder="Enter 10-digit number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="h-14 text-lg pl-24 font-medium"
                        onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={phone.length < 10 || loading}
                    className="w-full h-14 bg-gradient-to-r from-krishi-green to-emerald-500 hover:from-krishi-dark hover:to-emerald-600 shadow-lg shadow-green-200 text-lg font-semibold gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>Send OTP <ChevronRight className="w-5 h-5" /></>
                    )}
                  </Button>

                  <p className="text-center text-xs text-gray-400">
                    By continuing, you agree to our Terms of Service and Privacy Policy
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {demoOtp && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                        <Shield className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-amber-700">Demo Mode — OTP</p>
                        <p className="text-2xl font-black text-amber-800 tracking-[0.3em]">{demoOtp}</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Enter OTP</label>
                    <Input
                      placeholder="• • • • • •"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="h-14 text-center text-2xl tracking-[0.5em] font-bold"
                      onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={otp.length < 4 || loading}
                    className="w-full h-14 bg-gradient-to-r from-krishi-green to-emerald-500 hover:from-krishi-dark hover:to-emerald-600 shadow-lg shadow-green-200 text-lg font-semibold gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>Verify & Login <CheckCircle className="w-5 h-5" /></>
                    )}
                  </Button>

                  <button
                    onClick={() => { setStep('phone'); setDemoOtp(''); setOtp(''); }}
                    className="flex items-center justify-center gap-1 text-sm text-krishi-green hover:text-krishi-dark font-medium w-full"
                  >
                    <ArrowLeft className="w-4 h-4" /> Change phone number
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-sm text-gray-400 mt-4">
            <button onClick={() => router.push('/')} className="text-krishi-green hover:underline font-medium">
              ← Back to home
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}