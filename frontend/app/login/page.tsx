'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sprout, ChevronRight, CheckCircle, Phone, ArrowLeft,
  Shield, Scan, Bot, TrendingUp, RefreshCw, Clock
} from 'lucide-react';
import { authApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) router.replace('/dashboard');
  }, []);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setTimeout(() => setResendTimer(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const handleSendOtp = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      const response = await authApi.sendOTP(email);
      
      if (response.data.otp) {
        toast.success(`OTP sent to your email address ✓`);
      } else {
        toast.success('OTP sent to your email address ✓');
      }
      
      setStep('otp');
      setResendTimer(60); // 60 second cooldown before resend
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) {
      toast.error('Enter the OTP sent to your email');
      return;
    }
    setLoading(true);
    try {
      const response = await authApi.verifyOTP(email, otp);
      const { access_token, user, is_new_user } = response.data;

      // Store auth data
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));

      // Route based on is_new_user flag from backend
      if (is_new_user) {
        toast.success('Welcome to Digital Krishi! Let\'s set up your profile.');
        setTimeout(() => router.replace('/register'), 300);
      } else {
        toast.success(`Welcome back, ${user.name}! 🌾`);
        setTimeout(() => router.replace('/dashboard'), 300);
      }
    } catch (error: any) {
      const msg = error.response?.data?.detail;
      if (msg?.includes('expired')) {
        toast.error('OTP has expired. Please request a new one.');
        setStep('email');
        setOtp('');
      } else if (msg?.includes('Invalid OTP')) {
        toast.error('Wrong OTP. Please check and try again.');
        setOtp('');
      } else {
        toast.error(msg || 'Login failed. Please try again.');
      }
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
                {step === 'email' ? 'Login / Register' : 'Verify OTP'}
              </h2>
              <p className="text-sm opacity-80 mt-1">
                {step === 'email'
                  ? 'Enter your email address to continue'
                  : `OTP sent to ${email}`}
              </p>
            </div>

            <CardContent className="p-8 space-y-6">
              {step === 'email' ? (
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Email Address</label>
                    <div className="relative">
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-14 text-lg font-medium"
                        onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={email.length < 5 || loading}
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
                  {/* Real Email notification */}
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">OTP sent via Email</p>
                      <p className="text-xs text-green-600 mt-0.5">
                        Check your inbox at {email}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Enter OTP</label>
                    <Input
                      placeholder="• • • • • •"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="h-14 text-center text-2xl tracking-[0.5em] font-bold"
                      onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                      autoFocus
                    />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> OTP valid for 5 minutes
                      </p>
                      <button
                        onClick={handleSendOtp}
                        disabled={resendTimer > 0 || loading}
                        className="text-xs text-krishi-green hover:text-krishi-dark font-semibold flex items-center gap-1 disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                      </button>
                    </div>
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
                    onClick={() => { setStep('email'); setDemoOtp(''); setOtp(''); setResendTimer(0); }}
                    className="flex items-center justify-center gap-1 text-sm text-krishi-green hover:text-krishi-dark font-medium w-full"
                  >
                    <ArrowLeft className="w-4 h-4" /> Change email address
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