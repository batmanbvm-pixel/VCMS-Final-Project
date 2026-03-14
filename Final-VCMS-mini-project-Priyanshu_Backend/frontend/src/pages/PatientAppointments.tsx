import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { CalendarDays, Clock, MapPin, Stethoscope, IndianRupee, Video, Trash2, AlertTriangle, FileText, XCircle, Activity, RefreshCw, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatLocation } from "@/utils/formatLocation";
import api from "@/services/api";
import StatusBadge from "@/components/StatusBadge";
import RateButton from "@/components/RateButton";

interface CancelDialogState {
  open: boolean;
  appointmentId: string | null;
  reason: string;
  loading: boolean;
}

const PatientAppointments = () => {
  const { user } = useAuth();
  const { appointments, getPrescriptionByAppointment, fetchAppointments } = useClinic();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [cancelDialog, setCancelDialog] = useState<CancelDialogState>({
    open: false,
    appointmentId: null,
    reason: "",
    loading: false,
  });

  const myAppointments = appointments
    .filter((a) => a.patientId === user?._id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  const [tab, setTab] = useState<"all" | "accepted" | "upcoming" | "completed" | "cancelled">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewAppointment, setReviewAppointment] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const todayDate = new Date().toISOString().split("T")[0];
  const normalizeStatus = (status?: string) => String(status || "").toLowerCase();
  const isJoinEnabledStatus = (status?: string) => ["accepted", "in progress", "in-progress"].includes(normalizeStatus(status));
  const isBookedStatus = (status?: string) => normalizeStatus(status) === "booked";

  const acceptedApts = myAppointments.filter(a => isJoinEnabledStatus(a.status));
  const upcomingApts = myAppointments.filter(a => a.date > todayDate && isBookedStatus(a.status));
  const completedApts = myAppointments.filter(a => a.status === "Completed");
  const cancelledApts = myAppointments.filter(a => a.status === "Cancelled");

  const displayedApts =
    tab === "accepted" ? acceptedApts :
    tab === "upcoming" ? upcomingApts :
    tab === "completed" ? completedApts :
    tab === "cancelled" ? cancelledApts :
    myAppointments;

  // Auto-fetch appointments on mount
  useEffect(() => {
    fetchAppointments();
  }, []);

  // Socket listeners for real-time appointment updates
  useEffect(() => {
    if (!socket) return;

    const handleAppointmentAccepted = (data: any) => {
      if (data.patientId === user?._id) {
        toast({ title: "Appointment accepted!", description: "Doctor has accepted your appointment." });
        fetchAppointments();
      }
    };

    const handleAppointmentRejected = (data: any) => {
      if (data.patientId === user?._id) {
        toast({ title: "Appointment rejected", description: `Reason: ${data.reason || "No reason provided"}` });
        fetchAppointments();
      }
    };

    const handleAppointmentCancelled = (data: any) => {
      if (data.patientId === user?._id) {
        toast({ title: "Appointment cancelled", description: `Reason: ${data.reason || "No reason provided"}` });
        fetchAppointments();
      }
    };

    socket.on("appointment:accepted", handleAppointmentAccepted);
    socket.on("appointment:rejected", handleAppointmentRejected);
    socket.on("appointment:cancelled", handleAppointmentCancelled);

    return () => {
      socket.off("appointment:accepted", handleAppointmentAccepted);
      socket.off("appointment:rejected", handleAppointmentRejected);
      socket.off("appointment:cancelled", handleAppointmentCancelled);
    };
  }, [socket, user?._id, fetchAppointments, toast]);

  const handleCancelAppointment = async () => {
    if (!cancelDialog.appointmentId) return;

    try {
      setCancelDialog(prev => ({ ...prev, loading: true }));
      
      const response = await api.post(
        `/appointments/${cancelDialog.appointmentId}/patient-delete`,
        { reason: cancelDialog.reason }
      );

      if (response.data?.success) {
        toast({
          title: "Success",
          description: "Appointment cancelled and doctor has been notified",
        });
        setCancelDialog({ open: false, appointmentId: null, reason: "", loading: false });
        fetchAppointments();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to cancel appointment",
        variant: "destructive",
      });
    } finally {
      setCancelDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    try {
      setRefreshing(true);
      await Promise.resolve(fetchAppointments());
      toast({ title: "Refreshed", description: "Appointments updated." });
    } finally {
      setRefreshing(false);
    }
  };

  const openReviewDialog = (appointment: any) => {
    setReviewAppointment(appointment);
    setReviewRating(5);
    setReviewComment("");
    setShowReviewDialog(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewAppointment?._id || !reviewAppointment?.doctorId) return;

    try {
      setSubmittingReview(true);
      const doctorId = String(reviewAppointment.doctorId);
      const result = await api.post('/public/reviews', {
        appointmentId: reviewAppointment._id,
        doctorId,
        rating: reviewRating,
        comment: reviewComment,
      });

      if (result.data?.success) {
        toast({ title: "Thank you!", description: "Your rating was submitted successfully." });
        setShowReviewDialog(false);
        setReviewAppointment(null);
        await Promise.resolve(fetchAppointments());
      } else {
        toast({ title: "Error", description: result.data?.message || "Could not submit rating", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error?.response?.data?.message || "Could not submit rating", variant: "destructive" });
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-6 py-8 space-y-6 max-w-7xl pb-12">

      {/* ── Hero Header ────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden bg-sky-500 border border-sky-300 shadow-md text-white">
        <div className="px-6 py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-white/90 uppercase tracking-widest flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> My Appointments
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Track and manage all your appointments</h1>
            <p className="text-sky-100 text-sm">View status, join consultations, and manage your healthcare.</p>
          </div>
        </div>
      </div>

      {/* ── Tab Filter ─────────────────────────────────────── */}
      <div className="flex gap-1.5 bg-white border border-slate-200 rounded-2xl p-1.5 w-full justify-between items-center shadow-sm flex-wrap">
        <div className="flex gap-1.5">
          {[
            { key: "all",       label: "All",       count: myAppointments.length },
            { key: "accepted",  label: "Accepted",  count: acceptedApts.length },
            { key: "upcoming",  label: "Upcoming",  count: upcomingApts.length },
            { key: "completed", label: "Completed", count: completedApts.length },
            { key: "cancelled", label: "Cancelled", count: cancelledApts.length },
          ].map(({ key, label, count }) => {
            const isAcceptedAttention = key === "accepted" && count > 0;
            return (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                tab === key 
                  ? "bg-sky-500 text-white shadow-sm" 
                  : "bg-white text-slate-700 hover:bg-slate-50 hover:shadow-sm"
              } ${
                isAcceptedAttention ? "animate-pulse ring-2 ring-emerald-200/80" : ""
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {label}
                {isAcceptedAttention && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
              </span>
              {count > 0 && (
                <span className={`text-xs rounded-full px-2 py-0.5 font-bold ${
                  tab === key ? "bg-white/25 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {count}
                </span>
              )}
            </button>
            );
          })}
        </div>
        <Button
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="ml-auto min-w-[140px] justify-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-white font-semibold shadow-sm hover:bg-sky-600"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* ── Appointments List ──────────────────────────────── */}
      {displayedApts.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="py-20 flex flex-col items-center gap-4 text-center px-6">
            <div className="h-20 w-20 rounded-2xl bg-sky-100 flex items-center justify-center shadow-sm">
              <CalendarDays className="h-10 w-10 text-sky-600" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-lg">No Appointments Found</p>
              <p className="text-sm text-slate-600 mt-1.5 max-w-sm">
                {tab === "accepted"
                  ? "No accepted appointments yet. Once accepted by doctor, they will appear here."
                  : tab === "upcoming" 
                  ? "You don't have any upcoming appointments. Book one from the dashboard to get started!" 
                  : tab === "completed"
                  ? "No completed appointments yet. Your consultation history will appear here."
                  : tab === "cancelled"
                  ? "No cancelled appointments. All your active appointments are on track!"
                  : "You haven't booked any appointments yet. Visit the dashboard to find doctors and schedule your first consultation."}
              </p>
            </div>
            {tab !== "all" && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setTab("all")}
                className="mt-2 rounded-xl bg-slate-100 border-slate-300 text-slate-800 font-semibold hover:bg-slate-200 hover:text-sky-700 hover:border-sky-300 transition-all duration-200 text-xs"
              >
                Show All Appointments
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableCaption className="sr-only">Patient appointments table with doctor, schedule, status, prescription, and actions.</TableCaption>
              <TableHeader>
                <TableRow className="bg-slate-50 border-b border-slate-200">
                  <TableHead scope="col" className="text-slate-700 font-semibold py-3 text-xs uppercase tracking-wide">Doctor</TableHead>
                  <TableHead scope="col" className="text-slate-700 font-semibold py-3 text-xs uppercase tracking-wide">Specialization</TableHead>
                  <TableHead scope="col" className="text-slate-700 font-semibold py-3 text-xs uppercase tracking-wide text-center">Schedule</TableHead>
                  <TableHead scope="col" className="text-slate-700 font-semibold py-3 text-xs uppercase tracking-wide">Location</TableHead>
                  <TableHead scope="col" className="text-slate-700 font-semibold py-3 text-xs uppercase tracking-wide text-center">Fee</TableHead>
                  <TableHead scope="col" className="text-slate-700 font-semibold py-3 text-xs uppercase tracking-wide text-center">Status</TableHead>
                  <TableHead scope="col" className="text-slate-700 font-semibold py-3 text-xs uppercase tracking-wide text-center">Prescription</TableHead>
                  <TableHead scope="col" className="text-slate-700 font-semibold py-3 text-xs uppercase tracking-wide text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedApts.map((apt, index) => {
                  const rx = getPrescriptionByAppointment(apt._id);
                  const statusLower = apt.status.toLowerCase();
                  const canJoin = statusLower === "in progress" || statusLower === "in-progress";
                  const waitingForDoctor = statusLower === "accepted";
                  const isCompleted = statusLower === "completed";
                  const isCancelled = statusLower === "cancelled";

                  return (
                    <TableRow 
                      key={apt._id} 
                      className={`transition-colors border-slate-200 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      } hover:bg-slate-50`}
                    >
                      <TableCell className="py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center text-white font-bold shadow-sm text-xs ${
                            isCompleted ? "bg-sky-600" :
                            isCancelled ? "bg-red-600" :
                            canJoin ? "bg-sky-600" :
                            "bg-sky-600"
                          }`}>
                            {apt.doctorName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">{apt.doctorName}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 align-middle">
                        <span className="inline-block bg-sky-50 text-sky-700 border border-sky-200 font-medium px-2.5 py-1 rounded-md text-xs">
                          {apt.specialization}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-center align-middle">
                        <div className="flex flex-col items-center gap-0.5 text-xs">
                          <div className="font-semibold text-slate-900 flex items-center gap-0.5">
                            <CalendarDays className="w-3 h-3 text-sky-600" />
                            {apt.date}
                          </div>
                          <div className="text-xs font-medium text-slate-600 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5 text-slate-500" />
                            {apt.time}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 align-middle">
                        <div className="text-xs text-slate-600">
                          {apt.location ? formatLocation(apt.location) : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-center align-middle">
                        {apt.consultationFee ? (
                          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-sky-700 bg-sky-50 px-2 py-1 rounded-md border border-sky-200">
                            <IndianRupee className="h-2.5 w-2.5" />
                            ₹{apt.consultationFee}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="py-3 text-center align-middle">
                        <StatusBadge status={apt.status} />
                      </TableCell>
                      <TableCell className="py-3 text-center align-middle">
                        {rx ? (
                          <div className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 px-2.5 py-1 rounded-md text-xs border border-sky-200">
                            <div className="w-1.5 h-1.5 bg-sky-500 rounded-full"></div>
                            <span className="font-bold">Given</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 bg-cyan-50 text-cyan-700 px-2.5 py-1 rounded-md text-xs border border-cyan-200">
                            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></div>
                            <span className="font-bold">Not Given</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3 align-middle">
                        <div className="flex justify-center gap-1.5 flex-wrap">
                          {canJoin && (
                            <Button
                              size="sm"
                              className="h-8 rounded-lg text-xs gap-1 bg-sky-500 hover:bg-sky-600 text-white shadow-sm font-semibold"
                              onClick={() => navigate(`/video/${apt._id}`)}
                            >
                              <Video className="h-3 w-3" /> Join
                            </Button>
                          )}
                          {waitingForDoctor && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="h-8 rounded-lg text-xs gap-1 border-amber-200 text-amber-700 bg-amber-50 font-semibold"
                              title="Waiting for doctor to start"
                            >
                              <Clock className="h-3 w-3" /> Waiting for Doctor
                            </Button>
                          )}
                          {isCompleted && (
                            <RateButton
                              rated={!!apt.reviewSubmitted}
                              onClick={() => openReviewDialog(apt)}
                            />
                          )}
                          {rx ? (
                            <Button
                              size="sm"
                              className="h-8 rounded-lg text-xs gap-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold"
                              onClick={() => navigate(`/prescriptions/${rx._id || rx.id}`)}
                            >
                              <FileText className="h-3 w-3" /> Rx
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="h-8 rounded-lg text-xs gap-1 border-slate-300 text-slate-500"
                            >
                              <FileText className="h-3 w-3" /> No Rx
                            </Button>
                          )}
                          {!isCompleted && !isCancelled && (
                            <Button
                              size="sm"
                              className="h-8 rounded-lg text-xs gap-1 bg-red-600 hover:bg-red-700 text-white font-semibold"
                              onClick={() => setCancelDialog({ open: true, appointmentId: apt._id, reason: "", loading: false })}
                            >
                              <Trash2 className="h-3 w-3" /> Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Cancel Dialog */}
      <Dialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Cancel Appointment
            </DialogTitle>
            <DialogDescription>
              Once cancelled, the doctor will be notified immediately. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              The doctor will receive a notification about your cancellation with the reason you provide.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Cancellation Reason (Optional)</label>
              <Textarea
                placeholder="Tell the doctor why you're cancelling this appointment..."
                value={cancelDialog.reason}
                onChange={(e) => setCancelDialog(prev => ({ ...prev, reason: e.target.value }))}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300" onClick={() => setCancelDialog({ open: false, appointmentId: null, reason: "", loading: false })}>
              Keep Appointment
            </Button>
            <Button variant="destructive" onClick={handleCancelAppointment} disabled={cancelDialog.loading}>
              {cancelDialog.loading ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rate Doctor Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-md rounded-2xl border border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold">Rate Doctor</DialogTitle>
            <DialogDescription className="text-slate-600">
              Share your consultation feedback.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Star Rating</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="h-9 w-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-amber-50"
                  >
                    <Star className={`h-4 w-4 ${star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Comment (optional)</label>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience"
                rows={3}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReviewDialog(false)} className="rounded-xl border-slate-200">Cancel</Button>
            <Button onClick={handleSubmitReview} disabled={submittingReview} className="rounded-xl bg-sky-500 hover:bg-sky-600 text-white">
              {submittingReview ? 'Submitting...' : 'Submit Rating'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default PatientAppointments;
