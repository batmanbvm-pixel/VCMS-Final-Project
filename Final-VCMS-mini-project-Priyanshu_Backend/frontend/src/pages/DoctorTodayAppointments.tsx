import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Video, CheckCircle, XCircle, AlertTriangle, CalendarDays, RefreshCw, User, FileText, FilePen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { PatientMedicalHistoryButton } from "@/components/PatientMedicalHistoryButton";

interface RejectDialogState {
  open: boolean;
  appointmentId: string | null;
  reason: string;
  loading: boolean;
}

const DoctorTodayAppointments = () => {
  const { user } = useAuth();
  const { appointments, acceptAppointment, rejectAppointment, updateAppointmentStatus, getPrescriptionByAppointment, fetchAppointments, fetchPrescriptions } = useClinic();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeFilter, setActiveFilter] = useState<'today' | 'upcoming' | 'completed' | 'all'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const normalizeStatus = (status?: string) => String(status || "").toLowerCase();

  // Helper to capitalize names properly
  const capitalizeName = (name?: string) => {
    if (!name) return "";
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const myAppointments = appointments.filter((a) => a.doctorId === user?._id || a.doctorId === user?.id);

  const todayAppointments = myAppointments
    .filter((a) => a.date === today && !["cancelled", "rejected", "completed"].includes(normalizeStatus(a.status)))
    .sort((a, b) => a.time.localeCompare(b.time));

  const upcomingAppointments = myAppointments
    .filter((a) => a.date > today && !["cancelled", "rejected", "completed"].includes(normalizeStatus(a.status)))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const completedAppointments = myAppointments
    .filter((a) => normalizeStatus(a.status) === "completed")
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  const [rejectDialog, setRejectDialog] = useState<RejectDialogState>({
    open: false,
    appointmentId: null,
    reason: "",
    loading: false,
  });

  const handleRejectWithWarning = async () => {
    if (!rejectDialog.appointmentId || !rejectDialog.reason.trim()) {
      toast({ title: "Required", description: "Please provide a rejection reason", variant: "destructive" });
      return;
    }

    try {
      setRejectDialog((prev) => ({ ...prev, loading: true }));
      const result = await rejectAppointment(rejectDialog.appointmentId, rejectDialog.reason);

      if (result.success) {
        toast({ title: "Success", description: "Appointment rejected and patient notified" });
        setRejectDialog({ open: false, appointmentId: null, reason: "", loading: false });
        fetchAppointments();
      } else {
        toast({ title: "Error", description: result.message || "Failed to reject appointment", variant: "destructive" });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to reject appointment",
        variant: "destructive",
      });
    } finally {
      setRejectDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "Booked":
        return "bg-sky-50 text-sky-600 border border-sky-200";
      case "Accepted":
        return "bg-sky-100 text-sky-700 border border-sky-300";
      case "In Progress":
        return "bg-cyan-50 text-cyan-700 border border-cyan-200";
      case "Completed":
        return "bg-sky-100 text-sky-700 border border-sky-200";
      case "Cancelled":
        return "bg-red-50 text-red-700 border border-red-200";
      default:
        return "bg-sky-50 text-sky-600 border border-sky-200";
    }
  };

  const getRxStatusLabel = (status?: string) => {
    const normalized = String(status || "draft").toLowerCase();
    if (normalized === "draft") return "Draft Saved";
    if (normalized === "issued") return "Prescription Issued";
    if (normalized === "viewed") return "Viewed by Patient";
    if (normalized === "picked_up") return "Picked Up";
    if (normalized === "cancelled") return "Cancelled";
    return "Prescription Added";
  };

  const getRxStatusStyles = (status?: string) => {
    const normalized = String(status || "draft").toLowerCase();
    if (normalized === "draft") return "bg-amber-50 border-amber-200 text-amber-700";
    if (normalized === "cancelled") return "bg-red-50 border-red-200 text-red-700";
    return "bg-emerald-50 border-emerald-200 text-emerald-700";
  };

  const renderActionButtons = (apt: any) => {
    const appointmentId = apt._id || apt.id;
    const statusLower = normalizeStatus(apt.status);
    const rx = getPrescriptionByAppointment(appointmentId);

    if (statusLower === "booked") {
      return (
        <div className="flex flex-wrap gap-2 justify-end">
          <Button 
            size="sm" 
            onClick={() => acceptAppointment(appointmentId)} 
            className="h-8 gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm font-medium"
          >
            <CheckCircle className="h-3.5 w-3.5" /> Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 bg-red-50 text-red-600 border-red-200 hover:bg-red-100 shadow-sm font-medium"
            onClick={() => setRejectDialog({ open: true, appointmentId, reason: "", loading: false })}
          >
            <XCircle className="h-3.5 w-3.5" /> Reject
          </Button>
        </div>
      );
    }

    if (statusLower === "accepted") {
      return (
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            size="sm"
            className="h-8 gap-1.5 bg-violet-500 hover:bg-violet-600 text-white shadow-sm font-medium"
            onClick={() => {
              updateAppointmentStatus(appointmentId, "In Progress");
              navigate(`/video/${appointmentId}`);
            }}
          >
            <Video className="h-3.5 w-3.5" /> Join Call
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 gap-1.5 bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-sm font-medium" 
            onClick={() => updateAppointmentStatus(appointmentId, "Completed")}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Mark Completed
          </Button>
        </div>
      );
    }

    if (statusLower === "in progress" || statusLower === "in-progress") {
      return (
        <div className="flex flex-wrap gap-2 justify-end">
          <Button 
            size="sm" 
            className="h-8 gap-1.5 bg-violet-500 hover:bg-violet-600 text-white shadow-sm font-medium" 
            onClick={() => navigate(`/video/${appointmentId}`)}
          >
            <Video className="h-3.5 w-3.5" /> Join Call
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 gap-1.5 bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-sm font-medium" 
            onClick={() => updateAppointmentStatus(appointmentId, "Completed")}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Complete
          </Button>
        </div>
      );
    }

    if (statusLower === "completed") {
      const rxStatus = String(rx?.status || "").toLowerCase();
      return (
        <div className="flex flex-wrap gap-2 justify-end">
          {!rx ? (
            <Button 
              size="sm" 
              variant="outline" 
              className="h-8 gap-1.5 bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 shadow-sm font-medium" 
              onClick={() => navigate(`/create-prescription/${appointmentId}`)}
            >
              <FilePen className="h-3.5 w-3.5" /> Write Prescription
            </Button>
          ) : rxStatus === "draft" ? (
            <Button 
              size="sm" 
              variant="outline" 
              className="h-8 gap-1.5 bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100 shadow-sm font-medium" 
              onClick={() => navigate(`/create-prescription/${appointmentId}`)}
            >
              <FilePen className="h-3.5 w-3.5" /> Edit Draft
            </Button>
          ) : (
            <div className={`inline-flex items-center h-8 gap-1.5 px-2.5 rounded-md border ${getRxStatusStyles(rx?.status)}`}>
              <span className="text-xs font-medium">{getRxStatusLabel(rx?.status)}</span>
            </div>
          )}
        </div>
      );
    }

    return <span className="text-xs text-slate-500">—</span>;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchAppointments(), fetchPrescriptions()]);
      toast({ title: "Refreshed", description: "Appointments updated successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to refresh appointments", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderAppointmentsTable = (title: string, list: any[]) => (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <Card className="border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-[23%]">Patient</TableHead>
                  <TableHead className="w-[11%]">Schedule</TableHead>
                  <TableHead className="w-[18%]">Diagnosis</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                  <TableHead className="w-[10%] text-center">Medical History</TableHead>
                  <TableHead className="w-[14%] text-center">Prescription</TableHead>
                  <TableHead className="text-right w-[14%]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((apt: any) => {
                  const appointmentId = apt._id || apt.id;
                  const rx = getPrescriptionByAppointment(appointmentId);
                  const diagnosisText = (rx?.diagnosis || apt?.symptoms || "—").toString().trim() || "—";
                  return (
                    <TableRow key={appointmentId} className="hover:bg-slate-50/60">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                            <User className="h-5 w-5 text-sky-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 truncate">{capitalizeName(apt.patientName)}</div>
                            <div className="text-xs text-slate-600 mt-0.5 truncate">Age: {apt.patientAge || "—"} • {apt.patientMedicalHistory || "No history"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-900">{apt.date}</div>
                        <div className="text-xs text-slate-600">{apt.time}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-800 truncate" title={diagnosisText}>
                          {diagnosisText}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(apt.status)}`}>{apt.status}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {apt.patientId ? (
                          <div className="flex justify-center">
                            <PatientMedicalHistoryButton
                              patientId={apt.patientId}
                              patientName={apt.patientName}
                              variant="outline"
                              size="icon"
                              showLabel={false}
                              className="h-8 w-8 p-0 bg-sky-100 border-sky-200 text-sky-700 hover:bg-sky-200"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {rx ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5 bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-medium"
                            onClick={() => navigate(rx?._id ? `/prescriptions/${rx._id}` : `/prescriptions/appointment/${appointmentId}`)}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            View Rx
                          </Button>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200">
                            <FileText className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-xs text-slate-500 font-medium">No Rx</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{renderActionButtons(apt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="container mx-auto px-6 py-8 space-y-6 max-w-7xl pb-12">
      <div className="rounded-xl bg-sky-500 text-white p-6 shadow-md border border-sky-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <CalendarDays className="h-7 w-7" /> Appointments
            </h1>
            <p className="mt-2 text-white/90 text-sm">Today: {todayAppointments.length} • Upcoming: {upcomingAppointments.length} • Completed: {completedAppointments.length}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 bg-white/15 text-white border-white/30 hover:bg-white/25 transition-all duration-200 hover:scale-105" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> 
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <Card className="border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setActiveFilter('all')}
              variant={activeFilter === 'all' ? 'default' : 'outline'}
              className={`h-9 px-4 ${
                activeFilter === 'all'
                  ? 'bg-sky-500 hover:bg-sky-600 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              All ({todayAppointments.length + upcomingAppointments.length + completedAppointments.length})
            </Button>
            <Button
              onClick={() => setActiveFilter('today')}
              variant={activeFilter === 'today' ? 'default' : 'outline'}
              className={`h-9 px-4 ${
                activeFilter === 'today'
                  ? 'bg-sky-500 hover:bg-sky-600 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Clock className="h-4 w-4 mr-2" />
              Today ({todayAppointments.length})
            </Button>
            <Button
              onClick={() => setActiveFilter('upcoming')}
              variant={activeFilter === 'upcoming' ? 'default' : 'outline'}
              className={`h-9 px-4 ${
                activeFilter === 'upcoming'
                  ? 'bg-sky-500 hover:bg-sky-600 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Upcoming ({upcomingAppointments.length})
            </Button>
            <Button
              onClick={() => setActiveFilter('completed')}
              variant={activeFilter === 'completed' ? 'default' : 'outline'}
              className={`h-9 px-4 ${
                activeFilter === 'completed'
                  ? 'bg-sky-500 hover:bg-sky-600 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Completed ({completedAppointments.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {todayAppointments.length === 0 && upcomingAppointments.length === 0 && completedAppointments.length === 0 && (
        <Card className="border-slate-200 shadow-sm bg-white rounded-xl">
          <CardContent className="py-8">
            <EmptyState icon={CalendarDays} title="No appointments found" description="Your appointments will appear here once patients book consultations." />
          </CardContent>
        </Card>
      )}

      {(activeFilter === 'all' || activeFilter === 'today') && todayAppointments.length > 0 && renderAppointmentsTable("Today's Appointments", todayAppointments)}

      {(activeFilter === 'all' || activeFilter === 'upcoming') && upcomingAppointments.length > 0 && renderAppointmentsTable("Upcoming Appointments", upcomingAppointments)}

      {(activeFilter === 'all' || activeFilter === 'completed') && completedAppointments.length > 0 && renderAppointmentsTable("Completed Appointments", completedAppointments)}

      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Reject Appointment
            </DialogTitle>
            <DialogDescription>The patient will be notified immediately with your rejection reason.</DialogDescription>
          </DialogHeader>

          <Alert className="border-sky-200 bg-sky-50">
            <AlertTriangle className="h-4 w-4 text-sky-600" />
            <AlertDescription className="text-sky-800">
              Patient will receive a notification with your rejection reason and automatic status update.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Rejection Reason *</label>
              <Textarea
                placeholder="Explain why you're rejecting this appointment (e.g., scheduling conflict, health issue, etc.)"
                value={rejectDialog.reason}
                onChange={(e) => setRejectDialog((prev) => ({ ...prev, reason: e.target.value }))}
                rows={4}
                className="resize-none focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300" onClick={() => setRejectDialog({ open: false, appointmentId: null, reason: "", loading: false })}>
              Keep Appointment
            </Button>
            <Button variant="destructive" onClick={handleRejectWithWarning} disabled={rejectDialog.loading || !rejectDialog.reason.trim()}>
              {rejectDialog.loading ? "Rejecting..." : "Reject & Notify Patient"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DoctorTodayAppointments;
