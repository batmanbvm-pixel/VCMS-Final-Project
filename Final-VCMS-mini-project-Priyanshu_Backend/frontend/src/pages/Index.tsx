import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Activity, ArrowRight, Shield, Video, Brain, Stethoscope,
  CalendarDays, FileText, Star, CheckCircle, Users, Clock,
  Zap, Heart, Lock, ChevronRight,
} from "lucide-react";

const Index = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(`/${user.role}`, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-sky-100 mx-auto flex items-center justify-center animate-pulse">
            <Activity className="h-6 w-6 text-sky-500" />
          </div>
          <p className="text-slate-600">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: Shield,
      title: "Bank-Grade Security",
      desc: "End-to-end encrypted data with role-based access control for patients, doctors, and admins.",
    },
    {
      icon: CalendarDays,
      title: "Smart Appointments",
      desc: "Book, reschedule, or cancel appointments in seconds. Real-time availability every time.",
    },
    {
      icon: Video,
      title: "Video Consultations",
      desc: "WebRTC-powered peer-to-peer video calls. No downloads, no plugins — just open and connect.",
    },
    {
      icon: FileText,
      title: "Digital Prescriptions",
      desc: "Doctors issue prescriptions instantly during the call. Patients access them on any device.",
    },
    {
      icon: Brain,
      title: "AI Report Analyzer",
      desc: "Upload medical reports and get AI-powered summaries in plain language — no medical jargon.",
    },
    {
      icon: Stethoscope,
      title: "Find Specialists",
      desc: "Browse verified doctors by specialization, location, and availability. Book in one tap.",
    },
  ];

  const steps = [
    { step: "01", title: "Create Your Account", desc: "Sign up as a patient or doctor in under 2 minutes." },
    { step: "02", title: "Find a Doctor", desc: "Browse specialists by symptom, specialization, or location." },
    { step: "03", title: "Book & Consult", desc: "Pick a slot and connect via video consultation." },
    { step: "04", title: "Get Your Prescription", desc: "Receive a digital prescription and AI-powered health summary." },
  ];

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* ── REFINED HERO ── */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden bg-white">

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left side - text */}
            <div className="space-y-8 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-100 border border-sky-200 text-sky-700 text-sm font-medium">
                <Zap className="h-4 w-4" />
                India's Virtual Clinic Platform
              </div>
              <h1 className="text-5xl sm:text-6xl xl:text-7xl font-bold leading-[1.05] tracking-tight text-slate-900">
                Healthcare{" "}
                <span className="text-sky-500 inline-block">
                  Reimagined
                </span>{" "}
                for 2026
              </h1>
              <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-lg">
                Connect with verified doctors via video consultation, get digital prescriptions, upload medical reports for AI analysis — all from your browser with <span className="text-sky-600 font-semibold">bank-grade security</span>.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="sm"
                  className="h-9 px-6 text-xs btn-premium"
                  asChild
                >
                  <Link to="/guest-booking">Browse Doctors</Link>
                </Button>
                <Button
                  size="sm"
                  className="h-9 px-6 text-xs border border-slate-300 text-slate-700 hover:bg-slate-50"
                  variant="outline"
                  asChild
                >
                  <Link to="/login">Sign In</Link>
                </Button>
              </div>
              <div className="flex items-center gap-3 text-slate-600 text-sm">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Free to join · No credit card required · AI-Powered
              </div>
            </div>

            {/* Right side - demo cards */}
            <div className="hidden lg:flex items-center justify-center relative">
              <div className="relative w-full max-w-sm space-y-6 animate-scale-in"
                   style={{animationDelay: '0.3s'}}>
                {/* Doctor card */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-sky-400 to-sky-500 flex items-center justify-center text-white font-bold text-lg">R</div>
                    <div className="flex-1">
                      <p className="text-slate-900 font-semibold text-base">Dr. Rajesh Kumar</p>
                      <p className="text-slate-600 text-sm">Cardiologist · 15+ years</p>
                    </div>
                    <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                  </div>
                  <div className="flex gap-3">
                    <Button size="sm" className="flex-1 btn-premium text-xs h-9 transition-all duration-200 hover:scale-105">Book ₹500</Button>
                    <Button size="sm" variant="outline" className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-50 text-xs h-9 transition-all duration-200 hover:scale-105" aria-label="Preview video consultation action" title="Preview video consultation"><Video className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                
                {/* Verified badge */}
                <div className="absolute -top-4 -right-4 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg">
                  <CheckCircle className="h-3.5 w-3.5 inline mr-1" />
                  Verified
                </div>
                
                {/* Prescription preview */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-6 ml-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-sky-500 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-slate-900 text-base font-semibold">Digital Rx</p>
                  </div>
                  <div className="space-y-3">
                    <div className="h-2.5 bg-slate-200 rounded-full w-full" />
                    <div className="h-2.5 bg-slate-200 rounded-full w-4/5" />
                    <div className="h-2.5 bg-slate-100 rounded-full w-3/5" />
                  </div>
                  <div className="flex items-center gap-2 mt-4 text-sky-600 text-xs font-semibold">
                    <Brain className="h-4 w-4" />
                    AI Analysis Ready →
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-24 bg-slate-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl relative z-10">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-100 border border-sky-200 text-sky-700 text-xs font-semibold tracking-widest uppercase">
              <Star className="h-4 w-4" />
              Why MediConnect
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
              Everything for{" "}
              <span className="text-sky-500">modern healthcare</span>
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              One platform for patients, doctors, and administrators — built for speed, security, and simplicity.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md p-7 group hover:border-sky-300 transition-all duration-200 hover:scale-[1.02]">
                <div className="h-12 w-12 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center mb-5">
                  <Icon className="h-6 w-6 text-sky-500" />
                </div>
                <h3 className="text-slate-900 font-semibold text-lg mb-3">{title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl relative z-10">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-100 border border-sky-200 text-sky-700 text-xs font-semibold tracking-widest uppercase">
              <Zap className="h-4 w-4" />
              Simple Process
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">How it works</h2>
            <p className="text-slate-600 text-lg max-w-xl mx-auto">Get started in under 5 minutes</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map(({ step, title, desc }, index) => (
              <div key={step} className="relative group">
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md p-6 h-full transition-all duration-200 hover:scale-[1.02]">
                  <div className="text-5xl font-bold text-sky-500/30 mb-4 select-none">{step}</div>
                  <h3 className="font-semibold text-slate-900 text-base mb-2">{title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{desc}</p>
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2">
                      <ChevronRight className="h-5 w-5 text-sky-500/50" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 bg-slate-50 relative overflow-hidden">
        <div className="container mx-auto px-4 text-center space-y-8 max-w-2xl relative z-10">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center">
              <Heart className="h-8 w-8 text-sky-500" />
            </div>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
            Your health, on{" "}
            <span className="text-sky-500">your terms</span>
          </h2>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            Join thousands of patients and doctors who trust MediConnect for seamless virtual healthcare.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="sm" className="h-9 px-6 text-xs btn-premium transition-all duration-200 hover:scale-105" asChild>
              <Link to="/guest-booking">Browse Doctors</Link>
            </Button>
            <Button size="sm" className="h-9 px-6 text-xs border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all duration-200 hover:scale-105" variant="outline" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-slate-600 text-sm pt-4">
            <span className="flex items-center gap-2"><Lock className="h-4 w-4" /> Bank-Grade Security</span>
            <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> No Credit Card</span>
            <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Free Forever</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-slate-200 relative overflow-hidden">
        <div className="container mx-auto px-4 max-w-6xl py-12 relative z-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex gap-8 text-sm">
              <Link to="/about-us" className="text-slate-600 hover:text-slate-700 transition-colors">About</Link>
              <Link to="/contact" className="text-slate-600 hover:text-slate-700 transition-colors">Contact</Link>
              <Link to="/login" className="text-slate-600 hover:text-slate-700 transition-colors">Sign In</Link>
              <Link to="/register" className="text-slate-600 hover:text-slate-700 transition-colors">Register</Link>
            </div>
          </div>
          <div className="border-t border-slate-200 mt-8 pt-8 text-center">
            <p className="text-xs text-slate-500">© 2026 MediConnect. All rights reserved. Built with ❤️ in India.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
