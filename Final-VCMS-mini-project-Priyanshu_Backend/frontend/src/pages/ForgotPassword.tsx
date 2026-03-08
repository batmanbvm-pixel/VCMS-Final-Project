import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, Check, Clock, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/services/api";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(`/${user.role}`, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Stage: "request" | "verify" | "reset" | "success"
  const [stage, setStage] = useState<"request" | "verify" | "reset" | "success">("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [devOtp, setDevOtp] = useState<string>("");

  // Start OTP timer
  const startOtpTimer = () => {
    setOtpTimer(60);
    const interval = setInterval(() => {
      setOtpTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

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

  const handleEmailInput = (value: string) => {
    setEmail(value);
    if (!value.trim()) {
      setErrors((prev) => ({ ...prev, email: "Email is required" }));
      return;
    }
    if (!validateEmail(value)) {
      setErrors((prev) => ({ ...prev, email: "Valid Gmail address is required (example@gmail.com)" }));
      return;
    }
    setErrors((prev) => {
      const updated = { ...prev };
      if (updated.email) delete updated.email;
      return updated;
    });
  };

  const validatePassword = (value: string) => {
    const regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(value);
  };

  // Step 1: Request Email OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setDevOtp("");

    if (!validateEmail(email)) {
      setErrors({ email: "Valid Gmail address is required (example@gmail.com)" });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/send-email-otp", { email: email.trim().toLowerCase() });

      if (response.data.success) {
        if (response.data.otp) {
          setDevOtp(response.data.otp);
        }
        toast({
          title: "OTP Sent Successfully",
          description: `OTP has been sent to ${email}`,
        });
        setStage("verify");
        startOtpTimer();
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || "Failed to send OTP";
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      setErrors({ general: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Email OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!otp || otp.length !== 6) {
      setErrors({ otp: "OTP must be 6 digits" });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/verify-email-otp", { email, code: otp });

      if (response.data.success) {
        toast({
          title: "OTP Verified",
          description: "Now you can reset your password",
        });
        setStage("reset");
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || "Failed to verify OTP";
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      setErrors({ otp: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password with Email OTP
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!newPassword || !confirmPassword) {
      setErrors({ password: "Both password fields are required" });
      return;
    }

    if (!validatePassword(newPassword)) {
      setErrors({
        password: "Password must be 8+ chars with uppercase, number, special char",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/reset-password-email", {
        email,
        code: otp,
        newPassword,
        confirmPassword,
      });

      if (response.data.success) {
        setStage("success");
        toast({
          title: "Success",
          description: "Password reset successfully",
        });

        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || "Failed to reset password";
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      setErrors({ general: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (otpTimer > 0) return;
    setOtp("");
    await handleRequestOtp({
      preventDefault: () => {},
    } as React.FormEvent);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-white">
      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Lock className="h-6 w-6" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reset Password</h1>
          <p className="text-slate-700">Recover your account securely</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-between px-2 my-6">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold text-sm transition-all ${
              stage === "request" || ["verify", "reset", "success"].includes(stage)
                ? "bg-sky-500 text-white"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {["verify", "reset", "success"].includes(stage) ? <Check className="h-4 w-4" /> : "1"}
          </div>
          <div className={`flex-1 h-1 mx-2 rounded transition-all ${
            ["verify", "reset", "success"].includes(stage) ? "bg-sky-500" : "bg-slate-200"
          }`} />
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold text-sm transition-all ${
              stage === "verify" || ["reset", "success"].includes(stage)
                ? "bg-sky-500 text-white"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {["reset", "success"].includes(stage) ? <Check className="h-4 w-4" /> : "2"}
          </div>
          <div className={`flex-1 h-1 mx-2 rounded transition-all ${
            ["reset", "success"].includes(stage) ? "bg-sky-500" : "bg-slate-200"
          }`} />
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold text-sm transition-all ${
              stage === "reset" || stage === "success"
                ? "bg-sky-500 text-white"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {stage === "success" ? <Check className="h-4 w-4" /> : "3"}
          </div>
        </div>

        {/* Success Screen */}
        {stage === "success" && (
          <Card className="shadow-md bg-white rounded-xl overflow-hidden border-sky-200">
            <CardContent className="pt-12 text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-sky-50 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-sky-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-sky-600">Password Reset Successful!</h2>
              <p className="text-slate-700">
                Your password has been reset successfully. Redirecting to login page...
              </p>
              <div className="pt-4">
                <Button
                  onClick={() => navigate("/login")}
                  className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold transition-all duration-200 hover:scale-105"
                >
                  Go to Login
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Request OTP Stage */}
        {stage === "request" && (
          <Card className="shadow-md bg-white rounded-xl overflow-hidden border-slate-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-slate-900">Reset Password</CardTitle>
              <CardDescription className="text-slate-700">We'll send an OTP to verify your email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-900 font-semibold">
                    Email Address *
                  </Label>
                  <div className="relative">
                    <AlertCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="your.email@gmail.com"
                      value={email}
                      onChange={(e) => handleEmailInput(e.target.value)}
                      onBlur={() => {
                        if (!email.trim()) {
                          setErrors((prev) => ({ ...prev, email: "Email is required" }));
                        } else if (!validateEmail(email)) {
                          setErrors((prev) => ({ ...prev, email: "Valid Gmail address is required (example@gmail.com)" }));
                        }
                      }}
                      className={`pl-10 border-2 bg-white transition-all duration-200 focus:ring-2 focus:ring-sky-200 ${
                        errors.email ? "border-red-500" : "border-slate-200 focus:border-sky-500"
                      }`}
                    />
                  </div>
                  {errors.email && <p className="text-xs text-red-600 font-medium">{errors.email}</p>}
                  <p className="text-xs text-slate-600 mt-1">OTP will be sent to your email</p>
                </div>

                {errors.general && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-700">{errors.general}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={loading || !email || !validateEmail(email)}
                  className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold transition-all duration-200 hover:scale-105"
                >
                  {loading ? "Sending OTP..." : "Send OTP"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Verify OTP Stage */}
        {stage === "verify" && (
          <Card className="shadow-md bg-white rounded-xl overflow-hidden border-slate-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-slate-900">Verify OTP</CardTitle>
              <CardDescription className="text-slate-700">Enter the 6-digit OTP sent to your email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-slate-900 font-semibold">
                    OTP Code *
                  </Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
                    <Input
                      id="otp"
                      type="text"
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setOtp(cleaned);
                        if (errors.otp) delete errors.otp;
                      }}
                      maxLength={6}
                      className={`pl-10 text-center text-lg tracking-widest border-2 font-mono bg-white transition-all duration-200 focus:ring-2 focus:ring-sky-200 ${
                        errors.otp ? "border-red-500" : "border-slate-200 focus:border-sky-500"
                      }`}
                    />
                  </div>
                  {errors.otp && <p className="text-xs text-red-600 font-medium">{errors.otp}</p>}
                </div>

                {otpTimer > 0 ? (
                  <p className="text-xs text-slate-600 text-center">
                    Resend OTP in {otpTimer}s
                  </p>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-sky-600 font-semibold hover:bg-sky-50 transition-all duration-200 hover:scale-105"
                    onClick={handleResendOtp}
                  >
                    Resend OTP
                  </Button>
                )}

                {errors.general && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-700">{errors.general}</AlertDescription>
                  </Alert>
                )}

                {devOtp && (
                  <Alert className="bg-sky-50 border-sky-200">
                    <AlertCircle className="h-4 w-4 text-sky-600" />
                    <AlertDescription className="text-sky-800">
                      <strong>Development Mode:</strong> Your OTP code is <span className="font-mono font-bold text-sky-900 bg-sky-100 px-2 py-1 rounded text-base">{devOtp}</span>
                      <br />
                      <span className="text-xs text-sky-700 mt-1 inline-block">Real email has been sent to {email}</span>
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold transition-all duration-200 hover:scale-105"
                >
                  {loading ? "Verifying..." : "Verify OTP"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Reset Password Stage */}
        {stage === "reset" && (
          <Card className="shadow-md bg-white rounded-xl overflow-hidden border-slate-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-slate-900">Set New Password</CardTitle>
              <CardDescription className="text-slate-700">Create a strong password for your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-slate-900 font-semibold">
                    New Password *
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (errors.password) delete errors.password;
                    }}
                    className={`border-2 bg-white transition-all duration-200 focus:ring-2 focus:ring-sky-200 ${
                      errors.password ? "border-red-500" : "border-slate-200 focus:border-sky-500"
                    }`}
                  />
                  {errors.password && <p className="text-xs text-red-600 font-medium">{errors.password}</p>}
                  <p className="text-xs text-slate-600">
                    Minimum 8 characters with 1 uppercase, 1 number, 1 special character
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-900 font-semibold">
                    Confirm Password *
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) delete errors.confirmPassword;
                    }}
                    className={`border-2 bg-white transition-all duration-200 focus:ring-2 focus:ring-sky-200 ${
                      errors.confirmPassword
                        ? "border-red-500"
                        : "border-slate-200 focus:border-sky-500"
                    }`}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-red-600 font-medium">{errors.confirmPassword}</p>
                  )}
                </div>

                {errors.general && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-700">{errors.general}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={loading || !newPassword || !confirmPassword}
                  className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold transition-all duration-200 hover:scale-105"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Footer Links */}
        {stage !== "success" && (
          <div className="text-center space-y-3">
            <Button
              variant="ghost"
              className="w-full text-sky-600 font-semibold hover:bg-sky-50 gap-2 transition-all duration-200 hover:scale-105"
              onClick={() => navigate("/login")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Button>
            <p className="text-xs text-slate-600">
              Need immediate help?{" "}
              <a href="mailto:support@mediconnect.com" className="text-sky-600 hover:underline font-semibold">
                Contact Support
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
