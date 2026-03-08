import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Users, Stethoscope, CalendarDays, Clock, AlertCircle, TrendingUp, MessageSquare, RefreshCw, Shield, Activity, Star, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import api from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { useSocket } from "@/hooks/useSocket";
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

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
  totalAdmins: number;
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
  patientId: string;
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
    totalAdmins: 0,
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
  const [allAppointments, setAllAppointments] = useState<any[]>([]);
  const [userData, setUserData] = useState<any[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [recentContacts, setRecentContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [analyticsStats, setAnalyticsStats] = useState<AppointmentAnalyticsStats | null>(null);
  const [doctorDemand, setDoctorDemand] = useState<DoctorDemandData | null>(null);
  const [doctorAvailability, setDoctorAvailability] = useState<Record<string, boolean>>({});
  const [doctorFilter, setDoctorFilter] = useState<"highest-appointments" | "highest-cancellation" | "lowest-cancellation">("highest-appointments");
  const [patientFilter, setPatientFilter] = useState<"highest-feedback" | "highest-rating" | "high-demand" | "normal-demand">("highest-feedback");
  const [performanceView, setPerformanceView] = useState<"doctor" | "patient">("doctor");
  const [recentReviews, setRecentReviews] = useState<AdminReviewItem[]>([]);
  const [reviewSummary, setReviewSummary] = useState({ totalReviews: 0, averageRating: 0 });
  const [warningDialog, setWarningDialog] = useState({
    open: false,
    userId: "",
    userName: "",
    userRole: "doctor" as "doctor" | "patient",
    reason: "",
    message: "",
    loading: false,
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Use admin-specific endpoints
      const safeGet = async (url: string) => {
        try { return await api.get(url); }
        catch { return { data: {} }; }
      };

      const [
        statsRes,
        appointmentsRes,
        contactsRes,
        reviewsRes,
        usersRes,
        usersTotalRes,
        usersDoctorsTotalRes,
        usersPatientsTotalRes,
        usersAdminsTotalRes,
        pendingDoctorsRes,
        pendingPatientsRes,
      ] = await Promise.all([
        safeGet('/admin/dashboard-stats'),
        safeGet('/admin/appointments?limit=5000&page=1'),
        safeGet('/contact/'),
        safeGet('/public/reviews/admin/recent?limit=6'),
        safeGet('/admin/users?limit=1000'),
        safeGet('/admin/users?limit=1'),
        safeGet('/admin/users?role=doctor&limit=1'),
        safeGet('/admin/users?role=patient&limit=1'),
        safeGet('/admin/users?role=admin&limit=1'),
        safeGet('/admin/doctors/pending-list'),
        safeGet('/admin/patients/pending'),
      ]);

      const dashStats = statsRes.data?.stats || statsRes.data || {};
      const appointments: any[] = appointmentsRes.data?.appointments || [];
      const contacts: any[] = contactsRes.data?.contacts || contactsRes.data || [];
      const users: any[] = usersRes.data?.users || usersRes.data || [];

      // Build chart data from appointments
      const statuses = ["completed", "cancelled", "in-progress", "in progress", "booked", "pending", "accepted", "confirmed"];
      const statusCounts: Record<string, number> = {};
      appointments.forEach((a: any) => {
        const s = (a.status || "").toLowerCase();
        statuses.forEach((st) => { if (s === st) statusCounts[st] = (statusCounts[st] || 0) + 1; });
      });

      const completedFromAppointments = (statusCounts["completed"] || 0);
      const cancelledFromAppointments = (statusCounts["cancelled"] || 0);
      const inProgressFromAppointments = (statusCounts["in-progress"] || 0) + (statusCounts["in progress"] || 0);
      const upcomingFromAppointments = (statusCounts["booked"] || 0) + (statusCounts["pending"] || 0) + (statusCounts["accepted"] || 0) + (statusCounts["confirmed"] || 0);

      const completed = Number(dashStats.completedAppointments ?? completedFromAppointments);
      const cancelled = Number(dashStats.cancelledAppointments ?? cancelledFromAppointments);
      const inProg = Number(dashStats.inProgressAppointments ?? inProgressFromAppointments);
      const booked = Number(
        ((dashStats.pendingAppointments ?? 0) as number) +
        ((dashStats.confirmedAppointments ?? 0) as number)
      ) || upcomingFromAppointments;

      const appointmentChartData = [
        { name: "Completed", value: completed, fill: "#10b981" },
        { name: "Cancelled", value: cancelled, fill: "#ef4444" },
        { name: "In Progress", value: inProg, fill: "#f59e0b" },
        { name: "Upcoming", value: booked, fill: "#3b82f6" },
      ].filter((d) => d.value > 0);

      // Build non-overlapping user distribution buckets (fixes logical double counting)
      const usersList = Array.isArray(users) ? users : [];

      const totalUsersFromPagination = usersTotalRes.data?.pagination?.total;
      const totalDoctorsFromPagination = usersDoctorsTotalRes.data?.pagination?.total;
      const totalPatientsFromPagination = usersPatientsTotalRes.data?.pagination?.total;
      const totalAdminsFromPagination = usersAdminsTotalRes.data?.pagination?.total;

      const pendingDoctorsFromEndpoint = pendingDoctorsRes.data?.count ??
        (Array.isArray(pendingDoctorsRes.data?.doctors) ? pendingDoctorsRes.data.doctors.length : undefined);

      const pendingPatientsFromEndpoint = pendingPatientsRes.data?.count ??
        (Array.isArray(pendingPatientsRes.data?.patients) ? pendingPatientsRes.data.patients.length : undefined);

      const toNum = (value: unknown): number | undefined => {
        if (value === undefined || value === null) return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
      };

      const firstDefinedNumber = (...values: unknown[]): number => {
        for (const value of values) {
          const n = toNum(value);
          if (n !== undefined) return n;
        }
        return 0;
      };

      const totalUsers = firstDefinedNumber(totalUsersFromPagination, dashStats.totalUsers, usersList.length);
      const totalDoctors = firstDefinedNumber(totalDoctorsFromPagination, dashStats.totalDoctors);
      const totalPatients = firstDefinedNumber(totalPatientsFromPagination, dashStats.totalPatients);
      const totalAdmins = firstDefinedNumber(totalAdminsFromPagination, Math.max(totalUsers - totalDoctors - totalPatients, 0));
      const pendingDoctors = firstDefinedNumber(pendingDoctorsFromEndpoint, dashStats.pendingDoctors);
      const pendingPatients = firstDefinedNumber(pendingPatientsFromEndpoint, dashStats.pendingPatients);

      const approvedDoctors = Math.max(totalDoctors - pendingDoctors, 0);
      const approvedPatients = Math.max(totalPatients - pendingPatients, 0);

      const userChartData = [
        { name: "Approved Doctors", value: approvedDoctors, fill: "#10b981" },
        { name: "Approved Patients", value: approvedPatients, fill: "#3b82f6" },
        { name: "Pending Doctors", value: pendingDoctors, fill: "#f59e0b" },
        { name: "Pending Patients", value: pendingPatients, fill: "#8b5cf6" },
      ].filter((d) => d.value > 0);

      const today = new Date().toISOString().split("T")[0];

      // Map DB lowercase status → UI capitalized
      const mapDbStatus = (s: string) => {
        const m: Record<string, string> = { pending: "Booked", confirmed: "Accepted", "in-progress": "In Progress", completed: "Completed", cancelled: "Cancelled", rejected: "Rejected" };
        return m[(s || "").toLowerCase()] || s;
      };

      const todayAppts = appointments
        .filter((a: any) => {
          const matchesDate = String(a.date).slice(0, 10) === today && (a.status || "") !== "cancelled";
          const hasValidData = (a.patientId?.name || a.patientName) && (a.doctorId?.name || a.doctorName);
          return matchesDate && hasValidData;
        })
        .slice(0, 8)
        .map((a: any) => ({
          _id: a._id,
          patientName: a.patientId?.name || a.patientName,
          doctorName: a.doctorId?.name || a.doctorName,
          specialization: a.doctorId?.specialization || a.specialization || "General",
          time: a.time || "—",
          date: a.date,
          status: mapDbStatus(a.status),
        }));

      setStats({
        totalUsers,
        totalDoctors,
        totalPatients,
        totalAdmins,
        totalAppointments: dashStats.totalAppointments ?? appointments.length,
        completedAppointments: dashStats.completedAppointments ?? completed,
        cancelledAppointments: dashStats.cancelledAppointments ?? cancelled,
        inProgressAppointments: dashStats.inProgressAppointments ?? inProg,
        totalPrescriptions: dashStats.totalPrescriptions ?? 0,
        pendingDoctors,
        pendingPatients,
        totalContacts: Array.isArray(contacts) ? contacts.length : 0,
        openContacts: Array.isArray(contacts) ? contacts.filter((c: any) => (c.status || "").toLowerCase() === "open").length : 0,
      });

      setAppointmentData(appointmentChartData);
      setAllAppointments(appointments);
      setUserData(userChartData);
      setTodayAppointments(todayAppts);
      setRecentContacts(Array.isArray(contacts) ? contacts.slice(0, 3) : []);
      setRecentReviews(reviewsRes.data?.reviews || []);
      setReviewSummary({
        totalReviews: reviewsRes.data?.summary?.totalReviews || 0,
        averageRating: reviewsRes.data?.summary?.averageRating || 0,
      });

      const doctors = usersList.filter((u: any) => String(u.role || '').toLowerCase() === 'doctor');
      if (Array.isArray(doctors)) {
        const availabilityMap: Record<string, boolean> = {};
        doctors.forEach((d: any) => {
          const approvalStatus = String(d.approvalStatus || '').toLowerCase();
          const completion = Number(d.profileCompletionPercentage || 0);
          const isEligible = d.isApprovedAndComplete === true || (approvalStatus === 'approved' && completion === 100);
          const isAvailable = isEligible && (
            typeof d.available === "boolean"
              ? d.available
              : String(d.onlineStatus || "").toLowerCase() === "online"
          );
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

  const filteredDoctors = (doctorDemand?.topDoctors || [])
    .filter(
      (d) =>
        d.doctorName &&
        !d.doctorName.toLowerCase().includes('unknown') &&
        !d.doctorName.toLowerCase().includes('(deleted)') &&
        d.doctorId
    )
    .slice()
    .sort((a, b) => {
      if (doctorFilter === "highest-cancellation") return b.cancellationRate - a.cancellationRate;
      if (doctorFilter === "lowest-cancellation") return a.cancellationRate - b.cancellationRate;
      return b.appointmentCount - a.appointmentCount;
    });

  const patientDemandRows = Object.values(
    recentReviews
      .filter((r) => r.patientName && !r.patientName.toLowerCase().includes('unknown'))
      .reduce((acc, r) => {
        const key = r.patientName;
        // Extract patient ID - handle both string and object formats
        const patientIdValue = typeof r.patientId === 'string' ? r.patientId : (r.patientId?._id || "");
        if (!acc[key]) {
          acc[key] = { patientId: patientIdValue, patientName: key, totalFeedback: 0, averageRating: 0, totalRating: 0 };
        }
        if (!acc[key].patientId && patientIdValue) acc[key].patientId = patientIdValue;
        acc[key].totalFeedback += 1;
        acc[key].totalRating += Number(r.rating || 0);
        acc[key].averageRating = acc[key].totalRating / acc[key].totalFeedback;
        return acc;
      }, {} as Record<string, { patientId: string; patientName: string; totalFeedback: number; averageRating: number; totalRating: number }>)
  ).sort((a, b) => b.totalFeedback - a.totalFeedback);

  const filteredPatients = patientDemandRows
    .filter((p) => {
      if (patientFilter === "high-demand") return p.totalFeedback >= 2;
      if (patientFilter === "normal-demand") return p.totalFeedback < 2;
      return true;
    })
    .slice()
    .sort((a, b) => {
      if (patientFilter === "highest-rating") return b.averageRating - a.averageRating;
      return b.totalFeedback - a.totalFeedback;
    });

  const openWarningDialog = (userId: string, userName: string, userRole: "doctor" | "patient") => {
    setWarningDialog({
      open: true,
      userId,
      userName,
      userRole,
      reason: "",
      message: "",
      loading: false,
    });
  };

  const handleSendWarning = async () => {
    if (!warningDialog.userId || !warningDialog.message.trim()) {
      toast({
        title: "Required",
        description: "Please enter a warning message.",
        variant: "destructive",
      });
      return;
    }

    const reasonLabelMap: Record<string, string> = {
      "high-cancellation": "High Cancellation Rate",
      "no-show": "Frequent No-shows",
      "poor-ratings": "Poor Patient Ratings",
      "violation": "Policy Violation",
      "other": "Other",
    };
    const reasonLabel = warningDialog.reason ? reasonLabelMap[warningDialog.reason] || warningDialog.reason : "";
    const composedMessage = reasonLabel
      ? `${reasonLabel}: ${warningDialog.message.trim()}`
      : warningDialog.message.trim();

    try {
      setWarningDialog((prev) => ({ ...prev, loading: true }));
      await api.put(`/admin/users/${warningDialog.userId}/warn`, { message: composedMessage });
      toast({ title: "Warning sent", description: `Warning sent to ${warningDialog.userName}` });
      setWarningDialog({ open: false, userId: "", userName: "", userRole: "doctor", reason: "", message: "", loading: false });
    } catch (error: any) {
      console.error('Warning error:', error.response?.data || error.message);
      toast({ 
        title: "Warning failed", 
        description: error.response?.data?.message || `Could not send warning to ${warningDialog.userName}`, 
        variant: "destructive" 
      });
      setWarningDialog((prev) => ({ ...prev, loading: false }));
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

  // Calculate dynamic trends based on appointment data range
  const calculateDynamicTrends = (appointments: any[]) => {
    if (!appointments || appointments.length === 0) {
      return { data: [], granularity: 'monthly' as const, period: 'Month' };
    }

    // Helper function to convert ISO week to friendly date range
    const getWeekDateRange = (weekString: string): string => {
      const [year, week] = weekString.split('-W').map(x => parseInt(x));
      const simple = new Date(year, 0, 1 + (week - 1) * 7);
      const mon = new Date(simple);
      mon.setDate(mon.getDate() - mon.getDay() + 1);
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      const startStr = mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = sun.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${startStr} - ${endStr}`;
    };

    // Extract dates from appointments
    const dates = appointments
      .map((a: any) => {
        const dateStr = a.date || a.createdAt;
        return dateStr ? new Date(dateStr) : null;
      })
      .filter((d: Date | null): d is Date => d !== null && !isNaN(d.getTime()))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());

    if (dates.length === 0) {
      return { data: [], granularity: 'monthly' as const, period: 'Month' };
    }

    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const daysDiff = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);

    // Determine granularity based on date range
    let granularity: 'daily' | 'weekly' | 'monthly';
    let period: string;

    if (daysDiff <= 14) {
      granularity = 'daily';
      period = 'Day';
    } else if (daysDiff <= 90) {
      granularity = 'weekly';
      period = 'Week';
    } else {
      granularity = 'monthly';
      period = 'Month';
    }

    // Group appointments by selected granularity
    const groupedData: Record<string, number> = {};

    if (granularity === 'daily') {
      // Fill in all days in range
      const current = new Date(minDate);
      while (current <= maxDate) {
        const dateKey = current.toISOString().split('T')[0];
        groupedData[dateKey] = 0;
        current.setDate(current.getDate() + 1);
      }

      // Count appointments per day
      appointments.forEach((a: any) => {
        const dateStr = a.date || a.createdAt;
        if (dateStr) {
          const dateKey = new Date(dateStr).toISOString().split('T')[0];
          groupedData[dateKey] = (groupedData[dateKey] || 0) + 1;
        }
      });
    } else if (granularity === 'weekly') {
      // Get week number for a date
      const getWeekKey = (date: Date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      };

      // Fill in all weeks in range
      const current = new Date(minDate);
      const filledWeeks = new Set<string>();
      while (current <= maxDate) {
        const weekKey = getWeekKey(current);
        if (!filledWeeks.has(weekKey)) {
          groupedData[weekKey] = 0;
          filledWeeks.add(weekKey);
        }
        current.setDate(current.getDate() + 7);
      }

      // Count appointments per week
      appointments.forEach((a: any) => {
        const dateStr = a.date || a.createdAt;
        if (dateStr) {
          const weekKey = getWeekKey(new Date(dateStr));
          groupedData[weekKey] = (groupedData[weekKey] || 0) + 1;
        }
      });
    } else {
      // Monthly granularity
      const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      while (current <= maxDate) {
        const monthKey = current.toISOString().slice(0, 7); // YYYY-MM format
        groupedData[monthKey] = 0;
        current.setMonth(current.getMonth() + 1);
      }

      // Count appointments per month
      appointments.forEach((a: any) => {
        const dateStr = a.date || a.createdAt;
        if (dateStr) {
          const monthKey = new Date(dateStr).toISOString().slice(0, 7);
          groupedData[monthKey] = (groupedData[monthKey] || 0) + 1;
        }
      });
    }

    // Convert to chart data format
    const chartData = Object.entries(groupedData)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, count]) => ({
        label: granularity === 'daily' 
          ? new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : granularity === 'weekly'
          ? getWeekDateRange(label)
          : new Date(label + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        appointments: count,
        fullLabel: label
      }));

    return { data: chartData, granularity, period };
  };

  const dynamicTrends = calculateDynamicTrends(
    allAppointments && allAppointments.length > 0 ? allAppointments : []
  );

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

        {/* Header */}
        <div className="rounded-xl bg-sky-500 p-6 text-white shadow-md border border-sky-300">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Shield className="h-6 w-6" /> Dashboard</h1>
              <p className="mt-1 text-sky-100 text-sm">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} · Live system overview
              </p>
            </div>
            <Button onClick={() => fetchDashboardData()} variant="outline" size="sm" className="gap-2 bg-white/15 border-white/30 text-white hover:bg-white/25">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>

        {/* Key Metrics - Clean Cards - Item #15 Enhanced */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          
          <button onClick={() => navigate("/admin/users")} className="group text-left h-full">
            <Card className="rounded-2xl shadow-md overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 group-hover:shadow-xl transition-all group-hover:scale-[1.02] cursor-pointer h-full border-0">
              <CardContent className="p-6 text-white h-full flex flex-col">
                <div className="flex items-start justify-between mb-4 flex-1">
                  <div>
                    <p className="text-xs font-semibold text-blue-50 mb-2 uppercase tracking-wider">Total Users</p>
                    <p className="text-4xl font-bold">{stats.totalUsers}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-blue-400/30 flex items-center justify-center group-hover:bg-blue-400/40 transition-colors">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-blue-300/30">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.totalDoctors}</p>
                    <p className="text-xs text-blue-50">Doctors</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.totalPatients}</p>
                    <p className="text-xs text-blue-50">Patients</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.totalAdmins}</p>
                    <p className="text-xs text-blue-50">Admins</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

          <button onClick={() => navigate("/admin/appointments")} className="group text-left h-full">
            <Card className="rounded-2xl shadow-md overflow-hidden bg-gradient-to-br from-indigo-500 to-indigo-600 group-hover:shadow-xl transition-all group-hover:scale-[1.02] cursor-pointer h-full border-0">
              <CardContent className="p-6 text-white h-full flex flex-col">
                <div className="flex items-start justify-between mb-4 flex-1">
                  <div>
                    <p className="text-xs font-semibold text-indigo-50 mb-2 uppercase tracking-wider">Appointments</p>
                    <p className="text-4xl font-bold">{stats.totalAppointments}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-indigo-400/30 flex items-center justify-center group-hover:bg-indigo-400/40 transition-colors">
                    <CalendarDays className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="flex gap-4 pt-4 border-t border-indigo-300/30 justify-evenly">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.completedAppointments}</p>
                    <p className="text-xs text-indigo-50">Completed</p>
                  </div>
                  <div className="w-px bg-indigo-300/30"></div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.cancelledAppointments}</p>
                    <p className="text-xs text-indigo-50">Cancelled</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

          <button onClick={() => navigate("/admin/approvals")} className="group text-left h-full">
            <Card className="rounded-2xl shadow-md overflow-hidden bg-gradient-to-br from-amber-500 to-amber-600 group-hover:shadow-xl transition-all group-hover:scale-[1.02] cursor-pointer h-full border-0">
              <CardContent className="p-6 text-white h-full flex flex-col">
                <div className="flex items-start justify-between mb-4 flex-1">
                  <div>
                    <p className="text-xs font-semibold text-amber-50 mb-2 uppercase tracking-wider">Pending</p>
                    <p className="text-4xl font-bold">{stats.pendingDoctors + stats.pendingPatients}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-amber-400/30 flex items-center justify-center group-hover:bg-amber-400/40 transition-colors">
                    <AlertCircle className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="flex gap-4 pt-4 border-t border-amber-300/30 justify-evenly">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.pendingDoctors}</p>
                    <p className="text-xs text-amber-50">Doctors</p>
                  </div>
                  <div className="w-px bg-amber-300/30"></div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.pendingPatients}</p>
                    <p className="text-xs text-amber-50">Patients</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

          <button onClick={() => navigate("/admin/contacts")} className="group text-left h-full">
            <Card className="rounded-2xl shadow-md overflow-hidden bg-gradient-to-br from-teal-500 to-teal-600 group-hover:shadow-xl transition-all group-hover:scale-[1.02] cursor-pointer h-full border-0">
              <CardContent className="p-6 text-white h-full flex flex-col">
                <div className="flex items-start justify-between mb-4 flex-1">
                  <div>
                    <p className="text-xs font-semibold text-teal-50 mb-2 uppercase tracking-wider">Messages</p>
                    <p className="text-4xl font-bold">{stats.totalContacts}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-teal-400/30 flex items-center justify-center group-hover:bg-teal-400/40 transition-colors">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="flex gap-4 pt-4 border-t border-teal-300/30 justify-evenly">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.openContacts}</p>
                    <p className="text-xs text-teal-50">Open</p>
                  </div>
                  <div className="w-px bg-teal-300/30"></div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{stats.totalContacts - stats.openContacts}</p>
                    <p className="text-xs text-teal-50">Resolved</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

          <button onClick={() => navigate("/admin/reviews")} className="group text-left h-full">
            <Card className="rounded-2xl shadow-md overflow-hidden bg-gradient-to-br from-rose-500 to-rose-600 group-hover:shadow-xl transition-all group-hover:scale-[1.02] cursor-pointer h-full border-0">
              <CardContent className="p-6 text-white h-full flex flex-col">
                <div className="flex items-start justify-between mb-4 flex-1">
                  <div>
                    <p className="text-xs font-semibold text-rose-50 mb-2 uppercase tracking-wider">Feedback</p>
                    <p className="text-4xl font-bold">{reviewSummary.totalReviews}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-rose-400/30 flex items-center justify-center group-hover:bg-rose-400/40 transition-colors">
                    <Star className="h-5 w-5 text-white fill-white" />
                  </div>
                </div>
                <div className="flex gap-4 pt-4 border-t border-rose-300/30 justify-evenly">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{reviewSummary.averageRating.toFixed(1)}</p>
                    <p className="text-xs text-rose-50">Avg ★</p>
                  </div>
                  <div className="w-px bg-rose-300/30"></div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{recentReviews.filter((r) => r.rating >= 4).length}</p>
                    <p className="text-xs text-rose-50">4★+</p>
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



      {/* Dynamic Appointment Trends - Adaptive Granularity */}
      {dynamicTrends.data && dynamicTrends.data.length > 0 && (
        <Card className="border border-slate-200 rounded-2xl shadow-md hover:shadow-lg hover:border-sky-200 transition-all duration-300 bg-gradient-to-br from-white via-blue-50/30 to-sky-50">
          <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-sky-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-sky-600 rounded-lg shadow-md">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                {dynamicTrends.granularity === 'daily' ? 'Daily' : dynamicTrends.granularity === 'weekly' ? 'Weekly' : 'Monthly'} Appointment Trends
              </CardTitle>
              <Badge className="bg-gradient-to-r from-blue-500 to-sky-600 text-white">
                {dynamicTrends.data.reduce((a, b) => a + b.appointments, 0)} Total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={350}>
              <LineChart 
                data={dynamicTrends.data}
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
                  dataKey="label" 
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
            
            {/* Trend Summary Cards - Dynamic */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
              <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-4 rounded-xl border-2 border-sky-200 shadow-sm">
                <div className="text-xs text-blue-700 font-semibold uppercase tracking-wide">Peak {dynamicTrends.period}</div>
                <div className="text-xl font-bold text-blue-600 mt-2">
                  {dynamicTrends.data.reduce((max, item) => 
                    item.appointments > max.appointments ? item : max, dynamicTrends.data[0]
                  )?.label}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  {Math.max(...dynamicTrends.data.map(d => d.appointments))} appointments
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-4 rounded-xl border-2 border-sky-200 shadow-sm">
                <div className="text-xs text-sky-700 font-semibold uppercase tracking-wide">Average</div>
                <div className="text-xl font-bold text-sky-600 mt-2">
                  {Math.round(dynamicTrends.data.reduce((a, b) => a + b.appointments, 0) / dynamicTrends.data.length)}
                </div>
                <div className="text-xs text-sky-600 mt-1">per {dynamicTrends.period.toLowerCase()}</div>
              </div>
              
              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-4 rounded-xl border-2 border-cyan-200 shadow-sm">
                <div className="text-xs text-cyan-700 font-semibold uppercase tracking-wide">Total {dynamicTrends.period}s</div>
                <div className="text-xl font-bold text-cyan-600 mt-2">
                  {dynamicTrends.data.length}
                </div>
                <div className="text-xs text-cyan-600 mt-1">tracked</div>
              </div>
              
              <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-4 rounded-xl border-2 border-cyan-200 shadow-sm">
                <div className="text-xs text-cyan-700 font-semibold uppercase tracking-wide">Trend</div>
                <div className="text-xl font-bold text-cyan-600 mt-2 flex items-center gap-2">
                  {(() => {
                    const lastItem = dynamicTrends.data[dynamicTrends.data.length - 1];
                    const prevItem = dynamicTrends.data[dynamicTrends.data.length - 2];
                    const lastCount = lastItem?.appointments || 0;
                    const prevCount = prevItem?.appointments || lastCount;
                    return lastCount >= prevCount ? (
                      <><TrendingUp className="w-5 h-5" /> Up</>
                    ) : (
                      <><Activity className="w-5 h-5" /> Down</>
                    );
                  })()}
                </div>
                <div className="text-xs text-cyan-600 mt-1">vs last {dynamicTrends.period.toLowerCase()}</div>
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
                {performanceView === "doctor" ? "Doctor Performance Analytics" : "Patient Demand & Feedback Analytics"}
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant={performanceView === "doctor" ? "default" : "outline"} className={performanceView === "doctor" ? "bg-sky-600 hover:bg-sky-700 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"} onClick={() => setPerformanceView("doctor")}>Doctor View</Button>
                <Button size="sm" variant={performanceView === "patient" ? "default" : "outline"} className={performanceView === "patient" ? "bg-sky-600 hover:bg-sky-700 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"} onClick={() => setPerformanceView("patient")}>Patient View</Button>
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
                {performanceView === "patient" && (
                  <select
                    value={patientFilter}
                    onChange={(e) => setPatientFilter(e.target.value as "highest-feedback" | "highest-rating" | "high-demand" | "normal-demand")}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold"
                  >
                    <option value="highest-feedback">Highest Feedback</option>
                    <option value="highest-rating">Highest Rating</option>
                    <option value="high-demand">High Demand</option>
                    <option value="normal-demand">Normal Demand</option>
                  </select>
                )}
                {((performanceView === "doctor" && doctorFilter !== "highest-appointments") ||
                  (performanceView === "patient" && patientFilter !== "highest-feedback")) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-700 border-red-300 bg-red-50 hover:bg-red-100"
                    onClick={() => {
                      if (performanceView === "doctor") setDoctorFilter("highest-appointments");
                      if (performanceView === "patient") setPatientFilter("highest-feedback");
                    }}
                  >
                    Clear Filter
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {performanceView === "doctor" ? (
            <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[1020px]">
                <caption className="sr-only">Doctor performance table showing appointment counts, cancellation metrics, and actions.</caption>
                <thead>
                  <tr className="sticky top-0 z-10 border-b-2 border-slate-300 bg-gradient-to-r from-slate-100 to-slate-50">
                    <th scope="col" className="text-left py-4 px-4 text-sm font-bold text-slate-800">Doctor</th>
                    <th scope="col" className="text-center py-4 px-4 text-sm font-bold text-slate-800">Total Appointments</th>
                    <th scope="col" className="text-center py-4 px-4 text-sm font-bold text-slate-800">Completed</th>
                    <th scope="col" className="text-center py-4 px-4 text-sm font-bold text-slate-800">Cancellation Rate</th>
                    <th scope="col" className="text-center py-4 px-4 text-sm font-bold text-slate-800">Performance Status</th>
                    <th scope="col" className="text-center py-4 px-4 text-sm font-bold text-slate-800">Actions</th>
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
                      ? "Excellent"
                      : doctor.cancellationRate >= 50
                      ? "Critical"
                      : doctor.cancellationRate >= 20
                      ? "Needs Improvement"
                      : "Good";
                    const isAvailable = !!doctorAvailability[doctor.doctorId];
                    
                    return (
                      <tr 
                        key={doctor.doctorId} 
                        className="border-b border-slate-100 hover:bg-sky-50/80 transition-all duration-300 hover:shadow-sm"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br from-emerald-400 to-emerald-600">
                              {doctor.doctorName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{doctor.doctorName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center"><div className="text-xl font-bold text-sky-600">{doctor.appointmentCount}</div></td>
                        <td className="py-4 px-4 text-center">
                          <div className="text-xl font-bold text-emerald-600">{doctor.completedCount}</div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="text-xl font-bold text-red-600">{doctor.cancellationRate}%</div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge className={statusTone}>{statusLabel}</Badge>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              className="text-xs gap-1.5 font-semibold bg-amber-500 hover:bg-amber-600 text-white"
                              onClick={() => openWarningDialog(doctor.doctorId, doctor.doctorName, "doctor")}
                              disabled={!doctor.doctorId}
                            >
                              <AlertCircle className="w-3 h-3" />
                              Warn
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 border-sky-300"
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
              <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full min-w-[1020px]">
                  <caption className="sr-only">Patient demand table with feedback count and average ratings.</caption>
                  <thead>
                    <tr className="sticky top-0 z-10 border-b-2 border-slate-300 bg-gradient-to-r from-slate-100 to-slate-50">
                      <th scope="col" className="text-left py-4 px-4 text-sm font-bold text-slate-800">Patient</th>
                      <th scope="col" className="text-center py-4 px-4 text-sm font-bold text-slate-800">Total Feedback</th>
                      <th scope="col" className="text-center py-4 px-4 text-sm font-bold text-slate-800">Average Rating</th>
                      <th scope="col" className="text-center py-4 px-4 text-sm font-bold text-slate-800">Rating Stars</th>
                      <th scope="col" className="text-center py-4 px-4 text-sm font-bold text-slate-800">Demand Status</th>
                      <th scope="col" className="text-center py-4 px-4 text-sm font-bold text-slate-800">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.map((p) => (
                      <tr key={p.patientName} className="border-b border-slate-100 hover:bg-sky-50/80 transition-all duration-300 hover:shadow-sm">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br from-cyan-400 to-cyan-600">
                              {p.patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{p.patientName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center"><div className="text-xl font-bold text-sky-600">{p.totalFeedback}</div></td>
                        <td className="py-4 px-4 text-center">
                          <div className="text-xl font-bold text-sky-600">{p.averageRating.toFixed(1)}</div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star key={i} className={`w-4 h-4 ${i < Math.round(p.averageRating) ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300'}`} />
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge className={p.totalFeedback >= 2 ? "bg-sky-100 text-sky-700 border-sky-300 font-semibold" : "bg-slate-100 text-slate-700 border-slate-300 font-semibold"}>
                            {p.totalFeedback >= 2 ? "High" : "Normal"}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              className="text-xs gap-1.5 font-semibold bg-amber-500 hover:bg-amber-600 text-white"
                              onClick={() => openWarningDialog(p.patientId, p.patientName, "patient")}
                              disabled={!p.patientId}
                            >
                              <AlertCircle className="w-3 h-3" />
                              Warn
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 border-sky-300"
                              onClick={() => navigate(`/admin/reviews`)}
                            >
                              <Activity className="w-3 h-3 mr-1" />
                              View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredPatients.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-500">No patient demand data available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Performance Summary */}
            {performanceView === "doctor" ? (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
                <div className="bg-sky-50 p-4 rounded-lg border border-sky-200">
                  <div className="text-sm text-sky-700 font-medium">Top Performers</div>
                  <div className="text-2xl font-bold text-sky-600 mt-1">
                    {filteredDoctors.filter((d) => d.cancellationRate < 10).length}
                  </div>
                  <div className="text-xs text-green-600 mt-1">Cancellation rate &lt; 10% (filtered)</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="text-sm text-yellow-700 font-medium">Needs Monitoring</div>
                  <div className="text-2xl font-bold text-yellow-600 mt-1">
                    {filteredDoctors.filter((d) => d.cancellationRate >= 10 && d.cancellationRate <= 20).length}
                  </div>
                  <div className="text-xs text-yellow-600 mt-1">Cancellation rate 10-20% (filtered)</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="text-sm text-red-700 font-medium">Critical</div>
                  <div className="text-2xl font-bold text-red-600 mt-1">
                    {filteredDoctors.filter((d) => d.cancellationRate > 20).length}
                  </div>
                  <div className="text-xs text-red-600 mt-1">Cancellation rate &gt; 20% (filtered)</div>
                </div>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
                <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-200">
                  <div className="text-sm text-cyan-700 font-medium">High Demand Patients</div>
                  <div className="text-2xl font-bold text-cyan-600 mt-1">
                    {filteredPatients.filter((p) => p.totalFeedback >= 2).length}
                  </div>
                  <div className="text-xs text-cyan-600 mt-1">Feedback count ≥ 2 (filtered)</div>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                  <div className="text-sm text-amber-700 font-medium">Top Rated Patients</div>
                  <div className="text-2xl font-bold text-amber-600 mt-1">
                    {filteredPatients.filter((p) => p.averageRating >= 4).length}
                  </div>
                  <div className="text-xs text-amber-600 mt-1">Average rating ≥ 4.0</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="text-sm text-slate-700 font-medium">Normal Demand Patients</div>
                  <div className="text-2xl font-bold text-slate-700 mt-1">
                    {filteredPatients.filter((p) => p.totalFeedback < 2).length}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">Feedback count &lt; 2</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Warning Dialog */}
      <Dialog open={warningDialog.open} onOpenChange={(openState) => setWarningDialog((prev) => ({ ...prev, open: openState }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Send Warning to {warningDialog.userRole === "patient" ? "Patient" : "Doctor"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Send a formal warning to {warningDialog.userName}
            </DialogDescription>
          </DialogHeader>

          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-800">
              Send a clear warning to <strong>{warningDialog.userName}</strong>. This will be visible to the {warningDialog.userRole}.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <select
                className="w-full px-3 py-2 rounded-md border border-input text-sm"
                value={warningDialog.reason}
                onChange={(e) => setWarningDialog((prev) => ({ ...prev, reason: e.target.value }))}
              >
                <option value="">Select a reason...</option>
                <option value="high-cancellation">High Cancellation Rate</option>
                <option value="no-show">Frequent No-shows</option>
                <option value="poor-ratings">Poor Ratings</option>
                <option value="violation">Policy Violation</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Warning Message *</label>
              <Textarea
                placeholder={`Write a clear warning message for ${warningDialog.userName || 'the selected user'}...`}
                value={warningDialog.message}
                onChange={(e) => setWarningDialog((prev) => ({ ...prev, message: e.target.value }))}
                className="text-sm resize-none"
                rows={4}
              />
              <div className="text-xs text-slate-500">Be specific about what needs to improve.</div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
              onClick={() => setWarningDialog((prev) => ({ ...prev, open: false }))}
              disabled={warningDialog.loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleSendWarning()}
              disabled={warningDialog.loading || !warningDialog.message.trim()}
            >
              {warningDialog.loading ? "Sending..." : "Send Warning"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Removed: Patient Feedback by Doctor card (duplicate section, not needed) */}

    </div>
    </div>
  );
};

export default AdminDashboard;
