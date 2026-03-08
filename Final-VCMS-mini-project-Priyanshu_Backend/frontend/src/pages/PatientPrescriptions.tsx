import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/hooks/useSocket";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import api from "@/services/api";
import { FileText, Download, CheckCircle2, Clock, AlertCircle, Pill, X, Stethoscope, CalendarDays, Printer } from "lucide-react";
import PrescriptionAISummary from "@/components/PrescriptionAISummary";
import LoadingSpinner from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";

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
  const { socket } = useSocket();
  const { toast } = useToast();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const navigate = useNavigate();

  const displayedPrescriptions = prescriptions.filter((p) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return ["issued", "viewed"].includes(p.status);
    if (statusFilter === "picked_up") return p.status === "picked_up";
    return true;
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
        <div className="container mx-auto px-4 py-8 max-w-7xl pb-12">
          <LoadingSpinner text="Loading prescriptions..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-primary/5">
      <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl pb-12">
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

      {/* Status Filter */}
      <div className="w-full max-w-md flex items-center gap-2">
        <div className="flex-1">
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
        </div>
        {statusFilter !== "all" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatusFilter("all")}
            className="h-11 text-red-700 border-red-300 bg-red-50 hover:bg-red-100"
          >
            <X className="h-4 w-4 mr-1" /> Clear Filters
          </Button>
        )}
      </div>

      {/* Prescriptions list */}
      {displayedPrescriptions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <EmptyState
            icon={FileText}
            title="No prescriptions found"
            description="Your doctor will add prescriptions after your appointment"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {displayedPrescriptions.map((rx) => (
            <div key={rx._id} className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
              {/* Top stripe by status */}
              <div className={`h-1 rounded-t-2xl ${rx.status === 'cancelled' ? 'bg-red-500' : rx.status === 'picked_up' ? 'bg-green-500' : 'bg-sky-500'}`} />
              <div className="p-3.5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
                    <Pill className="h-4.5 w-4.5 text-sky-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-bold text-slate-900">{rx.diagnosis}</p>
                        <p className="text-sm text-slate-600 flex items-center gap-1 mt-0.5">
                          <Stethoscope className="h-3.5 w-3.5" /> Dr. {rx.doctorId?.name || 'Doctor'}
                        </p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize flex items-center gap-1.5 ${getStatusBadgeClass(rx.status)}`}>
                        {getStatusIcon(rx.status)}
                        {rx.status === 'picked_up' ? 'Picked Up' : rx.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span className="text-xs">Issued: {rx.issuedAt ? new Date(rx.issuedAt).toLocaleDateString() : '—'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Clock className="h-3.5 w-3.5" />
                        <span className={`text-xs ${isExpired(rx.validUntil) ? 'text-red-600 font-semibold' : ''}`}>
                          Valid until: {new Date(rx.validUntil).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {rx.medications.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {rx.medications.map((med, idx) => (
                          <span key={idx} className="text-xs bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md">
                            {med.name} {med.dosage}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button size="sm" className="text-xs btn-premium min-w-[78px] transition-all duration-200 hover:scale-105" onClick={() => handleViewPrescription(rx)}>Details</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-sky-200 text-sky-700 hover:bg-sky-50 transition-all duration-200 hover:scale-105"
                      onClick={() => handleViewPrescription(rx)}
                    >
                      AI Summary
                    </Button>
                    {rx.status === 'issued' && !rx.pickedUpAt && !isExpired(rx.validUntil) && (
                      <Button size="sm" variant="outline" className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200 hover:scale-105" onClick={() => handlePickupPrescription(rx._id)}>Picked Up</Button>
                    )}
                    <Button
                      size="sm" variant="ghost" className="text-xs text-slate-600 hover:text-slate-900 transition-all duration-200 hover:scale-105"
                      title={rx.medications.length > 0 ? "Print prescription" : "No medications to print"}
                      aria-label={rx.medications.length > 0 ? "Print prescription" : "No medications to print"}
                      onClick={() => {
                        if (rx.medications.length > 0) {
                          navigate(`/prescriptions/${rx._id}`);
                        } else {
                          navigate("/patient");
                        }
                      }}
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
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
                <span className="text-sm text-slate-600">Issued: {selectedPrescription.issuedAt ? new Date(selectedPrescription.issuedAt).toLocaleDateString() : '—'}</span>
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
      </div>
    </div>
  );
};

export default PatientPrescriptions;
