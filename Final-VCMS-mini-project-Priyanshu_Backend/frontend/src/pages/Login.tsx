import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Validation functions
  const validateEmail = (email: string) => {
    if (!email) return false;
    const trimmed = email.trim();
    const basicRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!basicRegex.test(trimmed)) return false;
    const parts = trimmed.split('@');
    if (parts.length !== 2) return false;
    const domain = parts[1].toLowerCase();
    // Only allow Gmail addresses for this project
    return domain === 'gmail.com';
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!email || !validateEmail(email)) {
      newErrors.email = "Valid Gmail address is required (example@gmail.com)";
    }

    if (!password || password.length < 1) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateField = (name: string, value: string) => {
    const newErrors: Record<string, string> = { ...errors };
    const setError = (k: string, msg: string) => { newErrors[k] = msg; };
    const clearError = (k: string) => { delete newErrors[k]; };

    if (name === "email") {
      if (!validateEmail(value)) setError("email", "Valid Gmail address is required (example@gmail.com)");
      else clearError("email");
    }

    if (name === "password") {
      if (!value || value.length < 1) setError("password", "Password is required");
      else clearError("password");
    }

    setErrors(newErrors);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    validateField(name, value);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    // Clear error when user starts typing
    if (errors.email) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.email;
        return newErrors;
      });
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    // Clear error when user starts typing
    if (errors.password) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.password;
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    const result = await login(email.trim().toLowerCase(), password);

    if (result.success) {
      const role = result.user?.role;
      toast({ title: "Success", description: "Login successful!" });
      
      if (role === "admin") {
        navigate("/admin");
      } else if (role === "doctor") {
        navigate("/doctor");
      } else if (role === "patient") {
        navigate("/patient");
      } else {
        navigate("/");
      }
    } else {
      setErrors({ submit: result.message });
    }
    
    setLoading(false);
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-[450px] bg-white rounded-2xl border border-slate-200 shadow-lg p-10">
        <div className="space-y-3 mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-slate-600">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {errors.submit && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errors.submit}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-700 font-medium">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleBlur}
              className={`input-premium h-12 ${errors.email ? "border-red-500" : ""}`}
            />
            {errors.email && <p className="text-xs text-red-600 font-medium">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
              <button type="button" onClick={() => navigate("/forgot-password")} className="text-xs text-sky-600 hover:text-sky-700 font-medium transition-all duration-200 hover:underline">
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={handlePasswordChange}
                onBlur={handleBlur}
                className={`input-premium h-12 pr-12 ${errors.password ? "border-red-500" : ""}`}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-all duration-200 hover:scale-105" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-600">{errors.password}</p>}
          </div>

          {/* Demo credentials card */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">📖 Demo Credentials</p>
            <div className="space-y-2 text-xs text-slate-600">
              <p><span className="font-semibold text-slate-900">⚙️ Admin:</span> admin@gmail.com / 12345</p>
              <p><span className="font-semibold text-slate-900">👨‍⚕️ Doctor:</span></p>
              <p className="ml-4">• rudra12@gmail.com / Preet@2412</p>
              <p className="ml-4">• naruto1821uzumaki@gmail.com / Preet@2412</p>
              <p><span className="font-semibold text-slate-900">👤 Patient:</span></p>
              <p className="ml-4">• preetp2412@gmail.com / Preet@2412</p>
              <p className="ml-4">• preet12@gmail.com / Preet@2412</p>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full btn-premium h-12 text-base gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2"><span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</span>
            ) : (
              <span className="flex items-center gap-2">Sign In <ArrowRight className="h-5 w-5" /></span>
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-600 mt-8">
          Don't have an account?{" "}
          <Link to="/register" className="text-sky-600 hover:text-sky-700 font-semibold">Create one free</Link>
        </p>
      </div>
    </div>
  );
};
export default Login;
