import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Mail, Phone, MapPin, Send, Clock, CheckCircle, MessageSquare, ArrowRight } from "lucide-react";
import api from "@/services/api";
import { useNavigate } from "react-router-dom";

export function ContactUs() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Admins don't need this public contact form
  useEffect(() => {
    if (user?.role === "admin") navigate("/admin", { replace: true });
  }, [user, navigate]);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    problemType: "",
    subject: "",
    description: "",
    priority: "medium",
  });

  const problemTypes = [
    { value: "technical-issue", label: "🔧 Technical Issue" },
    { value: "payment-issue", label: "💳 Payment Issue" },
    { value: "account-issue", label: "👤 Account Issue" },
    { value: "appointment-issue", label: "📅 Appointment Issue" },
    { value: "medical-concern", label: "⚕️ Medical Concern" },
    { value: "feedback", label: "💬 Feedback" },
    { value: "other", label: "❓ Other" },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to submit a contact request.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    const subject = formData.subject.trim();
    const description = formData.description.trim();

    if (!formData.problemType || !subject || !description) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (subject.length < 5 || subject.length > 100) {
      toast({
        title: "Invalid Subject",
        description: "Subject must be between 5 and 100 characters.",
        variant: "destructive",
      });
      return;
    }

    if (description.length < 10 || description.length > 2000) {
      toast({
        title: "Invalid Description",
        description: "Description must be between 10 and 2000 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/contact/submit", {
        ...formData,
        subject,
        description,
      });

      if (res.data?.success) {
        toast({
          title: "Success!",
          description: res.data.message,
        });
        setSubmitted(true);
        setFormData({
          problemType: "",
          subject: "",
          description: "",
          priority: "medium",
        });

        // Reset form after 3 seconds
        setTimeout(() => {
          setSubmitted(false);
        }, 3000);
      }
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.response?.data?.message || "Failed to submit contact form",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <div className="relative pt-20 pb-12 px-4 text-white">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-2 mb-6 backdrop-blur-sm">
            <Mail className="h-4 w-4 text-blue-300" />
            <span className="text-sm font-medium text-blue-200">Support Center</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400">
            Get in Touch
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Have questions or need support? Our team is here to help. Reach out and we'll respond within 24-48 hours.
          </p>
        </div>
      </div>

      {/* Contact Info Cards */}
      <div className="relative max-w-6xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-6 mb-16">
          {[
            { icon: Mail, label: "Email", value: "support@mediconnect.com", color: "from-blue-500 to-blue-600" },
            { icon: Phone, label: "Phone", value: "+91 (800) MEDIC HELP", color: "from-cyan-500 to-cyan-600" },
            { icon: MapPin, label: "Location", value: "India", color: "from-violet-500 to-violet-600" },
            { icon: Clock, label: "Response", value: "24–48 hours", color: "from-emerald-500 to-emerald-600" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div
              key={label}
              className="group relative bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/80 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`}></div>
              <div className="relative">
                <div className={`inline-block p-3 rounded-xl bg-gradient-to-br ${color} mb-4`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-white font-semibold mb-1 text-sm uppercase tracking-wider">{label}</h3>
                <p className="text-slate-300 text-sm">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main Form Section */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left - Features */}
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
              <MessageSquare className="h-8 w-8 text-blue-400 mb-4" />
              <h3 className="text-white font-bold mb-2">Quick Support</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Issues with appointments, prescriptions, and accounts typically resolved within 2 hours.
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
              <CheckCircle className="h-8 w-8 text-emerald-400 mb-4" />
              <h3 className="text-white font-bold mb-2">Secure & Confidential</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                All submissions are encrypted and treated with complete confidentiality.
              </p>
            </div>
          </div>

          {/* Right - Form */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
              {submitted ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-6 animate-pulse">
                    <CheckCircle className="h-8 w-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Message Sent!</h2>
                  <p className="text-slate-400 max-w-sm">
                    Thank you for reaching out. Our support team will review your request and respond shortly.
                  </p>
                </div>
              ) : !isAuthenticated ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-6">
                    <Mail className="h-8 w-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Login Required</h2>
                  <p className="text-slate-400 mb-6">Please log in to submit a support request.</p>
                  <Button
                    onClick={() => navigate("/login")}
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold h-11 px-8 rounded-xl flex items-center gap-2 transition-all hover:scale-105"
                  >
                    Go to Login
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* User Info */}
                  <div className="flex items-center gap-4 bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {(user?.name || "U").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{user?.name}</p>
                      <p className="text-slate-400 text-xs">{user?.email}</p>
                    </div>
                  </div>

                  {/* Problem Type & Priority */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white font-semibold text-sm mb-2">
                        Problem Type <span className="text-red-400">*</span>
                      </label>
                      <Select value={formData.problemType} onValueChange={(value) => handleSelectChange("problemType", value)}>
                        <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white rounded-xl h-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                          <SelectValue placeholder="Select problem type..." />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {problemTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value} className="text-white">
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-white font-semibold text-sm mb-2">Priority</label>
                      <Select value={formData.priority} onValueChange={(value) => handleSelectChange("priority", value)}>
                        <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white rounded-xl h-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {[
                            { value: "low", label: "🟢 Low" },
                            { value: "medium", label: "🟡 Medium" },
                            { value: "high", label: "🟠 High" },
                            { value: "urgent", label: "🔴 Urgent" },
                          ].map((p) => (
                            <SelectItem key={p.value} value={p.value} className="text-white">
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-white font-semibold text-sm mb-2">
                      Subject <span className="text-red-400">*</span>
                    </label>
                    <Input
                      name="subject"
                      placeholder="Brief subject of your issue..."
                      value={formData.subject}
                      onChange={handleInputChange}
                      maxLength={100}
                      className="bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-500 rounded-xl h-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <p className="text-slate-400 text-xs mt-1">{formData.subject.length}/100 characters</p>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-white font-semibold text-sm mb-2">
                      Description <span className="text-red-400">*</span>
                    </label>
                    <Textarea
                      name="description"
                      placeholder="Please provide detailed information about your issue..."
                      value={formData.description}
                      onChange={handleInputChange}
                      maxLength={2000}
                      rows={5}
                      className="bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-500 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
                    />
                    <p className="text-slate-400 text-xs mt-1">{formData.description.length}/2000 characters</p>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Submit Request
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="relative mt-16 pb-12 text-center">
        <p className="text-slate-400 text-sm">
          <Clock className="h-4 w-4 inline mr-2" />
          Average response time: 24–48 hours
        </p>
      </div>
    </div>
  );
}

export default ContactUs;
