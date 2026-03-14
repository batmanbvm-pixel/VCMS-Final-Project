import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";
import { PatientMedicalHistoryButton } from "@/components/PatientMedicalHistoryButton";
import api from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { FileText, Calendar, User, Pill, ArrowRight, RefreshCw } from "lucide-react";
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
  status: "draft" | "issued" | "viewed" | "picked_up" | "cancelled";
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'draft' | 'issued'>('all');

  const normalizeRxStatus = (status?: string) => String(status || "draft").toLowerCase();
  const isIssuedLikeStatus = (status?: string) => ["issued", "viewed", "picked_up"].includes(normalizeRxStatus(status));

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchPrescriptions();
      toast({ title: "Refreshed", description: "Prescriptions updated successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to refresh prescriptions", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredPrescriptions = prescriptions.filter((rx) => {
    const patientName = typeof rx.patientId === 'object' && rx.patientId?.name ? rx.patientId.name : '';
    const matchesSearch = patientName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeFilter === 'all') return matchesSearch;
    if (activeFilter === 'draft') return matchesSearch && normalizeRxStatus(rx.status) === 'draft';
    if (activeFilter === 'issued') return matchesSearch && isIssuedLikeStatus(rx.status);
    return matchesSearch;
  });

  const stats = {
    total: prescriptions.length,
    draft: prescriptions.filter((r) => normalizeRxStatus(r.status) === "draft").length,
    issued: prescriptions.filter((r) => isIssuedLikeStatus(r.status)).length,
  };

  const getStatusBadge = (status?: string) => {
    const normalized = normalizeRxStatus(status);
    if (normalized === 'draft') return { text: '✎ Draft', classes: 'bg-amber-100 text-amber-700' };
    if (normalized === 'issued') return { text: '✓ Issued', classes: 'bg-emerald-100 text-emerald-700' };
    if (normalized === 'viewed') return { text: '👁 Viewed', classes: 'bg-sky-100 text-sky-700' };
    if (normalized === 'picked_up') return { text: '📦 Picked Up', classes: 'bg-violet-100 text-violet-700' };
    if (normalized === 'cancelled') return { text: '✕ Cancelled', classes: 'bg-red-100 text-red-700' };
    return { text: '—', classes: 'bg-slate-100 text-slate-700' };
  };

  return (
    <div className="container mx-auto px-6 py-8 space-y-6 max-w-7xl pb-12">
      {/* Header */}
      <div className="rounded-xl bg-sky-500 text-white p-6 shadow-md border border-sky-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Pill className="h-7 w-7" /> My Prescriptions
            </h1>
            <p className="mt-2 text-white/90 text-sm">Total: {stats.total} • Draft: {stats.draft} • Issued+: {stats.issued}</p>
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
              <FileText className="h-4 w-4 mr-2" />
              All ({stats.total})
            </Button>
            <Button
              onClick={() => setActiveFilter('draft')}
              variant={activeFilter === 'draft' ? 'default' : 'outline'}
              className={`h-9 px-4 ${
                activeFilter === 'draft'
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FileText className="h-4 w-4 mr-2" />
              Draft ({stats.draft})
            </Button>
            <Button
              onClick={() => setActiveFilter('issued')}
              variant={activeFilter === 'issued' ? 'default' : 'outline'}
              className={`h-9 px-4 ${
                activeFilter === 'issued'
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FileText className="h-4 w-4 mr-2" />
              Issued+ ({stats.issued})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Prescriptions List */}
      {loading ? (
        <Card className="border-slate-200 shadow-sm bg-white rounded-xl">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-sky-100 flex items-center justify-center animate-pulse">
                <FileText className="h-6 w-6 text-sky-600" />
              </div>
              <p className="text-center text-slate-600 font-medium">Loading prescriptions...</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredPrescriptions.length === 0 ? (
        <Card className="border-slate-200 shadow-sm bg-white rounded-xl">
          <CardContent className="py-16">
            <EmptyState
              icon={FileText}
              title={activeFilter === 'all' ? "No prescriptions found" : "No prescriptions match this filter"}
              description={
                searchTerm
                  ? "Try adjusting your search or filters"
                  : activeFilter === 'all'
                  ? "Start creating prescriptions for your patients"
                  : "Try selecting a different status filter"
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="min-w-[220px]">Patient</TableHead>
                    <TableHead className="min-w-[140px]">Diagnosis</TableHead>
                    <TableHead className="min-w-[120px]">Medicines</TableHead>
                    <TableHead className="min-w-[140px]">Date</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="text-right min-w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrescriptions.map((rx) => {
                    const statusBadge = getStatusBadge(rx.status);
                    return (
                    <TableRow key={rx._id} className="hover:bg-slate-50/60">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                            <User className="h-5 w-5 text-sky-600" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{rx.patientId?.name || 'Patient'}</div>
                            <div className="text-xs text-slate-600">{rx.patientId?.email || ''}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-700 max-w-xs truncate">{rx.diagnosis || '—'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <span className="text-sm font-medium text-slate-700">{rx.medications.length}</span>
                          <span className="text-xs text-slate-600">medicine{rx.medications.length !== 1 ? 's' : ''}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-700">
                          {new Date(rx.createdAt).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge.classes}`}>
                          {statusBadge.text}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {rx.patientId?._id && (
                          <div className="flex gap-1 justify-end">
                            <PatientMedicalHistoryButton
                              patientId={rx.patientId._id}
                              patientName={rx.patientId.name || 'Patient'}
                              variant="outline"
                              size="xs"
                              className="h-7 px-2 border-sky-200 text-sky-700 hover:bg-sky-50 text-xs"
                            />
                            <Button
                              size="xs"
                              variant="outline"
                              className="h-7 px-2 gap-1 bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100 text-xs font-medium"
                              onClick={() => navigate(`/prescriptions/${rx._id}`)}
                            >
                              <ArrowRight className="h-3 w-3" />
                              View
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DoctorPrescriptions;
