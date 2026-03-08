import { useState, useEffect, useCallback } from "react";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption,
} from "@/components/ui/table";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, AlertCircle, CheckCircle2, XCircle, RefreshCw, CalendarDays, Clock, FileText } from "lucide-react";
import api from "@/services/api";
import { EmptyState } from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { PatientMedicalHistoryButton } from "@/components/PatientMedicalHistoryButton";

const AdminAppointments = () => {
  const { cancelAppointment } = useClinic();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get("filter") || "all";

  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rxByAppointment, setRxByAppointment] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState(initialFilter);
  const [viewMode, setViewMode] = useState<"all" | "doctor">("all");
  const [doctorSort, setDoctorSort] = useState<"highest" | "lowest" | "all">("all");  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string | null>(null);  const [warningDialog, setWarningDialog] = useState({
    open: false,
    doctorId: null as string | null,
    doctorName: "",
    reason: "",
    message: "",
    loading: false,
  });
  const [reasonDialog, setReasonDialog] = useState({
    open: false,
    patientName: "",
    doctorName: "",
    reason: "",
    date: "",
  });

  // Fetch appointments from API
  // Map DB lowercase status to UI capitalized status
  const mapDbStatus = (s: string): string => {
    const map: Record<string, string> = {
      pending: 'Booked',
      confirmed: 'Accepted',
      'in-progress': 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return map[s] || s;
  };

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const [appointmentsRes, prescriptionsRes] = await Promise.all([
        api.get('/admin/appointments?limit=200'),
        api.get('/prescriptions', { params: { limit: 2000 } }),
      ]);

      const normalizeId = (value: any) => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return String(value);
        if (typeof value === 'object') {
          if (value._id) return String(value._id);
          if (value.id) return String(value.id);
        }
        return String(value);
      };

      const prescriptions = prescriptionsRes.data?.prescriptions || prescriptionsRes.data?.data || [];
      const rxMap = (Array.isArray(prescriptions) ? prescriptions : []).reduce((acc: Record<string, string>, rx: any) => {
        const appointmentId = normalizeId(rx.appointmentId?._id || rx.appointmentId);
        const rxId = normalizeId(rx._id || rx.id);
        if (appointmentId && rxId) {
          acc[appointmentId] = rxId;
        }
        return acc;
      }, {});
      setRxByAppointment(rxMap);

      const res = appointmentsRes;
      if (res.data?.success) {
        const appointmentsData = (res.data.appointments || []).map((apt: any) => ({
          _id: apt._id,
          id: apt._id,
          patientName: apt.patientId?.name || apt.patientName || 'Unknown Patient',
          patientId: apt.patientId?._id || apt.patientId || '',
          doctorId: apt.doctorId?._id || apt.doctorId || '',
          doctorName: apt.doctorId?.name || apt.doctorName || 'Unknown Doctor',
          specialization: apt.doctorId?.specialization || apt.doctorSpecialization || 'General',
          date: apt.date || new Date().toISOString().split('T')[0],
          time: apt.time || '00:00',
          status: mapDbStatus(apt.status || 'pending'),
          reason: apt.cancellationReason || apt.notes || '',
          prescriptionGiven: apt.prescriptionGiven || false,
          prescription: apt.prescriptionId || null,
        }));
        setAppointments(appointmentsData);
      } else {
        setAppointments([]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load appointments",
        variant: "destructive",
      });
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchAppointments();
      toast({ title: "Refreshed", description: "Latest appointment and prescription data loaded" });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const filtered = appointments
    .filter((a) => statusFilter === "all" || a.status === statusFilter)
    .filter((a) => !selectedDoctorFilter || a.doctorId === selectedDoctorFilter)
    .filter((a) => {
      // Hide ONLY if BOTH patient AND doctor are deleted
      const patientDeleted = a.patientName.includes('(Deleted)');
      const doctorDeleted = a.doctorName.includes('(Deleted)');
      return !(patientDeleted && doctorDeleted);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  // Calculate doctor appointment counts
  const doctorCounts = appointments.reduce((acc: Record<string, {name: string, id: string, count: number}>, apt) => {
    const key = apt.doctorId || `doctor:${apt.doctorName}`;
    if (!acc[key]) {
      acc[key] = { name: apt.doctorName, id: apt.doctorId, count: 0 };
    }
    acc[key].count++;
    return acc;
  }, {});

  const doctorStats = Object.values(doctorCounts)
    .filter(doc => doc.name && doc.id && !doc.name.toLowerCase().includes('unknown'))
    .sort((a, b) => {
      if (doctorSort === "highest") return b.count - a.count;
      if (doctorSort === "lowest") return a.count - b.count;
      return 0;
    });

  const viewAllDoctorAppointments = viewMode === "doctor" ? doctorStats : null;

  // Calculate statistics
  const stats = {
    total: appointments.length,
    completed: appointments.filter(a => a.status === "Completed").length,
    cancelled: appointments.filter(a => a.status === "Cancelled").length,
    pending: appointments.filter(a => a.status === "Booked").length,
    accepted: appointments.filter(a => a.status === "Accepted").length,
    inProgress: appointments.filter(a => a.status === "In Progress").length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Completed": return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "Cancelled": return <XCircle className="w-4 h-4 text-red-600" />;
      case "In Progress": return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default: return <AlertCircle className="w-4 h-4 text-blue-600" />;
    }
  };

  const getInitials = (name: string) => {
    const cleanName = String(name || '').trim();
    
    // Handle deleted users
    if (cleanName.includes('(Deleted)')) {
      if (cleanName.startsWith('Patient')) return 'PD';
      if (cleanName.startsWith('Doctor')) return 'DD';
      if (cleanName.startsWith('Unknown')) return 'UN';
    }
    
    // Regular name processing
    return cleanName
      .split(' ')
      .filter(word => word && !word.includes('('))
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'NA';
  };

  const formatDateDisplay = (value: string) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleSendWarningToDoctor = async () => {
    if (!warningDialog.doctorId || !warningDialog.reason) {
      toast({
        title: "Required",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setWarningDialog(prev => ({ ...prev, loading: true }));
      
      const response = await api.post(
        `/appointments/admin/doctor/${warningDialog.doctorId}/warning`,
        {
          reason: warningDialog.reason,
          message: warningDialog.message,
        }
      );

      if (response.data?.success) {
        toast({
          title: "Success",
          description: `Warning sent to ${warningDialog.doctorName}`,
        });
        setWarningDialog({
          open: false,
          doctorId: null,
          doctorName: "",
          reason: "",
          message: "",
          loading: false,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to send warning",
        variant: "destructive",
      });
    } finally {
      setWarningDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const filters = ["all", "Booked", "Accepted", "In Progress", "Completed", "Cancelled"];

  return (
    <>
    <div className="container mx-auto px-6 py-8 space-y-6 max-w-7xl pb-12 bg-white min-h-screen">
      {/* Header */}
      <div className="rounded-xl bg-sky-500 p-6 text-white shadow-md border border-sky-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><CalendarDays className="h-6 w-6" /> All Appointments</h1>
            <p className="mt-1 text-sky-100 text-sm">Manage, track, and monitor all appointments in the system</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 bg-white/15 border-white/30 text-white hover:bg-white/25" onClick={handleRefresh} disabled={isRefreshing || loading}>
            <RefreshCw className={`h-4 w-4 ${(isRefreshing || loading) ? 'animate-spin' : ''}`} /> {(isRefreshing || loading) ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Statistics Cards - Modern Hover Effects */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="border-slate-200 shadow-sm rounded-xl hover:shadow-md hover:border-sky-300 transition-all duration-200 hover:scale-105">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs text-slate-600 mb-1 font-semibold uppercase">Total</p>
              <p className="text-2xl font-bold text-sky-600">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm rounded-xl hover:shadow-md hover:border-emerald-300 transition-all duration-200 hover:scale-105">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs text-slate-600 mb-1 font-semibold uppercase">Completed</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm rounded-xl hover:shadow-md hover:border-red-300 transition-all duration-200 hover:scale-105">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs text-slate-600 mb-1 font-semibold uppercase">Cancelled</p>
              <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm rounded-xl hover:shadow-md hover:border-sky-300 transition-all duration-200 hover:scale-105">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs text-slate-600 mb-1 font-semibold uppercase">Pending</p>
              <p className="text-2xl font-bold text-sky-600">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm rounded-xl hover:shadow-md hover:border-emerald-300 transition-all duration-200 hover:scale-105">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs text-slate-600 mb-1 font-semibold uppercase">Accepted</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.accepted}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm rounded-xl hover:shadow-md hover:border-amber-300 transition-all duration-200 hover:scale-105">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-xs text-slate-600 mb-1 font-semibold uppercase">In Progress</p>
              <p className="text-2xl font-bold text-amber-600">{stats.inProgress}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs - Enhanced Transitions */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 hover:shadow-sm ${
              statusFilter === f 
                ? "bg-sky-500 text-white shadow-md scale-105" 
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:scale-102"
            }`}>
            {f === "all" ? "All" : f}
            {f !== "all" && (
              <span className="ml-2 text-xs">
                ({appointments.filter(a => a.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* View Mode Toggle & Doctor Filter - Enhanced */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-700">View:</span>
          <button
            onClick={() => { setViewMode("all"); setDoctorSort("all"); }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md ${
              viewMode === "all" 
                ? "bg-emerald-500 text-white shadow-md scale-105" 
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:scale-102"
            }`}>
            All Appointments
          </button>
          <button
            onClick={() => setViewMode("doctor")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md ${
              viewMode === "doctor" 
                ? "bg-emerald-500 text-white shadow-md scale-105" 
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:scale-102"
            }`}>
            By Doctor
          </button>
          {selectedDoctorFilter && (
            <button
              onClick={() => {
                setSelectedDoctorFilter(null);
                toast({ title: "Filter Cleared", description: "Showing all doctors' appointments" });
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 flex items-center gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              Clear Filter
            </button>
          )}
        </div>

        {viewMode === "doctor" && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-700">Sort:</span>
            <button
              onClick={() => setDoctorSort("highest")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md ${
                doctorSort === "highest" 
                  ? "bg-blue-500 text-white shadow-md scale-105" 
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:scale-102"
              }`}>
              Highest Appointments
            </button>
            <button
              onClick={() => setDoctorSort("lowest")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md ${
                doctorSort === "lowest" 
                  ? "bg-blue-500 text-white shadow-md scale-105" 
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:scale-102"
              }`}>
              Lowest Appointments
            </button>
          </div>
        )}
      </div>

      {/* View: All Appointments */}
      {viewMode === "all" && (
      <Card className="border border-slate-200 rounded-2xl shadow-sm bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto rounded-2xl bg-white">
            <Table className="min-w-[1120px]">
              <TableCaption className="sr-only">All appointments with patient, doctor, schedule, status, prescription, and actions.</TableCaption>
              <TableHeader>
                <TableRow className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                  <TableHead scope="col" className="text-slate-700 font-semibold py-3 text-xs uppercase tracking-wide">Patient</TableHead>
                  <TableHead scope="col" className="text-slate-700 font-semibold py-3 text-xs uppercase tracking-wide">Doctor</TableHead>
                  <TableHead scope="col" className="hidden sm:table-cell text-slate-700 font-semibold py-3 text-xs uppercase tracking-wide">Specialization</TableHead>
                  <TableHead scope="col" className="text-slate-700 font-semibold py-3 text-xs uppercase tracking-wide text-center">Schedule</TableHead>
                  <TableHead scope="col" className="text-slate-700 font-semibold py-3 text-xs uppercase tracking-wide text-center">Status</TableHead>
                  <TableHead scope="col" className="hidden md:table-cell text-slate-700 font-semibold py-3 text-xs uppercase tracking-wide text-center">Reason</TableHead>
                  <TableHead scope="col" className="text-slate-700 font-semibold py-3 text-xs uppercase tracking-wide text-center">Prescription</TableHead>
                  <TableHead scope="col" className="text-slate-700 font-semibold py-3 text-xs uppercase tracking-wide text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((apt, index) => {
                  const rx = apt.prescription;
                  const appointmentId = String(apt._id || apt.id || '');
                  const rxId = rx
                    ? (typeof rx === 'object' && rx !== null ? (rx as any)._id : rx)
                    : rxByAppointment[appointmentId] || null;
                  const patientDeleted = apt.patientName.includes('(Deleted)');
                  const doctorDeleted = apt.doctorName.includes('(Deleted)');
                  const hasDeletedUser = patientDeleted || doctorDeleted;
                  
                  return (
                    <TableRow 
                      key={apt.id} 
                      className={`transition-colors border-slate-200 ${
                        hasDeletedUser 
                          ? 'bg-red-50/60 hover:bg-red-50 border-l-2 border-l-red-400' 
                          : index % 2 === 0 
                          ? 'bg-white hover:bg-slate-50' 
                          : 'bg-slate-50/60 hover:bg-slate-100/70'
                      }`}
                    >
                      <TableCell className="py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm ${
                            patientDeleted ? 'bg-red-400 opacity-60' : 'bg-cyan-600'
                          }`}>
                            {getInitials(apt.patientName)}
                          </div>
                          <div>
                            <div className={`font-semibold ${
                              patientDeleted ? 'text-red-600 line-through' : 'text-slate-900'
                            }`}>{apt.patientName}</div>
                            {apt.patientId && !patientDeleted ? (
                              <div className="text-xs text-slate-500">ID: {apt.patientId?.slice(-6)}</div>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm ${
                            doctorDeleted ? 'bg-red-400 opacity-60' : 'bg-emerald-600'
                          }`}>
                            {getInitials(apt.doctorName)}
                          </div>
                          <div>
                            <div className={`font-semibold ${
                              doctorDeleted ? 'text-red-600 line-through' : 'text-slate-900'
                            }`}>
                              {apt.doctorName}
                            </div>
                            {apt.doctorId && !doctorDeleted ? (
                              <div className="text-xs text-slate-500">ID: {apt.doctorId?.slice(-6)}</div>
                            ) : null}
                            {apt.doctorId && !doctorDeleted && doctorCounts[apt.doctorId || `doctor:${apt.doctorName}`]?.count ? (
                              <div className="text-xs text-sky-600 font-semibold">{doctorCounts[apt.doctorId || `doctor:${apt.doctorName}`]?.count || 0} appointments</div>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-3 align-middle">
                        <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 font-medium">
                          {apt.specialization}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-center align-middle">
                        <div className="flex flex-col items-center gap-1">
                          <div className="text-sm font-semibold text-slate-900 flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5 text-sky-600" />
                            {formatDateDisplay(apt.date)}
                          </div>
                          <div className="text-xs font-medium text-slate-600 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {apt.time}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-center align-middle">
                        <StatusBadge status={apt.status} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-3 align-middle text-center">
                        <div className="flex justify-center">
                          {apt.status === "Cancelled" && apt.reason ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg border-red-200 bg-red-50 text-red-700 hover:bg-red-100 font-semibold text-xs"
                              onClick={() =>
                                setReasonDialog({
                                  open: true,
                                  patientName: apt.patientName,
                                  doctorName: apt.doctorName,
                                  reason: apt.reason,
                                  date: apt.date,
                                })
                              }
                            >
                              View
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-center align-middle">
                        {rxId ? (
                          <button
                            onClick={() => navigate(`/prescriptions/${rxId}`)}
                            className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-md border border-emerald-200 hover:bg-emerald-100 font-semibold text-xs"
                          >
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                            <span className="text-xs font-bold">View</span>
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-700 px-2.5 py-1.5 rounded-md border border-orange-200">
                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                            <span className="text-xs font-bold">Not Given</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3 align-middle">
                        <div className="flex justify-center gap-1.5 items-center">
                          {apt.patientId && (
                            <PatientMedicalHistoryButton
                              patientId={apt.patientId}
                              patientName={apt.patientName}
                              variant="outline"
                              size="sm"
                              className="bg-sky-50 text-sky-700 hover:bg-sky-100 border-sky-300 h-8 text-xs font-semibold rounded-lg whitespace-nowrap px-2"
                            />
                          )}
                          {(apt.status === "Booked" || apt.status === "Accepted") && (
                            <Button 
                              size="sm" 
                              className="bg-red-600 hover:bg-red-700 text-white border-red-700 text-xs h-8 rounded-lg font-semibold whitespace-nowrap px-3" 
                              onClick={async () => {
                                const result = await cancelAppointment(apt.id, "Cancelled by admin");
                                if (result.success) {
                                  toast({ title: "Appointment cancelled" });
                                  fetchAppointments();
                                } else {
                                  toast({ title: "Cancel failed", description: result.message, variant: "destructive" });
                                }
                              }}
                            >
                              Cancel
                            </Button>
                          )}
                          {apt.status === "Cancelled" && (
                            <Button 
                              size="sm" 
                              className="bg-amber-500 hover:bg-amber-600 text-white border-amber-600 text-xs h-8 rounded-lg font-semibold whitespace-nowrap px-2"
                              disabled={!apt.doctorId}
                              onClick={() => setWarningDialog({
                                ...warningDialog,
                                doctorId: apt.doctorId,
                                doctorName: apt.doctorName,
                                open: true
                              })}
                            >
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Warn
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16">
                      <EmptyState 
                        icon={CalendarDays}
                        title="No appointments found"
                        description="Try adjusting your filters or check back later"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* View: Doctor-Based Summary */}
      {viewMode === "doctor" && (
      <Card className="border-0 rounded-2xl shadow-xl bg-white overflow-hidden">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctorStats.length === 0 ? (
              <div className="col-span-full text-center py-16">
                <EmptyState 
                  icon={CalendarDays}
                  title="No doctors found"
                  description="No appointment data available"
                />
              </div>
            ) : (
              doctorStats.map((doc) => {
                const docAppointments = appointments.filter(a => a.doctorId === doc.id);
                const completed = docAppointments.filter(a => a.status === "Completed").length;
                const cancelled = docAppointments.filter(a => a.status === "Cancelled").length;
                const pending = docAppointments.filter(a => a.status === "Booked").length;
                
                return (
                  <div 
                    key={doc.id} 
                    className="border border-slate-200 rounded-xl p-5 hover:shadow-lg hover:border-sky-300 transition-all duration-300 bg-gradient-to-br from-slate-50 to-white cursor-pointer hover:scale-105"
                    onClick={() => {
                      setViewMode("all");
                      setStatusFilter("all");
                    }}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold shadow-md">
                        {getInitials(doc.name)}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 text-base">{doc.name}</h3>
                        <p className="text-xs text-slate-500">{doc.count} total appointments</p>
                      </div>
                    </div>
                    
                    <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Total Appointments</span>
                        <span className="font-bold text-lg text-sky-600">{doc.count}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Completed</span>
                        <span className="font-semibold text-emerald-600">{completed}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Pending</span>
                        <span className="font-semibold text-sky-600">{pending}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Cancelled</span>
                        <span className="font-semibold text-red-600">{cancelled}</span>
                      </div>
                    </div>

                    <button 
                      className="w-full mt-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDoctorFilter(doc.id);
                        setViewMode("all");
                        setStatusFilter("all");
                        toast({
                          title: "Filter Applied",
                          description: `Showing appointments for ${doc.name}`,
                        });
                      }}
                    >
                      View Appointments
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
      )}
    </div>

    {/* Cancellation Reason Dialog */}
    <Dialog
      open={reasonDialog.open}
      onOpenChange={(openState) => setReasonDialog((prev) => ({ ...prev, open: openState }))}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            Cancellation Reason
          </DialogTitle>
          <DialogDescription>
            {reasonDialog.patientName} • {reasonDialog.doctorName} • {formatDateDisplay(reasonDialog.date)}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 leading-relaxed">
          {reasonDialog.reason}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800"
            onClick={() => setReasonDialog((prev) => ({ ...prev, open: false }))}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Warning Dialog */}
    <Dialog open={warningDialog.open} onOpenChange={(openState) => setWarningDialog({ ...warningDialog, open: openState })}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            Send Warning to Doctor
          </DialogTitle>
          <DialogDescription className="sr-only">
            Send a formal warning to {warningDialog.doctorName}
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-sm text-yellow-800">
            You are about to send a formal warning to <strong>{warningDialog.doctorName}</strong> regarding high cancellation rate.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Warning Reason *</label>
            <select 
              className="w-full px-3 py-2 rounded-md border border-input text-sm"
              value={warningDialog.reason}
              onChange={(e) => setWarningDialog({ ...warningDialog, reason: e.target.value })}
            >
              <option value="">Select a reason...</option>
              <option value="high-cancellation">High Cancellation Rate</option>
              <option value="no-show">Frequent No-shows</option>
              <option value="poor-ratings">Poor Patient Ratings</option>
              <option value="violation">Policy Violation</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Message</label>
            <Textarea 
              placeholder="Enter any additional message for the doctor..."
              value={warningDialog.message}
              onChange={(e) => setWarningDialog({ ...warningDialog, message: e.target.value })}
              className="text-sm resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
            onClick={() => setWarningDialog({ ...warningDialog, open: false })}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={() => handleSendWarningToDoctor()}
            disabled={!warningDialog.reason || warningDialog.loading}
          >
            {warningDialog.loading ? "Sending..." : "Send Warning"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default AdminAppointments;
