import { useState, useEffect, useCallback } from "react";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, AlertCircle, CheckCircle2, XCircle, RefreshCw, CalendarDays, Clock, FileText, X } from "lucide-react";
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
  const [statusFilter, setStatusFilter] = useState(initialFilter);
  const [viewMode, setViewMode] = useState<"all" | "doctor">("all");
  const [doctorSort, setDoctorSort] = useState<"highest" | "lowest" | "all">("all");
  const [warningDialog, setWarningDialog] = useState({
    open: false,
    doctorId: null as string | null,
    doctorName: "",
    reason: "",
    message: "",
    loading: false,
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
      const res = await api.get('/admin/appointments?limit=200');
      if (res.data?.success) {
        const appointmentsData = (res.data.appointments || []).map((apt: any) => ({
          _id: apt._id,
          id: apt._id,
          patientName: apt.patientId?.name || 'Unknown Patient',
          patientId: apt.patientId?._id || apt.patientId || '',
          doctorId: apt.doctorId?._id || apt.doctorId || '',
          doctorName: apt.doctorId?.name || 'Unknown Doctor',
          specialization: apt.doctorId?.specialization || 'N/A',
          date: apt.date || new Date().toISOString().split('T')[0],
          time: apt.time || '00:00',
          status: mapDbStatus(apt.status || 'pending'),
          reason: apt.cancellationReason || '',
          prescriptionGiven: apt.prescriptionGiven || false,
          prescription: apt.prescriptionId,
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

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const filtered = appointments
    .filter((a) => statusFilter === "all" || a.status === statusFilter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  // Calculate doctor appointment counts
  const doctorCounts = appointments.reduce((acc: Record<string, {name: string, id: string, count: number}>, apt) => {
    if (!acc[apt.doctorId]) {
      acc[apt.doctorId] = { name: apt.doctorName, id: apt.doctorId, count: 0 };
    }
    acc[apt.doctorId].count++;
    return acc;
  }, {});

  const doctorStats = Object.values(doctorCounts).sort((a, b) => {
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
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl pb-12 bg-white min-h-screen">
      {/* Header */}
      <div className="rounded-xl bg-sky-500 p-6 text-white shadow-md border border-sky-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><CalendarDays className="h-6 w-6" /> All Appointments</h1>
            <p className="mt-1 text-sky-100 text-sm">Manage, track, and monitor all appointments in the system</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 bg-white/15 border-white/30 text-white hover:bg-white/25" onClick={() => fetchAppointments()}>
            <RefreshCw className="h-4 w-4" /> Refresh
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
      <Card className="border-0 rounded-2xl shadow-xl bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1180px]">
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-300">
                  <TableHead className="text-slate-900 font-bold py-4 text-sm">Patient Info</TableHead>
                  <TableHead className="text-slate-900 font-bold py-4 text-sm">Doctor Info</TableHead>
                  <TableHead className="hidden sm:table-cell text-slate-900 font-bold py-4 text-sm">Specialization</TableHead>
                  <TableHead className="text-slate-900 font-bold py-4 text-sm text-center">Schedule</TableHead>
                  <TableHead className="text-slate-900 font-bold py-4 text-sm text-center">Status</TableHead>
                  <TableHead className="hidden md:table-cell text-slate-900 font-bold py-4 text-sm">Cancellation Reason</TableHead>
                  <TableHead className="text-slate-900 font-bold py-4 text-sm text-center">Prescription</TableHead>
                  <TableHead className="text-slate-900 font-bold py-4 text-sm text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((apt, index) => {
                  // Use the prescription field populated directly from DB (not ClinicContext which is user-scoped)
                  const rx = apt.prescription;
                  const rxId = rx ? (typeof rx === 'object' && rx !== null ? (rx as any)._id : rx) : null;
                  return (
                    <TableRow 
                      key={apt.id} 
                      className={`transition-all duration-200 hover:bg-sky-50/70 hover:shadow-sm border-slate-200 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white font-bold shadow-sm">
                            {apt.patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{apt.patientName}</div>
                            <div className="text-xs text-slate-500">ID: {apt.patientId?.slice(-6)}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold shadow-sm">
                            {apt.doctorName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{apt.doctorName}</div>
                            <div className="text-xs text-slate-500">ID: {apt.doctorId?.slice(-6)}</div>
                            <div className="text-xs text-sky-600 font-semibold">{doctorCounts[apt.doctorId]?.count || 0} appointments</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-4">
                        <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 font-medium">
                          {apt.specialization}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="text-sm font-bold text-slate-900 flex items-center gap-1">
                            <CalendarDays className="w-4 h-4 text-sky-600" />
                            {apt.date}
                          </div>
                          <div className="text-xs font-medium text-slate-600 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {apt.time}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <StatusBadge status={apt.status} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-4">
                        <div className="max-w-xs">
                          {apt.status === "Cancelled" && apt.cancelReason ? (
                            <div className="text-xs text-slate-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                              <div className="font-semibold text-red-700 mb-1">Reason:</div>
                              {apt.cancelReason}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No cancellation</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        {rxId ? (
                          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg border border-emerald-200">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-bold">Given</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-2 rounded-lg border border-orange-200">
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            <span className="text-xs font-bold">Not Given</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex justify-center gap-2 flex-wrap">
                          {apt.patientId && (
                            <PatientMedicalHistoryButton
                              patientId={apt.patientId}
                              patientName={apt.patientName}
                              variant="outline"
                              size="sm"
                              className="text-sky-600 hover:bg-sky-50 border-sky-300 h-9 text-xs font-semibold transition-all duration-200 hover:scale-105"
                            />
                          )}
                          {(apt.status === "Booked" || apt.status === "Accepted") && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-red-600 hover:bg-red-50 border-red-300 text-xs h-9 font-semibold transition-all duration-200 hover:scale-105" 
                              onClick={() => {
                                cancelAppointment(apt.id, "Cancelled by admin");
                                toast({ title: "Appointment cancelled" });
                              }}
                            >
                              <X className="w-3 h-3 mr-1" />
                              Cancel
                            </Button>
                          )}
                          {apt.status === "Cancelled" && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-yellow-700 hover:bg-yellow-50 border-yellow-400 text-xs h-9 font-semibold transition-all duration-200 hover:scale-105"
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
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-sky-700 hover:bg-sky-50 border-sky-300 text-xs h-9 font-semibold transition-all duration-200 hover:scale-105" 
                            onClick={() => navigate(rxId ? `/prescriptions/${rxId}` : `/prescriptions/appointment/${apt.id}`)}
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            Rx
                          </Button>
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
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold shadow-md">
                        {doc.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 text-base">{doc.name}</h3>
                        <p className="text-xs text-slate-500">Doctor ID: {doc.id.slice(-6)}</p>
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
                      className="w-full mt-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Can add filter by doctor functionality here
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

    {/* Warning Dialog */}
    <Dialog open={warningDialog.open} onOpenChange={(openState) => setWarningDialog({ ...warningDialog, open: openState })}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            Send Warning to Doctor
          </DialogTitle>
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
