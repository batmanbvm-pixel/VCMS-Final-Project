import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Video, CheckCircle, XCircle, AlertTriangle, CalendarDays, RefreshCw } from "lucide-react";
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
  const { appointments, acceptAppointment, rejectAppointment, updateAppointmentStatus, getPrescriptionByAppointment, fetchAppointments } = useClinic();
  const navigate = useNavigate();
  const { toast } = useToast();

  const today = new Date().toISOString().split("T")[0];
  const normalizeStatus = (status?: string) => String(status || "").toLowerCase();

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

  const renderAppointmentCard = (apt: any) => {
    const appointmentId = apt._id || apt.id;
    const statusLower = normalizeStatus(apt.status);
    const rx = getPrescriptionByAppointment(appointmentId);

    return (
      <Card key={appointmentId} className="border-slate-200 shadow-sm bg-white rounded-xl">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white text-sm font-bold">
                {String(apt.patientName || "?")
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")}
              </div>
              <div>
                <p className="font-medium text-slate-900">{apt.patientName}</p>
                <p className="text-xs text-slate-700">Age: {apt.patientAge || "—"} • {apt.patientMedicalHistory || "No history"}</p>
                <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                  <CalendarDays className="h-3 w-3" /> {apt.date}
                  <Clock className="h-3 w-3" /> {apt.time}
                  <span>• {apt.specialization}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {apt.patientId && (
                <PatientMedicalHistoryButton
                  patientId={apt.patientId}
                  patientName={apt.patientName}
                  variant="outline"
                  size="sm"
                  className="border-sky-200 text-sky-600 hover:bg-sky-50"
                />
              )}
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(apt.status)}`}>{apt.status}</span>
            </div>
          </div>

          {statusLower === "booked" && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => acceptAppointment(appointmentId)} className="gap-1 bg-sky-500 hover:bg-sky-600 text-white transition-all duration-200 hover:scale-105">
                <CheckCircle className="h-3 w-3" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-500 border-slate-200 hover:bg-red-50 transition-all duration-200 hover:scale-105"
                onClick={() => setRejectDialog({ open: true, appointmentId, reason: "", loading: false })}
              >
                <XCircle className="h-3 w-3 mr-1" /> Reject
              </Button>
            </div>
          )}

          {statusLower === "accepted" && (
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => {
                  updateAppointmentStatus(appointmentId, "In Progress");
                  navigate(`/video/${appointmentId}`);
                }}
                className="gap-1 bg-sky-500 hover:bg-sky-600 text-white transition-all duration-200 hover:scale-105"
              >
                <Video className="h-3 w-3" /> Join Video Call
              </Button>
              <Button size="sm" variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200 hover:scale-105" onClick={() => updateAppointmentStatus(appointmentId, "Completed")}>
                Mark Completed
              </Button>
            </div>
          )}

          {(statusLower === "in progress" || statusLower === "in-progress") && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => navigate(`/video/${appointmentId}`)} className="gap-1 bg-sky-500 hover:bg-sky-600 text-white transition-all duration-200 hover:scale-105">
                <Video className="h-3 w-3" /> Join Video Call
              </Button>
              <Button size="sm" variant="outline" className="gap-1 border-slate-200 text-sky-600 hover:bg-sky-50 transition-all duration-200 hover:scale-105" onClick={() => updateAppointmentStatus(appointmentId, "Completed")}>
                <CheckCircle className="h-3 w-3" /> Complete
              </Button>
            </div>
          )}

          {statusLower === "completed" && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-1 border-slate-200 text-sky-600 hover:bg-sky-50 transition-all duration-200 hover:scale-105" onClick={() => navigate(`/create-prescription/${appointmentId}`)}>
                <CheckCircle className="h-3 w-3" /> {rx ? "Edit Prescription" : "Write Prescription"}
              </Button>
              {rx && (
                <Button size="sm" variant="outline" className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200 hover:scale-105" onClick={() => navigate(`/prescriptions/${rx._id || appointmentId}`)}>
                  View Rx
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl pb-12">
      <div className="rounded-xl bg-sky-500 text-white p-6 shadow-md border border-sky-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <CalendarDays className="h-6 w-6" /> Appointments
            </h1>
            <p className="mt-1 text-sky-100 text-sm">Today: {todayAppointments.length} • Upcoming: {upcomingAppointments.length} • Completed: {completedAppointments.length}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 bg-white/15 text-white border-white/30 hover:bg-white/25 transition-all duration-200 hover:scale-105" onClick={() => fetchAppointments()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {todayAppointments.length === 0 && upcomingAppointments.length === 0 && completedAppointments.length === 0 && (
        <Card className="border-slate-200 shadow-sm bg-white rounded-xl">
          <CardContent className="py-8">
            <EmptyState icon={CalendarDays} title="No appointments found" description="Your appointments will appear here once patients book consultations." />
          </CardContent>
        </Card>
      )}

      {todayAppointments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Today's Appointments</h2>
          {todayAppointments.map(renderAppointmentCard)}
        </div>
      )}

      {upcomingAppointments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Upcoming Appointments</h2>
          {upcomingAppointments.map(renderAppointmentCard)}
        </div>
      )}

      {completedAppointments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Completed Appointments</h2>
          {completedAppointments.map(renderAppointmentCard)}
        </div>
      )}

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
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, appointmentId: null, reason: "", loading: false })}>
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
