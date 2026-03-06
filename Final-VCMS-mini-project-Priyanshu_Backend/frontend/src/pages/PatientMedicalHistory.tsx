import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useSocket } from "@/hooks/useSocket";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, MapPin, Stethoscope, IndianRupee, ChevronDown, ChevronUp, Plus, Activity, Heart, Brain, Bone, Pill, AlertCircle, FileText, ScanLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import api from "@/services/api";
import AddMedicalHistoryForm from "@/components/AddMedicalHistoryForm";
import { EmptyState } from "@/components/EmptyState";

interface MedicalHistoryRecord {
  _id: string;
  patientId: string;
  doctorId?: string;
  doctorName?: string;
  condition: string;
  description?: string;
  diagnosis?: string;
  treatment?: string;
  createdAt: string;
  date?: string;
  isDoctorCreated: boolean;
}

interface MedicalHistoryFormData {
  condition: string;
  description: string;
  diagnosis: string;
  treatment: string;
  reportFileName?: string;
}

// Health condition categories with icons
const getConditionCategory = (condition: string): { icon: any; color: string; label: string } => {
  const lowerCondition = condition.toLowerCase();
  if (lowerCondition.includes('heart') || lowerCondition.includes('cardiac') || lowerCondition.includes('blood pressure')) {
    return { icon: Heart, color: 'text-red-600', label: 'Cardiac' };
  }
  if (lowerCondition.includes('stomach') || lowerCondition.includes('digestive') || lowerCondition.includes('gastric')) {
    return { icon: Activity, color: 'text-orange-600', label: 'Digestive' };
  }
  if (lowerCondition.includes('brain') || lowerCondition.includes('neuro') || lowerCondition.includes('headache') || lowerCondition.includes('migraine')) {
    return { icon: Brain, color: 'text-primary', label: 'Neurological' };
  }
  if (lowerCondition.includes('bone') || lowerCondition.includes('joint') || lowerCondition.includes('back pain') || lowerCondition.includes('arthritis')) {
    return { icon: Bone, color: 'text-amber-600', label: 'Musculoskeletal' };
  }
  if (lowerCondition.includes('diabetes') || lowerCondition.includes('thyroid') || lowerCondition.includes('hormone')) {
    return { icon: Pill, color: 'text-primary', label: 'Endocrine' };
  }
  return { icon: FileText, color: 'text-gray-600', label: 'General' };
};

const PatientMedicalHistory = () => {
  const { user } = useAuth();
  const { appointments, getPrescriptionByAppointment } = useClinic();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistoryRecord[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const pastAppointments = appointments
    .filter((a) => a.patientId === user?._id && (a.status?.toLowerCase() === "completed" || a.status?.toLowerCase() === "cancelled"))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Show all medical history (no year limit)
  const recentMedicalHistory = useMemo(() => {
    return medicalHistory.sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt);
      const dateB = new Date(b.date || b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
  }, [medicalHistory]);

  // Group medical history by year
  const medicalHistoryByYear = useMemo(() => {
    const grouped: { [year: string]: MedicalHistoryRecord[] } = {};
    recentMedicalHistory.forEach(record => {
      const year = new Date(record.date || record.createdAt).getFullYear().toString();
      if (!grouped[year]) grouped[year] = [];
      grouped[year].push(record);
    });
    return grouped;
  }, [recentMedicalHistory]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = recentMedicalHistory.length;
    const doctorRecords = recentMedicalHistory.filter(r => r.isDoctorCreated).length;
    const selfRecords = total - doctorRecords;
    const categories = new Set(recentMedicalHistory.map(r => getConditionCategory(r.condition).label));
    
    return {
      total,
      doctorRecords,
      selfRecords,
      categories: Array.from(categories),
    };
  }, [recentMedicalHistory]);

  // Fetch medical history on mount
  useEffect(() => {
    if (user?._id) {
      fetchMedicalHistory();
    }
  }, [user?._id]);

  // Socket listener for real-time medical history updates
  useEffect(() => {
    if (!socket) return;

    const handleNewMedicalHistory = (data: any) => {
      if (data.patientId === user?._id) {
        setMedicalHistory((prev) => [data, ...prev]);
        toast({ title: "New medical record added", description: "Doctor has recorded new medical information." });
      }
    };

    socket.on("medical-history:created", handleNewMedicalHistory);
    return () => socket.off("medical-history:created", handleNewMedicalHistory);
  }, [socket, user?._id, toast]);

  const fetchMedicalHistory = async () => {
    try {
      const res = await api.get(`/medical-history/patient/${user?._id}`);
      if (res.data?.success) {
        setMedicalHistory(res.data.entries || res.data.medicalHistory || []);
      }
    } catch (err) {
      // Failed to fetch medical history
    }
  };

  const handleAddMedicalHistory = async (data: MedicalHistoryFormData) => {
    if (!data.condition.trim()) {
      toast({ title: "Condition is required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/medical-history/patient/self", {
        condition: data.condition,
        description: data.description,
        diagnosis: data.diagnosis,
        treatment: data.treatment,
        reportFileName: data.reportFileName || undefined,
      });

      if (res.data?.success) {
        toast({ title: "Medical history recorded", description: res.data.message });
        setShowAddForm(false);
        fetchMedicalHistory();
      } else {
        toast({ title: "Failed", description: res.data?.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to save medical history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-primary/5">
      <div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl pb-12">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500 via-sky-600 to-primary p-6 shadow-md border border-sky-300 text-white">
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <p className="text-sky-100 text-sm font-medium">Health Records 🏥</p>
              <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold">Complete History</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Medical History</h1>
            <p className="text-sky-100 mt-1.5 text-sm max-w-2xl">Track diagnoses, treatments, and doctor-entered records in one clean timeline.</p>
            {stats.categories.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {stats.categories.slice(0, 4).map((category) => (
                  <span key={category} className="text-[11px] bg-white/20 px-2.5 py-1 rounded-full font-medium text-white">
                    {category}
                  </span>
                ))}
                {stats.categories.length > 4 && (
                  <span className="text-[11px] bg-white/20 px-2.5 py-1 rounded-full font-medium text-white">
                    +{stats.categories.length - 4} more
                  </span>
                )}
              </div>
            )}
            <div className="flex gap-2 mt-4 flex-wrap">
              <Button
                size="sm"
                variant="ghost"
                className="text-white/90 hover:text-white hover:bg-white/20 gap-1.5 transition-all duration-200 hover:scale-105"
                onClick={() => navigate('/patient/ai-analyzer')}
              >
                <ScanLine className="h-4 w-4" /> AI Analyzer
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center min-w-[92px]">
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-white/80 text-xs mt-0.5">Records</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center min-w-[92px]">
              <p className="text-2xl font-bold text-white">{stats.doctorRecords}</p>
              <p className="text-white/80 text-xs mt-0.5">By Doctor</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center min-w-[92px]">
              <p className="text-2xl font-bold text-white">{stats.categories.length}</p>
              <p className="text-white/80 text-xs mt-0.5">Categories</p>
            </div>
          </div>
        </div>
      </div>

      {/* General profile medical history */}
      {user?.medicalHistory && (
        <div className="flex items-start gap-3 rounded-2xl bg-white/90 backdrop-blur-sm border border-border px-5 py-4 shadow-sm">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertCircle className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">General Health Notes (from registration)</p>
            <p className="text-sm text-foreground">{user.medicalHistory}</p>
          </div>
        </div>
      )}

      <AddMedicalHistoryForm
        open={showAddForm}
        onOpenChange={setShowAddForm}
        onAddRecord={handleAddMedicalHistory}
        loading={loading}
      />

      {/* Medical History Timeline (Last 5 Years) - Grouped by Year */}
      {Object.keys(medicalHistoryByYear).length > 0 && (
        <div className="space-y-6">
          <div className="rounded-2xl overflow-hidden shadow-sm border border-border bg-white/80 backdrop-blur-sm">
            <div className="bg-muted/70 border-b border-border px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-foreground font-bold text-lg">Medical Records Timeline</h2>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
                All Records • {recentMedicalHistory.length} Total
              </span>
            </div>
          </div>

          {Object.keys(medicalHistoryByYear)
            .sort((a, b) => parseInt(b) - parseInt(a))
            .map(year => (
              <div key={year} className="space-y-3">
                {/* Year Header */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border"></div>
                  <h3 className="text-xl font-bold text-muted-foreground">{year}</h3>
                  <div className="h-px flex-1 bg-border"></div>
                </div>

                {/* Records for this year */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {medicalHistoryByYear[year].map(record => {
                    const category = getConditionCategory(record.condition);
                    const Icon = category.icon;
                    const recordDate = new Date(record.date || record.createdAt);

                    return (
                      <Card key={record._id} className="border border-border bg-white/90 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Icon className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <CardTitle className="text-base font-semibold">{record.condition}</CardTitle>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {recordDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant={record.isDoctorCreated ? "default" : "secondary"} className="text-xs">
                                {record.isDoctorCreated ? "Doctor" : "Self-Reported"}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {category.label}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {record.description && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase">Description</p>
                              <p className="mt-1">{record.description}</p>
                            </div>
                          )}
                          {record.diagnosis && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase">Diagnosis</p>
                              <p className="mt-1">{record.diagnosis}</p>
                            </div>
                          )}
                          {record.treatment && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase">Treatment</p>
                              <p className="mt-1">{record.treatment}</p>
                            </div>
                          )}
                          {record.isDoctorCreated && record.doctorName && (
                            <div className="flex items-center gap-2 pt-2 border-t">
                              <Stethoscope className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Dr. {record.doctorName}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Empty state */}
      {recentMedicalHistory.length === 0 && (
        <Card className="border border-border shadow-sm">
          <CardContent className="py-8">
            <EmptyState
              icon={FileText}
              title="No medical records found"
              description="Start adding your medical history to track your health journey"
              action={{
                label: "Add First Record",
                onClick: () => setShowAddForm(true),
              }}
            />
          </CardContent>
        </Card>
      )}

      {medicalHistory.length === 0 && (
        <Card className="border border-border shadow-md">
          <CardContent className="py-8">
            <EmptyState
              icon={CalendarDays}
              title="No medical records found"
              description="Your consultation history will appear here after your first completed appointment"
            />
          </CardContent>
        </Card>
      )}

      {/* Floating Add Button */}
      <button
        onClick={() => setShowAddForm(true)}
        className="fixed bottom-6 right-24 h-14 w-14 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 flex items-center justify-center z-50"
        aria-label="Add medical record"
      >
        <Plus className="h-6 w-6" />
      </button>
      </div>
    </div>
  );
};

export default PatientMedicalHistory;
