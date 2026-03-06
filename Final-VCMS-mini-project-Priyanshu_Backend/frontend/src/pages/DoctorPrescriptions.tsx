import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { PatientMedicalHistoryButton } from "@/components/PatientMedicalHistoryButton";
import api from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { FileText, Search, Calendar, User, Pill, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Prescription {
  _id: string;
  appointmentId?: string;
  doctorId: { _id: string; name: string; email: string };
  patientId: { _id: string; name: string; email: string; phone?: string };
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }>;
  diagnosis: string;
  clinicalNotes?: string;
  status: "draft" | "issued";
  createdAt: string;
  validUntil: string;
}

export const DoctorPrescriptions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const response = await api.get("/prescriptions/doctor/list", {
        params: { limit: 100 },
      });

      if (response.data.success && Array.isArray(response.data.prescriptions)) {
        setPrescriptions(response.data.prescriptions);
      } else {
        setPrescriptions([]);
      }
    } catch (error: any) {
      toast({
        title: "Failed to load prescriptions",
        description: error.response?.data?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPrescriptions = prescriptions.filter((rx) => {
    const patientName = typeof rx.patientId === 'object' && rx.patientId?.name ? rx.patientId.name : '';
    return patientName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const stats = {
    total: prescriptions.length,
    draft: prescriptions.filter((r) => r.status === "draft").length,
    issued: prescriptions.filter((r) => r.status === "issued").length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-primary/5 container mx-auto px-4 py-6 space-y-6 max-w-7xl pb-12">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-blue-600 p-6 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <Pill className="h-8 w-8" />
          <h1 className="text-3xl font-bold">My Prescriptions</h1>
        </div>
        <p className="text-white/80">Manage all prescriptions you've created for patients</p>
      </div>

      {/* Stats */}
      <Card className="border-0 shadow-lg">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Total Prescriptions</p>
          <p className="text-3xl font-bold mt-2 text-sky-600">{stats.total}</p>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="border-0 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prescriptions List */}
      {loading ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Loading prescriptions...</p>
          </CardContent>
        </Card>
      ) : filteredPrescriptions.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No prescriptions found"
          description={
            searchTerm
              ? "Try adjusting your search or filters"
              : "Start creating prescriptions for your patients"
          }
          action={
            !searchTerm
              ? {
                  label: "Create New Prescription",
                  onClick: () => navigate("/doctor/today"),
                }
              : undefined
          }
          variant="info"
        />
      ) : (
        <div className="space-y-3">
          {filteredPrescriptions.map((rx) => (
            <Card
              key={rx._id}
              className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
              onClick={() => navigate(`/prescriptions/${rx._id}`)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    {/* Patient Info */}
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100">
                          <User className="h-5 w-5 text-sky-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{rx.patientId?.name || 'Patient'}</p>
                          <p className="text-xs text-muted-foreground">{rx.patientId?.email || ''}</p>
                        </div>
                      </div>
                      {rx.patientId?._id && (
                        <PatientMedicalHistoryButton
                          patientId={rx.patientId._id}
                          patientName={rx.patientId.name || 'Patient'}
                          variant="outline"
                          size="sm"
                          className="border-sky-200 text-sky-600 hover:bg-sky-50"
                        />
                      )}
                    </div>

                    {/* Prescription Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Pill className="h-4 w-4" />
                        <span>{rx.medications.length} medicine{rx.medications.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(rx.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Medicines Preview */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {rx.medications.slice(0, 3).map((med, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {med.name}
                        </Badge>
                      ))}
                      {rx.medications.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{rx.medications.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Status & Action */}
                  <div className="flex flex-col items-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/prescriptions/${rx._id}`);
                      }}
                      className="text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DoctorPrescriptions;
