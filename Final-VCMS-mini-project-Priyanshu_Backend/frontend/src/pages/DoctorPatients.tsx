import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PatientMedicalHistoryButton } from "@/components/PatientMedicalHistoryButton";
import { CalendarDays, Clock, FileText, Users, UserCheck, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const DoctorPatients = () => {
  const { user } = useAuth();
  const { appointments, getPrescriptionByAppointment } = useClinic();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);

  const myAppointments = appointments.filter((a) => (a.doctorId === user?._id || a.doctorId === user?.id) && a.status !== "Cancelled");

  // Group by patient
  const patientMap = new Map<string, typeof myAppointments>();
  myAppointments.forEach((apt) => {
    const existing = patientMap.get(apt.patientId) || [];
    existing.push(apt);
    patientMap.set(apt.patientId, existing);
  });

  const statusColor = (s: string) => {
    switch (s) {
      case "Booked": return "bg-primary/10 text-primary";
      case "Accepted": return "bg-secondary/10 text-secondary";
      case "In Progress": return "bg-warning/10 text-warning";
      case "Completed": return "bg-secondary/10 text-secondary";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Filter patients based on appointment status
  const filterPatients = () => {
    let filteredMap = new Map<string, typeof myAppointments>();
    
    patientMap.forEach((apts, patientId) => {
      if (activeFilter === 'all') {
        filteredMap.set(patientId, apts);
      } else if (activeFilter === 'active') {
        const hasActive = apts.some(apt => ['Booked', 'Accepted', 'In Progress'].includes(apt.status));
        if (hasActive) {
          filteredMap.set(patientId, apts);
        }
      } else if (activeFilter === 'completed') {
        const hasCompleted = apts.some(apt => apt.status === 'Completed');
        if (hasCompleted) {
          filteredMap.set(patientId, apts);
        }
      }
    });
    
    return filteredMap;
  };

  const filteredPatients = filterPatients();

  const filterCounts = {
    all: patientMap.size,
    active: Array.from(patientMap.values()).filter(apts => apts.some(apt => ['Booked', 'Accepted', 'In Progress'].includes(apt.status))).length,
    completed: Array.from(patientMap.values()).filter(apts => apts.some(apt => apt.status === 'Completed')).length,
  };

  return (
    <div className="container mx-auto px-6 py-8 space-y-6 max-w-7xl pb-12">
      {/* Header */}
      <div className="rounded-xl bg-sky-500 text-white p-6 shadow-md border border-sky-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Users className="h-7 w-7" /> My Patients</h1>
            <p className="mt-2 text-white/90 text-sm">All: {patientMap.size} • Active: {filterCounts.active} • Completed: {filterCounts.completed}</p>
          </div>
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
              <Users className="h-4 w-4 mr-2" />
              All Patients ({filterCounts.all})
            </Button>
            <Button
              onClick={() => setActiveFilter('active')}
              variant={activeFilter === 'active' ? 'default' : 'outline'}
              className={`h-9 px-4 ${
                activeFilter === 'active'
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Active ({filterCounts.active})
            </Button>
            <Button
              onClick={() => setActiveFilter('completed')}
              variant={activeFilter === 'completed' ? 'default' : 'outline'}
              className={`h-9 px-4 ${
                activeFilter === 'completed'
                  ? 'bg-sky-500 hover:bg-sky-600 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FileText className="h-4 w-4 mr-2" />
              Completed ({filterCounts.completed})
            </Button>
          </div>
        </CardContent>
      </Card>

      {patientMap.size === 0 && (
        <Card className="border-slate-200 shadow-sm rounded-xl">
          <CardContent className="py-12 text-center">
            <UserCheck className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <p className="font-medium text-slate-700">No patients yet</p>
            <p className="text-sm text-slate-600 mt-1">Patients will appear here after accepting appointments.</p>
          </CardContent>
        </Card>
      )}

      {filteredPatients.size === 0 && patientMap.size > 0 && (
        <Card className="border-slate-200 shadow-sm rounded-xl">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <p className="font-medium text-slate-700">No patients match this filter</p>
            <p className="text-sm text-slate-600 mt-1">Try selecting a different filter to view patients.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {Array.from(filteredPatients.entries()).map(([patientId, apts]) => {
          const firstApt = apts[0];
          return (
            <Card key={patientId} className="border-slate-200 shadow-sm rounded-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => setExpandedPatient(expandedPatient === patientId ? null : patientId)}
                    className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white text-sm font-bold">
                      {firstApt.patientName.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <CardTitle className="text-base text-slate-900">{firstApt.patientName}</CardTitle>
                      <p className="text-xs text-slate-700">Age: {firstApt.patientAge || "—"} • {firstApt.patientMedicalHistory || "No history"}</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-600 transition-transform ${expandedPatient === patientId ? 'rotate-180' : ''}`} />
                  </button>
                  {patientId && (
                    <PatientMedicalHistoryButton
                      patientId={patientId}
                      patientName={firstApt.patientName}
                      variant="outline"
                      size="sm"
                      className="border-sky-200 text-sky-600 hover:bg-sky-50 transition-all duration-200 hover:scale-105"
                    />
                  )}
                </div>
              </CardHeader>
              {expandedPatient === patientId && (
              <CardContent className="space-y-2 pt-0">
                {apts.sort((a, b) => b.date.localeCompare(a.date)).map((apt) => {
                  const rx = getPrescriptionByAppointment(apt._id || apt.id);
                  return (
                    <div key={apt.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <CalendarDays className="h-3 w-3" /> {apt.date}
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3 w-3" /> {apt.time}
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColor(apt.status)}`}>{apt.status}</span>
                      </div>
                      <div className="flex gap-1">
                        {rx ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 transition-all duration-200 hover:scale-105"
                            onClick={() =>
                              navigate(rx?._id ? `/prescriptions/${rx._id}` : `/prescriptions/appointment/${apt.id}`)
                            }
                          >
                            <FileText className="h-3 w-3 mr-1" /> Prescription
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">No Rx</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default DoctorPatients;
