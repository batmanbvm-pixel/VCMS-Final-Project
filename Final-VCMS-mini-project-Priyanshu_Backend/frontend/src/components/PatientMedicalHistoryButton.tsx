import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Loader2, AlertCircle, Calendar, Pill, FileText, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import api from "@/services/api";

interface MedicalHistoryEntry {
  _id: string;
  condition: string;
  diagnosedDate: string;
  status: string;
  notes?: string;
  medications?: string[];
  createdAt: string;
}

interface PatientMedicalHistoryButtonProps {
  patientId: string;
  patientName?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showLabel?: boolean;
}

export const PatientMedicalHistoryButton = ({
  patientId,
  patientName = "Patient",
  variant = "outline",
  size = "sm",
  className = "",
  showLabel = true,
}: PatientMedicalHistoryButtonProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<MedicalHistoryEntry[]>([]);

  const fetchMedicalHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/users/medical-history/${patientId}`);
      
      if (response.data.success && Array.isArray(response.data.history)) {
        setHistory(response.data.history);
      } else {
        setHistory([]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to load medical history",
        variant: "destructive",
      });
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    fetchMedicalHistory();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
      case "ongoing":
        return "bg-sky-100 text-sky-700 border-sky-200";
      case "resolved":
      case "cured":
        return "bg-sky-100 text-sky-700 border-sky-200";
      case "chronic":
        return "bg-cyan-100 text-cyan-700 border-cyan-200";
      default:
        return "bg-sky-100 text-sky-700 border-sky-200";
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={`gap-2 ${className}`}
        onClick={handleOpen}
      >
        <ClipboardList className="h-4 w-4" />
        {showLabel && "Medical History"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sky-700">
              <div className="h-8 w-8 rounded-lg bg-sky-100 flex items-center justify-center">
                <Activity className="h-5 w-5 text-sky-600" />
              </div>
              Medical History
            </DialogTitle>
            <DialogDescription>
              Complete medical history for {patientName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-sky-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-600">Loading medical history...</p>
                </div>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <ClipboardList className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Medical History</h3>
                <p className="text-sm text-slate-600 text-center max-w-sm">
                  This patient has not added any medical history records yet.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((entry, index) => (
                  <div
                    key={entry._id}
                    className="border border-slate-200 rounded-xl p-5 bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-slate-900">
                            {entry.condition}
                          </h3>
                          <Badge
                            className={`${getStatusColor(entry.status)} border`}
                          >
                            {entry.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Diagnosed: {new Date(entry.diagnosedDate).toLocaleDateString()}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span>
                            Added: {new Date(entry.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {entry.notes && (
                      <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <p className="text-xs font-semibold text-slate-600 uppercase mb-1 flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Clinical Notes
                        </p>
                        <p className="text-sm text-slate-700 leading-relaxed">
                          {entry.notes}
                        </p>
                      </div>
                    )}

                    {entry.medications && entry.medications.length > 0 && (
                      <div className="p-3 bg-sky-50 rounded-lg border border-sky-100">
                        <p className="text-xs font-semibold text-sky-700 uppercase mb-2 flex items-center gap-1">
                          <Pill className="h-3 w-3" />
                          Medications ({entry.medications.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {entry.medications.map((med, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="bg-white text-sky-700 border-sky-200"
                            >
                              {med}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {history.length > 0 && (
                  <div className="text-center pt-4 border-t">
                    <p className="text-xs text-slate-500">
                      Total {history.length} medical history record{history.length !== 1 ? 's' : ''} found
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PatientMedicalHistoryButton;
