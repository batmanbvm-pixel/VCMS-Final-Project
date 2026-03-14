import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useSocket } from "@/hooks/useSocket";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CalendarDays, Clock, FileText, Activity, IndianRupee, Stethoscope, 
  MapPin, Search, Video, Grid, List, Calendar as CalendarIcon, CheckCircle, XCircle, AlertCircle,
  ClipboardList, ScanLine, Pill, ChevronRight, Sparkles, X, Trash2, Star, RefreshCw, UserRound, type LucideIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import api from "@/services/api";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatLocation } from "@/utils/formatLocation";
import { format } from "date-fns";
import DoctorCard from "@/components/DoctorCard";
import RateButton from "@/components/RateButton";

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
  "high bp": ["Cardiology"],
  "shortness of breath": ["Cardiology", "Pulmonology"],
};

const formatDoctorDisplayName = (name?: string) => {
  const clean = String(name || "Doctor").replace(/^dr\.?\s*/i, "").trim();
  return `Dr. ${clean || "Doctor"}`;
};

const SPECIALIZATION_EQUIVALENTS: Record<string, string[]> = {
  "cardiology": ["cardiologist", "heart specialist"],
  "dermatology": ["dermatologist", "skin specialist"],
  "orthopedics": ["orthopedic", "orthopaedic", "orthopedist"],
  "neurology": ["neurologist"],
  "gastroenterology": ["gastroenterologist"],
  "physiotherapy": ["physiotherapist"],
  "general medicine": ["general physician", "physician", "internal medicine"],
  "infectious disease": ["infectious diseases"],
  "rheumatology": ["rheumatologist"],
  "pulmonology": ["pulmonologist", "chest physician"],
};

const normalizeText = (v: string) => String(v || "").trim().toLowerCase();

const specializationMatches = (doctorSpecialization: string, requiredSpecialization: string) => {
  const docSpec = normalizeText(doctorSpecialization);
  const reqSpec = normalizeText(requiredSpecialization);
  if (!docSpec || !reqSpec) return false;

  if (docSpec.includes(reqSpec) || reqSpec.includes(docSpec)) return true;

  const aliases = SPECIALIZATION_EQUIVALENTS[reqSpec] || [];
  return aliases.some((alias) => docSpec.includes(normalizeText(alias)) || normalizeText(alias).includes(docSpec));
};

type FamilyRiskAnswer = "yes" | "no" | "unknown";
type FamilyRiskDiseaseKey =
  | "cancer"
  | "heart-disease"
  | "diabetes"
  | "stroke"
  | "hypertension"
  | "asthma"
  | "kidney-disease";

type FamilyRiskQuestion = {
  key: string;
  label: string;
  weight: number;
};

type ActiveFamilyRiskQuestion = FamilyRiskQuestion & {
  id: string;
  diseaseKey: FamilyRiskDiseaseKey;
  diseaseLabel: string;
};

const FAMILY_RISK_DISEASES: { key: FamilyRiskDiseaseKey; label: string; helper: string }[] = [
  { key: "cancer", label: "Cancer", helper: "Family cancer pattern" },
  { key: "heart-disease", label: "Heart Disease", helper: "Cardiac family risk" },
  { key: "diabetes", label: "Diabetes", helper: "Sugar/metabolic trend" },
  { key: "stroke", label: "Stroke", helper: "Neuro-vascular family trend" },
  { key: "hypertension", label: "Hypertension", helper: "Blood pressure tendency" },
  { key: "asthma", label: "Asthma", helper: "Respiratory allergy pattern" },
  { key: "kidney-disease", label: "Kidney Disease", helper: "Renal family risk" },
];

const FAMILY_RISK_QUESTIONS: Record<FamilyRiskDiseaseKey, FamilyRiskQuestion[]> = {
  "cancer": [
    { key: "father", label: "Father diagnosed with cancer", weight: 22 },
    { key: "mother", label: "Mother diagnosed with cancer", weight: 22 },
    { key: "grandfather", label: "Any grandfather diagnosed with cancer", weight: 16 },
    { key: "grandmother", label: "Any grandmother diagnosed with cancer", weight: 14 },
    { key: "sibling", label: "Brother/Sister diagnosed with cancer", weight: 20 },
    { key: "lifestyle", label: "High-risk lifestyle factors present (tobacco, alcohol, inactivity)", weight: 10 },
    { key: "screening", label: "No regular preventive screening done", weight: 8 },
  ],
  "heart-disease": [
    { key: "father", label: "Father diagnosed with heart disease", weight: 24 },
    { key: "mother", label: "Mother diagnosed with heart disease", weight: 24 },
    { key: "grandfather", label: "Any grandfather had heart attack/stroke", weight: 14 },
    { key: "grandmother", label: "Any grandmother had heart disease", weight: 12 },
    { key: "sibling", label: "Brother/Sister diagnosed with heart disease", weight: 16 },
    { key: "bp", label: "You have high BP/high cholesterol", weight: 12 },
    { key: "activity", label: "Low physical activity/regular smoking", weight: 10 },
  ],
  "diabetes": [
    { key: "father", label: "Father diagnosed with diabetes", weight: 24 },
    { key: "mother", label: "Mother diagnosed with diabetes", weight: 24 },
    { key: "grandfather", label: "Any grandfather diagnosed with diabetes", weight: 14 },
    { key: "grandmother", label: "Any grandmother diagnosed with diabetes", weight: 14 },
    { key: "sibling", label: "Brother/Sister diagnosed with diabetes", weight: 16 },
    { key: "weight", label: "Overweight or central obesity", weight: 10 },
    { key: "activity", label: "Low activity and high-sugar diet", weight: 8 },
  ],
  "stroke": [
    { key: "father", label: "Father had stroke/TIA", weight: 22 },
    { key: "mother", label: "Mother had stroke/TIA", weight: 22 },
    { key: "grandfather", label: "Any grandfather had stroke", weight: 14 },
    { key: "grandmother", label: "Any grandmother had stroke", weight: 14 },
    { key: "sibling", label: "Brother/Sister had stroke", weight: 16 },
    { key: "bp", label: "You have high BP/atrial fibrillation", weight: 14 },
    { key: "smoking", label: "Smoking/alcohol/sedentary routine", weight: 10 },
  ],
  "hypertension": [
    { key: "father", label: "Father diagnosed with high BP", weight: 24 },
    { key: "mother", label: "Mother diagnosed with high BP", weight: 24 },
    { key: "grandfather", label: "Any grandfather had high BP", weight: 14 },
    { key: "grandmother", label: "Any grandmother had high BP", weight: 14 },
    { key: "sibling", label: "Brother/Sister diagnosed with high BP", weight: 14 },
    { key: "salt", label: "High salt diet and stress", weight: 10 },
    { key: "activity", label: "Low daily physical activity", weight: 10 },
  ],
  "asthma": [
    { key: "father", label: "Father has asthma/allergic airway disease", weight: 20 },
    { key: "mother", label: "Mother has asthma/allergic airway disease", weight: 20 },
    { key: "grandparent", label: "Any grandparent had asthma/allergies", weight: 16 },
    { key: "sibling", label: "Brother/Sister has asthma", weight: 18 },
    { key: "allergy", label: "You have chronic allergy/sinus symptoms", weight: 14 },
    { key: "smoke", label: "Exposure to smoke/pollution at home/work", weight: 12 },
    { key: "pet", label: "Frequent trigger exposure (dust, pet dander)", weight: 10 },
  ],
  "kidney-disease": [
    { key: "father", label: "Father diagnosed with kidney disease", weight: 22 },
    { key: "mother", label: "Mother diagnosed with kidney disease", weight: 22 },
    { key: "grandparent", label: "Any grandparent had kidney disease", weight: 14 },
    { key: "sibling", label: "Brother/Sister diagnosed with kidney disease", weight: 16 },
    { key: "diabetes", label: "You have diabetes/pre-diabetes", weight: 14 },
    { key: "bp", label: "You have long-term high BP", weight: 12 },
    { key: "hydration", label: "Poor hydration/high painkiller use", weight: 10 },
  ],
};

const RISK_OPTION_LABELS: { key: FamilyRiskAnswer; label: string }[] = [
  { key: "yes", label: "Yes" },
  { key: "no", label: "No" },
  { key: "unknown", label: "Not Sure" },
];

const PatientDashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect if not authenticated or not a patient
  useEffect(() => {
    if (!isAuthenticated || !user || user.role !== "patient") {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);
  const { appointments, bookAppointment, getPrescriptionByAppointment, cancelAppointment, clearCancelledAppointments, isSlotBooked, fetchAppointments } = useClinic();
  const { socket } = useSocket();
  const { toast } = useToast();

  // Doctors state
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [specializationsList, setSpecializationsList] = useState<string[]>([]);

  // Filter & search state
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [filterSpec, setFilterSpec] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterName, setFilterName] = useState("");
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  // Booking state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [bookDate, setBookDate] = useState<Date | undefined>();
  const [bookTime, setBookTime] = useState("");

  // Appointments tab
  const [appointmentTab, setAppointmentTab] = useState<"all" | "accepted" | "upcoming" | "past" | "cancelled">("all");

  // Cancel confirmation dialog
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<string | null>(null);
  const [showClearCancelledDialog, setShowClearCancelledDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewAppointment, setReviewAppointment] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showFamilyRiskDialog, setShowFamilyRiskDialog] = useState(false);
  const [refreshingAppointments, setRefreshingAppointments] = useState(false);
  const [doctorWaitingByAppointment, setDoctorWaitingByAppointment] = useState<Record<string, { doctorName: string; updatedAt: number }>>({});
  const waitingToastRef = useRef<Set<string>>(new Set());
  const waitingStorageKey = useMemo(() => `doctor_waiting_${user?._id || "guest"}`, [user?._id]);

  const persistDoctorWaiting = useCallback((value: Record<string, { doctorName: string; updatedAt: number }>) => {
    if (!user?._id) return;
    try {
      localStorage.setItem(waitingStorageKey, JSON.stringify(value));
    } catch {
      // ignore storage write errors
    }
  }, [user?._id, waitingStorageKey]);

  // Family Health Tree (frontend-only risk estimator)
  const [selectedRiskDiseases, setSelectedRiskDiseases] = useState<FamilyRiskDiseaseKey[]>(["cancer"]);
  const [familyRiskAnswers, setFamilyRiskAnswers] = useState<Record<string, FamilyRiskAnswer>>({});

  // My appointments filtered
  const myAppointments = appointments.filter((a) => a.patientId === user?._id);
  const todayDate = new Date().toISOString().split("T")[0];
  const normalizeStatus = (status?: string) => String(status || "").toLowerCase();
  const isJoinEnabledStatus = (status?: string) => ["accepted", "in progress", "in-progress"].includes(normalizeStatus(status));
  const isBookedStatus = (status?: string) => normalizeStatus(status) === "booked";

  const allAppointments = myAppointments;
  const acceptedAppointments = myAppointments.filter((a) => isJoinEnabledStatus(a.status));
  const upcomingAppointments = myAppointments.filter((a) => a.date > todayDate && isBookedStatus(a.status));
  const pastAppointments = myAppointments.filter((a) => a.status === "Completed");
  const cancelledAppointments = myAppointments.filter((a) => a.status === "Cancelled");
  const currentTabAppointments = appointmentTab === "all"
    ? allAppointments
    : appointmentTab === "accepted"
      ? acceptedAppointments
    : appointmentTab === "upcoming"
      ? upcomingAppointments
      : appointmentTab === "past"
        ? pastAppointments
        : cancelledAppointments;
  const APPOINTMENTS_PREVIEW_LIMIT = 6;
  const previewAppointments = currentTabAppointments.slice(0, APPOINTMENTS_PREVIEW_LIMIT);
  const doctorWaitingAppointmentIds = Object.keys(doctorWaitingByAppointment).filter((id) => !!doctorWaitingByAppointment[id]);
  const doctorWaitingCount = doctorWaitingAppointmentIds.length;
  const firstWaitingAppointmentId = doctorWaitingAppointmentIds[0] || "";
  const waitingDoctorPrimaryName = doctorWaitingByAppointment[firstWaitingAppointmentId]?.doctorName || "Doctor";
  const acceptedAppointmentIdSet = new Set(acceptedAppointments.map((apt: any) => String(apt._id || apt.id || "")).filter(Boolean));
  const combinedAppointmentAttentionCount = new Set([
    ...Array.from(acceptedAppointmentIdSet),
    ...doctorWaitingAppointmentIds,
  ]).size;

  // Auto-fetch appointments on mount
  useEffect(() => {
    fetchAppointments();
  }, []);

  // Restore live waiting signals after refresh (source of truth = socket waiting events)
  useEffect(() => {
    if (!user?._id) return;
    try {
      const raw = localStorage.getItem(waitingStorageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object") {
        const now = Date.now();
        const maxAgeMs = 2 * 60 * 60 * 1000; // 2 hours
        const filtered: Record<string, { doctorName: string; updatedAt: number }> = {};
        Object.entries(parsed as Record<string, { doctorName?: string; updatedAt?: number }>).forEach(([appointmentId, value]) => {
          const updatedAt = Number(value?.updatedAt || 0);
          if (updatedAt > 0 && now - updatedAt <= maxAgeMs) {
            filtered[appointmentId] = {
              doctorName: String(value?.doctorName || "Doctor"),
              updatedAt,
            };
          }
        });

        setDoctorWaitingByAppointment(filtered);
        waitingToastRef.current = new Set(Object.keys(filtered));
        persistDoctorWaiting(filtered);
      }
    } catch {
      // ignore storage read errors
    }
  }, [user?._id, waitingStorageKey, persistDoctorWaiting]);

  // Remove stale waiting entries when appointment is completed/cancelled/rejected
  useEffect(() => {
    setDoctorWaitingByAppointment((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach((appointmentId) => {
        const apt = myAppointments.find((a: any) => String(a._id || a.id || "") === appointmentId);
        if (!apt) {
          delete next[appointmentId];
          waitingToastRef.current.delete(appointmentId);
          changed = true;
          return;
        }
        const status = String(apt.status || "").toLowerCase();
        if (["completed", "cancelled", "rejected"].includes(status)) {
          delete next[appointmentId];
          waitingToastRef.current.delete(appointmentId);
          changed = true;
        }
      });
      if (changed) persistDoctorWaiting(next);
      return changed ? next : prev;
    });
  }, [myAppointments, persistDoctorWaiting]);

  // Real-time socket updates for appointments
  useEffect(() => {
    if (!socket || !user) return;

    const handleStatusChanged = (data: any) => {
      fetchAppointments(); // Refresh appointments list

      const appointmentId = String(data?.appointmentId || "");
      const normalizedIncomingStatus = String(data?.status || "").toLowerCase();
      if (appointmentId && ["completed", "cancelled", "rejected"].includes(normalizedIncomingStatus)) {
        setDoctorWaitingByAppointment((prev) => {
          if (!prev[appointmentId]) return prev;
          const next = { ...prev };
          delete next[appointmentId];
          persistDoctorWaiting(next);
          return next;
        });
        waitingToastRef.current.delete(appointmentId);
      }
      
      // Show toast notification for important status changes
      if (data.status === "accepted" || data.status === "Accepted") {
        toast({
          title: "Appointment Accepted!",
          description: "Doctor has accepted your appointment. Please wait for doctor to start the consultation.",
        });
      } else if (data.status === "in-progress" || data.status === "In Progress") {
        toast({
          title: "Doctor is ready!",
          description: "Your consultation is starting. Join the video call now.",
        });
      } else if (data.status === "completed" || data.status === "Completed") {
        toast({
          title: "Consultation Completed",
          description: "Your consultation has been completed. Check your prescriptions.",
        });
      }
    };

    const handleAppointmentUpdate = () => {
      fetchAppointments();
    };

    const handleVideoWaitingStatus = (data: any) => {
      const appointmentId = String(data?.appointmentId || "");
      if (!appointmentId) return;

      const role = String(data?.role || "").toLowerCase();
      const waiting = !!data?.waiting;

      // Patient dashboard only reacts to doctor waiting signal
      if (role !== "doctor") return;

      const fallbackDoctorName = myAppointments.find((apt: any) => String(apt._id || apt.id || "") === appointmentId)?.doctorName;
      const doctorName = String(data?.fromName || data?.doctorName || fallbackDoctorName || "Doctor");

      setDoctorWaitingByAppointment((prev) => {
        if (waiting) {
          const next = {
            ...prev,
            [appointmentId]: {
              doctorName,
              updatedAt: Date.now(),
            },
          };
          persistDoctorWaiting(next);
          return next;
        }
        if (!prev[appointmentId]) return prev;
        const next = { ...prev };
        delete next[appointmentId];
        persistDoctorWaiting(next);
        return next;
      });

      if (waiting && !waitingToastRef.current.has(appointmentId)) {
        waitingToastRef.current.add(appointmentId);
        toast({
          title: "Doctor is waiting",
          description: `${doctorDisplayName(doctorName)} started the video call. Join now.`,
        });
      }

      if (!waiting) {
        waitingToastRef.current.delete(appointmentId);
      }
    };

    socket.on("appointment-status-changed", handleStatusChanged);
    socket.on("appointment:status-changed", handleStatusChanged);
    socket.on("appointment:updated", handleAppointmentUpdate);
    socket.on("appointment:accepted", handleAppointmentUpdate);
    socket.on("appointment:rejected", handleAppointmentUpdate);
    socket.on("video:waiting-status", handleVideoWaitingStatus);

    return () => {
      socket.off("appointment-status-changed", handleStatusChanged);
      socket.off("appointment:status-changed", handleStatusChanged);
      socket.off("appointment:updated", handleAppointmentUpdate);
      socket.off("appointment:accepted", handleAppointmentUpdate);
      socket.off("appointment:rejected", handleAppointmentUpdate);
      socket.off("video:waiting-status", handleVideoWaitingStatus);
    };
  }, [socket, user, fetchAppointments, toast, myAppointments, persistDoctorWaiting]);

  const loadDoctors = useCallback(async (showErrorToast = true) => {
    setLoadingDoctors(true);
    try {
      const [doctorsRes, specsRes] = await Promise.all([
        api.get('/public/doctors', { params: { limit: 500 } }),
        api.get('/public/specializations'),
      ]);

      if (doctorsRes.data?.doctors) {
        setDoctors(doctorsRes.data.doctors);
      }

      if (specsRes.data?.specializations) {
        const specs = specsRes.data.specializations
          .map((s: any) => s.specialization)
          .filter(Boolean);
        setSpecializationsList(specs);
      }
    } catch (err) {
      if (showErrorToast) {
        toast({
          title: "Error",
          description: "Failed to load doctors. Please refresh the page.",
          variant: "destructive",
        });
      }
    } finally {
      setLoadingDoctors(false);
    }
  }, [toast]);

  const handleAppointmentsRefresh = async () => {
    if (refreshingAppointments) return;
    setRefreshingAppointments(true);
    try {
      await Promise.all([
        loadDoctors(false),
        Promise.resolve(fetchAppointments()),
      ]);
      toast({
        title: "Refreshed",
        description: "Appointments and doctors list updated.",
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshingAppointments(false);
    }
  };

  // Fetch doctors and specializations on mount + auto-refresh every 20 seconds
  useEffect(() => {
    loadDoctors();

    // Auto-refresh doctors list every 20 seconds
    const refreshInterval = window.setInterval(() => {
      loadDoctors(false); // silent refresh
    }, 20000);

    // Also refresh when tab becomes visible
    const handleVisibilityRefresh = () => {
      if (!document.hidden) {
        loadDoctors(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    return () => {
      window.clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    };
  }, [loadDoctors]);

  // Specializations list from server
  const specializations = useMemo(() => {
    if (specializationsList.length > 0) return specializationsList;
    const specs = new Set(doctors.map((d) => d.specialization).filter(Boolean));
    return Array.from(specs) as string[];
  }, [doctors, specializationsList]);

  // Name autocomplete suggestions
  const nameSuggestions = useMemo(() => {
    if (!filterName.trim()) return [];
    const lower = filterName.toLowerCase();
    return doctors
      .filter((d) => (d.name || '').toLowerCase().includes(lower))
      .map((d) => `Dr. ${d.name}`)
      .slice(0, 5);
  }, [doctors, filterName]);

  // Filter doctors
  const filteredDoctors = useMemo(() => {
    // "*" means user explicitly clicked "All" — show all doctors
    const allSpecsSelected = filterSpec === "*";
    // If no filters at all, show empty prompt (but filterSpec="*" is still a filter)
    if (selectedSymptoms.length === 0 && !filterName.trim() && !filterSpec && !filterLocation.trim()) {
      return [];
    }
    // If only filterSpec="*" is selected (all specializations), show all doctors
    if (allSpecsSelected && selectedSymptoms.length === 0 && !filterName.trim() && !filterLocation.trim()) {
      return doctors;
    }

    return doctors.filter((doc) => {
      // Symptom filter
      if (selectedSymptoms.length > 0) {
        const matchesSymptom = selectedSymptoms.some((symptomName) => {
          const card = SYMPTOM_CARDS.find((c) => c.name === symptomName);
          if (!card) return false;
          const specs = card.keywords.reduce((acc: string[], kw) => {
            const relatedSpecs = SYMPTOM_TO_SPECIALIZATION[kw.toLowerCase()] || [];
            return [...acc, ...relatedSpecs];
          }, []);
          // Fallback: if symptom name itself exists as a key, include those specs too
          const symptomSpecs = SYMPTOM_TO_SPECIALIZATION[symptomName.toLowerCase()] || [];
          const allSpecs = [...new Set([...specs, ...symptomSpecs])];
          return allSpecs.some((sp) => specializationMatches(doc.specialization || "", sp));
        });
        if (!matchesSymptom) return false;
      }

      // Name filter
      if (filterName.trim()) {
        const searchName = filterName.replace(/^Dr\.\s*/i, "").trim().toLowerCase();
        if (!doc.name?.toLowerCase().includes(searchName)) return false;
      }

      // Specialization filter — "*" = all, anything else = exact match
      if (filterSpec && !allSpecsSelected) {
        if (doc.specialization !== filterSpec) return false;
      }

      // Location filter
      if (filterLocation.trim()) {
        const loc = doc.location?.toLowerCase() || "";
        if (!loc.includes(filterLocation.toLowerCase())) return false;
      }

      return true;
    });
  }, [doctors, selectedSymptoms, filterName, filterSpec, filterLocation]);

  // Handle symptom card click - toggle symptom
  const handleSymptomClick = (symptom: string) => {
    setSelectedSymptoms((prev) => {
      if (prev.includes(symptom)) {
        return prev.filter((s) => s !== symptom);
      } else {
        return [...prev, symptom];
      }
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedSymptoms([]);
    setFilterName("");
    setFilterSpec("");
    setFilterLocation("");
  };

  // Open booking modal
  const openBooking = (doctor: any) => {
    setSelectedDoctor(doctor);
    setBookDate(undefined);
    setBookTime("");
    setShowBookingModal(true);
  };

  // Check if day is available
  const isDayAvailable = (date: Date) => {
    if (!selectedDoctor) return false;
    const dayName = DAYS[date.getDay()];
    return selectedDoctor.availability?.some((av: any) => av.day === dayName) || false;
  };

  // Generate time slots from start/end time (30-minute intervals)
  const generateTimeSlots = (startTime: string, endTime: string): string[] => {
    const slots: string[] = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    let currentHour = startHour;
    let currentMin = startMin;
    
    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      slots.push(timeStr);
      
      // Add 30 minutes
      currentMin += 30;
      if (currentMin >= 60) {
        currentMin = 0;
        currentHour += 1;
      }
    }
    
    return slots;
  };

  // Get available time slots for selected date
  const availableTimeSlots = useMemo(() => {
    if (!selectedDoctor || !bookDate) return [];
    const dayName = DAYS[bookDate.getDay()];
    const dayAvail = selectedDoctor.availability?.find((av: any) => av.day === dayName);
    
    if (!dayAvail) return [];
    
    // If slots array exists (old format), use it
    if (dayAvail.slots && Array.isArray(dayAvail.slots)) {
      return dayAvail.slots;
    }
    
    // Otherwise generate slots from startTime/endTime
    if (dayAvail.startTime && dayAvail.endTime) {
      return generateTimeSlots(dayAvail.startTime, dayAvail.endTime);
    }
    
    return [];
  }, [selectedDoctor, bookDate]);

  // Confirm booking
  const handleConfirmBooking = async () => {
    if (!user || !selectedDoctor || !bookDate || !bookTime) {
      toast({
        title: "Error",
        description: "Please select date and time",
        variant: "destructive",
      });
      return;
    }

    const dateStr = format(bookDate, "yyyy-MM-dd");
    
    // Check if slot is already booked
    const slotTaken = isSlotBooked(selectedDoctor._id, dateStr, bookTime);
    if (slotTaken) {
      toast({
        title: "Slot Unavailable",
        description: "This time slot is already booked. Please choose another.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await bookAppointment({
        patientId: user._id,
        patientName: user.name,
        patientAge: user.age || 25,
        patientMedicalHistory: user.medicalHistory || "",
        doctorId: selectedDoctor._id,
        doctorName: formatDoctorDisplayName(selectedDoctor.name),
        specialization: selectedDoctor.specialization || "",
        location: selectedDoctor.location || "",
        date: dateStr,
        time: bookTime,
        consultationFee: selectedDoctor.consultationFee || 500,
      });

      if (result.success) {
        toast({
          title: "Success!",
          description: "Appointment booked successfully. The doctor will confirm shortly.",
        });
        setShowBookingModal(false);
        setSelectedDoctor(null);
      } else {
        toast({
          title: "Booking Failed",
          description: result.message || "Unable to book appointment",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to book appointment. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Show cancel confirmation dialog
  const handleCancelClick = (appointmentId: string) => {
    setAppointmentToCancel(appointmentId);
    setShowCancelDialog(true);
  };

  // Cancel appointment
  const handleCancelAppointment = async () => {
    if (!appointmentToCancel) return;

    try {
      const result = await cancelAppointment(appointmentToCancel);
      if (result.success) {
        toast({
          title: "Cancelled",
          description: "Appointment cancelled successfully",
        });
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to cancel appointment",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel appointment",
        variant: "destructive",
      });
    }
  };

  const handleClearCancelledAppointments = async () => {
    try {
      const result = await clearCancelledAppointments();
      if (result.success) {
        toast({
          title: "Cancelled history cleared",
          description: result.message,
        });
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to clear cancelled appointments",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear cancelled appointments",
        variant: "destructive",
      });
    }
  };

  const openReviewDialog = (appointment: any) => {
    setReviewAppointment(appointment);
    setReviewRating(5);
    setReviewComment("");
    setShowReviewDialog(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewAppointment?._id || !reviewAppointment?.doctorId) return;

    try {
      setSubmittingReview(true);
      const doctorId = String(reviewAppointment.doctorId);
      const result = await api.post('/public/reviews', {
        appointmentId: reviewAppointment._id,
        doctorId,
        rating: reviewRating,
        comment: reviewComment,
      });

      if (result.data?.success) {
        toast({ title: "Thank you!", description: "Your rating was submitted successfully." });
        setShowReviewDialog(false);
        setReviewAppointment(null);
        await fetchAppointments();
      } else {
        toast({ title: "Error", description: result.data?.message || "Could not submit rating", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error?.response?.data?.message || "Could not submit rating", variant: "destructive" });
    } finally {
      setSubmittingReview(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; dot: string; icon: LucideIcon }> = {
      "Booked":      { bg: "bg-amber-50 border border-amber-200",    text: "text-amber-700",  dot: "bg-amber-400",  icon: AlertCircle },
      "Accepted":    { bg: "bg-emerald-50 border border-emerald-200",text: "text-emerald-700",dot: "bg-emerald-500",icon: CheckCircle },
      "In Progress": { bg: "bg-blue-50 border border-blue-200",      text: "text-blue-700",   dot: "bg-blue-500",   icon: Activity },
      "Completed":   { bg: "bg-slate-50 border border-slate-200",    text: "text-slate-600",  dot: "bg-slate-400",  icon: CheckCircle },
      "Cancelled":   { bg: "bg-red-50 border border-red-200",        text: "text-red-600",    dot: "bg-red-400",    icon: XCircle },
    };
    const c = config[status] || config["Booked"];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${c.dot} flex-shrink-0`} />
        {status}
      </span>
    );
  };

  // Avatar color palette for doctors
  const AVATAR_COLORS = [
    "from-sky-500 to-sky-600",
    "from-sky-500 to-sky-600",
    "from-sky-500 to-sky-600",
    "from-sky-500 to-sky-600",
    "from-sky-500 to-sky-600",
    "from-sky-500 to-sky-600",
  ];
  const getDoctorAvatarColor = (name: string) => {
    const idx = name ? name.charCodeAt(0) % AVATAR_COLORS.length : 0;
    return AVATAR_COLORS[idx];
  };

  const doctorDisplayName = (name: string) => {
    const cleaned = String(name || "").trim().replace(/^Dr\.\s*/i, "");
    return `Dr. ${cleaned}`;
  };

  const activeRiskQuestions = useMemo<ActiveFamilyRiskQuestion[]>(() => {
    return selectedRiskDiseases.flatMap((diseaseKey) => {
      const diseaseMeta = FAMILY_RISK_DISEASES.find((d) => d.key === diseaseKey);
      const diseaseLabel = diseaseMeta?.label || diseaseKey;

      return (FAMILY_RISK_QUESTIONS[diseaseKey] || []).map((q) => ({
        ...q,
        id: `${diseaseKey}:${q.key}`,
        diseaseKey,
        diseaseLabel,
      }));
    });
  }, [selectedRiskDiseases]);

  useEffect(() => {
    setFamilyRiskAnswers((prev) => {
      const next: Record<string, FamilyRiskAnswer> = {};
      activeRiskQuestions.forEach((q) => {
        next[q.id] = prev[q.id] || "unknown";
      });
      return next;
    });
  }, [activeRiskQuestions]);

  const updateFamilyRiskAnswer = (questionId: string, answer: FamilyRiskAnswer) => {
    setFamilyRiskAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const toggleRiskDisease = (diseaseKey: FamilyRiskDiseaseKey) => {
    setSelectedRiskDiseases((prev) =>
      prev.includes(diseaseKey)
        ? prev.filter((key) => key !== diseaseKey)
        : [...prev, diseaseKey]
    );
  };

  const familyRiskResult = useMemo(() => {
    if (activeRiskQuestions.length === 0) {
      return {
        percent: 0,
        level: "Select Disease",
        chipClass: "bg-slate-100 text-slate-700 border-slate-200",
        barClass: "from-slate-300 to-slate-400",
        summary: "Select one or more diseases to start family risk prediction.",
      };
    }

    const totalWeight = activeRiskQuestions.reduce((sum, q) => sum + q.weight, 0);

    let rawScore = activeRiskQuestions.reduce((sum, q) => {
      const answer = familyRiskAnswers[q.id] || "unknown";
      if (answer === "yes") return sum + q.weight;
      if (answer === "unknown") return sum + q.weight * 0.35;
      return sum;
    }, 0);

    const hasYesFor = (suffix: string) =>
      Object.entries(familyRiskAnswers).some(([id, ans]) => id.endsWith(`:${suffix}`) && ans === "yes");

    const fatherYes = hasYesFor("father");
    const motherYes = hasYesFor("mother");
    const siblingYes = hasYesFor("sibling");
    if (fatherYes && motherYes) rawScore += 10;
    if (siblingYes && (fatherYes || motherYes)) rawScore += 6;

    const riskPercent = Math.max(5, Math.min(95, Math.round((rawScore / Math.max(totalWeight, 1)) * 100)));

    if (riskPercent >= 70) {
      return {
        percent: riskPercent,
        level: "High",
        chipClass: "bg-sky-100 text-sky-800 border-sky-200",
        barClass: "from-sky-700 to-sky-500",
        summary: "Higher family-linked risk detected. Please discuss screening with a healthcare professional.",
      };
    }

    if (riskPercent >= 40) {
      return {
        percent: riskPercent,
        level: "Moderate",
        chipClass: "bg-sky-50 text-sky-700 border-sky-200",
        barClass: "from-sky-600 to-sky-500",
        summary: "Moderate family trend. Early lifestyle changes and routine checkups are recommended.",
      };
    }

    return {
      percent: riskPercent,
      level: "Low",
      chipClass: "bg-sky-50 text-sky-700 border-sky-200",
      barClass: "from-sky-500 to-sky-400",
      summary: "Currently lower family-linked risk, but continue preventive care and periodic health checks.",
    };
  }, [activeRiskQuestions, familyRiskAnswers]);

  const resetFamilyRiskForm = () => {
    setFamilyRiskAnswers(
      activeRiskQuestions.reduce((acc, q) => {
        acc[q.id] = "unknown";
        return acc;
      }, {} as Record<string, FamilyRiskAnswer>)
    );
  };

  const statCards = [
    {
      label: "Upcoming",
      value: upcomingAppointments.length,
      icon: CalendarDays,
      card: "bg-white border-slate-200 shadow-sm hover:shadow-md transition-all",
      iconWrap: "bg-sky-100 text-sky-600",
    },
    {
      label: "Completed",
      value: pastAppointments.length,
      icon: CheckCircle,
      card: "bg-white border-slate-200 shadow-sm hover:shadow-md transition-all",
      iconWrap: "bg-sky-100 text-sky-600",
    },
    {
      label: "Prescriptions",
      value: myAppointments.filter((a) => getPrescriptionByAppointment(a._id || a.id)).length,
      icon: FileText,
      card: "bg-white border-slate-200 shadow-sm hover:shadow-md transition-all",
      iconWrap: "bg-sky-100 text-sky-600",
    },
    {
      label: "Doctors",
      value: doctors.length,
      icon: Stethoscope,
      card: "bg-white border-slate-200 shadow-sm hover:shadow-md transition-all",
      iconWrap: "bg-sky-100 text-sky-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-50">
      <div className="container mx-auto px-6 py-8 space-y-6 max-w-7xl pb-12">

      {/* ── Hero Header ─────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
        <div className="px-6 py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <p className="text-[11px] font-bold text-sky-600 uppercase tracking-widest mb-1">Patient Portal</p>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{user?.name || "Patient"}</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 text-xs font-semibold">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                Patient
              </span>
            </div>
            <p className="text-slate-600 text-sm mt-1">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p className="text-slate-600 text-sm mt-1">Book appointments, view records, and stay on top of your health journey.</p>

            <div className="flex flex-wrap gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200 px-3 py-1 text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5" /> Personalized Care
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200 px-3 py-1 text-xs font-semibold">
                <CheckCircle className="h-3.5 w-3.5" /> Health Records Ready
              </span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap self-start lg:self-center">
            <button
              onClick={() => navigate("/patient/appointments")}
              className={`relative flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200 hover:scale-105 ${
                doctorWaitingCount > 0
                  ? "border-l-4 border-l-emerald-500"
                  : ""
              } ${
                acceptedAppointments.length > 0 || doctorWaitingCount > 0
                  ? "shadow-[0_0_0_2px_rgba(56,189,248,0.35),0_0_22px_rgba(14,165,233,0.45)]"
                  : "shadow-sm"
              }`}
            >
              {(acceptedAppointments.length > 0 || doctorWaitingCount > 0) && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-xl bg-sky-300/25 blur-md animate-pulse"
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> My Appointments
              </span>
              {(acceptedAppointments.length > 0 || doctorWaitingCount > 0) && (
                <>
                  <span
                    aria-hidden
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-emerald-400 opacity-75 animate-ping z-10"
                  />
                  <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-sm z-20">
                    {combinedAppointmentAttentionCount > 99 ? "99+" : combinedAppointmentAttentionCount}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {doctorWaitingCount > 0 && (
        <div className="w-full">
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-md">
            <CardContent className="px-6 py-5 text-center space-y-4">
              <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <Video className="h-7 w-7 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-emerald-700">
                  {doctorDisplayName(waitingDoctorPrimaryName)} started the video call.
                </p>
                <p className="text-sm text-emerald-600">
                  {doctorWaitingCount > 1
                    ? `${doctorWaitingCount} consultations are live. Choose one to join now.`
                    : "Your doctor is waiting in the consultation room."}
                </p>
              </div>
              <div className="flex justify-center">
                <Button
                  size="sm"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-5"
                  onClick={() => {
                    if (firstWaitingAppointmentId) navigate(`/video/${firstWaitingAppointmentId}`);
                  }}
                >
                  <Video className="h-4 w-4 mr-1.5" /> Join Video Call
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map(({ label, value, icon: Icon, card, iconWrap }) => (
          <div key={label} className={`rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all ${card}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold leading-none text-slate-900">{value}</p>
                <p className="text-slate-600 text-[11px] mt-1 font-semibold uppercase tracking-wide">{label}</p>
              </div>
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center shadow-sm ${iconWrap}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick Access Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { 
            icon: ClipboardList, 
            title: "Medical History", 
            desc: "View your complete medical timeline",
            badge: "Track Records",
            path: "/patient/medical-history" 
          },
          { 
            icon: ScanLine, 
            title: "AI Report Analyzer", 
            desc: "Get AI-powered insights from reports",
            badge: "Smart Analysis",
            path: "/patient/ai-analyzer" 
          },
          { 
            icon: Pill, 
            title: "My Prescriptions", 
            desc: "Access prescriptions with AI summaries",
            badge: "Smart Rx",
            path: "/patient/prescriptions" 
          },
        ].map(({ icon: Icon, title, desc, badge, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:border-sky-300 hover:scale-105 transition-all duration-300"
          >
            {/* Content */}
            <div className="relative p-5 space-y-3 h-full flex flex-col">
              {/* Icon and Badge Row */}
              <div className="flex items-start justify-between gap-2">
                <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center">
                  <Icon className="h-5.5 w-5.5 text-sky-600" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 whitespace-nowrap flex-shrink-0">
                  {badge}
                </span>
              </div>
              
              {/* Title */}
              <div>
                <h3 className="font-bold text-slate-900 text-sm leading-snug">{title}</h3>
              </div>
              
              {/* Description */}
              <p className="text-xs text-slate-600 leading-tight line-clamp-2 flex-1">{desc}</p>
              
              {/* CTA Button */}
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white bg-sky-500 group-hover:bg-sky-600 px-2.5 py-1.5 rounded-xl transition-all w-full mt-1 justify-center">
                <span>Open</span>
                <ChevronRight className="h-3 w-3 transform group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </button>
        ))}

        <button
          onClick={() => setShowFamilyRiskDialog(true)}
          className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:border-sky-300 hover:scale-105 transition-all duration-300"
        >
          <div className="relative p-5 space-y-3 h-full flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center">
                <Activity className="h-5.5 w-5.5 text-sky-600" />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 whitespace-nowrap flex-shrink-0">
                Family Risk
              </span>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 text-sm leading-snug">Family Health Tree</h3>
            </div>

            <p className="text-xs text-slate-600 leading-tight line-clamp-2 flex-1">Predefined questions and options for disease risk prediction.</p>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-white bg-sky-500 group-hover:bg-sky-600 px-2.5 py-1.5 rounded-xl transition-all w-full mt-1 justify-center">
              <span>Open</span>
              <ChevronRight className="h-3 w-3 transform group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </button>
      </div>

      {/* ── Find Doctors ─────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">

        {/* Section Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
              <Search className="h-4 w-4 text-sky-500" />
            </div>
            <div>
              <h2 className="text-slate-900 font-bold text-sm leading-none">Find Doctors</h2>
              <p className="text-slate-600 text-xs mt-0.5">Search by symptom, name, specialization or location</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(filterName || filterSpec || filterLocation || selectedSymptoms.length > 0) && (
              <button
                onClick={clearFilters}
                className="text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl border border-red-200 transition-all flex items-center gap-1.5"
              >
                <X className="h-3.5 w-3.5" /> Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* Symptom Cards - 5 per row Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                🏥 Quick select by symptom
              </p>
              {selectedSymptoms.length > 0 && (
                <span className="text-xs bg-sky-100 text-sky-700 px-2.5 py-1 rounded-full font-semibold border border-sky-200">
                  {selectedSymptoms.length} selected
                </span>
              )}
            </div>
            <div className="px-4 py-2 -mx-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {SYMPTOM_CARDS.map((card) => {
                  const active = selectedSymptoms.includes(card.name);
                  return (
                    <button
                      key={card.name}
                      onClick={() => handleSymptomClick(card.name)}
                      className={`group relative flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all duration-300 ${
                        active
                          ? `bg-gradient-to-br ${card.gradient} border-white/40 text-white shadow-xl scale-105`
                          : `bg-gradient-to-br ${card.bgLight} border-sky-200/60 hover:border-sky-400/80 hover:scale-105 hover:shadow-lg`
                      }`}
                    >
                      <div className={`text-4xl mb-1.5 transition-transform duration-300 ${
                        active ? "scale-110" : "group-hover:scale-110"
                      }`}>
                        {card.icon}
                      </div>
                      <span className={`text-xs font-bold text-center leading-tight mb-0.5 ${
                        active ? "text-white" : "text-slate-800 group-hover:text-sky-700"
                      }`}>
                        {card.name}
                      </span>
                      <span className={`text-[10px] text-center leading-tight ${
                        active ? "text-white/90" : "text-slate-600 group-hover:text-sky-600"
                      }`}>
                        {card.desc}
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
            </div>
          </div>

          {/* Search Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Doctor Name */}
            <div className="relative group">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 pl-1">
                Doctor Name
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  placeholder="Search by name..."
                  value={filterName}
                  onChange={(e) => { setFilterName(e.target.value); setShowNameSuggestions(e.target.value.length > 0); }}
                  onFocus={() => setShowNameSuggestions(filterName.length > 0)}
                  className="w-full h-10 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 rounded-xl border-2 border-slate-200 bg-white focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all duration-200"
                />
              </div>
              {showNameSuggestions && nameSuggestions.length > 0 && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-auto">
                  {nameSuggestions.map((name) => (
                    <button key={name} className="w-full text-left px-3 py-2 hover:bg-sky-50 text-sm text-slate-700 transition-colors" onClick={() => { setFilterName(name); setShowNameSuggestions(false); }}>
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 pl-1">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  placeholder="City or area..."
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 rounded-xl border-2 border-slate-200 bg-white focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all duration-200"
                />
              </div>
            </div>

            {/* Specialization */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 pl-1">
                Specialization
              </label>
              <div className="relative">
                <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select
                  value={filterSpec}
                  onChange={(e) => setFilterSpec(e.target.value)}
                  className="w-full h-10 pl-9 pr-8 text-sm text-slate-900 rounded-xl border-2 border-slate-200 bg-white focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all duration-200 appearance-none cursor-pointer"
                >
                  <option value="">None</option>
                  <option value="*">All Specializations</option>
                  {specializations.map((spec) => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▾</span>
              </div>
            </div>
          </div>

          {/* Results bar */}
          <div className="flex items-center justify-between">
            {selectedSymptoms.length === 0 && !filterName.trim() && !filterSpec && !filterLocation.trim() ? (
              <p className="text-sm font-medium text-slate-600">Select a symptom or use filters to discover doctors</p>
            ) : (
              <p className="text-sm text-slate-600">
                {loadingDoctors ? (
                  <span className="flex items-center gap-2"><span className="h-3 w-3 border-2 border-sky-500 border-t-transparent rounded-full animate-spin inline-block" />Searching...</span>
                ) : (
                  <><span className="text-sky-600 font-bold text-base">{filteredDoctors.length}</span> doctor{filteredDoctors.length !== 1 ? "s" : ""} found</>
                )}
              </p>
            )}
            <div className="flex gap-0.5 bg-slate-100 border border-slate-200 rounded-xl p-0.5">
              <button
                onClick={() => setViewMode("card")}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${viewMode === "card" ? "bg-white text-sky-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                <Grid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${viewMode === "table" ? "bg-white text-sky-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Doctors — Card View */}
          {viewMode === "card" && (
            <>
              {loadingDoctors ? (
                <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-2xl bg-slate-200 flex-shrink-0" />
                        <div className="space-y-2 flex-1">
                          <div className="h-4 bg-slate-200 rounded-lg w-1/3" />
                          <div className="h-3 bg-slate-200 rounded-lg w-1/4" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 bg-slate-200 rounded-lg w-2/3" />
                        <div className="h-3 bg-slate-200 rounded-lg w-1/2" />
                      </div>
                      <div className="h-9 bg-slate-200 rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : selectedSymptoms.length === 0 && !filterName.trim() && !filterSpec && !filterLocation.trim() ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 rounded-2xl bg-gradient-to-br from-slate-50 via-white to-sky-50/30 border-2 border-dashed border-slate-200">
                  <div className="relative mb-6">
                    <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-sky-500 via-sky-600 to-blue-600 flex items-center justify-center shadow-xl shadow-sky-300/50">
                      <Stethoscope className="h-12 w-12 text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 h-9 w-9 rounded-full bg-white border-2 border-sky-200 flex items-center justify-center shadow-md">
                      <Search className="h-5 w-5 text-sky-600" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Find Your Perfect Doctor</h3>
                  <p className="text-sm text-slate-600 text-center max-w-md mb-8 leading-relaxed">
                    Select a symptom below or use the search filters above to discover qualified doctors available for consultation.
                  </p>
                  <div className="px-4 py-2 -mx-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {SYMPTOM_CARDS.slice(0, 5).map((s) => (
                        <button
                          key={s.name}
                          onClick={() => handleSymptomClick(s.name)}
                          className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50 hover:scale-105 hover:shadow-lg transition-all duration-200"
                        >
                          <span className="text-3xl mb-2">{s.icon}</span>
                          <span className="text-xs text-center leading-tight">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 rounded-2xl bg-gradient-to-br from-slate-50 to-white border-2 border-dashed border-slate-200">
                  <div className="h-20 w-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-5 shadow-sm">
                    <Search className="h-9 w-9 text-slate-400" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2 text-lg">No Doctors Found</h3>
                  <p className="text-sm text-slate-600 text-center mb-6 max-w-sm leading-relaxed">
                    We couldn't find any doctors matching your criteria. Try adjusting your filters or selecting different symptoms.
                  </p>
                  <Button variant="outline" size="sm" onClick={clearFilters} className="rounded-xl border-sky-300 text-sky-600 hover:bg-sky-50 font-semibold">
                    <X className="h-3.5 w-3.5 mr-1.5" /> Clear All Filters
                  </Button>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-6">
                  {filteredDoctors.map((doc) => (
                    <DoctorCard
                      key={doc._id}
                      doctor={doc}
                      onBookClick={() => openBooking(doc)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Doctors — Table View */}
          {viewMode === "table" && (
            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-bold text-slate-600">Doctor</TableHead>
                    <TableHead className="font-bold text-slate-600">Specialization</TableHead>
                    <TableHead className="font-bold text-slate-600">Location</TableHead>
                    <TableHead className="font-bold text-slate-600">Experience</TableHead>
                    <TableHead className="font-bold text-slate-600">Fee</TableHead>
                    <TableHead className="text-right font-bold text-slate-600">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingDoctors ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">Loading doctors...</TableCell>
                    </TableRow>
                  ) : filteredDoctors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">No doctors found. Try adjusting your filters.</TableCell>
                    </TableRow>
                  ) : (
                    filteredDoctors.map((doc) => (
                      <TableRow key={doc._id} className="hover:bg-slate-100/60 transition-all duration-200">
                        <TableCell className="font-semibold text-slate-900">{formatDoctorDisplayName(doc.name)}</TableCell>
                        <TableCell>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-100">{doc.specialization}</span>
                        </TableCell>
                        <TableCell className="text-slate-600">{formatLocation(doc.location)}</TableCell>
                        <TableCell className="text-slate-600">{doc.experience || 5} yrs</TableCell>
                        <TableCell className="font-bold text-slate-900">₹{doc.consultationFee || 500}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => openBooking(doc)} className="rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white shadow-md shadow-sky-200">Book</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* ── My Appointments ──────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-sky-200 bg-white shadow-sm hover:shadow-md transition-shadow">
        {/* Section Header */}
        <div className="px-6 py-5 flex items-center justify-between border-b border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0 shadow-sm">
              <CalendarDays className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <h2 className="text-slate-900 font-bold text-base leading-none">My Appointments</h2>
              <p className="text-sky-700 text-xs mt-0.5 font-medium">Track and manage all your appointments</p>
            </div>
          </div>
          <div className="text-xs font-semibold text-sky-600 bg-sky-100 px-3 py-1.5 rounded-lg">Compact Preview</div>
        </div>

        <div className="p-6 space-y-5">
          {/* Tabs */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
            {[
              { key: "all",       label: "All",       count: allAppointments.length },
              { key: "accepted",  label: "Accepted",  count: acceptedAppointments.length },
              { key: "upcoming",  label: "Upcoming",  count: upcomingAppointments.length },
              { key: "past",      label: "Completed", count: pastAppointments.length },
              { key: "cancelled", label: "Cancelled", count: cancelledAppointments.length },
            ].map((tab) => {
              const isAcceptedAttention = tab.key === "accepted" && tab.count > 0;
              return (
              <button
                key={tab.key}
                onClick={() => setAppointmentTab(tab.key as typeof appointmentTab)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  appointmentTab === tab.key ? "bg-white text-sky-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                } ${
                  isAcceptedAttention ? "animate-pulse ring-2 ring-emerald-200/80" : ""
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {tab.label}
                  {isAcceptedAttention && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                </span>
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  appointmentTab === tab.key ? "bg-slate-100 text-slate-600" : "bg-slate-200/70 text-slate-500"
                }`}>{tab.count}</span>
              </button>
              );
            })}
          </div>
          <Button
            size="sm"
            onClick={handleAppointmentsRefresh}
            disabled={refreshingAppointments}
            className="rounded-xl h-10 min-w-[126px] px-5 text-sm bg-sky-500 hover:bg-sky-600 text-white font-semibold gap-1.5 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${refreshingAppointments ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          </div>

          {/* Appointments Table */}
          <div className="rounded-2xl border border-slate-200 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead>Doctor and Specialty</TableHead>
                  <TableHead>Date and Time</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewAppointments.map((apt: any) => {
                  const aptId = String(apt._id || apt.id || "");
                  const waitingInfo = doctorWaitingByAppointment[aptId];
                  const isDoctorWaiting = !!waitingInfo;
                  return (
                  <TableRow key={apt._id} className={isDoctorWaiting ? "border-l-4 border-l-emerald-500 bg-emerald-50/40" : ""}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{doctorDisplayName(apt.doctorName)}</div>
                      <div className="text-xs text-slate-600">{apt.specialization || "General"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-900">{apt.date}</div>
                      <div className="text-xs text-slate-600">{apt.time}</div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">{formatLocation(apt.location) || "-"}</TableCell>
                    <TableCell>{getStatusBadge(apt.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {isDoctorWaiting && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                            {doctorDisplayName(waitingInfo?.doctorName || apt.doctorName)} in progress
                          </Badge>
                        )}
                        {apt.status === "In Progress" && isDoctorWaiting && (
                          <Button
                            size="sm"
                            title="Join Video Call"
                            className="h-9 px-3 gap-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold"
                            onClick={() => navigate(`/video/${apt._id}`)}
                          >
                            <Video className="h-4 w-4" /> Join
                          </Button>
                        )}
                        {apt.status === "Accepted" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            title="Waiting for doctor to start"
                            className="h-9 px-3 gap-1.5 rounded-lg border-amber-200 text-amber-700 bg-amber-50 text-xs font-semibold"
                          >
                            <Clock className="h-4 w-4" /> Waiting for Doctor
                          </Button>
                        )}
                        {apt.status === "In Progress" && !isDoctorWaiting && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            title="Waiting for doctor to start"
                            className="h-9 px-3 gap-1.5 rounded-lg border-amber-200 text-amber-700 bg-amber-50 text-xs font-semibold"
                          >
                            <Clock className="h-4 w-4" /> Waiting for Doctor
                          </Button>
                        )}
                        {(apt.status === "Booked" || apt.status === "Accepted") && (
                          <Button
                            size="sm"
                            title="Cancel Appointment"
                            className="h-9 px-3 gap-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold"
                            onClick={() => handleCancelClick(apt._id)}
                          >
                            <XCircle className="h-4 w-4" /> Cancel
                          </Button>
                        )}
                        {apt.status === "Completed" && (
                          <>
                            <Button
                              size="sm"
                              title="View Prescription"
                              className="h-9 px-3 gap-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold"
                              onClick={() => {
                                const appointmentId = apt._id || apt.id;
                                if (appointmentId) navigate(`/prescriptions/appointment/${appointmentId}`);
                              }}
                            >
                              <FileText className="h-4 w-4" /> Rx
                            </Button>
                            <RateButton
                              rated={!!apt.reviewSubmitted}
                              onClick={() => openReviewDialog(apt)}
                            />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
                {previewAppointments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-slate-500">No appointments found for this tab.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {currentTabAppointments.length > APPOINTMENTS_PREVIEW_LIMIT && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3">
              <p className="text-xs text-slate-600">
                Showing <span className="font-semibold text-slate-900">{APPOINTMENTS_PREVIEW_LIMIT}</span> of <span className="font-semibold text-slate-900">{currentTabAppointments.length}</span> appointments.
              </p>
              <Button
                size="sm"
                onClick={() => navigate('/patient/appointments')}
                className="rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs px-3"
              >
                View All
              </Button>
            </div>
          )}

          {appointmentTab === "cancelled" && cancelledAppointments.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl text-xs border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-semibold"
              onClick={() => setShowClearCancelledDialog(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear All Cancelled
            </Button>
          )}
        </div>
      </div>

      {/* ── Booking Modal ────────────────────────────────────────────── */}
      <Dialog open={showBookingModal} onOpenChange={setShowBookingModal}>
        <DialogContent className="max-w-lg rounded-2xl border border-slate-200 shadow-lg p-0 overflow-hidden bg-white">
          {/* Modal header */}
          <div className="bg-white border-b border-slate-200 px-6 py-5">
            <DialogTitle className="text-slate-900 font-bold text-lg">Book Appointment</DialogTitle>
            <DialogDescription className="text-slate-600 text-sm mt-0.5">
              {selectedDoctor ? `Scheduling with Dr. ${selectedDoctor.name}` : "Select your preferred date and time"}
            </DialogDescription>
          </div>

          {selectedDoctor && (
            <div className="p-6 space-y-5">
              {/* Doctor info strip */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${getDoctorAvatarColor(selectedDoctor.name || "")} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white font-bold text-lg">{(selectedDoctor.name || "?").slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900">{formatDoctorDisplayName(selectedDoctor.name)}</h3>
                  <p className="text-sm text-slate-600">{selectedDoctor.specialization}</p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600"><MapPin className="h-3 w-3" />{formatLocation(selectedDoctor.location)}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
                      <IndianRupee className="h-3 w-3" />₹{selectedDoctor.consultationFee || 500}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Date picker */}
                <div>
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">Select Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal rounded-xl border-2 border-slate-200 hover:border-sky-400 h-10">
                        <CalendarIcon className="mr-2 h-4 w-4 text-sky-500" />
                        {bookDate ? format(bookDate, "PPP") : <span className="text-slate-400">Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border border-slate-200 shadow-lg">
                      <Calendar
                        mode="single"
                        selected={bookDate}
                        onSelect={setBookDate}
                        disabled={(date) => date < new Date() || !isDayAvailable(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Time picker */}
                <div>
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">Select Time</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <select
                      value={bookTime}
                      onChange={(e) => setBookTime(e.target.value)}
                      disabled={!bookDate}
                      className="w-full h-10 pl-9 pr-3 text-sm text-slate-900 rounded-xl border-2 border-slate-200 bg-white focus:outline-none focus:border-sky-400 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
                    >
                      <option value="">Choose time...</option>
                      {availableTimeSlots.map((slot: string) => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {bookDate && availableTimeSlots.length === 0 && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">No slots available on this day. Please try another date.</p>
              )}
            </div>
          )}

          <DialogFooter className="px-6 pb-6 pt-0 gap-2">
            <Button variant="outline" onClick={() => setShowBookingModal(false)} className="rounded-xl border-slate-200 flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmBooking}
              disabled={!bookDate || !bookTime}
              className="rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-semibold shadow-md shadow-sky-200 flex-1"
            >
              Confirm Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Family Health Tree Risk Predictor Dialog */}
      <Dialog open={showFamilyRiskDialog} onOpenChange={setShowFamilyRiskDialog}>
        <DialogContent className="max-w-5xl rounded-2xl border border-sky-200 shadow-xl p-0 overflow-hidden bg-white max-h-[88vh] flex flex-col">
          <div className="px-6 py-5 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-white">
            <DialogTitle className="text-slate-900 font-bold text-lg">Family Health Tree Risk Card</DialogTitle>
            <DialogDescription className="text-sky-700 text-sm mt-0.5">
              Choose a disease, answer predefined questions, and get a frontend risk estimate.
            </DialogDescription>
          </div>

          <div className="p-6 grid grid-cols-1 xl:grid-cols-3 gap-6 overflow-y-auto">
            <div className="xl:col-span-2 space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">Select Disease</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {FAMILY_RISK_DISEASES.map((disease) => {
                    const active = selectedRiskDiseases.includes(disease.key);
                    return (
                      <button
                        key={disease.key}
                        onClick={() => toggleRiskDisease(disease.key)}
                        className={`rounded-xl border-2 px-3 py-2 text-left transition-all ${
                          active
                            ? "border-sky-500 bg-gradient-to-r from-sky-600 to-sky-500 text-white shadow-md"
                            : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50"
                        }`}
                      >
                        <p className={`text-sm font-bold ${active ? "text-white" : "text-slate-900"}`}>{disease.label}</p>
                        <p className={`text-[11px] ${active ? "text-sky-100" : "text-slate-500"}`}>{disease.helper}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Family & Lifestyle Questions</p>
                {activeRiskQuestions.length === 0 && (
                  <div className="rounded-xl border border-dashed border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-800 font-medium">
                    Select one or more diseases above. Click again on a selected disease to remove it.
                  </div>
                )}

                {activeRiskQuestions.map((question, idx) => (
                  <div key={question.id} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-semibold text-slate-800">
                        <span className="text-sky-600 mr-1">Q{idx + 1}.</span>
                        {question.label}
                        <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-sky-700">{question.diseaseLabel}</span>
                      </p>
                      <div className="flex items-center gap-1.5">
                        {RISK_OPTION_LABELS.map((opt) => {
                          const selected = familyRiskAnswers[question.id] === opt.key;
                          return (
                            <button
                              key={opt.key}
                              onClick={() => updateFamilyRiskAnswer(question.id, opt.key)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                selected
                                  ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-700"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-sky-50 p-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-sky-700">Predicted Risk</p>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${familyRiskResult.chipClass}`}>
                    {familyRiskResult.level}
                  </span>
                </div>

                <div className="rounded-xl bg-white border border-sky-100 p-4 text-center">
                  <p className="text-4xl font-black text-slate-900 leading-none">{familyRiskResult.percent}%</p>
                  <p className="text-xs text-slate-500 mt-1">estimated inherited risk trend</p>
                </div>

                <div>
                  <div className="h-3 bg-white rounded-full border border-sky-100 overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${familyRiskResult.barClass} transition-all duration-500`}
                      style={{ width: `${familyRiskResult.percent}%` }}
                    />
                  </div>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed">{familyRiskResult.summary}</p>
              </div>

              <div className="space-y-3 pt-5 mt-5 border-t border-sky-100">
                <button
                  onClick={resetFamilyRiskForm}
                  className="w-full rounded-xl border border-sky-200 bg-white hover:bg-sky-50 text-sky-700 font-semibold text-sm py-2 transition-all"
                >
                  Reset Answers
                </button>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800 leading-relaxed">
                    ⚠️ This is an educational frontend estimate only, not a doctor diagnosis. Please consult your healthcare professional.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Appointment Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-slate-900">Cancel Appointment</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel 
              className="rounded-xl border-slate-200"
              onClick={() => setAppointmentToCancel(null)}
            >
              No, Keep It
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
              onClick={() => {
                handleCancelAppointment();
                setShowCancelDialog(false);
              }}
            >
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showClearCancelledDialog} onOpenChange={setShowClearCancelledDialog}>
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-slate-900">Clear Cancelled Appointments</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              This will permanently delete all cancelled appointments from your history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="rounded-xl border-slate-200">No, Keep</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
              onClick={() => {
                handleClearCancelledAppointments();
                setShowClearCancelledDialog(false);
              }}
            >
              Yes, Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-md rounded-2xl border border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold">Rate Your Consultation</DialogTitle>
            <DialogDescription className="text-slate-600">
              Your rating helps other patients choose doctors confidently.
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
                placeholder="Share your consultation experience"
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReviewDialog(false)} className="rounded-xl border-slate-200">Cancel</Button>
            <Button onClick={handleSubmitReview} disabled={submittingReview} className="rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700">
              {submittingReview ? 'Submitting...' : 'Submit Rating'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default PatientDashboard;
