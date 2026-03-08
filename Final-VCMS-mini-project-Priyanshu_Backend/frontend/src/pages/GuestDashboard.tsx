import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Search, Clock, CalendarDays, Stethoscope, Grid, List, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "@/services/api";
import { formatLocation } from "@/utils/formatLocation";
import DoctorCard from "@/components/DoctorCard";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const SYMPTOM_CARDS = [
  { name: "Fever", icon: "🤒", desc: "High temperature & cold", keywords: ["fever", "cold", "cough"], gradient: "from-sky-400/90 to-blue-500/90", bgLight: "from-sky-50 to-blue-50" },
  { name: "Headache", icon: "🤕", desc: "Head pain & migraines", keywords: ["headache"], gradient: "from-cyan-400/90 to-sky-500/90", bgLight: "from-cyan-50 to-sky-50" },
  { name: "Chest Pain", icon: "💔", desc: "Heart & breathing issues", keywords: ["chest pain", "heart palpitations"], gradient: "from-blue-400/90 to-indigo-500/90", bgLight: "from-blue-50 to-indigo-50" },
  { name: "Skin Rash", icon: "🩹", desc: "Skin irritation & redness", keywords: ["skin rash", "eczema"], gradient: "from-teal-400/90 to-cyan-500/90", bgLight: "from-teal-50 to-cyan-50" },
  { name: "Joint Pain", icon: "🦴", desc: "Joint & knee discomfort", keywords: ["joint pain", "knee pain"], gradient: "from-sky-500/90 to-cyan-600/90", bgLight: "from-sky-50 to-cyan-50" },
  { name: "Back Pain", icon: "🔙", desc: "Spine & back issues", keywords: ["back pain"], gradient: "from-indigo-400/90 to-blue-600/90", bgLight: "from-indigo-50 to-blue-50" },
  { name: "Stomach Pain", icon: "🤢", desc: "Digestive discomfort", keywords: ["stomach pain"], gradient: "from-cyan-500/90 to-teal-600/90", bgLight: "from-cyan-50 to-teal-50" },
  { name: "Acne", icon: "😣", desc: "Facial skin problems", keywords: ["acne"], gradient: "from-sky-400/90 to-cyan-500/90", bgLight: "from-sky-50 to-cyan-50" },
  { name: "Hair Loss", icon: "💇", desc: "Hair thinning & baldness", keywords: ["hair loss"], gradient: "from-blue-400/90 to-sky-500/90", bgLight: "from-blue-50 to-sky-50" },
  { name: "High BP", icon: "❤️‍🩹", desc: "Blood pressure concerns", keywords: ["high blood pressure", "shortness of breath"], gradient: "from-cyan-400/90 to-blue-600/90", bgLight: "from-cyan-50 to-blue-50" },
];

const SYMPTOM_TO_SPECIALIZATION: Record<string, string[]> = {
  "fever": ["General Medicine", "Infectious Disease"],
  "headache": ["Neurology", "General Medicine"],
  "chest pain": ["Cardiology"],
  "skin rash": ["Dermatology"],
  "joint pain": ["Orthopedics", "Rheumatology"],
  "back pain": ["Orthopedics", "Physiotherapy"],
  "stomach pain": ["Gastroenterology", "General Medicine"],
  "acne": ["Dermatology"],
  "hair loss": ["Dermatology"],
  "high blood pressure": ["Cardiology"],
};

const GuestDashboard = () => {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [specializationsList, setSpecializationsList] = useState<string[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [filterSpec, setFilterSpec] = useState("none");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterName, setFilterName] = useState("");
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "table">("card"); // New: toggle between card and table view

  // Fetch doctors and specialization list from the public API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [doctorsRes, specsRes] = await Promise.all([
          api.get('/public/doctors', { params: { limit: 500 } }),
          api.get('/public/specializations'),
        ]);

        if (doctorsRes.data?.doctors) {
          setDoctors(doctorsRes.data.doctors);
        }

        if (specsRes.data?.specializations) {
          // backend returns objects with { specialization, count }
          const specs = specsRes.data.specializations
            .map((s: any) => s.specialization)
            .filter(Boolean);
          setSpecializationsList(specs);
        }
      } catch (err) {
        // Error fetching public data
      } finally {
        setLoadingDoctors(false);
      }
    };
    fetchData();
  }, []);

  // Refresh doctors list
  const handleRefreshDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const doctorsRes = await api.get('/public/doctors', { params: { limit: 500 } });
      if (doctorsRes.data?.doctors) {
        setDoctors(doctorsRes.data.doctors);
      }
    } catch (err) {
      // Error fetching data
    } finally {
      setLoadingDoctors(false);
    }
  };

  // memoize specialization list; prefer server-provided list if available
  const specializations = useMemo(() => {
    if (specializationsList.length > 0) {
      return specializationsList;
    }
    const specs = new Set(doctors.map((d) => d.specialization).filter(Boolean));
    return Array.from(specs) as string[];
  }, [doctors, specializationsList]);

  const nameSuggestions = useMemo(() => {
    if (!filterName.trim()) return [];
    const lower = filterName.toLowerCase();
    return doctors
      .filter((d) => (d.name || '').toLowerCase().startsWith(lower) || (d.name || '').toLowerCase().includes(lower))
      .filter((d) => d.name)
      .map((d) => `Dr. ${d.name}`)
      .slice(0, 5);
  }, [doctors, filterName]);

  // use shared utility so other components can reuse the logic
  const locationToString = (loc: any): string => formatLocation(loc);

  const filteredDoctors = useMemo(() => {
    // specialization filtering enabled any time spec is provided and not 'none';
    // 'all' means "do not filter by spec" but it should count as an active filter
    const hasSpecFilter = filterSpec && filterSpec !== 'none' && filterSpec !== 'all';
    const wantsAll = filterSpec === 'all';
    const hasFilters = selectedSymptoms.length > 0 || wantsAll || hasSpecFilter || filterLocation || filterName.trim();
    if (!hasFilters) {
      // nothing selected: show prompt rather than doctors
      return [];
    }

    return doctors.filter((doc) => {
      // If symptoms are selected, doctor must match at least one symptom
      if (selectedSymptoms.length > 0) {
        const matchesSymptom = selectedSymptoms.some((symptom) => {
          const requiredSpecializations = SYMPTOM_TO_SPECIALIZATION[symptom.toLowerCase()] || [];
          return requiredSpecializations.some((spec) =>
            doc.specialization?.toLowerCase().includes(spec.toLowerCase())
          );
        });
        if (!matchesSymptom) return false;
      }
      if (hasSpecFilter && doc.specialization !== filterSpec) return false;
      if (filterLocation) {
        const locStr = locationToString(doc.location).toLowerCase();
        if (!locStr.includes(filterLocation.toLowerCase())) return false;
      }
      if (filterName) {
        const name = (doc.name || '').toLowerCase();
        if (!name.includes(filterName.toLowerCase().replace("dr. ", ""))) return false;
      }
      return true;
    });
  }, [doctors, filterSpec, filterLocation, filterName, selectedSymptoms]);

  const getDayNameStr = (dateStr: string) => {
    const d = new Date(dateStr);
    return DAYS[d.getDay()];
  };

  // determine if any filter criteria are active (used for messaging)
  const hasFilters =
    selectedSymptoms.length > 0 ||
    filterSpec === 'all' ||
    (filterSpec && filterSpec !== 'none' && filterSpec !== 'all') ||
    filterLocation ||
    filterName.trim();

  return (
    <div className="min-h-screen bg-white">
      {/* Page uses global header from Layout; remove duplicate fixed header */}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto mt-16 px-4 md:px-8 pb-8 space-y-6">

        {/* ── Hero Header ─────────────────────────────────────────────── */}
        <div className="rounded-xl overflow-hidden bg-sky-500 border border-sky-300 shadow-md text-white">
          <div className="px-6 py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-white/90 uppercase tracking-widest flex items-center gap-2">
                <Search className="h-4 w-4" /> Guest Portal
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Find Your Doctor</h1>
              <p className="text-sky-100 text-sm">Browse doctors and check availability before booking.</p>
            </div>
          </div>
        </div>

        {/* Symptoms Quick Select */}
        <Card className="mb-8 border-slate-200 shadow-sm hover:shadow-md transition-shadow bg-white">
          <CardHeader className="bg-white border-b border-slate-200">
            <CardTitle className="text-slate-900 text-xl">🏥 Select Your Symptoms (Multiple allowed)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {SYMPTOM_CARDS.map((symptom) => {
                const active = selectedSymptoms.includes(symptom.name);
                return (
                  <button
                    key={symptom.name}
                    onClick={() =>
                      setSelectedSymptoms((prev) =>
                        prev.includes(symptom.name)
                          ? prev.filter((s) => s !== symptom.name)
                          : [...prev, symptom.name]
                      )
                    }
                    className={`group relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-300 ${
                      active
                        ? `bg-gradient-to-br ${symptom.gradient} border-white/40 text-white shadow-xl scale-105`
                        : `bg-gradient-to-br ${symptom.bgLight} border-sky-200/60 hover:border-sky-400/80 hover:scale-105 hover:shadow-lg`
                    }`}
                  >
                    <div className={`text-3xl mb-1.5 transition-transform duration-300 ${
                      active ? "scale-110" : "group-hover:scale-110"
                    }`}>
                      {symptom.icon}
                    </div>
                    <span className={`text-xs font-bold text-center leading-tight mb-0.5 ${
                      active ? "text-white" : "text-slate-800 group-hover:text-sky-700"
                    }`}>
                      {symptom.name}
                    </span>
                    <span className={`text-[10px] text-center leading-tight ${
                      active ? "text-white/90" : "text-slate-600 group-hover:text-sky-600"
                    }`}>
                      {symptom.desc}
                    </span>
                    {active && (
                      <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-white flex items-center justify-center shadow-md">
                        <span className="text-sky-600 text-xs font-bold">✓</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Doctor Search */}
        <Card className="mb-8 border-slate-200 shadow-sm hover:shadow-md transition-shadow bg-white">
          <CardHeader className="bg-white border-b border-slate-200">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-900 text-xl flex items-center gap-2">
                <Search className="h-5 w-5 text-sky-600" /> Search & Filter Doctors
              </CardTitle>
              <div className="flex items-center gap-2">
                {(filterSpec !== "none" || filterLocation.trim() || filterName.trim() || selectedSymptoms.length > 0) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFilterSpec("none");
                      setFilterLocation("");
                      setFilterName("");
                      setSelectedSymptoms([]);
                    }}
                    className="text-red-700 border-red-300 bg-red-50 hover:bg-red-100"
                  >
                    Clear Filters
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleRefreshDoctors}
                  disabled={loadingDoctors}
                  className="gap-2 bg-sky-500 hover:bg-sky-600 text-white"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingDoctors ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label className="text-slate-700 font-semibold mb-2 block">Specialization</Label>
                <select
                  value={filterSpec}
                  onChange={(e) => setFilterSpec(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:border-sky-500 focus:outline-none transition-all text-slate-900"
                >
                  <option value="none">None</option>
                  <option value="all">All Specializations</option>
                  {specializations.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-slate-700 font-semibold mb-2 block">Location</Label>
                <Input
                  placeholder="Search location..."
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="border-2 border-slate-200 focus:border-sky-500 text-slate-900"
                />
              </div>
              <div>
                <Label className="text-slate-700 font-semibold mb-2 block">Doctor Name</Label>
                <div className="relative">
                  <Input
                    placeholder="Dr. ..."
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    onFocus={() => setShowNameSuggestions(true)}
                    className="border-2 border-slate-200 focus:border-sky-500 text-slate-900"
                  />
                  {showNameSuggestions && nameSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-slate-200 rounded-lg shadow-lg z-10">
                      {nameSuggestions.map((name) => (
                        <div
                          key={name}
                          onClick={() => {
                            setFilterName(name.replace("Dr. ", ""));
                            setShowNameSuggestions(false);
                          }}
                          className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer text-slate-900 transition-colors font-medium"
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Doctors List */}
        <div className="grid gap-6">
          {filteredDoctors.length > 0 && (
            <div className="flex justify-between items-center">
              <p className="text-slate-900 font-semibold">Found {filteredDoctors.length} doctor{filteredDoctors.length !== 1 ? 's' : ''}</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setViewMode("card")}
                  className={`gap-2 ${viewMode === "card" ? "bg-sky-500 text-white hover:bg-sky-600" : "bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                >
                  <Grid className="h-4 w-4" /> Card View
                </Button>
                <Button
                  onClick={() => setViewMode("table")}
                  className={`gap-2 ${viewMode === "table" ? "bg-sky-500 text-white hover:bg-sky-600" : "bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                >
                  <List className="h-4 w-4" /> Table View
                </Button>
              </div>
            </div>
          )}
          {loadingDoctors ? (
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardContent className="pt-12 text-center">
                <p className="text-slate-900 text-lg font-medium">Loading doctors...</p>
              </CardContent>
            </Card>
          ) : filteredDoctors.length === 0 ? (
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardContent className="pt-12 text-center">
                <Stethoscope className="h-12 w-12 text-slate-400 mx-auto mb-4 opacity-50" />
                {doctors.length === 0 ? (
                  <>
                    <p className="text-foreground text-lg font-medium">No doctors are available right now.</p>
                    <p className="text-muted-foreground text-sm mt-2">
                      The public database may be empty or unreachable. Verify your backend connection and seed data.
                    </p>
                  </>
                ) : !hasFilters ? (
                  <>
                    <p className="text-slate-900 text-lg font-medium">Select symptoms or apply filters to see doctors.</p>
                    <p className="text-slate-600 text-sm mt-2">Start by picking a symptom or entering a location/name.</p>
                  </>
                ) : (
                  <>
                    <p className="text-slate-900 text-lg font-medium">No doctors found matching your criteria.</p>
                    <p className="text-slate-600 text-sm mt-2">Try adjusting your filters or symptoms.</p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {viewMode === "card" ? (
                // CARD VIEW - Using DoctorCard Component
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredDoctors.map((doc) => (
                    <DoctorCard
                      key={doc._id}
                      doctor={doc}
                      onBookClick={() => navigate("/login")}
                    />
                  ))}
                </div>
              ) : (
                // TABLE VIEW
                <Card className="border-slate-200 shadow-sm overflow-auto bg-white">
                  <CardContent className="pt-6 px-0">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1080px]">
                        <thead>
                          <tr className="border-b-2 border-slate-200 bg-slate-50">
                            <th className="text-left px-4 py-3 font-semibold text-slate-900">Doctor Name</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-900">Specialization</th>
                            <th className="text-center px-4 py-3 font-semibold text-slate-900">Experience</th>
                            <th className="text-center px-4 py-3 font-semibold text-slate-900">Fee</th>
                            <th className="text-left px-4 py-3 font-semibold text-slate-900">Location</th>
                            <th className="text-center px-4 py-3 font-semibold text-slate-900">Availability</th>
                            <th className="text-center px-4 py-3 font-semibold text-slate-900">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDoctors.map((doc, idx) => (
                            <tr key={doc._id} className={`border-b border-slate-200 hover:bg-slate-100/60 transition-all duration-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded bg-sky-500 flex items-center justify-center text-white font-semibold text-sm">
                                    {doc.name ? doc.name.charAt(0) : "D"}
                                  </div>
                                  <span className="font-medium text-slate-900">Dr. {doc.name || 'Unknown'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-block bg-slate-100 text-slate-900 px-2 py-1 rounded text-xs font-semibold border border-slate-200">
                                  {doc.specialization || 'N/A'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-slate-900 font-medium">
                                {doc.experience || 0} yrs
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="font-bold text-slate-900">₹{doc.consultationFee || 500}</span>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">
                                {formatLocation(doc.location) || "Not specified"}
                              </td>
                              <td className="px-4 py-3 text-center text-xs">
                                {doc.availability && doc.availability.length > 0 ? (
                                  <span className="text-slate-900 font-semibold">
                                    {doc.availability.length} slot{doc.availability.length !== 1 ? 's' : ''}
                                  </span>
                                ) : (
                                  <span className="text-slate-600">None</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Button
                                  onClick={() => navigate("/login")}
                                  size="sm"
                                  className="h-9 rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-semibold shadow-sm transition-all duration-200 hover:scale-105"
                                >
                                  Book Now
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-16 mb-8 border-t border-slate-200 pt-8">
          <div className="text-center space-y-4">
            <h3 className="text-xl font-bold text-slate-900">Ready to Get Started?</h3>
            <p className="text-slate-600">Create an account to book your appointment with ease</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => navigate("/register")}
                className="bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold px-6"
              >
                Create Account
              </Button>
              <Button
                onClick={() => navigate("/login")}
                className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:from-sky-600 hover:to-cyan-600 font-semibold px-6"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestDashboard;
