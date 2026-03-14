import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useSocket } from "@/hooks/useSocket";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import api from "@/services/api";
import { FileText, CheckCircle2, Clock, AlertCircle, Pill, X, Stethoscope, CalendarDays, Printer, RefreshCw, Star } from "lucide-react";
import PrescriptionAISummary from "@/components/PrescriptionAISummary";
import LoadingSpinner from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import RateButton from "@/components/RateButton";

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  quantity: number;
  refills: number;
  sideEffects: string[];
}

interface Prescription {
  _id: string;
  appointmentId: any;
  medicalHistoryId: any;
  patientId: any;
  doctorId: any;
  medications: Medication[];
  diagnosis: string;
  clinicalNotes: string;
  treatmentPlan: string;
  followUpDate: string;
  followUpRecommendations: string;
  status: "draft" | "issued" | "viewed" | "picked_up" | "cancelled";
  issuedAt: string;
  viewedAt: string;
  pickedUpAt: string;
  cancelledAt: string;
  cancelledReason: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  createdAt: string;
}

const PatientPrescriptions = () => {
  const { user } = useAuth();
  const { appointments } = useClinic();
  const { socket } = useSocket();

  // Build a Set of appointmentIds that have already been reviewed
  const reviewedAppointmentIds = new Set(
    appointments
      .filter((a) => a.reviewSubmitted)
      .map((a) => String(a._id || a.id))
  );
  const { toast } = useToast();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [ratingPrescription, setRatingPrescription] = useState<Prescription | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const navigate = useNavigate();

  const displayedPrescriptions = prescriptions.filter((p) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      String(p.diagnosis || "").toLowerCase().includes(q) ||
      String(p.doctorId?.name || "").toLowerCase().includes(q) ||
      p.medications.some((m) => `${m.name} ${m.dosage}`.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && ["issued", "viewed"].includes(p.status)) ||
      (statusFilter === "picked_up" && p.status === "picked_up");

    return matchesSearch && matchesStatus;
  });

  const countAll = prescriptions.length;
  const countActive = prescriptions.filter((p) => ["issued", "viewed"].includes(p.status)).length;
  const countPickedUp = prescriptions.filter((p) => p.status === "picked_up").length;

  useEffect(() => {
    if (user?._id) {
      fetchPrescriptions();
    }
  }, [user?._id]);

  // Socket listener for real-time prescription updates
  useEffect(() => {
    if (!socket || !user?._id) return;

    const handlePrescriptionIssued = (data: any) => {
      if (data.patientId === user._id) {
        setPrescriptions((prev) => [data, ...prev]);
        toast({ title: "New prescription", description: "Doctor has issued a new prescription." });
      }
    };

    socket.on("prescription:issued", handlePrescriptionIssued);
    return () => socket.off("prescription:issued", handlePrescriptionIssued);
  }, [socket, user?._id, toast]);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/prescriptions/patient/${user?._id}?limit=100`);
      if (response.data?.success) {
        setPrescriptions(response.data.prescriptions || []);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to load prescriptions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    try {
      setRefreshing(true);
      await fetchPrescriptions();
      toast({ title: "Refreshed", description: "Prescription list updated" });
    } finally {
      setRefreshing(false);
    }
  };

  const openRateDialog = (prescription: Prescription) => {
    setRatingPrescription(prescription);
    setReviewRating(5);
    setReviewComment("");
    setShowRateDialog(true);
  };

  const handleSubmitReview = async () => {
    if (!ratingPrescription) return;

    const appointmentId =
      typeof ratingPrescription.appointmentId === "object"
        ? ratingPrescription.appointmentId?._id || ratingPrescription.appointmentId?.id
        : ratingPrescription.appointmentId;
    const doctorId =
      typeof ratingPrescription.doctorId === "object"
        ? ratingPrescription.doctorId?._id || ratingPrescription.doctorId?.id
        : ratingPrescription.doctorId;

    if (!appointmentId || !doctorId) {
      toast({ title: "Error", description: "Missing appointment/doctor details", variant: "destructive" });
      return;
    }

    try {
      setSubmittingReview(true);
      const res = await api.post('/public/reviews', {
        appointmentId,
        doctorId,
        rating: reviewRating,
        comment: reviewComment,
      });

      if (res.data?.success) {
        toast({ title: "Thanks!", description: "Your rating has been submitted." });
        setShowRateDialog(false);
        setRatingPrescription(null);
      } else {
        toast({ title: "Error", description: res.data?.message || "Could not submit rating", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error?.response?.data?.message || "Could not submit rating", variant: "destructive" });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleViewPrescription = async (prescription: Prescription) => {
    if (prescription.status === "issued" && !prescription.viewedAt) {
      try {
        await api.post(`/prescriptions/${prescription._id}/view`);
        toast({ title: "Success", description: "Prescription marked as viewed" });
        fetchPrescriptions();
      } catch (error: any) {
        toast({
          title: "Error",
          description: error?.response?.data?.message || "Failed to mark as viewed",
          variant: "destructive",
        });
      }
    }
    setSelectedPrescription(prescription);
  };

  const handlePickupPrescription = async (prescriptionId: string) => {
    try {
      const response = await api.post(`/prescriptions/${prescriptionId}/pickup`, {});
      if (response.data?.success) {
        toast({ title: "Success", description: "Prescription marked as picked up" });
        fetchPrescriptions();
        setSelectedPrescription(null);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to mark as picked up",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "issued":   return <Clock className="h-4 w-4 text-primary" />;
      case "viewed":   return <FileText className="h-4 w-4 text-secondary" />;
      case "picked_up": return <CheckCircle2 className="h-4 w-4 text-secondary" />;
      case "cancelled": return <AlertCircle className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "issued":   return "bg-primary/10 text-primary";
      case "viewed":   return "bg-secondary/10 text-secondary";
      case "picked_up": return "bg-secondary/20 text-secondary";
      case "cancelled": return "bg-destructive/10 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const isExpired = (validUntil: string) => new Date(validUntil) < new Date();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-primary/5">
        <div className="container mx-auto px-6 py-8 max-w-7xl pb-12">
          <LoadingSpinner text="Loading prescriptions..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-primary/5">
      <div className="container mx-auto px-6 py-8 space-y-6 max-w-7xl pb-12">
      {/* Hero */}
      <div className="rounded-xl bg-sky-500 p-6 shadow-md border border-sky-300 text-white">
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-white/90 text-sm font-medium mb-1">My Health 📊</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Prescriptions</h1>
            <p className="text-white/80 mt-1 text-sm">All prescriptions issued by your doctors with AI-powered summaries.</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl px-5 py-3 text-center">
            <p className="text-2xl font-bold text-white">{countAll}</p>
            <p className="text-white/80 text-xs mt-0.5">Total</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl px-5 py-3 text-center">
            <p className="text-2xl font-bold text-white">{countActive}</p>
            <p className="text-white/80 text-xs mt-0.5">Active</p>
          </div>
        </div>
      </div>

      {/* Simple Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto_auto] gap-3 items-center">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search diagnosis, doctor, medicine..."
            className="h-11 px-3 rounded-xl border-2 border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none text-sm"
          />

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 bg-white border-2 border-slate-200 focus:border-sky-500 shadow-sm">
              <SelectValue placeholder="Filter prescriptions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({countAll})</SelectItem>
              <SelectItem value="active">Active ({countActive})</SelectItem>
              <SelectItem value="picked_up">Picked Up ({countPickedUp})</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setSearchTerm("");
            }}
            className="h-11 bg-rose-500 hover:bg-rose-600 text-white"
          >
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>

          <Button
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-11 bg-sky-500 hover:bg-sky-600 text-white shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>

        </div>
      </div>

      {/* Prescriptions table */}
      {displayedPrescriptions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <EmptyState
            icon={FileText}
            title="No prescriptions found"
            description="Your doctor will add prescriptions after your appointment"
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead>Diagnosis</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Issued Date</TableHead>
                <TableHead>Valid Till</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Medicines</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedPrescriptions.map((rx) => (
                <TableRow key={rx._id} className="hover:bg-slate-50/70">
                  <TableCell className="font-semibold text-slate-900">{rx.diagnosis}</TableCell>
                  <TableCell className="text-slate-700">
                    <span className="inline-flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5 text-sky-600" />Dr. {rx.doctorId?.name || "Doctor"}</span>
                  </TableCell>
                  <TableCell className="text-slate-700">{new Date(rx.issuedAt || rx.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className={`${isExpired(rx.validUntil) ? 'text-rose-600 font-semibold' : 'text-slate-700'}`}>
                    {new Date(rx.validUntil).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize inline-flex items-center gap-1.5 ${getStatusBadgeClass(rx.status)}`}>
                      {getStatusIcon(rx.status)}
                      {rx.status === 'picked_up' ? 'Picked Up' : rx.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-700">{rx.medications.length}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {rx.status !== 'cancelled' && (() => {
                        const aptId = String(
                          typeof rx.appointmentId === 'object'
                            ? rx.appointmentId?._id || rx.appointmentId?.id
                            : rx.appointmentId
                        );
                        return (
                          <RateButton
                            rated={reviewedAppointmentIds.has(aptId)}
                            onClick={() => openRateDialog(rx)}
                          />
                        );
                      })()}
                      {rx.status === 'issued' && !rx.pickedUpAt && !isExpired(rx.validUntil) && (
                        <Button size="sm" className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => handlePickupPrescription(rx._id)}>Picked Up</Button>
                      )}
                      <Button
                        size="sm"
                        className="h-8 px-3 bg-sky-500 hover:bg-sky-600 text-white"
                        onClick={() => navigate(`/prescriptions/${rx._id}`)}
                      >
                        <Printer className="h-3.5 w-3.5 mr-1" /> Prescription
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedPrescription && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Prescription Details</h2>
                <p className="text-xs text-slate-600 mt-0.5">Dr. {selectedPrescription.doctorId?.name}</p>
              </div>
              <button
                className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all duration-200 hover:scale-105"
                onClick={() => setSelectedPrescription(null)}
                aria-label="Close prescription details"
                title="Close"
              >
                <X className="h-4 w-4 text-slate-600" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Status row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs px-3 py-1 rounded-full font-semibold capitalize flex items-center gap-1.5 ${getStatusBadgeClass(selectedPrescription.status)}`}>
                  {getStatusIcon(selectedPrescription.status)}
                  {selectedPrescription.status === 'picked_up' ? 'Picked Up' : selectedPrescription.status}
                </span>
                <span className="text-sm text-slate-600">Issued: {new Date(selectedPrescription.issuedAt || selectedPrescription.createdAt).toLocaleDateString()}</span>
                <span className={`text-sm ${isExpired(selectedPrescription.validUntil) ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                  Valid until: {new Date(selectedPrescription.validUntil).toLocaleDateString()}
                </span>
              </div>

              {/* Diagnosis */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                <p className="text-xs text-slate-700 uppercase font-semibold tracking-wide mb-1">Diagnosis</p>
                <p className="font-semibold text-slate-900">{selectedPrescription.diagnosis}</p>
              </div>

              {/* Clinical Notes */}
              {selectedPrescription.clinicalNotes && (
                <div>
                  <p className="text-xs text-slate-700 uppercase font-semibold tracking-wide mb-1">Clinical Notes</p>
                  <p className="text-sm text-slate-900">{selectedPrescription.clinicalNotes}</p>
                </div>
              )}

              {/* Medications */}
              <div>
                <p className="text-xs text-slate-700 uppercase font-semibold tracking-wide mb-2">Medications</p>
                <div className="space-y-2">
                  {selectedPrescription.medications.map((med, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Pill className="h-4 w-4 text-sky-600" />
                        <span className="font-semibold text-sm text-slate-900">{med.name}</span>
                        <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full">{med.dosage}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
                        <span>Frequency: <span className="text-slate-900 font-medium">{med.frequency}</span></span>
                        <span>Duration: <span className="text-slate-900 font-medium">{med.duration}</span></span>
                      </div>
                      {med.instructions && (
                        <p className="text-xs text-slate-600 mt-2 pt-2 border-t border-slate-200">Instructions: {med.instructions}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Follow-up */}
              {selectedPrescription.followUpDate && (
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-sky-600" />
                  <span className="text-slate-600">Follow-up:</span>
                  <span className="font-medium text-slate-900">{new Date(selectedPrescription.followUpDate).toLocaleDateString()}</span>
                </div>
              )}

              <PrescriptionAISummary
                medications={selectedPrescription.medications}
                diagnosis={selectedPrescription.diagnosis}
                treatmentPlan={selectedPrescription.treatmentPlan}
                followUpRecommendations={selectedPrescription.followUpRecommendations}
              />

              {/* Action buttons */}
              <div className="flex gap-3 pt-2 border-t border-slate-200 flex-wrap">
                {selectedPrescription.status === 'issued' && !selectedPrescription.pickedUpAt && !isExpired(selectedPrescription.validUntil) && (
                  <Button className="btn-premium transition-all duration-200 hover:scale-105" onClick={() => handlePickupPrescription(selectedPrescription._id)}>Mark Picked Up</Button>
                )}
                <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200 hover:scale-105" onClick={() => {
                  setSelectedPrescription(null);
                  if (selectedPrescription.medications.length > 0) {
                    navigate(`/prescriptions/${selectedPrescription._id}`);
                  } else {
                    navigate("/patient");
                  }
                }}>
                  <Printer className="h-4 w-4 mr-2" /> View &amp; Print
                </Button>
                <Button variant="ghost" className="text-slate-600 hover:text-slate-900 transition-all duration-200 hover:scale-105" onClick={() => setSelectedPrescription(null)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showRateDialog} onOpenChange={setShowRateDialog}>
        <DialogContent className="max-w-md rounded-2xl border border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold">Rate Doctor</DialogTitle>
            <DialogDescription className="text-slate-600">
              Share your feedback for Dr. {typeof ratingPrescription?.doctorId === 'object' ? ratingPrescription?.doctorId?.name : 'Doctor'}
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
              <Label className="text-sm font-semibold text-slate-700">Comment (optional)</Label>
              <Input
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience"
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRateDialog(false)} className="rounded-xl border-slate-200">Cancel</Button>
            <Button onClick={handleSubmitReview} disabled={submittingReview} className="rounded-xl bg-sky-500 hover:bg-sky-600">
              {submittingReview ? 'Submitting...' : 'Submit Rating'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default PatientPrescriptions;
