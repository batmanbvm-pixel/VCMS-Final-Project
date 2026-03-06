import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Users, Stethoscope, CalendarDays, Clock, AlertCircle, TrendingUp, MessageSquare, RefreshCw, Shield, Activity, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import api from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { useSocket } from "@/hooks/useSocket";
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LineChart, Line } from "recharts";

interface AppointmentAnalyticsStats {
  total: number;
  statusDistribution: { completed: number; cancelled: number; pending: number; inProgress: number };
  cancelledByDoctor: number;
  cancelledByPatient: number;
  monthlyTrends: Record<string, number>;
  completionRate: number;
}
interface DoctorDemandEntry {
  doctorId: string;
  doctorName: string;
  specialization: string;
  appointmentCount: number;
  completedCount: number;
  cancellationRate: number;
  available?: boolean;
}
interface DoctorDemandData {
  topDoctors: DoctorDemandEntry[];
  highDemandThreshold: number;
  highDemandDoctors: DoctorDemandEntry[];
}

interface Stats {
  totalUsers: number;
  totalDoctors: number;
  totalPatients: number;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  inProgressAppointments: number;
  totalPrescriptions: number;
  pendingDoctors: number;
  pendingPatients: number;
  totalContacts: number;
  openContacts: number;
}

interface AdminReviewItem {
  _id: string;
  rating: number;
  comment: string;
  patientName: string;
  doctorName: string;
  doctorSpecialization: string;
  createdAt: string;
}

const COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6"];

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { socket } = useSocket();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalDoctors: 0,
    totalPatients: 0,
    totalAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    inProgressAppointments: 0,
    totalPrescriptions: 0,
    pendingDoctors: 0,
    pendingPatients: 0,
    totalContacts: 0,
    openContacts: 0,
  });
  const [appointmentData, setAppointmentData] = useState<any[]>([]);
  const [userData, setUserData] = useState<any[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [recentContacts, setRecentContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [analyticsStats, setAnalyticsStats] = useState<AppointmentAnalyticsStats | null>(null);
  const [doctorDemand, setDoctorDemand] = useState<DoctorDemandData | null>(null);
  const [doctorAvailability, setDoctorAvailability] = useState<Record<string, boolean>>({});
  const [doctorFilter, setDoctorFilter] = useState<"highest-appointments" | "highest-cancellation" | "lowest-cancellation">("highest-appointments");
  const [performanceView, setPerformanceView] = useState<"doctor" | "patient">("doctor");
  const [recentReviews, setRecentReviews] = useState<AdminReviewItem[]>([]);
  const [reviewSummary, setReviewSummary] = useState({ totalReviews: 0, averageRating: 0 });

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Use admin-specific endpoints
      const safeGet = async (url: string) => {
        try { return await api.get(url); }
        catch { return { data: {} }; }
      };

      const [statsRes, appointmentsRes, contactsRes, reviewsRes, doctorsRes] = await Promise.all([
        safeGet('/admin/dashboard-stats'),
        safeGet('/admin/appointments'),
        safeGet('/contact/'),
        safeGet('/public/reviews/admin/recent?limit=6'),
        safeGet('/admin/users?role=doctor&limit=1000'),
      ]);

      const dashStats = statsRes.data?.stats || statsRes.data || {};
      const appointments: any[] = appointmentsRes.data?.appointments || [];
      const contacts: any[] = contactsRes.data?.contacts || contactsRes.data || [];

      // Build chart data from appointments
      const statuses = ["completed", "cancelled", "in-progress", "in progress", "booked", "pending", "accepted"];
      const statusCounts: Record<string, number> = {};
      appointments.forEach((a: any) => {
        const s = (a.status || "").toLowerCase();
        statuses.forEach((st) => { if (s === st) statusCounts[st] = (statusCounts[st] || 0) + 1; });
      });

      const completed = (statusCounts["completed"] || 0);
      const cancelled = (statusCounts["cancelled"] || 0);
      const inProg = (statusCounts["in-progress"] || 0) + (statusCounts["in progress"] || 0);
      const booked = (statusCounts["booked"] || 0) + (statusCounts["pending"] || 0) + (statusCounts["accepted"] || 0);

      const appointmentChartData = [
        { name: "Completed", value: completed, fill: "#10b981" },
        { name: "Cancelled", value: cancelled, fill: "#ef4444" },
        { name: "In Progress", value: inProg, fill: "#f59e0b" },
        { name: "Upcoming", value: booked, fill: "#3b82f6" },
      ].filter((d) => d.value > 0);

      const userChartData = [
        { name: "Doctors", value: dashStats.totalDoctors ?? 0, fill: "#10b981" },
        { name: "Patients", value: dashStats.totalPatients ?? 0, fill: "#3b82f6" },
        { name: "Pending Dr.", value: dashStats.pendingDoctors ?? 0, fill: "#f59e0b" },
      ].filter((d) => d.value > 0);

      const today = new Date().toISOString().split("T")[0];

      // Map DB lowercase status → UI capitalized
      const mapDbStatus = (s: string) => {
        const m: Record<string, string> = { pending: "Booked", confirmed: "Accepted", "in-progress": "In Progress", completed: "Completed", cancelled: "Cancelled", rejected: "Rejected" };
        return m[(s || "").toLowerCase()] || s;
      };

      const todayAppts = appointments
        .filter((a: any) => String(a.date).slice(0, 10) === today && (a.status || "") !== "cancelled")
        .slice(0, 8)
        .map((a: any) => ({
          _id: a._id,
          patientName: a.patientId?.name || a.patientName || "Unknown Patient",
          doctorName: a.doctorId?.name || a.doctorName || "Unknown Doctor",
          specialization: a.doctorId?.specialization || a.specialization || "N/A",
          time: a.time || "—",
          date: a.date,
          status: mapDbStatus(a.status),
        }));

      setStats({
        totalUsers: dashStats.totalUsers ?? 0,
        totalDoctors: dashStats.totalDoctors ?? 0,
        totalPatients: dashStats.totalPatients ?? 0,
        totalAppointments: dashStats.totalAppointments ?? appointments.length,
        completedAppointments: dashStats.completedAppointments ?? completed,
        cancelledAppointments: dashStats.cancelledAppointments ?? cancelled,
        inProgressAppointments: dashStats.inProgressAppointments ?? inProg,
        totalPrescriptions: dashStats.totalPrescriptions ?? 0,
        pendingDoctors: dashStats.pendingDoctors ?? 0,
        pendingPatients: dashStats.pendingPatients ?? 0,
        totalContacts: Array.isArray(contacts) ? contacts.length : 0,
        openContacts: Array.isArray(contacts) ? contacts.filter((c: any) => (c.status || "").toLowerCase() === "open").length : 0,
      });

      setAppointmentData(appointmentChartData);
      setUserData(userChartData);
      setTodayAppointments(todayAppts);
      setRecentContacts(Array.isArray(contacts) ? contacts.slice(0, 3) : []);
      setRecentReviews(reviewsRes.data?.reviews || []);
      setReviewSummary({
        totalReviews: reviewsRes.data?.summary?.totalReviews || 0,
        averageRating: reviewsRes.data?.summary?.averageRating || 0,
      });

      const doctors = doctorsRes.data?.users || doctorsRes.data || [];
      if (Array.isArray(doctors)) {
        const availabilityMap: Record<string, boolean> = {};
        doctors.forEach((d: any) => {
          const isAvailable = typeof d.available === "boolean"
            ? d.available
            : String(d.onlineStatus || "").toLowerCase() === "online";
          availabilityMap[String(d._id)] = isAvailable;
        });
        setDoctorAvailability(availabilityMap);
      }

      // Fetch analytics in parallel (non-blocking)
      try {
        const [analyticsRes, demandRes] = await Promise.all([
          safeGet('/appointments/analytics/dashboard'),
          safeGet('/appointments/analytics/demand'),
        ]);
        if (analyticsRes.data?.success) setAnalyticsStats(analyticsRes.data.data);
        if (demandRes.data?.success) setDoctorDemand(demandRes.data.data);
      } catch { /* Analytics failure is non-critical */ }

      setRetryCount(0);
    } catch (error: any) {
      if (retryCount < 2) {
        toast({ title: "Loading Dashboard", description: "Retrying data fetch..." });
        setTimeout(() => { setRetryCount((c) => c + 1); fetchDashboardData(); }, 2000);
      } else {
        toast({ title: "Notice", description: "Could not load all data. Check backend connection.", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }, [retryCount, toast]);

  const filteredDoctors = (doctorDemand?.topDoctors || []).slice().sort((a, b) => {
    if (doctorFilter === "highest-cancellation") return b.cancellationRate - a.cancellationRate;
    if (doctorFilter === "lowest-cancellation") return a.cancellationRate - b.cancellationRate;
    return b.appointmentCount - a.appointmentCount;
  });

  const patientDemandRows = Object.values(
    recentReviews.reduce((acc, r) => {
      const key = r.patientName || "Unknown";
      if (!acc[key]) {
        acc[key] = { patientName: key, totalFeedback: 0, averageRating: 0, totalRating: 0 };
      }
      acc[key].totalFeedback += 1;
      acc[key].totalRating += Number(r.rating || 0);
      acc[key].averageRating = acc[key].totalRating / acc[key].totalFeedback;
      return acc;
    }, {} as Record<string, { patientName: string; totalFeedback: number; averageRating: number; totalRating: number }>)
  ).sort((a, b) => b.totalFeedback - a.totalFeedback);

  const warnDoctor = async (doctorId: string, doctorName: string) => {
    try {
      await api.put(`/admin/users/${doctorId}/warn`, {
        message: "Your cancellation rate is being monitored. Please improve schedule reliability.",
      });
      toast({ title: "Warning sent", description: `Warning sent to ${doctorName}` });
    } catch {
      toast({ title: "Warning failed", description: `Could not send warning to ${doctorName}`, variant: "destructive" });
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  // Real-time socket: refresh on new registrations / appointments
  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchDashboardData();
    socket.on("user:registered", refresh);
    socket.on("appointment:created", refresh);
    socket.on("appointment:booked", refresh);
    socket.on("appointment:cancelled", refresh);
    socket.on("doctor:pending", refresh);
    return () => {
      socket.off("user:registered", refresh);
      socket.off("appointment:created", refresh);
      socket.off("appointment:booked", refresh);
      socket.off("appointment:cancelled", refresh);
      socket.off("doctor:pending", refresh);
    };
  }, [socket, fetchDashboardData]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-muted rounded w-1/3"></div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-64 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="container mx-auto px-6 py-8 space-y-8 max-w-7xl">
        
        {/* Minimal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center shadow-lg">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                <span className="inline-flex items-center gap-1 text-sky-600 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse"></span>
                  Live
                </span>
              </p>
            </div>
          </div>
          <Button onClick={() => fetchDashboardData()} variant="outline" size="sm" className="gap-2 bg-white hover:bg-slate-100 border-slate-200 transition-all duration-200 hover:scale-105">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        {/* Key Metrics - Clean Cards - Item #15 Enhanced */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          
          <button onClick={() => navigate("/admin/users")} className="group text-left h-full">
            <Card className="border-0 rounded-2xl shadow-lg overflow-hidden bg-gradient-to-br from-sky-500 to-sky-600 group-hover:shadow-2xl transition-all group-hover:scale-105 cursor-pointer h-full border border-sky-400/30">
              <CardContent className="p-6 text-white h-full flex flex-col">
                <div className="flex items-start justify-between mb-4 flex-1">
                  <div>
                    <p className="text-xs font-semibold opacity-90 mb-2 uppercase tracking-wider">Total Users</p>
                    <p className="text-4xl font-bold">{stats.totalUsers}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex gap-4 pt-4 border-t border-white/20 justify-evenly">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.totalDoctors}</p>
                    <p className="text-xs opacity-80">Doctors</p>
                  </div>
                  <div className="w-px bg-white/20"></div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.totalPatients}</p>
                    <p className="text-xs opacity-80">Patients</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

          <button onClick={() => navigate("/admin/appointments")} className="group text-left h-full">
            <Card className="border-0 rounded-2xl shadow-lg overflow-hidden bg-gradient-to-br from-sky-500 to-sky-600 group-hover:shadow-2xl transition-all group-hover:scale-105 cursor-pointer h-full border border-sky-400/30">
              <CardContent className="p-6 text-white h-full flex flex-col">
                <div className="flex items-start justify-between mb-4 flex-1">
                  <div>
                    <p className="text-xs font-semibold opacity-90 mb-2 uppercase tracking-wider">Appointments</p>
                    <p className="text-4xl font-bold">{stats.totalAppointments}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex gap-4 pt-4 border-t border-white/20 justify-evenly">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.completedAppointments}</p>
                    <p className="text-xs opacity-80">Completed</p>
                  </div>
                  <div className="w-px bg-white/20"></div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.cancelledAppointments}</p>
                    <p className="text-xs opacity-80">Cancelled</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

          <button onClick={() => navigate("/admin/approvals")} className="group text-left h-full">
            <Card className="border-0 rounded-2xl shadow-lg overflow-hidden bg-gradient-to-br from-cyan-500 to-cyan-600 group-hover:shadow-2xl transition-all group-hover:scale-105 cursor-pointer h-full border border-cyan-400/30">
              <CardContent className="p-6 text-white h-full flex flex-col">
                <div className="flex items-start justify-between mb-4 flex-1">
                  <div>
                    <p className="text-xs font-semibold opacity-90 mb-2 uppercase tracking-wider">Pending</p>
                    <p className="text-4xl font-bold">{stats.pendingDoctors + stats.pendingPatients}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex gap-4 pt-4 border-t border-white/20 justify-evenly">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.pendingDoctors}</p>
                    <p className="text-xs opacity-80">Doctors</p>
                  </div>
                  <div className="w-px bg-white/20"></div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.pendingPatients}</p>
                    <p className="text-xs opacity-80">Patients</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

          <button onClick={() => navigate("/admin/contacts")} className="group text-left h-full">
            <Card className="border-0 rounded-2xl shadow-lg overflow-hidden bg-gradient-to-br from-cyan-500 to-cyan-600 group-hover:shadow-2xl transition-all group-hover:scale-105 cursor-pointer h-full border border-cyan-400/30">
              <CardContent className="p-6 text-white h-full flex flex-col">
                <div className="flex items-start justify-between mb-4 flex-1">
                  <div>
                    <p className="text-xs font-semibold opacity-90 mb-2 uppercase tracking-wider">Messages</p>
                    <p className="text-4xl font-bold">{stats.totalContacts}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex gap-4 pt-4 border-t border-white/20 justify-evenly">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.openContacts}</p>
                    <p className="text-xs opacity-80">Open</p>
                  </div>
                  <div className="w-px bg-white/20"></div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.totalContacts - stats.openContacts}</p>
                    <p className="text-xs opacity-80">Resolved</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

          <button onClick={() => navigate("/admin/reviews")} className="group text-left h-full">
            <Card className="border-0 rounded-2xl shadow-lg overflow-hidden bg-gradient-to-br from-sky-500 to-sky-600 group-hover:shadow-2xl transition-all group-hover:scale-105 cursor-pointer h-full border border-sky-400/30">
              <CardContent className="p-6 text-white h-full flex flex-col">
                <div className="flex items-start justify-between mb-4 flex-1">
                  <div>
                    <p className="text-xs font-semibold opacity-90 mb-2 uppercase tracking-wider">Feedback</p>
                    <p className="text-4xl font-bold">{reviewSummary.totalReviews}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                    <Star className="h-5 w-5 fill-white" />
                  </div>
                </div>
                <div className="flex gap-4 pt-4 border-t border-white/20 justify-evenly">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{reviewSummary.averageRating.toFixed(1)}</p>
                    <p className="text-xs opacity-80">Avg ★</p>
                  </div>
                  <div className="w-px bg-white/20"></div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{recentReviews.filter((r) => r.rating >= 4).length}</p>
                    <p className="text-xs opacity-80">4★+</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Appointment Status Chart */}
          <Card className="border border-slate-200 rounded-2xl shadow-md hover:shadow-lg hover:border-sky-200 transition-all duration-300 bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Activity className="h-5 w-5 text-sky-600" />
                Appointment Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appointmentData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={appointmentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) => `${name}: ${value}`}
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {appointmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <Activity className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No appointment data yet</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Type Distribution Chart */}
          <Card className="border border-slate-200 rounded-2xl shadow-md hover:shadow-lg hover:border-sky-200 transition-all duration-300 bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-sky-600" />
                User Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={userData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {userData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No user data yet</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>



      {/* Monthly Trends - Enhanced Beautiful Chart */}
      {analyticsStats && Object.entries(analyticsStats.monthlyTrends || {}).length > 0 && (
        <Card className="border border-slate-200 rounded-2xl shadow-md hover:shadow-lg hover:border-sky-200 transition-all duration-300 bg-gradient-to-br from-white via-blue-50/30 to-sky-50">
          <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-sky-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-sky-600 rounded-lg shadow-md">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                Monthly Appointment Trends
              </CardTitle>
              <Badge className="bg-gradient-to-r from-blue-500 to-sky-600 text-white">
                {Object.values(analyticsStats.monthlyTrends).reduce((a, b) => a + b, 0)} Total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={350}>
              <LineChart 
                data={Object.entries(analyticsStats.monthlyTrends).map(([month, count]) => ({ 
                  month, 
                  appointments: count 
                }))}
                margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="colorAppointments" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#0ea5e9" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                  <filter id="shadow" height="200%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0ea5e9" floodOpacity="0.3"/>
                  </filter>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="#e2e8f0" 
                  strokeOpacity={0.5}
                  vertical={false}
                />
                <XAxis 
                  dataKey="month" 
                  stroke="#64748b"
                  style={{ 
                    fontSize: '13px',
                    fontWeight: '600',
                    fill: '#475569'
                  }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1', strokeWidth: 2 }}
                />
                <YAxis 
                  stroke="#64748b"
                  style={{ 
                    fontSize: '13px',
                    fontWeight: '600',
                    fill: '#475569'
                  }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1', strokeWidth: 2 }}
                  label={{ 
                    value: 'Appointments', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { 
                      fill: '#475569',
                      fontWeight: 'bold',
                      fontSize: '14px'
                    }
                  }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    border: '2px solid #0ea5e9',
                    borderRadius: '12px',
                    padding: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                    fontWeight: 'bold'
                  }}
                  labelStyle={{ 
                    color: '#0f172a',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    marginBottom: '8px'
                  }}
                  itemStyle={{
                    color: '#0ea5e9',
                    fontWeight: '600',
                    fontSize: '13px'
                  }}
                  cursor={{ stroke: '#0ea5e9', strokeWidth: 2, strokeDasharray: '5 5' }}
                />
                <Legend 
                  wrapperStyle={{
                    paddingTop: '20px',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}
                  iconType="circle"
                />
                <Line
                  type="monotone"
                  dataKey="appointments"
                  stroke="url(#lineGradient)"
                  strokeWidth={4}
                  dot={{ 
                    fill: '#0ea5e9', 
                    stroke: '#fff',
                    strokeWidth: 3,
                    r: 7,
                    filter: 'url(#shadow)'
                  }}
                  activeDot={{ 
                    r: 9, 
                    fill: '#0ea5e9',
                    stroke: '#fff',
                    strokeWidth: 4,
                    filter: 'url(#shadow)'
                  }}
                  name="Total Appointments"
                  fill="url(#colorAppointments)"
                  fillOpacity={0.3}
                  animationDuration={2000}
                  animationBegin={0}
                />
              </LineChart>
            </ResponsiveContainer>
            
            {/* Trend Summary Cards */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
              <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-4 rounded-xl border-2 border-sky-200 shadow-sm">
                <div className="text-xs text-blue-700 font-semibold uppercase tracking-wide">Peak Month</div>
                <div className="text-xl font-bold text-blue-600 mt-2">
                  {Object.entries(analyticsStats.monthlyTrends).reduce((max, [month, count]) => 
                    count > (analyticsStats.monthlyTrends[max] || 0) ? month : max, 
                    Object.keys(analyticsStats.monthlyTrends)[0]
                  )}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {Math.max(...Object.values(analyticsStats.monthlyTrends))} appointments
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-4 rounded-xl border-2 border-sky-200 shadow-sm">
                <div className="text-xs text-sky-700 font-semibold uppercase tracking-wide">Average</div>
                <div className="text-xl font-bold text-sky-600 mt-2">
                  {Math.round(Object.values(analyticsStats.monthlyTrends).reduce((a, b) => a + b, 0) / Object.keys(analyticsStats.monthlyTrends).length)}
                </div>
                <div className="text-xs text-sky-600 mt-1">per month</div>
              </div>
              
              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-4 rounded-xl border-2 border-cyan-200 shadow-sm">
                <div className="text-xs text-cyan-700 font-semibold uppercase tracking-wide">Total Months</div>
                <div className="text-xl font-bold text-cyan-600 mt-2">
                  {Object.keys(analyticsStats.monthlyTrends).length}
                </div>
                <div className="text-xs text-cyan-600 mt-1">tracked</div>
              </div>
              
              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-4 rounded-xl border-2 border-cyan-200 shadow-sm">
                <div className="text-xs text-cyan-700 font-semibold uppercase tracking-wide">Trend</div>
                <div className="text-xl font-bold text-cyan-600 mt-2 flex items-center gap-2">
                  {(() => {
                    const months = Object.keys(analyticsStats.monthlyTrends);
                    const lastMonth = analyticsStats.monthlyTrends[months[months.length - 1]];
                    const prevMonth = analyticsStats.monthlyTrends[months[months.length - 2]] || lastMonth;
                    return lastMonth >= prevMonth ? (
                      <><TrendingUp className="w-5 h-5" /> Up</>
                    ) : (
                      <><Activity className="w-5 h-5" /> Down</>
                    );
                  })()}
                </div>
                <div className="text-xs text-cyan-600 mt-1">vs last month</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance & Demand */}
      {doctorDemand?.topDoctors && doctorDemand.topDoctors.length > 0 && (
        <Card className="border-0 rounded-2xl shadow-lg bg-gradient-to-br from-white to-slate-50">
          <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-sky-50 to-blue-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-3">
                <div className="p-2 bg-sky-100 rounded-lg">
                  <Stethoscope className="h-6 w-6 text-sky-600" />
                </div>
                Doctor Performance Analytics
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant={performanceView === "doctor" ? "default" : "outline"} onClick={() => setPerformanceView("doctor")}>Doctor View</Button>
                <Button size="sm" variant={performanceView === "patient" ? "default" : "outline"} onClick={() => setPerformanceView("patient")}>Patient View</Button>
                {performanceView === "doctor" && (
                  <select
                    value={doctorFilter}
                    onChange={(e) => setDoctorFilter(e.target.value as "highest-appointments" | "highest-cancellation" | "lowest-cancellation")}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold"
                  >
                    <option value="highest-appointments">Highest Appointments</option>
                    <option value="highest-cancellation">Highest Cancellation</option>
                    <option value="lowest-cancellation">Lowest Cancellation</option>
                  </select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {performanceView === "doctor" ? (
            <div className="overflow-auto">
              <table className="w-full min-w-[1120px]">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-50">
                    <th className="text-left py-4 px-4 text-sm font-bold text-slate-800">Doctor</th>
                    <th className="text-left py-4 px-4 text-sm font-bold text-slate-800">Specialization</th>
                    <th className="text-center py-4 px-4 text-sm font-bold text-slate-800">Total</th>
                    <th className="text-center py-4 px-4 text-sm font-bold text-slate-800">Completed</th>
                    <th className="text-center py-4 px-4 text-sm font-bold text-slate-800">Cancelled</th>
                    <th className="text-center py-4 px-4 text-sm font-bold text-slate-800">Cancel Rate</th>
                    <th className="text-center py-4 px-4 text-sm font-bold text-slate-800">Status</th>
                    <th className="text-center py-4 px-4 text-sm font-bold text-slate-800">Availability</th>
                    <th className="text-center py-4 px-4 text-sm font-bold text-slate-800">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDoctors.map((doctor) => {
                    const cancelledCount = Math.max(doctor.appointmentCount - doctor.completedCount, 0);
                    const statusTone = doctor.cancellationRate === 0
                      ? "bg-green-100 text-green-700 border-green-300 font-semibold"
                      : doctor.cancellationRate >= 50
                      ? "bg-red-100 text-red-700 border-red-300 font-semibold"
                      : "bg-yellow-100 text-yellow-700 border-yellow-300 font-semibold";
                    const statusLabel = doctor.cancellationRate === 0
                      ? "Good"
                      : doctor.cancellationRate >= 50
                      ? "Alert"
                      : "Normal";
                    const isAvailable = !!doctorAvailability[doctor.doctorId];
                    
                    return (
                      <tr 
                        key={doctor.doctorId} 
                        className="border-b border-slate-100 hover:bg-sky-50/80 transition-all duration-300 hover:shadow-sm"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br from-sky-400 to-blue-600">
                              {doctor.doctorName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{doctor.doctorName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">
                            {doctor.specialization}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-center"><div className="text-xl font-bold text-sky-600">{doctor.appointmentCount}</div></td>
                        <td className="py-4 px-4 text-center">
                          <div className="text-xl font-bold text-sky-600">{doctor.completedCount}</div>
                        </td>
                        <td className="py-4 px-4 text-center"><div className="text-xl font-bold text-red-600">{cancelledCount}</div></td>
                        <td className="py-4 px-4 text-center">
                          <Badge className={statusTone}>{doctor.cancellationRate}%</Badge>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge className={statusTone}>{statusLabel}</Badge>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge className={isAvailable ? "bg-sky-100 text-sky-700 border-sky-300" : "bg-slate-100 text-slate-700 border-slate-300"}>
                            {isAvailable ? "Available" : "Unavailable"}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              className="text-xs gap-1.5 font-semibold bg-amber-500 hover:bg-amber-600 text-white"
                              onClick={() => warnDoctor(doctor.doctorId, doctor.doctorName)}
                            >
                              <AlertCircle className="w-3 h-3" />
                              Warn
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => navigate(`/admin/users?search=${doctor.doctorName}`)}
                            >
                              <Activity className="w-3 h-3 mr-1" />
                              View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr className="border-b-2 border-slate-300 bg-slate-50">
                      <th className="text-left py-4 px-4 text-sm font-bold text-slate-800">Patient</th>
                      <th className="text-center py-4 px-4 text-sm font-bold text-slate-800">Feedback Count</th>
                      <th className="text-center py-4 px-4 text-sm font-bold text-slate-800">Average Rating</th>
                      <th className="text-center py-4 px-4 text-sm font-bold text-slate-800">Demand Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientDemandRows.map((p) => (
                      <tr key={p.patientName} className="border-b border-slate-100">
                        <td className="py-4 px-4 font-semibold text-slate-900">{p.patientName}</td>
                        <td className="py-4 px-4 text-center font-bold text-sky-600">{p.totalFeedback}</td>
                        <td className="py-4 px-4 text-center font-bold text-sky-600">{p.averageRating.toFixed(1)}</td>
                        <td className="py-4 px-4 text-center">
                          <Badge className={p.totalFeedback >= 2 ? "bg-sky-100 text-sky-700 border-sky-300" : "bg-slate-100 text-slate-700 border-slate-300"}>
                            {p.totalFeedback >= 2 ? "High" : "Normal"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {patientDemandRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-slate-500">No patient demand data available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Performance Summary */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
              <div className="bg-sky-50 p-4 rounded-lg border border-sky-200">
                <div className="text-sm text-sky-700 font-medium">Top Performers</div>
                <div className="text-2xl font-bold text-sky-600 mt-1">
                  {doctorDemand.topDoctors.filter(d => d.cancellationRate < 10).length}
                </div>
                <div className="text-xs text-green-600 mt-1">Cancellation rate &lt; 10%</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="text-sm text-yellow-700 font-medium">Needs Monitoring</div>
                <div className="text-2xl font-bold text-yellow-600 mt-1">
                  {doctorDemand.topDoctors.filter(d => d.cancellationRate >= 10 && d.cancellationRate <= 20).length}
                </div>
                <div className="text-xs text-yellow-600 mt-1">Cancellation rate 10-20%</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <div className="text-sm text-red-700 font-medium">Critical</div>
                <div className="text-2xl font-bold text-red-600 mt-1">
                  {doctorDemand.topDoctors.filter(d => d.cancellationRate > 20).length}
                </div>
                <div className="text-xs text-red-600 mt-1">Cancellation rate &gt; 20%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Patient Feedback by Doctor - NEW SECTION */}
      {recentReviews && recentReviews.length > 0 && (
        <Card className="border-0 rounded-2xl shadow-xl bg-gradient-to-br from-white to-cyan-50">
          <CardHeader className="border-b border-cyan-200 bg-gradient-to-r from-cyan-50 to-blue-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg shadow-md">
                  <Star className="h-6 w-6 text-white fill-white" />
                </div>
                Patient Feedback by Doctor
              </CardTitle>
              <Badge className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                {recentReviews.length} Reviews
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {(() => {
                // Group reviews by doctor
                const reviewsByDoctor: Record<string, typeof recentReviews> = {};
                recentReviews.forEach(review => {
                  if (!reviewsByDoctor[review.doctorName]) {
                    reviewsByDoctor[review.doctorName] = [];
                  }
                  reviewsByDoctor[review.doctorName].push(review);
                });

                return Object.entries(reviewsByDoctor).map(([doctorName, doctorReviews]) => {
                  const avgRating = doctorReviews.reduce((sum, r) => sum + r.rating, 0) / doctorReviews.length;
                  const specialization = doctorReviews[0]?.doctorSpecialization || "N/A";
                  
                  return (
                    <div key={doctorName} className="bg-white border-2 border-cyan-200 rounded-xl p-6 hover:shadow-lg transition-all">
                      {/* Doctor Header */}
                      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                            {doctorName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">{doctorName}</h3>
                            <p className="text-sm text-slate-600">{specialization}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                            <span className="text-3xl font-bold text-slate-900">{avgRating.toFixed(1)}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{doctorReviews.length} review{doctorReviews.length > 1 ? 's' : ''}</p>
                        </div>
                      </div>

                      {/* Reviews Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {doctorReviews.map((review) => (
                          <div key={review._id} className="bg-gradient-to-br from-slate-50 to-cyan-50 border border-cyan-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white font-bold text-xs">
                                  {review.patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <span className="font-semibold text-sm text-slate-900">{review.patientName}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-4 h-4 ${
                                      i < review.rating
                                        ? 'fill-yellow-400 text-yellow-400'
                                        : 'fill-slate-200 text-slate-200'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            {review.comment && (
                              <p className="text-xs text-slate-700 italic mt-2 bg-white/60 rounded-md p-2 border border-slate-200">
                                "{review.comment}"
                              </p>
                            )}
                            <p className="text-xs text-slate-500 mt-2">
                              {new Date(review.createdAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Reviews Message */}
      {(!recentReviews || recentReviews.length === 0) && (
        <Card className="border-0 rounded-2xl shadow-lg bg-white">
          <CardContent className="py-16">
            <div className="text-center">
              <Star className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Patient Feedback Yet</h3>
              <p className="text-slate-600">Patient reviews will appear here once they start providing feedback.</p>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
    </div>
  );
};

export default AdminDashboard;
