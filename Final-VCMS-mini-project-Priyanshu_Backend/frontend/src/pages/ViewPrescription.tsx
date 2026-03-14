import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, ArrowLeft, AlertCircle, Sparkles, ClipboardList } from "lucide-react";
import api from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { PrescriptionAISummary } from "@/components/PrescriptionAISummary";
import { PatientMedicalHistoryButton } from "@/components/PatientMedicalHistoryButton";

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  quantity?: number;
}

interface Prescription {
  _id: string;
  appointmentId: any;
  patientId: any;
  doctorId: any;
  medications: Medication[];
  diagnosis: string;
  clinicalNotes?: string;
  treatmentPlan?: string;
  followUpDate?: string;
  status: string;
  issuedAt: string;
  validUntil?: string;
  createdAt: string;
}

const ViewPrescription = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const role = (user?.role || "").toLowerCase();

  // Inject print styles once
  useEffect(() => {
    const printStyle = document.createElement("style");
    printStyle.textContent = `
      @media print {
        * { margin: 0; padding: 0; }
        @page { margin: 1cm; size: A4; }
        
        body { 
          background: white !important; 
          margin: 0 !important; 
          padding: 0 !important;
        }

        body * {
          visibility: hidden !important;
        }

        #rx-print-root,
        #rx-print-root * {
          visibility: visible !important;
        }
        
        #rx-print-root {
          display: block !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
        }
        
        #rx-print-root > div {
          display: block !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        #rx-print-root * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        .print\\:hidden, [class*="print:hidden"] {
          display: none !important;
        }
        
        button, nav, [role="button"], .no-print {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(printStyle);
    return () => printStyle.remove();
  }, []);

  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPrescription();
  }, [id]);

  const fetchPrescription = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let data = null;

      // Try multiple endpoints
      try {
        const res = await api.get(`/prescriptions/${id}`);
        if (res.data?.success) {
          data = res.data.prescription || res.data.data || res.data;
        }
      } catch (err1: any) {
        // Try as appointment ID
        try {
          const res = await api.get(`/prescriptions/appointment/${id}`);
          if (res.data?.success) {
            data = res.data.prescription || res.data.data || res.data;
          }
        } catch (err2) {
          // Silent fallback
        }
      }

      if (!data) {
        setError("Prescription not found. It may not have been created yet.");
        setLoading(false);
        return;
      }

      setPrescription(data);
      
      // Mark as viewed
      try {
        await api.post(`/prescriptions/${data._id}/view`);
      } catch (err) {
        // Silent fail
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load prescription");
      toast({
        title: "Error",
        description: "Failed to load prescription",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading prescription...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !prescription) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 transition-all duration-200 hover:scale-105">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Card className="border-slate-200 shadow-md rounded-xl">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-amber-600 mx-auto mb-4 opacity-70" />
            <p className="text-lg font-semibold text-slate-900">{error || "Prescription not available"}</p>
            <p className="text-sm text-slate-700 mt-2">The prescription may not have been created yet.</p>
            <Button onClick={() => navigate(-1)} className="mt-4 bg-sky-500 hover:bg-sky-600 text-white transition-all duration-200 hover:scale-105">Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div id="rx-print-root" className="min-h-screen bg-white py-8">
      <div className="container mx-auto px-4 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">Prescription</h1>
            <p className="text-slate-700 mt-2">Medical Prescription Details</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => navigate(-1)} className="border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200 hover:scale-105">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button size="sm" onClick={() => {
              if (prescription.medications && prescription.medications.length > 0) {
                window.print();
              } else {
                navigate(role === "doctor" ? "/doctor" : "/patient");
              }
            }} className="bg-sky-500 hover:bg-sky-600 text-white transition-all duration-200 hover:scale-105">
              <Download className="h-4 w-4 mr-2" /> {prescription.medications?.length > 0 ? "Print" : "No Rx to Print"}
            </Button>
          </div>
        </div>

        {/* Print-only header */}
        <div className="hidden print:block mb-6">
          <div className="text-center border-b-2 border-sky-500 pb-4 mb-4">
            <h1 className="text-3xl font-bold text-sky-600">⚕️ MediConnect - Virtual Clinic</h1>
            <p className="text-sm text-slate-600 mt-1">Professional Medical Care</p>
          </div>
        </div>

        <Card className="border-slate-200 shadow-md rounded-xl">
          <CardHeader className="border-b border-slate-200 pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50">
                  <FileText className="h-6 w-6 text-sky-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-slate-900">{prescription.diagnosis || "Prescription"}</CardTitle>
                  <p className="text-sm text-slate-700 mt-1">Issued: {new Date(prescription.issuedAt || prescription.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <Badge className="text-white capitalize bg-sky-500">{prescription.status}</Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-sky-50 rounded-lg p-4 space-y-2 border border-sky-200">
                <p className="text-xs font-semibold text-slate-700 uppercase">Patient</p>
                <p className="text-lg font-semibold text-slate-900">{prescription.patientId?.name || "Unknown"}</p>
                {prescription.patientId?.email && <p className="text-sm text-slate-600">{prescription.patientId.email}</p>}
              </div>
              <div className="bg-purple-50 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-600 uppercase">Doctor</p>
                <p className="text-lg font-semibold text-slate-900">Dr. {prescription.doctorId?.name || "Unknown"}</p>
                {prescription.doctorId?.specialization && <p className="text-sm text-slate-600">{prescription.doctorId.specialization}</p>}
              </div>
            </div>

            {prescription.clinicalNotes && (
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-slate-700 mb-2">Clinical Notes</p>
                <p className="text-slate-900 bg-slate-50 p-3 rounded">{prescription.clinicalNotes}</p>
              </div>
            )}

            {prescription.medications && prescription.medications.length > 0 && (
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-semibold text-slate-700 uppercase">Medications</p>
                {prescription.medications.map((med, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded p-4">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-600 font-medium">Medication</p>
                        <p className="text-slate-900 font-semibold">{med.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-medium">Dosage</p>
                        <p className="text-slate-900">{med.dosage}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-medium">Frequency</p>
                        <p className="text-slate-900">{med.frequency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 font-medium">Duration</p>
                        <p className="text-slate-900">{med.duration}</p>
                      </div>
                    </div>
                    {med.instructions && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-slate-600 font-medium mb-1">Instructions</p>
                        <p className="text-sm text-slate-900">{med.instructions}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {prescription.treatmentPlan && (
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-slate-700 mb-2">Treatment Plan</p>
                <p className="text-slate-900 bg-slate-50 p-3 rounded">{prescription.treatmentPlan}</p>
              </div>
            )}

            {prescription.followUpDate && (
              <div className="border-t pt-4">
                <div className="bg-green-50 rounded p-4">
                  <p className="text-xs text-slate-600 font-medium mb-1">Follow-up Recommended</p>
                  <p className="text-lg font-semibold text-green-700">{new Date(prescription.followUpDate).toLocaleDateString()}</p>
                </div>
              </div>
            )}

            {/* Role-aware action buttons */}
            <div className="border-t pt-4 flex flex-wrap gap-2 print:hidden">
              {role === "patient" && (
                <Button variant="outline" size="sm" className="gap-2 transition-all duration-200 hover:scale-105" onClick={() => navigate("/patient/medical-history")}>
                  <ClipboardList className="h-4 w-4" /> Medical History
                </Button>
              )}
              {(role === "doctor" || role === "admin") && prescription.patientId?._id && (
                <PatientMedicalHistoryButton
                  patientId={prescription.patientId._id}
                  patientName={prescription.patientId.name}
                  variant="outline"
                  size="sm"
                  className="border-sky-200 text-sky-600 hover:bg-sky-50"
                />
              )}
              {role === "doctor" && prescription.status === "draft" && (
                <Button variant="outline" size="sm" className="gap-2 transition-all duration-200 hover:scale-105" onClick={() => navigate(`/create-prescription/${prescription.appointmentId?._id || prescription.appointmentId}`)}>
                  <FileText className="h-4 w-4" /> Update Prescription
                </Button>
              )}
            </div>

            {/* AI Summary — shown to patients, doctors, and admin */}
            {(role === "patient" || role === "doctor" || role === "admin") && (
              <div className="border-t pt-6 print:hidden">
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
                  <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> AI Prescription Summary
                  </p>
                  <PrescriptionAISummary
                    medications={prescription.medications || []}
                    diagnosis={prescription.diagnosis || ""}
                    treatmentPlan={(prescription as any).treatmentPlan || ""}
                    followUpRecommendations={(prescription as any).followUpRecommendations || ""}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ViewPrescription;
