import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import api from "@/services/api";
import { Plus, Trash2, ArrowLeft } from "lucide-react";

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

interface FormData {
  diagnosis: string;
  clinicalNotes: string;
  treatmentPlan: string;
  followUpDate: string;
  followUpRecommendations: string;
  validUntil: string;
  medications: Medication[];
}

const CreatePrescription = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    diagnosis: "",
    clinicalNotes: "",
    treatmentPlan: "",
    followUpDate: "",
    followUpRecommendations: "",
    validUntil: "",
    medications: [{ name: "", dosage: "", frequency: "", duration: "", instructions: "", quantity: 0, refills: 0, sideEffects: [] }],
  });

  useEffect(() => {
    if (appointmentId) {
      fetchAppointment();
    }
  }, [appointmentId]);

  const fetchAppointment = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/appointments/${appointmentId}`);
      if (response.data?.success && response.data?.appointment) {
        setAppointment(response.data.appointment);
      } else {
        throw new Error("Appointment not found");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to load appointment",
        variant: "destructive",
      });
      setTimeout(() => navigate(-1), 1500);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMedicationChange = (index: number, field: string, value: any) => {
    const updated = [...formData.medications];
    updated[index] = { ...updated[index], [field]: value };
    setFormData((prev) => ({ ...prev, medications: updated }));
  };

  const addMedication = () => {
    setFormData((prev) => ({
      ...prev,
      medications: [
        ...prev.medications,
        { name: "", dosage: "", frequency: "", duration: "", instructions: "", quantity: 0, refills: 0, sideEffects: [] },
      ],
    }));
  };

  const removeMedication = (index: number) => {
    if (formData.medications.length === 1) {
      toast({ title: "Error", description: "At least one medication is required", variant: "destructive" });
      return;
    }
    setFormData((prev) => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.diagnosis.trim()) {
      toast({ title: "Error", description: "Diagnosis is required", variant: "destructive" });
      return;
    }

    const appointmentDate = new Date(appointment?.date || appointment?.scheduledAt || appointment?.createdAt || new Date());
    appointmentDate.setHours(0, 0, 0, 0);

    if (formData.followUpDate) {
      const followUpDate = new Date(formData.followUpDate);
      followUpDate.setHours(0, 0, 0, 0);
      if (followUpDate < appointmentDate) {
        toast({ title: "Error", description: "Follow-up date cannot be before appointment date", variant: "destructive" });
        return;
      }
    }

    if (!formData.validUntil) {
      toast({ title: "Error", description: "Validity date is required", variant: "destructive" });
      return;
    }

    const validDate = new Date(formData.validUntil);
    validDate.setHours(0, 0, 0, 0);
    if (validDate < appointmentDate) {
      toast({ title: "Error", description: "Valid Until cannot be before appointment date", variant: "destructive" });
      return;
    }

    // Validate that Valid Until is not before Follow-up Date
    if (formData.followUpDate) {
      const followUpDate = new Date(formData.followUpDate);
      followUpDate.setHours(0, 0, 0, 0);
      if (validDate < followUpDate) {
        toast({ title: "Error", description: "Valid Until cannot be before Follow-up Date", variant: "destructive" });
        return;
      }
    }

    // Validate medications
    for (const med of formData.medications) {
      if (!med.name.trim() || !med.dosage.trim() || !med.frequency.trim() || !med.duration.trim()) {
        toast({ title: "Error", description: "All medication fields are required", variant: "destructive" });
        return;
      }
    }

    try {
      setSubmitting(true);
      const response = await api.post(`/prescriptions`, {
        appointmentId,
        diagnosis: formData.diagnosis.trim(),
        clinicalNotes: formData.clinicalNotes.trim(),
        treatmentPlan: formData.treatmentPlan.trim(),
        followUpDate: formData.followUpDate || undefined,
        followUpRecommendations: formData.followUpRecommendations.trim(),
        validUntil: formData.validUntil,
        medications: formData.medications.map((m) => ({
          name: m.name.trim(),
          dosage: m.dosage.trim(),
          frequency: m.frequency.trim(),
          duration: m.duration.trim(),
          instructions: m.instructions.trim(),
          quantity: m.quantity,
          refills: m.refills,
          sideEffects: m.sideEffects,
        })),
      });

      if (response.data?.success) {
        toast({ title: "Success", description: "Prescription created successfully" });
        setTimeout(() => navigate(`/doctor/today`), 1500);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to create prescription",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-slate-100 rounded"></div>
          <div className="h-32 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border border-slate-200 shadow-sm rounded-xl">
          <CardContent className="py-8 text-center">
            <p className="text-slate-700">Appointment not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-4xl bg-white min-h-screen">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="transition-all duration-200 hover:scale-105">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create Prescription</h1>
          <p className="text-sm text-slate-600">
            Patient: <span className="font-medium text-slate-900">{appointment.patientId?.name || "Loading..."}</span>
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Diagnosis */}
        <Card className="border border-slate-200 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">Diagnosis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="diagnosis" className="text-slate-700">Diagnosis *</Label>
              <Textarea
                id="diagnosis"
                name="diagnosis"
                placeholder="Enter diagnosis"
                value={formData.diagnosis}
                onChange={handleInputChange}
                required
                className="mt-1 focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="clinicalNotes" className="text-slate-700">Clinical Notes</Label>
              <Textarea
                id="clinicalNotes"
                name="clinicalNotes"
                placeholder="Additional clinical notes"
                value={formData.clinicalNotes}
                onChange={handleInputChange}
                className="mt-1 focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Medications */}
        <Card className="border border-slate-200 shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg text-slate-900">Medications</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addMedication} className="border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200 hover:scale-105">
              <Plus className="h-4 w-4 mr-2" /> Add Medication
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.medications.map((med, idx) => (
              <div key={idx} className="p-4 border border-slate-200 rounded-lg space-y-3 bg-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-900 text-slate-900">Medication {idx + 1}</span>
                  {formData.medications.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMedication(idx)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200 hover:scale-105"
                      aria-label="Remove medication"
                      title="Remove medication"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`name-${idx}`} className="text-slate-700">Name *</Label>
                    <Input
                      id={`name-${idx}`}
                      placeholder="e.g., Aspirin"
                      value={med.name}
                      onChange={(e) => handleMedicationChange(idx, "name", e.target.value)}
                      className="mt-1 focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`dosage-${idx}`} className="text-slate-700">Dosage *</Label>
                    <Input
                      id={`dosage-${idx}`}
                      placeholder="e.g., 500mg"
                      value={med.dosage}
                      onChange={(e) => handleMedicationChange(idx, "dosage", e.target.value)}
                      className="mt-1 focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`frequency-${idx}`} className="text-slate-700">Frequency *</Label>
                    <Input
                      id={`frequency-${idx}`}
                      placeholder="e.g., Twice daily"
                      value={med.frequency}
                      onChange={(e) => handleMedicationChange(idx, "frequency", e.target.value)}
                      className="mt-1 focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`duration-${idx}`} className="text-slate-700">Duration *</Label>
                    <Input
                      id={`duration-${idx}`}
                      placeholder="e.g., 7 days"
                      value={med.duration}
                      onChange={(e) => handleMedicationChange(idx, "duration", e.target.value)}
                      className="mt-1 focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`quantity-${idx}`} className="text-slate-700">Quantity</Label>
                    <Input
                      id={`quantity-${idx}`}
                      type="number"
                      placeholder="0"
                      value={med.quantity}
                      onChange={(e) => handleMedicationChange(idx, "quantity", parseInt(e.target.value) || 0)}
                      className="mt-1 focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200"
                      min="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`refills-${idx}`} className="text-slate-700">Refills</Label>
                    <Input
                      id={`refills-${idx}`}
                      type="number"
                      placeholder="0"
                      value={med.refills}
                      onChange={(e) => handleMedicationChange(idx, "refills", parseInt(e.target.value) || 0)}
                      className="mt-1 focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor={`instructions-${idx}`} className="text-slate-700">Instructions</Label>
                  <Textarea
                    id={`instructions-${idx}`}
                    placeholder="e.g., Take with food"
                    value={med.instructions}
                    onChange={(e) => handleMedicationChange(idx, "instructions", e.target.value)}
                    className="mt-1 focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200"
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Follow-up & Validity */}
        <Card className="border border-slate-200 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">Follow-up & Validity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="followUpDate" className="text-slate-700">Follow-up Date</Label>
                <Input
                  id="followUpDate"
                  name="followUpDate"
                  type="date"
                  min={String(appointment?.date || appointment?.scheduledAt || new Date().toISOString()).split('T')[0]}
                  value={formData.followUpDate}
                  onChange={handleInputChange}
                  className="mt-1 focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200"
                />
                <p className="text-xs text-slate-500 mt-1">Must be on or after appointment date</p>
              </div>
              <div>
                <Label htmlFor="validUntil" className="text-slate-700">Valid Until *</Label>
                <Input
                  id="validUntil"
                  name="validUntil"
                  type="date"
                  value={formData.validUntil}
                  onChange={handleInputChange}
                  required
                  className="mt-1 focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="followUpRecommendations" className="text-slate-700">Follow-up Recommendations</Label>
              <Textarea
                id="followUpRecommendations"
                name="followUpRecommendations"
                placeholder="e.g., Schedule follow-up in 2 weeks"
                value={formData.followUpRecommendations}
                onChange={handleInputChange}
                className="mt-1 focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="treatmentPlan" className="text-slate-700">Treatment Plan</Label>
              <Textarea
                id="treatmentPlan"
                name="treatmentPlan"
                placeholder="Detailed treatment plan"
                value={formData.treatmentPlan}
                onChange={handleInputChange}
                className="mt-1 focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)} className="border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200 hover:scale-105">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="btn-premium transition-all duration-200 hover:scale-105">
            {submitting ? "Creating..." : "Create Prescription"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreatePrescription;
