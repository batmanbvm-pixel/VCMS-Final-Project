import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useSocket } from "@/hooks/useSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CalendarDays, Clock, Users, IndianRupee, Stethoscope, FileText,
  Video, CheckCircle, XCircle, TrendingUp, Activity,
  AlertCircle, RefreshCw, Power, BarChart3, Star, MessageSquare,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import api from "@/services/api";
import { EmptyState } from "@/components/EmptyState";

interface DoctorFeedback {
  _id: string;
  rating: number;
  comment: string;
  patientName: string;
  createdAt: string;
}

const DoctorDashboard = () => {
  const { user } = useAuth();
  const { appointments, acceptAppointment, rejectAppointment, updateAppointmentStatus, addPrescription, fetchAppointments, getPrescriptionByAppointment } = useClinic();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const { toast } = useToast();

  const today = new Date().toISOString().split("T")[0];
  const normalizedStatus = (status?: string) => (status || "").toLowerCase();
  const myAppointments = appointments.filter((a) => a.doctorId === user?._id || a.doctorId === user?.id);

  const pendingAppointments = myAppointments.filter((a) => normalizedStatus(a.status) === "booked" || normalizedStatus(a.status) === "pending");
  const todayAppointments = myAppointments.filter((a) => {
    const aptDate = a.date;
    const isToday = aptDate === today;
    const notCancelledOrCompleted = !["cancelled", "completed"].includes(normalizedStatus(a.status));
    return isToday && notCancelledOrCompleted;
  });
  const upcomingAppointments = myAppointments.filter((a) => a.date > today && ["accepted", "booked"].includes(normalizedStatus(a.status)));
  const completedAppointments = myAppointments.filter((a) => normalizedStatus(a.status) === "completed");
  const uniquePatients = new Set(myAppointments.filter((a) => normalizedStatus(a.status) !== "cancelled").map((a) => a.patientId)).size;
  // Sum consultation fees from individual completed appointments (more accurate than user?.consultationFee)
  const estimatedEarnings = completedAppointments.reduce((sum, a) => sum + (a.consultationFee || (user as any)?.consultationFee || 0), 0);
  const feePerConsult = completedAppointments.length > 0
    ? Math.round(estimatedEarnings / completedAppointments.length)
    : ((user as any)?.consultationFee || 0);

  // Reject state
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  // Notification badge
  const [unreadCount, setUnreadCount] = useState(0);
  // Pulse animation for new pending
  const [newPending, setNewPending] = useState(false);
  // Online status and profile completion
  const [isOnline, setIsOnline] = useState(false);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [canGoOnline, setCanGoOnline] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState("");
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [recentFeedback, setRecentFeedback] = useState<DoctorFeedback[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState({ total: 0, averageRating: 0 });
  const [prescriptionsCount, setPrescriptionsCount] = useState(0);
  const seenAppointmentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set<string>(seenAppointmentIdsRef.current);
    myAppointments.forEach((apt: any) => {
      const id = String(apt?._id || apt?.id || "");
      if (id) currentIds.add(id);
    });
    seenAppointmentIdsRef.current = currentIds;
  }, [myAppointments]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get("/notifications/unread-count");
      setUnreadCount(res.data?.unreadCount ?? 0);
    } catch {/* ignore */}
  }, []);

  const fetchProfileCompletion = useCallback(async () => {
    try {
      const res = await api.get("/users/completion");
      if (res.data) {
        setProfileCompletion(res.data.profileCompletionPercentage || 0);
        setCanGoOnline(res.data.canGoOnline || false);
        setApprovalStatus(String(res.data.approvalStatus || '').toLowerCase());
        setMissingFields(res.data.missingFields || []);
        setIsOnline(res.data.onlineStatus === 'online');
      }
    } catch (error) {
      // Failed to fetch profile completion
    }
  }, [user]);

  const fetchDoctorFeedback = useCallback(async () => {
    if (user?.role !== 'doctor') return;
    try {
      const res = await api.get('/public/reviews/doctor/me?limit=5');
      setRecentFeedback(res.data?.reviews || []);
      setFeedbackSummary({
        total: res.data?.summary?.total || 0,
        averageRating: res.data?.summary?.averageRating || 0,
      });
    } catch {
      setRecentFeedback([]);
      setFeedbackSummary({ total: 0, averageRating: 0 });
    }
  }, [user?.role]);

  const fetchPrescriptionsCount = useCallback(async () => {
    if (user?.role !== 'doctor') return;
    try {
      const res = await api.get('/prescriptions/doctor/list');
      if (res.data?.success && Array.isArray(res.data.prescriptions)) {
        setPrescriptionsCount(res.data.prescriptions.length);
      }
    } catch (error) {
      // Failed to fetch prescriptions count
    }
  }, [user?.role]);

  const handleToggleOnline = async () => {
    if (onlineLoading) return;
    setOnlineLoading(true);
    try {
      const res = await api.put("/users/online-toggle");
      if (res.data.success) {
        setIsOnline(res.data.onlineStatus === 'online');
        fetchProfileCompletion();
        toast({
          title: res.data.onlineStatus === 'online' ? "You are now online" : "You are now offline",
          description: res.data.onlineStatus === 'online' ? "Patients can now see you and book appointments" : "Patients cannot book appointments",
        });
      }
    } catch (error: any) {
      const errorData = error.response?.data;
      if (errorData?.missingFields) {
        toast({
          title: "Cannot go online",
          description: `Complete your profile first. Missing: ${errorData.missingFields.join(", ")}`,
          variant: "destructive",
        });
        setMissingFields(errorData.missingFields);
      } else {
        toast({
          title: "Error",
          description: errorData?.message || "Failed to toggle online status",
          variant: "destructive",
        });
      }
    } finally {
      setOnlineLoading(false);
    }
  };

  useEffect(() => { fetchUnreadCount(); }, [fetchUnreadCount]);
  useEffect(() => { if (user?.role === 'doctor') fetchProfileCompletion(); }, [fetchProfileCompletion, user]);
  useEffect(() => { fetchDoctorFeedback(); }, [fetchDoctorFeedback]);
  useEffect(() => { if (user?.role === 'doctor') fetchPrescriptionsCount(); }, [fetchPrescriptionsCount, user]);

  // Socket: real-time events
  useEffect(() => {
    if (!socket) return;

    const onNewAppointment = (data: any) => {
      if (data.doctorId === user?._id) {
        const incomingId = String(data?._id || data?.appointmentId || data?.id || "");
        if (incomingId && seenAppointmentIdsRef.current.has(incomingId)) {
          return;
        }
        if (incomingId) {
          seenAppointmentIdsRef.current.add(incomingId);
        }
        setNewPending(true);
        setTimeout(() => setNewPending(false), 5000);
        toast({ title: "🔔 New Appointment Request!", description: `From ${data.patientName || "a patient"}` });
        fetchAppointments();
        fetchUnreadCount();
      }
    };

    const onCancelled = (data: any) => {
      if (data.doctorId === user?._id) {
        toast({ title: "Appointment Cancelled", description: data.reason || "Patient cancelled their appointment." });
        fetchAppointments();
      }
    };

    const onStatusChanged = (data: any) => {
      // Refetch appointments when status changes (for real-time "Join Video Call" button update)
      fetchAppointments();
    };

    const onWarning = (data: any) => {
      toast({ title: "⚠️ Admin Warning", description: data.message || "You received a warning from admin.", variant: "destructive" });
      fetchUnreadCount();
    };

    socket.on("appointment:created", onNewAppointment);
    socket.on("appointment:booked", onNewAppointment);
    socket.on("appointment:cancelled", onCancelled);
    socket.on("appointment-status-changed", onStatusChanged);
    socket.on("notification:warning", onWarning);
    socket.on("admin:warning", onWarning);

    return () => {
      socket.off("appointment:created", onNewAppointment);
      socket.off("appointment:booked", onNewAppointment);
      socket.off("appointment:cancelled", onCancelled);
      socket.off("appointment-status-changed", onStatusChanged);
      socket.off("notification:warning", onWarning);
      socket.off("admin:warning", onWarning);
    };
  }, [socket, user?._id, fetchAppointments, fetchUnreadCount, toast]);

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) { toast({ title: "Please provide a reason", variant: "destructive" }); return; }
    const result = await rejectAppointment(id, rejectReason);
    if (result.success) { toast({ title: "Appointment Rejected" }); setRejectId(null); setRejectReason(""); }
    else toast({ title: "Rejection failed", description: result.message, variant: "destructive" });
  };

  const handleAccept = async (id: string) => {
    const result = await acceptAppointment(id);
    if (result.success) toast({ title: "✅ Appointment Accepted", description: "Patient has been notified." });
    else toast({ title: "Accept failed", description: result.message, variant: "destructive" });
  };

  const handleMarkCompleted = async (aptId: string) => {
    try {
      await updateAppointmentStatus(aptId, "Completed");
      toast({ title: "✅ Marked as Completed", description: "You can now write a prescription." });
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const handleStartConsultation = async (aptId: string) => {
    try {
      await updateAppointmentStatus(aptId, "In Progress");
      navigate(`/video/${aptId}`);
    } catch {
      toast({ title: "Failed to start consultation", variant: "destructive" });
    }
  };

  const statusBadge = (status: string) => {
    const key = normalizedStatus(status);
    const map: Record<string, string> = {
      booked: "bg-sky-100 text-sky-800",
      accepted: "bg-emerald-100 text-emerald-800",
      "in progress": "bg-cyan-100 text-cyan-800",
      "in-progress": "bg-cyan-100 text-cyan-800",
      completed: "bg-sky-100 text-sky-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return map[key] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-50">
      <div className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
        <div className="px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold text-sky-600 uppercase tracking-widest mb-1">Doctor Portal</p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                Dr. {user?.name}
              </h1>
              {feedbackSummary.averageRating > 0 && (
                <Badge className="bg-sky-100 text-sky-700 border-sky-300 gap-1 px-3 py-1.5 text-sm">
                  <Star className="h-4 w-4 fill-sky-500 text-sky-500" />
                  {feedbackSummary.averageRating.toFixed(1)} ({feedbackSummary.total})
                </Badge>
              )}
            </div>
            <p className="text-slate-600 text-sm mt-1">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { fetchAppointments(); fetchUnreadCount(); fetchDoctorFeedback(); fetchPrescriptionsCount(); toast({ title: "Refreshed!" }); }}
              className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200 shadow-sm hover:scale-105"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        {/* Stats ribbon */}
        <div className="border-t border-slate-200 bg-slate-50 grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-200">
          {[
            { label: "Today",    value: todayAppointments.length,      icon: CalendarDays },
            { label: "Pending",  value: pendingAppointments.length,    icon: AlertCircle  },
            { label: "Patients", value: uniquePatients,                icon: Users        },
            { label: "Earnings", value: `₹${estimatedEarnings.toLocaleString("en-IN")}`, icon: IndianRupee },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 px-5 py-3">
              <Icon className="h-5 w-5 text-sky-500 flex-shrink-0" />
              <div>
                <p className="text-lg font-bold leading-none text-slate-900">{value}</p>
                <p className="text-slate-600 text-[11px] mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Online Status & Profile Completion ── */}
      <Card className="border border-slate-200 rounded-2xl shadow-sm bg-white">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Online Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Power className="h-4 w-4 text-sky-500" />
                    Online Status
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Toggle to {isOnline ? 'stop accepting' : 'accept'} new appointments
                  </p>
                </div>
                <Switch
                  checked={isOnline}
                  onCheckedChange={handleToggleOnline}
                  disabled={onlineLoading || (!canGoOnline && !isOnline)}
                  className="data-[state=checked]:bg-sky-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge className={isOnline ? "bg-sky-100 text-sky-700 border-sky-200" : "bg-slate-100 text-slate-700 border-slate-200"}>
                  {isOnline ? "🟢 Online" : "⚫ Offline"}
                </Badge>
                {isOnline && <span className="text-xs text-slate-600">Visible to patients</span>}
                {!isOnline && canGoOnline && <span className="text-xs text-slate-600">Not visible to patients</span>}
              </div>
              {!canGoOnline && !isOnline && (
                <Alert className="bg-sky-50 border-sky-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-800">
                    You can go online only after admin approval and 100% profile completion.
                    {approvalStatus && approvalStatus !== 'approved' ? ' (Approval pending)' : ''}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Profile Completion */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-sky-500" />
                    Profile Completion
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {profileCompletion}% complete
                  </p>
                </div>
                <button
                  onClick={() => navigate('/profile')}
                  className="text-xs text-sky-600 hover:text-sky-700 font-semibold transition-all duration-200 hover:underline"
                >
                  Edit Profile →
                </button>
              </div>
              <Progress value={profileCompletion} className="h-2" />
              {profileCompletion < 100 && missingFields.length > 0 && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-xs text-blue-800">
                    Missing: {missingFields.slice(0, 3).join(", ")}
                    {missingFields.length > 3 && ` +${missingFields.length - 3} more`}
                  </AlertDescription>
                </Alert>
              )}
              {profileCompletion === 100 && (
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Profile complete!</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg hover:border-sky-300 hover:scale-105 transition-all duration-300 flex flex-col">
          <CardContent className="p-5 flex flex-col flex-1">
            <div className="flex items-center justify-between gap-3 flex-1">
              <div>
                <p className="text-xs uppercase tracking-wide text-sky-600 font-semibold">Appointments</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{pendingAppointments.length + todayAppointments.length + upcomingAppointments.length}</p>
                <p className="text-xs text-slate-600 mt-1">Active appointments (pending, today & upcoming)</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-sky-600" />
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => navigate('/doctor/appointments')}
              className="w-full rounded-xl gap-2 bg-sky-500 hover:bg-sky-600 text-white mt-4 transition-all duration-200 hover:scale-105"
            >
              Open Appointments
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg hover:border-sky-300 hover:scale-105 transition-all duration-300 flex flex-col">
          <CardContent className="p-5 flex flex-col flex-1">
            <div className="flex items-center justify-between gap-3 flex-1">
              <div>
                <p className="text-xs uppercase tracking-wide text-sky-600 font-semibold">Patient Feedback</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {feedbackSummary.averageRating > 0 ? `${feedbackSummary.averageRating.toFixed(1)} ★` : '0.0 ★'}
                </p>
                <p className="text-xs text-slate-600 mt-1">{feedbackSummary.total} total review{feedbackSummary.total !== 1 ? 's' : ''}</p>
                {recentFeedback[0] && (
                  <p className="text-xs text-slate-500 mt-1">Latest: {recentFeedback[0].patientName}</p>
                )}
              </div>
              <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-sky-600" />
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => navigate('/doctor/feedback')}
              className="w-full rounded-xl gap-2 bg-sky-500 hover:bg-sky-600 text-white mt-4 transition-all duration-200 hover:scale-105"
            >
              Open Feedback
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg hover:border-sky-300 hover:scale-105 transition-all duration-300 flex flex-col">
          <CardContent className="p-5 flex flex-col flex-1">
            <div className="flex items-center justify-between gap-3 flex-1">
              <div>
                <p className="text-xs uppercase tracking-wide text-sky-600 font-semibold">My Patients</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{uniquePatients}</p>
                <p className="text-xs text-slate-600 mt-1">View and manage your patient list</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-sky-600" />
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => navigate('/doctor/patients')}
              className="w-full rounded-xl gap-2 bg-sky-500 hover:bg-sky-600 text-white mt-4 transition-all duration-200 hover:scale-105"
            >
              Open Patients
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg hover:border-sky-300 hover:scale-105 transition-all duration-300 flex flex-col">
          <CardContent className="p-5 flex flex-col flex-1">
            <div className="flex items-center justify-between gap-3 flex-1">
              <div>
                <p className="text-xs uppercase tracking-wide text-sky-600 font-semibold">Prescriptions</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{prescriptionsCount}</p>
                <p className="text-xs text-slate-600 mt-1">Total prescriptions created</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-sky-600" />
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => navigate('/doctor/prescriptions')}
              className="w-full rounded-xl gap-2 bg-sky-500 hover:bg-sky-600 text-white mt-4 transition-all duration-200 hover:scale-105"
            >
              Open Prescriptions
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ─── Today's Appointments ─── */}
      {todayAppointments.length > 0 && (
        <Card className="bg-white border-2 border-sky-300 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3 bg-gradient-to-r from-sky-50 to-cyan-50">
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <CalendarDays className="h-5 w-5 text-sky-600" />
              Today's Appointments
              <Badge className="bg-sky-500 text-white">{todayAppointments.length} today</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayAppointments.map((apt) => {
                const status = normalizedStatus(apt.status);
                const canJoin = ["accepted", "in-progress", "in progress"].includes(status);
                
                return (
                  <div key={apt._id} className="flex items-center justify-between rounded-xl border-2 border-sky-200 bg-sky-50 p-4 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white font-bold">
                        {(apt.patientName || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{apt.patientName}</p>
                        <p className="text-xs text-slate-600">{apt.symptoms || "General consultation"}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-sky-600" />
                          <span className="text-xs font-medium text-sky-700">{apt.time}</span>
                          <Badge className={`text-xs ${
                            status === "accepted" ? "bg-sky-100 text-sky-700" :
                            status === "in-progress" || status === "in progress" ? "bg-emerald-100 text-emerald-700" :
                            "bg-slate-100 text-slate-700"
                          }`}>
                            {apt.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {canJoin && (
                        <Button
                          size="sm"
                          className="gap-1.5 bg-sky-500 hover:bg-sky-600 text-white shadow-md transition-all duration-200 hover:scale-105"
                          onClick={() => navigate(`/video/${apt._id}`)}
                        >
                          <Video className="h-4 w-4" /> Join Call
                        </Button>
                      )}
                      {status === "booked" && (
                        <Button
                          size="sm"
                          className="gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white shadow-md transition-all duration-200 hover:scale-105"
                          onClick={() => handleAccept(apt._id)}
                        >
                          <CheckCircle className="h-4 w-4" /> Accept
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Pending Requests ─── */}
      <div id="pending-section">
        <Card className={`bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow ${pendingAppointments.length > 0 ? "ring-2 ring-sky-200" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <AlertCircle className="h-5 w-5 text-sky-500" />
              Pending Requests
              {pendingAppointments.length > 0 && (
                <Badge className="bg-sky-500 text-white">{pendingAppointments.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingAppointments.length === 0 ? (
              <div className="py-8">
                <EmptyState 
                  icon={CalendarDays}
                  title="No pending requests"
                  description="All appointment requests have been reviewed. Great job! 🎉"
                />
              </div>
            ) : (
              <div className="space-y-3">
                {pendingAppointments.map((apt) => (
                  <div key={apt._id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white font-bold text-sm">
                          {(apt.patientName || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{apt.patientName}</p>
                          <p className="text-xs text-slate-600">{apt.symptoms || "General consultation"}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                            <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{apt.date}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{apt.time}</span>
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-sky-100 text-sky-700 shrink-0">New Request</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white gap-1 shadow-sm transition-all duration-200 hover:scale-105" onClick={() => handleAccept(apt._id)}>
                        <CheckCircle className="h-3.5 w-3.5" /> Accept
                      </Button>
                      {rejectId === apt._id ? (
                        <div className="flex gap-2 flex-1 min-w-0">
                          <Input
                            className="text-sm h-8 focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200"
                            placeholder="Reason for rejection..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                          />
                          <Button size="sm" variant="destructive" className="h-8 shrink-0 transition-all duration-200 hover:scale-105" onClick={() => handleReject(apt._id)}>Send</Button>
                          <Button size="sm" variant="ghost" className="h-8 shrink-0 transition-all duration-200 hover:scale-105" onClick={() => { setRejectId(null); setRejectReason(""); }} aria-label="Cancel rejection" title="Cancel rejection">✕</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50 gap-1 transition-all duration-200 hover:scale-105" onClick={() => setRejectId(apt._id)}>
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Upcoming Appointments ─── */}
      {upcomingAppointments.length > 0 && (
        <Card className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <TrendingUp className="h-5 w-5 text-sky-500" />
              Upcoming Appointments
              <Badge className="bg-slate-100 text-slate-700">{upcomingAppointments.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingAppointments.slice(0, 5).map((apt) => (
                <div key={apt._id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-white font-bold text-xs">
                      {(apt.patientName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-slate-900">{apt.patientName}</p>
                      <p className="text-xs text-slate-600 flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />{apt.date}
                        <Clock className="h-3 w-3 ml-1" />{apt.time}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${statusBadge(apt.status)}`}>{apt.status}</span>
                    {normalizedStatus(apt.status) === "accepted" && (
                      <Button
                        size="sm"
                        className="gap-1 bg-sky-500 hover:bg-sky-600 text-white shadow-sm transition-all duration-200 hover:scale-105"
                        onClick={() => handleStartConsultation(apt._id)}
                      >
                        <Video className="h-3.5 w-3.5" /> Join
                      </Button>
                    )}
                    {(normalizedStatus(apt.status) === "in progress" || normalizedStatus(apt.status) === "in-progress") && (
                      <Button
                        size="sm"
                        className="gap-1 bg-sky-500 hover:bg-sky-600 text-white shadow-sm transition-all duration-200 hover:scale-105"
                        onClick={() => navigate(`/video/${apt._id}`)}
                      >
                        <Video className="h-3.5 w-3.5" /> Join
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Recent Consultations ─── */}
      <div id="completed-section">
        <Card className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <Stethoscope className="h-5 w-5 text-sky-500" />
              Completed Consultations
              <Badge className="bg-slate-100 text-slate-700">{completedAppointments.length} completed</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {completedAppointments.length === 0 ? (
              <p className="text-sm text-slate-600 py-4 text-center">No completed consultations yet.</p>
            ) : (
              <div className="space-y-2">
                {[...completedAppointments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((apt) => {
                  const rx = getPrescriptionByAppointment?.(apt._id || apt.id);
                  return (
                    <div key={apt._id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-sky-500 shrink-0" />
                        <div>
                          <p className="font-medium text-sm text-slate-900">{apt.patientName}</p>
                          <p className="text-xs text-slate-600">{apt.date} • {apt.time}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {rx && (
                          <Button size="sm" variant="ghost" className="text-xs text-slate-600 transition-all duration-200 hover:scale-105"
                            onClick={() => navigate(rx?._id ? `/prescriptions/${rx._id}` : `/prescriptions/appointment/${apt._id}`)}>View Rx</Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 border-slate-300 text-slate-700 hover:bg-slate-50 transition-all duration-200 hover:scale-105"
                          onClick={() => navigate(`/create-prescription/${apt._id}`)}
                        >
                          <FileText className="h-3.5 w-3.5" /> {rx ? "Edit Prescription" : "Write Prescription"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default DoctorDashboard;