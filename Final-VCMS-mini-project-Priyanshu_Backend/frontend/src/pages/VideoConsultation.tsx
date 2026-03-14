import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import useSocket from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import api from "@/services/api";
import { PrescriptionAISummary } from "@/components/PrescriptionAISummary";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, FileText, Loader,
  Plus, Trash2, CheckCircle, Clock, RefreshCw, Sparkles,
  ClipboardList, User, Stethoscope, CalendarDays, ChevronDown, ChevronUp, LogOut
} from "lucide-react";

const getEntityId = (entity: any): string => {
  if (!entity) return "";
  if (typeof entity === "string") return entity;
  return String(entity._id || entity.id || "");
};

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

interface PrescriptionFormData {
  diagnosis: string;
  clinicalNotes: string;
  treatmentPlan: string;
  followUpDate: string;
  followUpRecommendations: string;
  validUntil: string;
  medications: Medication[];
}

const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

const getMediaAccessErrorDetails = (error: unknown): { title: string; description: string } => {
  const errorName = (error as { name?: string })?.name || "";
  const hasMediaDevices = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  const secureContext = typeof window !== "undefined" ? window.isSecureContext : true;

  if (!secureContext || !hasMediaDevices || errorName === "SecurityError") {
    return {
      title: "Secure connection required",
      description: "Camera/microphone need a secure site. Please open on HTTPS or localhost and try again.",
    };
  }

  if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
    return {
      title: "Permission denied",
      description: "Please allow camera and microphone access in your browser site settings.",
    };
  }

  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
    return {
      title: "Device not found",
      description: "No camera or microphone was found. Please connect a device and retry.",
    };
  }

  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return {
      title: "Device busy",
      description: "Camera/microphone is being used by another app. Close that app and try again.",
    };
  }

  return {
    title: "Media access failed",
    description: "Failed to access camera/microphone. Please wait a moment and try again.",
  };
};

const isPermissionDeniedError = (error: unknown): boolean => {
  const errorName = (error as { name?: string })?.name || "";
  return errorName === "NotAllowedError" || errorName === "PermissionDeniedError";
};

const formatAppointmentDate = (rawDate: unknown): string => {
  if (!rawDate) return "Date TBD";
  const parsed = new Date(String(rawDate));
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  return String(rawDate);
};

const VideoConsultation = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { user } = useAuth();
  const { fetchAppointments, fetchPrescriptions } = useClinic();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { on, off, emit, joinRoom } = useSocket();

  const [appointment, setAppointment] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prescription, setPrescription] = useState<any>(null);
  const [loadingPrescription, setLoadingPrescription] = useState(false);
  const [rxSubmitting, setRxSubmitting] = useState(false);
  const [prescriptionExpanded, setPrescriptionExpanded] = useState(false);
  const [pollingActive, setPollingActive] = useState(true);
  const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
  const [endCallConfirmOpen, setEndCallConfirmOpen] = useState(false);
  const [completingConsultation, setCompletingConsultation] = useState(false);
  const [consultationCompleted, setConsultationCompleted] = useState(false);
  const [mediaPermissionDenied, setMediaPermissionDenied] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [hasRemoteMedia, setHasRemoteMedia] = useState(false);
  const [remoteWaitingInfo, setRemoteWaitingInfo] = useState<{ waiting: boolean; role: "doctor" | "patient" | "unknown" }>({ waiting: true, role: "unknown" });
  const [rxForm, setRxForm] = useState<PrescriptionFormData>({
    diagnosis: "",
    clinicalNotes: "",
    treatmentPlan: "",
    followUpDate: "",
    followUpRecommendations: "",
    validUntil: "",
    medications: [
      {
        name: "",
        dosage: "",
        frequency: "",
        duration: "",
        instructions: "",
        quantity: 0,
        refills: 0,
        sideEffects: [],
      },
    ],
  });

  // WebRTC refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  // Keep a ref to appointment so async WebRTC callbacks can access it
  const appointmentRef = useRef<any>(null);
  const waitingToastKeyRef = useRef<string>("");
  // Track whether the call was ever started so cleanup can emit video:end-call
  const callActiveRef = useRef<boolean>(false);
  const initializingCallRef = useRef<boolean>(false);
  const patientAutoJoinTriggeredRef = useRef<boolean>(false);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Track whether the doctor is present in the room (for patient waiting room UI)
  const [doctorPresent, setDoctorPresent] = useState(false);
  const normalizedRole = (user?.role || "").toLowerCase();
  const isDoctor = normalizedRole === "doctor";
  const inPatientWaitingRoom = !isDoctor && !callActive;

  const getDoctorMongoId = () => getEntityId(appointmentRef.current?.doctorId || appointment?.doctorId);
  const getPatientMongoId = () => getEntityId(appointmentRef.current?.patientId || appointment?.patientId);

  const emitWaitingStatus = (waiting: boolean) => {
    const appt = appointmentRef.current;
    const targetId = isDoctor ? getEntityId(appt?.patientId) : getEntityId(appt?.doctorId);
    if (!targetId || !appointmentId) return;

    emit("video:waiting-status", {
      to: targetId,
      appointmentId,
      waiting,
      role: isDoctor ? "doctor" : "patient",
    });
  };

  const flushPendingIceCandidates = async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;

    if (pendingIceCandidatesRef.current.length === 0) return;

    const queued = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore invalid/late candidates
      }
    }
  };

  const applyIncomingOffer = async (offer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      pendingOfferRef.current = offer;
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushPendingIceCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const doctorMongoId = getDoctorMongoId();
      if (doctorMongoId) {
        emit("video:answer", { answer, to: doctorMongoId, appointmentId });
      }
    } catch {
      // Handle connection error silently
    }
  };

  // Complete consultation function
  const completeConsultation = async () => {
    if (!isDoctor || !appointmentId || completingConsultation || consultationCompleted) return;
    
    try {
      setCompletingConsultation(true);
      await api.put(`/appointments/${appointmentId}/status`, { status: 'completed' });
      
      // Emit socket event to notify other party
      const targetId = getPatientMongoId();
      
      if (targetId) {
        emit('consultation:completed', { 
          appointmentId, 
          completedBy: user._id,
          targetUserId: targetId 
        });
      }
      
      setConsultationCompleted(true);
      toast({ 
        title: "Consultation Completed", 
        description: "The appointment has been marked as completed." 
      });

      // Keep dashboard data fresh before redirect
      await Promise.allSettled([fetchAppointments(), fetchPrescriptions()]);
      
      // End the call
      performEndCall();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to complete consultation",
        variant: "destructive",
      });
      setCompletingConsultation(false);
    }
  };

  // Listen for consultation completion from other party
  useEffect(() => {
    if (!appointmentId) return;

    const handleConsultationCompleted = (data: any) => {
      if (data.appointmentId === appointmentId) {
        if (data.completedBy === user?._id) return;
        setConsultationCompleted(true);
        toast({
          title: "Consultation Completed",
          description: "Doctor has completed this consultation.",
        });

        cleanupCall();
        if (isDoctor) {
          navigate('/doctor/today', { replace: true });
        } else {
          navigate('/patient/appointments', { replace: true });
        }
      }
    };

    on('consultation:completed', handleConsultationCompleted);

    return () => {
      off('consultation:completed', handleConsultationCompleted);
    };
  }, [appointmentId, user?._id, isDoctor, navigate, on, off, toast]);

  // Initialize WebRTC
  useEffect(() => {
    if (!appointmentId || !user) return;

    let isMounted = true;

    const setupCall = async () => {
      const appt = await fetchAppointment();
      if (!isMounted) return;
      if (isDoctor) {
        // Doctor always starts camera immediately
        await initializeCall();
      } else {
        // Patient: check if doctor is already in room (appointment in-progress from DB)
        const status = String(appt?.status || "").toLowerCase();
        if (["in-progress", "in progress"].includes(status)) {
          setDoctorPresent(true);
        }
        // Patient will start camera only when they click "Join Now"
      }
    };

    setupCall();

    return () => {
      isMounted = false;
      const appt = appointmentRef.current;
      const targetId = isDoctor ? getEntityId(appt?.patientId) : getEntityId(appt?.doctorId);
      if (targetId && appointmentId) {
        // If the call was active, send end-call so the other party is also redirected
        // Only doctor closing the page sends end-call (patient leaving should not kick doctor out)
        if (callActiveRef.current && isDoctor) {
          emit("video:end-call", { to: targetId, appointmentId });
        }
        emit("video:waiting-status", {
          to: targetId,
          appointmentId,
          waiting: false,
          role: isDoctor ? "doctor" : "patient",
        });
      }
      cleanupCall();
    };
  }, [appointmentId, user, emit, isDoctor]);

  useEffect(() => {
    if (!appointmentId) return;
    fetchPrescription();
  }, [appointmentId]);

  // Real-time polling for patient: auto-refresh prescription every 6s until found
  useEffect(() => {
    if (isDoctor || !appointmentId || !pollingActive) return;
    if (prescription) { setPollingActive(false); return; }
    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/prescriptions/appointment/${appointmentId}`);
        if (response.data?.success) {
          const data = response.data.data || response.data.prescription || response.data;
          if (data && data._id) {
            setPrescription(data);
            setPollingActive(false);
            toast({ title: "Prescription available!", description: "Doctor has issued your prescription." });
          }
        }
      } catch (_) { /* silent */ }
    }, 6000);
    return () => clearInterval(interval);
  }, [isDoctor, appointmentId, prescription, pollingActive, toast]);

  // ── Join video room via socket ──
  useEffect(() => {
    if (!appointmentId || !user) return;
    joinRoom(`video_${appointmentId}`);
  }, [appointmentId, user, joinRoom]);

  // When patient auto-joins, call can start while waiting-room UI is still mounted.
  // Re-bind streams once active-call video elements are rendered.
  useEffect(() => {
    if (!callActive) return;

    const localStream = localStreamRef.current;
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {
        // Autoplay may be blocked until user gesture in some browsers.
      });
    }

    const remoteStream = remoteStreamRef.current;
    if (remoteVideoRef.current && remoteStream && remoteStream.getTracks().length > 0) {
      remoteVideoRef.current.srcObject = remoteStream;
      setHasRemoteMedia(true);
      remoteVideoRef.current.play().catch(() => {
        // Autoplay may be blocked until user gesture in some browsers.
      });
    }
  }, [callActive]);

  // ── WebRTC signaling via socket ──
  useEffect(() => {
    if (!appointmentId || !user) return;

    const handleOffer = async ({ offer }: { offer: RTCSessionDescriptionInit; from: string }) => {
      await applyIncomingOffer(offer);
    };

    const handleAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingIceCandidates();
      } catch (e) {
        // Handle connection error silently
      }
    };

    const handleIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionRef.current;
      if (!candidate) return;

      if (!pc) {
        pendingIceCandidatesRef.current.push(candidate);
        return;
      }

      if (!pc.remoteDescription) {
        pendingIceCandidatesRef.current.push(candidate);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        // Handle connection error silently
      }
    };

    const handleEndCall = () => {
      cleanupCall();
      toast({ title: "Call ended", description: "The other party ended the call." });
      if (isDoctor) navigate("/doctor/today", { replace: true });
      else navigate("/patient", { replace: true });
    };

    // Doctor: create offer when patient signals ready
    const handlePatientReady = async () => {
      if (!isDoctor) return;
      const pc = peerConnectionRef.current;
      if (!pc) return;
      const patientId = getPatientMongoId();
      if (!patientId) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emit("video:offer", { offer, to: patientId, appointmentId });
      } catch (e) {
        // Handle connection error silently
      }
    };

    const handleWaitingStatus = ({
      waiting,
      role,
      appointmentId: incomingAppointmentId,
    }: {
      waiting?: boolean;
      role?: "doctor" | "patient";
      appointmentId?: string;
    }) => {
      if (!incomingAppointmentId || incomingAppointmentId !== appointmentId) return;

      const normalizedRole = role === "doctor" || role === "patient" ? role : "unknown";
      const isWaiting = !!waiting;

      setRemoteWaitingInfo({ waiting: isWaiting, role: normalizedRole });

      // Update doctor-presence flag so patient's waiting room reacts
      if (!isDoctor && normalizedRole === "doctor") {
        setDoctorPresent(isWaiting);
      }

      // Always show toast so the other party knows when someone joins/rejoins
      // (even if a connection was previously established)
      const toastKey = `${incomingAppointmentId}:${normalizedRole}:${isWaiting ? "waiting" : "ready"}`;
      if (waitingToastKeyRef.current === toastKey) return;
      waitingToastKeyRef.current = toastKey;

      if (isWaiting) {
        toast({
          title: normalizedRole === "doctor" ? "Doctor is waiting" : "Patient is waiting",
          description: normalizedRole === "doctor"
            ? "Doctor has joined the consultation. You can join now."
            : "Patient has joined the consultation. You can start now.",
        });
      }
    };

    on("video:offer", handleOffer);
    on("video:answer", handleAnswer);
    on("video:ice-candidate", handleIceCandidate);
    on("video:end-call", handleEndCall);
    on("video:user-ready", handlePatientReady);
    on("video:waiting-status", handleWaitingStatus);

    return () => {
      off("video:offer", handleOffer);
      off("video:answer", handleAnswer);
      off("video:ice-candidate", handleIceCandidate);
      off("video:end-call", handleEndCall);
      off("video:user-ready", handlePatientReady);
      off("video:waiting-status", handleWaitingStatus);
    };
  }, [appointmentId, user, isDoctor, on, off, emit, navigate, toast, connected]);

  // ── Doctor: fallback offer if patient was already ready before doctor joined ──
  useEffect(() => {
    if (!isDoctor || !callActive || !appointmentRef.current) return;
    const pc = peerConnectionRef.current;
    if (!pc) return;
    const patientId = getPatientMongoId();
    if (!patientId) return;

    // 2-second fallback: in case patient joined first and we missed their ready signal
    const timer = setTimeout(async () => {
      // Only create offer if not already in progress (signalingState is 'stable')
      if (pc.signalingState === "stable") {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          emit("video:offer", { offer, to: patientId, appointmentId });
        } catch (e) {
          // Handle connection error silently
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isDoctor, callActive, appointmentId, emit]);

  const fetchAppointment = async () => {
    try {
      const response = await api.get(`/appointments/${appointmentId}`);
      if (response.data?.success) {
        const appt = response.data.appointment;
        setAppointment(appt);
        appointmentRef.current = appt;
        return appt;
      }
      return null;
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load appointment",
        variant: "destructive",
      });
      setTimeout(() => navigate(-1), 1500);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchPrescription = async () => {
    if (!appointmentId) return;
    setLoadingPrescription(true);
    try {
      const response = await api.get(`/prescriptions/appointment/${appointmentId}`);
      if (response.data?.success) {
        setPrescription(response.data.data || response.data.prescription || response.data);
      }
    } catch (error) {
      setPrescription(null);
    } finally {
      setLoadingPrescription(false);
    }
  };

  const handleRxInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRxForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleMedicationChange = (index: number, field: keyof Medication, value: any) => {
    const updated = [...rxForm.medications];
    updated[index] = { ...updated[index], [field]: value };
    setRxForm((prev) => ({ ...prev, medications: updated }));
  };

  const addMedication = () => {
    setRxForm((prev) => ({
      ...prev,
      medications: [
        ...prev.medications,
        {
          name: "",
          dosage: "",
          frequency: "",
          duration: "",
          instructions: "",
          quantity: 0,
          refills: 0,
          sideEffects: [],
        },
      ],
    }));
  };

  const removeMedication = (index: number) => {
    if (rxForm.medications.length === 1) return;
    setRxForm((prev) => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index),
    }));
  };

  const submitPrescription = async (issueNow: boolean) => {
    if (!appointmentId) return;

    if (!rxForm.diagnosis.trim()) {
      toast({ title: "Diagnosis is required", variant: "destructive" });
      return;
    }

    const appointmentDate = new Date(appointment?.date || appointment?.scheduledAt || appointment?.createdAt || new Date());
    appointmentDate.setHours(0, 0, 0, 0);

    if (rxForm.followUpDate) {
      const followDate = new Date(rxForm.followUpDate);
      followDate.setHours(0, 0, 0, 0);
      if (followDate < appointmentDate) {
        toast({ title: "Invalid Date", description: "Follow-up date cannot be before appointment date", variant: "destructive" });
        return;
      }
    }

    if (!rxForm.validUntil) {
      toast({ title: "Validity date is required", variant: "destructive" });
      return;
    }

    const validDate = new Date(rxForm.validUntil);
    validDate.setHours(0, 0, 0, 0);
    if (validDate < appointmentDate) {
      toast({ title: "Valid Until cannot be before appointment date", variant: "destructive" });
      return;
    }

    for (const med of rxForm.medications) {
      if (!med.name.trim() || !med.dosage.trim() || !med.frequency.trim() || !med.duration.trim()) {
        toast({ title: "All medication fields are required", variant: "destructive" });
        return;
      }
    }

    try {
      setRxSubmitting(true);
      const response = await api.post("/prescriptions", {
        appointmentId,
        diagnosis: rxForm.diagnosis.trim(),
        clinicalNotes: rxForm.clinicalNotes.trim(),
        treatmentPlan: rxForm.treatmentPlan.trim(),
        followUpDate: rxForm.followUpDate || undefined,
        followUpRecommendations: rxForm.followUpRecommendations.trim(),
        validUntil: rxForm.validUntil,
        medications: rxForm.medications.map((m) => ({
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

      const created = response.data?.prescription;
      if (created) {
        if (issueNow) {
          await api.post(`/prescriptions/${created._id}/issue`, {});
          const issued = await api.get(`/prescriptions/${created._id}`);
          setPrescription(issued.data?.data || issued.data?.prescription || issued.data);
          toast({ title: "Prescription issued", description: "Patient can view it now." });
        } else {
          setPrescription(created);
          toast({ title: "Prescription saved", description: "Saved as draft." });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to create prescription",
        variant: "destructive",
      });
    } finally {
      setRxSubmitting(false);
    }
  };

  const initializeCall = async () => {
    if (callActiveRef.current || initializingCallRef.current) return;
    initializingCallRef.current = true;

    try {
      setMediaPermissionDenied(false);

      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        const { title, description } = getMediaAccessErrorDetails({ name: "SecurityError" });
        toast({ title, description, variant: "destructive" });
        return;
      }

      remoteStreamRef.current = new MediaStream();

      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      localStreamRef.current = stream;
      setMuted(!(stream.getAudioTracks()[0]?.enabled ?? true));
      setCameraOff(!(stream.getVideoTracks()[0]?.enabled ?? true));
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {
          // Autoplay can be blocked until first interaction in some browsers.
        });
      }

      // Create peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: STUN_SERVERS,
      });

      peerConnectionRef.current = peerConnection;

      // If signaling arrived before peer connection was ready, apply it now.
      if (pendingOfferRef.current) {
        const queuedOffer = pendingOfferRef.current;
        pendingOfferRef.current = null;
        await applyIncomingOffer(queuedOffer);
      }

      // Add local stream tracks
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        const existing = remoteStreamRef.current
          .getTracks()
          .some((t) => t.id === event.track.id);

        if (!existing) {
          remoteStreamRef.current.addTrack(event.track);
        }

        event.track.onended = () => {
          const activeTracks = remoteStreamRef.current.getTracks().filter((t) => t.readyState === "live");
          if (activeTracks.length === 0) {
            setHasRemoteMedia(false);
          }
        };

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
          remoteVideoRef.current.play().catch(() => {
            // Autoplay might be blocked; user gesture can start playback.
          });
        }
        setHasRemoteMedia(true);
        setConnected(true);
      };

      // Handle ICE candidates — forward to the other peer via socket signaling
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const appt = appointmentRef.current;
          const targetId = isDoctor
            ? getEntityId(appt?.patientId)
            : getEntityId(appt?.doctorId);
          if (targetId) {
            emit("video:ice-candidate", { candidate: event.candidate, to: targetId, appointmentId });
          }
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        if (
          peerConnection.connectionState === "connected" ||
          peerConnection.connectionState === "completed"
        ) {
          setConnected(true);
          setRemoteWaitingInfo((prev) => ({ ...prev, waiting: false }));
          emitWaitingStatus(false);
        } else if (peerConnection.connectionState === "closed") {
          setConnected(false);
          setHasRemoteMedia(false);
          setRemoteWaitingInfo((prev) => ({ ...prev, waiting: false }));
          emitWaitingStatus(false);
        } else if (
          peerConnection.connectionState === "disconnected" ||
          peerConnection.connectionState === "failed"
        ) {
          setConnected(false);
          setHasRemoteMedia(false);
          setRemoteWaitingInfo((prev) => ({ ...prev, waiting: true }));
          emitWaitingStatus(true);
        }
      };

      setCallActive(true);
      callActiveRef.current = true;
      setRemoteWaitingInfo({ waiting: true, role: isDoctor ? "patient" : "doctor" });
      emitWaitingStatus(true);

      // Patient signals readiness to doctor so doctor can create WebRTC offer
      if (!isDoctor) {
        const doctorId = getDoctorMongoId();
        if (doctorId) {
          // Small delay to ensure socket handlers are registered
          setTimeout(() => {
            emit("video:user-ready", { to: doctorId, appointmentId });
          }, 500);
        }
      }
    } catch (error) {
      if (!isDoctor) {
        patientAutoJoinTriggeredRef.current = false;
      }
      setMediaPermissionDenied(isPermissionDeniedError(error));
      const { title, description } = getMediaAccessErrorDetails(error);
      toast({
        title,
        description,
        variant: "destructive",
      });
    } finally {
      initializingCallRef.current = false;
    }
  };

  const retryVideoConnection = async () => {
    if (reconnecting || initializingCallRef.current) return;

    try {
      setReconnecting(true);
      cleanupCall();
      await initializeCall();
      toast({ title: "Reconnecting...", description: "Trying to refresh video connection." });
    } finally {
      setReconnecting(false);
    }
  };

  // Patient auto-joins as soon as doctor is marked present.
  // This removes extra manual "Join" step and opens video directly.
  useEffect(() => {
    if (isDoctor) return;
    if (!doctorPresent) return;
    if (callActive || callActiveRef.current) return;
    if (patientAutoJoinTriggeredRef.current) return;

    patientAutoJoinTriggeredRef.current = true;
    initializeCall();
  }, [isDoctor, doctorPresent, callActive]);

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) {
      if (mediaPermissionDenied) {
        toast({
          title: "Permission denied",
          description: "Browser blocked microphone/camera. On Mac, enable permissions in System Settings and browser site settings, then reload.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Call media not ready", description: "Please wait a moment and try again.", variant: "destructive" });
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      if (mediaPermissionDenied) {
        toast({
          title: "Permission denied",
          description: "Microphone access is blocked. Allow it in browser settings and Mac privacy settings, then reload.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Call media not ready", description: "Please wait a moment and try again.", variant: "destructive" });
      return;
    }

    const shouldEnable = !audioTracks[0].enabled;
    audioTracks.forEach((track) => {
      track.enabled = shouldEnable;
    });

    peerConnectionRef.current?.getSenders().forEach((sender) => {
      if (sender.track?.kind === "audio") {
        sender.track.enabled = shouldEnable;
      }
    });

    setMuted(!shouldEnable);
  };

  const toggleCamera = async () => {
    const stream = localStreamRef.current;
    if (!stream) {
      if (mediaPermissionDenied) {
        toast({
          title: "Permission denied",
          description: "Browser blocked camera/microphone. On Mac, enable permissions in System Settings and browser site settings, then reload.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Call media not ready", description: "Please wait a moment and try again.", variant: "destructive" });
      return;
    }

    let videoTracks = stream.getVideoTracks();
    const hasVideoTrack = videoTracks.length > 0;

    // If camera track was removed/stopped, reacquire it when user turns camera on.
    if (!hasVideoTrack) {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
          const { title, description } = getMediaAccessErrorDetails({ name: "SecurityError" });
          toast({ title, description, variant: "destructive" });
          return;
        }

        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const newVideoTrack = camStream.getVideoTracks()[0];
        if (!newVideoTrack) {
          toast({ title: "Camera unavailable", variant: "destructive" });
          return;
        }

        stream.addTrack(newVideoTrack);
        const videoSender = peerConnectionRef.current?.getSenders().find((s) => s.track?.kind === "video");
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        } else if (peerConnectionRef.current) {
          peerConnectionRef.current.addTrack(newVideoTrack, stream);
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }

        setCameraOff(false);
        return;
      } catch (error) {
        setMediaPermissionDenied(isPermissionDeniedError(error));
        const { title, description } = getMediaAccessErrorDetails(error);
        toast({ title, description, variant: "destructive" });
        return;
      }
    }

    videoTracks = stream.getVideoTracks();
    const shouldEnable = !videoTracks[0].enabled;
    videoTracks.forEach((track) => {
      track.enabled = shouldEnable;
    });

    peerConnectionRef.current?.getSenders().forEach((sender) => {
      if (sender.track?.kind === "video") {
        sender.track.enabled = shouldEnable;
      }
    });

    setCameraOff(!shouldEnable);
  };

  const performEndCall = async () => {
    const appt = appointmentRef.current;
    const targetId = isDoctor ? getEntityId(appt?.patientId) : getEntityId(appt?.doctorId);
    if (targetId) {
      if (isDoctor) {
        // Doctor ending the call → notify patient so they are also redirected
        emit("video:end-call", { to: targetId, appointmentId });
      }
      // Both roles clear their waiting presence so the other party knows
      emit("video:waiting-status", {
        to: targetId,
        appointmentId,
        waiting: false,
        role: isDoctor ? "doctor" : "patient",
      });
    }

    cleanupCall();

    // Navigate back to respective dashboard
    if (isDoctor) {
      navigate("/doctor/today", { replace: true, state: { refreshAt: Date.now() } });
      return;
    }

    if (normalizedRole === "patient") {
      navigate("/patient", { replace: true });
      return;
    }

    navigate("/", { replace: true });
  };

  const endCall = () => {
    setEndCallConfirmOpen(true);
  };

  const cleanupCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = new MediaStream();
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setCallActive(false);
    callActiveRef.current = false;
    setConnected(false);
    setHasRemoteMedia(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Initializing video call...</p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Appointment not found</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-sky-50 flex items-center justify-center">
                <Video className="h-5 w-5 text-sky-600" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Video Consultation</h1>
            </div>
            <p className="text-slate-600 mt-1 ml-11">
              {isDoctor
                ? <span className="flex items-center gap-1"><User className="h-4 w-4" /> Patient: <strong>{appointment.patientId?.name || "Loading..."}</strong></span>
                : <span className="flex items-center gap-1"><Stethoscope className="h-4 w-4" /> Doctor: <strong>{appointment.doctorId?.name || "Loading..."}</strong></span>
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            {connected ? (
              <Badge className="bg-sky-500 text-white hover:bg-sky-600">● Live</Badge>
            ) : inPatientWaitingRoom ? (
              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">● Waiting Room</Badge>
            ) : (
              <Badge variant="outline" className="text-cyan-600 border-cyan-300">● Connecting...</Badge>
            )}
            <Badge className="bg-sky-100 text-sky-700 border-sky-200">
              <CalendarDays className="h-3 w-3 mr-1" />
              {formatAppointmentDate(appointment.date)} · {appointment.time}
            </Badge>
          </div>
        </div>

        {/* Video Grid */}
        {/* ─── Patient Waiting Room (shown before patient joins) ─── */}
        {inPatientWaitingRoom ? (
          <Card className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="py-14 flex flex-col items-center justify-center gap-6 text-center">
              {doctorPresent ? (
                // Doctor is in the room — patient can join
                <>
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
                    <Video className="h-12 w-12 text-green-600" />
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-white animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-slate-900">
                      Dr. {String(appointment.doctorId?.name || "Doctor").replace(/^dr\.?\s*/i, "")} is ready!
                    </p>
                    <p className="text-sm text-slate-600">Doctor has started the consultation. Connecting you to video now...</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 px-4 py-2 rounded-full">
                    <Loader className="h-3 w-3 animate-spin" /> Starting video...
                  </div>
                  {mediaPermissionDenied && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                      onClick={() => initializeCall()}
                    >
                      Retry Camera/Mic Access
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" onClick={() => navigate("/patient")}>
                    <LogOut className="h-4 w-4 mr-1" /> Leave
                  </Button>
                </>
              ) : (
                // Doctor hasn't joined yet
                <>
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-sky-100">
                    <Stethoscope className="h-12 w-12 text-sky-400 animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-slate-900">Waiting for Doctor to Start</p>
                    <p className="text-sm text-slate-600 max-w-sm">
                      Dr. {String(appointment.doctorId?.name || "Doctor").replace(/^dr\.?\s*/i, "")} hasn't joined yet.
                      You'll be notified automatically when they arrive — no need to refresh.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-sky-50 border border-sky-200 px-4 py-2 rounded-full">
                    <Loader className="h-3 w-3 animate-spin" /> Listening for doctor...
                  </div>
                  <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" onClick={() => navigate("/patient")}>
                    <LogOut className="h-4 w-4 mr-1" /> Leave Waiting Room
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Local Video */}
          <Card className="bg-white border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="aspect-video bg-gradient-to-br from-sky-50 to-cyan-50 flex items-center justify-center relative border border-sky-200">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover rounded-xl ${cameraOff ? "hidden" : ""}`}
              />
              {cameraOff && (
                <div className="flex flex-col items-center justify-center space-y-2 text-slate-600">
                  <VideoOff className="h-12 w-12" />
                  <p className="text-sm">Camera is off</p>
                </div>
              )}
            </div>
            <p className="text-center text-sm text-slate-600 py-2">
              You {isDoctor ? "(Doctor)" : "(Patient)"}
            </p>
          </Card>

          {/* Remote Video */}
          <Card className="bg-white border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="aspect-video bg-gradient-to-br from-sky-50 to-cyan-50 flex items-center justify-center relative border border-sky-200">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={false}
                className={`w-full h-full object-cover rounded-xl ${hasRemoteMedia ? "" : "hidden"}`}
              />
              {!hasRemoteMedia && (
                <div className="flex flex-col items-center justify-center space-y-3 text-slate-600">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                    <Video className="h-8 w-8" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold">
                      {remoteWaitingInfo.waiting
                        ? (remoteWaitingInfo.role === "doctor"
                          ? "Doctor is waiting..."
                          : remoteWaitingInfo.role === "patient"
                            ? "Patient is waiting..."
                            : (isDoctor ? "Waiting for patient..." : "Waiting for doctor..."))
                        : (isDoctor ? "Waiting for patient..." : "Waiting for doctor...")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {remoteWaitingInfo.waiting
                        ? (remoteWaitingInfo.role === "doctor"
                          ? "Doctor has joined and is waiting for you"
                          : remoteWaitingInfo.role === "patient"
                            ? "Patient has joined and is waiting for you"
                            : (isDoctor ? "Patient will join the call shortly" : "Doctor will start the consultation soon"))
                        : (isDoctor ? "Patient will join the call shortly" : "Doctor will start the consultation soon")}
                    </p>
                  </div>
                  <Loader className="h-4 w-4 animate-spin" />
                  {callActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-sky-200 hover:bg-sky-50 hover:border-sky-500"
                      onClick={retryVideoConnection}
                      disabled={reconnecting}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${reconnecting ? "animate-spin" : ""}`} />
                      {reconnecting ? "Refreshing..." : "Refresh Video"}
                    </Button>
                  )}
                </div>
              )}
            </div>
            <p className="text-center text-sm text-slate-600 py-2">
              {isDoctor
                ? appointment.patientId?.name || "Patient"
                : appointment.doctorId?.name || "Doctor"}
            </p>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex justify-center gap-3 flex-wrap">
            {/* Mic */}
            <div className="flex flex-col items-center gap-1">
              <Button
                variant={muted ? "destructive" : "default"}
                size="icon"
                className={`h-12 w-12 rounded-full transition-all duration-200 shadow-lg hover:scale-105 ${
                  !muted 
                    ? 'bg-sky-500 hover:bg-sky-600 border-sky-600 text-white' 
                    : 'text-white'
                }`}
                onClick={toggleMute}
                title={muted ? "Unmute microphone" : "Mute microphone"}
                aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <span className="text-[10px] text-slate-600 font-medium">{muted ? "Mic Off" : "Mic On"}</span>
            </div>

            {/* Camera */}
            <div className="flex flex-col items-center gap-1">
              <Button
                variant={cameraOff ? "destructive" : "default"}
                size="icon"
                className={`h-12 w-12 rounded-full transition-all duration-200 shadow-lg hover:scale-105 ${
                  !cameraOff
                    ? 'bg-sky-500 hover:bg-sky-600 border-sky-600 text-white'
                    : 'text-white'
                }`}
                onClick={toggleCamera}
                title={cameraOff ? "Turn camera on" : "Turn camera off"}
                aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
              >
                {cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </Button>
              <span className="text-[10px] text-slate-600">{cameraOff ? "Camera Off" : "Camera On"}</span>
            </div>

            {/* Prescription (doctor only) */}
            {isDoctor && (
              <div className="flex flex-col items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full bg-white border-slate-200 hover:bg-sky-50 hover:border-sky-500 transition-all duration-200 hover:scale-105"
                  onClick={() => navigate(`/create-prescription/${appointmentId}`)}
                  title="Create prescription"
                  aria-label="Create prescription"
                >
                  <FileText className="h-5 w-5 text-sky-600" />
                </Button>
                <span className="text-[10px] text-slate-600">Prescription</span>
              </div>
            )}

            {/* Complete Consultation (Doctor only) */}
            {isDoctor && (
              <div className="flex flex-col items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full bg-sky-500 hover:bg-sky-600 text-white border-sky-600 transition-all duration-200 hover:scale-105"
                  onClick={completeConsultation}
                  disabled={completingConsultation || consultationCompleted}
                  title="Complete consultation and end call"
                  aria-label="Complete consultation and end call"
                >
                  <CheckCircle className="h-5 w-5" />
                </Button>
                <span className="text-[10px] text-slate-600">{consultationCompleted ? "Completed" : "Complete"}</span>
              </div>
            )}

            {/* End call */}
            <div className="flex flex-col items-center gap-1">
              <Button
                variant="destructive"
                size="icon"
                className="h-12 w-12 rounded-full transition-all duration-200 hover:scale-105"
                onClick={endCall}
                title={isDoctor ? "End the video call" : "Leave the consultation"}
                aria-label={isDoctor ? "End the video call" : "Leave the consultation"}
              >
                {isDoctor ? <PhoneOff className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
              </Button>
              <span className="text-[10px] text-slate-600">{isDoctor ? "End Call" : "Leave"}</span>
            </div>
          </div>
          <p className="text-xs text-slate-600">WebRTC peer-to-peer · End-to-end encrypted</p>
          </div>
          </div>
        )}

        {/* Prescription Panel */}
        <Card className="bg-white border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-sky-200 bg-sky-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-slate-900">
                <ClipboardList className="h-5 w-5 text-sky-600" />
                Prescription
              </CardTitle>
              <div className="flex items-center gap-2">
                {prescription?.status && (
                  <Badge
                    className={`capitalize ${
                      prescription.status === 'issued'
                        ? 'bg-sky-100 text-sky-700 border-sky-200'
                        : 'bg-cyan-100 text-cyan-700 border-cyan-200'
                    }`}
                  >
                    {prescription.status}
                  </Badge>
                )}
                {!isDoctor && !prescription && pollingActive && (
                  <Badge variant="outline" className="text-xs border-slate-200">
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Auto-checking...
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">

            {loadingPrescription ? (
              <div className="flex items-center gap-2 text-sm text-slate-600 py-4">
                <Loader className="h-4 w-4 animate-spin" />
                Loading prescription...
              </div>
            ) : isDoctor ? (
              prescription ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-sky-600" />
                      <span className="font-semibold text-slate-900">Diagnosis:</span>
                      <span className="text-slate-700">{prescription.diagnosis || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-slate-600" />
                      <span className="font-medium text-slate-900">Created:</span>
                      <span className="text-slate-700">{new Date(prescription.createdAt || prescription.issuedAt || Date.now()).toLocaleDateString()}</span>
                    </div>
                    {prescription.medications?.length > 0 && (
                      <p className="text-xs text-slate-600 mt-1">{prescription.medications.length} medication(s) prescribed</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button className="bg-sky-500 hover:bg-sky-600 text-white" onClick={() => setPrescriptionModalOpen(true)}>View Full Prescription</Button>
                  </div>
                </div>
            ) : (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submitPrescription(false); }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="diagnosis">Diagnosis *</Label>
                    <Textarea
                      id="diagnosis"
                      name="diagnosis"
                      rows={2}
                      value={rxForm.diagnosis}
                      onChange={handleRxInputChange}
                      placeholder="Enter diagnosis"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clinicalNotes">Clinical Notes</Label>
                    <Textarea
                      id="clinicalNotes"
                      name="clinicalNotes"
                      rows={2}
                      value={rxForm.clinicalNotes}
                      onChange={handleRxInputChange}
                      placeholder="Optional notes"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="treatmentPlan">Treatment Plan</Label>
                    <Textarea
                      id="treatmentPlan"
                      name="treatmentPlan"
                      rows={2}
                      value={rxForm.treatmentPlan}
                      onChange={handleRxInputChange}
                      placeholder="Treatment plan"
                    />
                  </div>
                  <div>
                    <Label htmlFor="followUpRecommendations">Follow-up Recommendations</Label>
                    <Textarea
                      id="followUpRecommendations"
                      name="followUpRecommendations"
                      rows={2}
                      value={rxForm.followUpRecommendations}
                      onChange={handleRxInputChange}
                      placeholder="Follow-up guidance"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="followUpDate">Follow-up Date</Label>
                    <Input
                      id="followUpDate"
                      name="followUpDate"
                      type="date"
                      min={String(appointment?.date || appointment?.scheduledAt || new Date().toISOString()).split('T')[0]}
                      value={rxForm.followUpDate}
                      onChange={handleRxInputChange}
                    />
                    <p className="text-xs text-slate-500 mt-1">Must be on or after appointment date</p>
                  </div>
                  <div>
                    <Label htmlFor="validUntil">Valid Until *</Label>
                    <Input
                      id="validUntil"
                      name="validUntil"
                      type="date"
                      min={String(appointment?.date || appointment?.scheduledAt || new Date().toISOString()).split('T')[0]}
                      value={rxForm.validUntil}
                      onChange={handleRxInputChange}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Medications *</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addMedication}>
                      <Plus className="h-4 w-4 mr-2" /> Add Medication
                    </Button>
                  </div>
                  {rxForm.medications.map((med, index) => (
                    <div key={index} className="rounded-md border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Medication {index + 1}</span>
                        {rxForm.medications.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMedication(index)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>Name *</Label>
                          <Input value={med.name} onChange={(e) => handleMedicationChange(index, "name", e.target.value)} />
                        </div>
                        <div>
                          <Label>Dosage *</Label>
                          <Input value={med.dosage} onChange={(e) => handleMedicationChange(index, "dosage", e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>Frequency *</Label>
                          <Input value={med.frequency} onChange={(e) => handleMedicationChange(index, "frequency", e.target.value)} />
                        </div>
                        <div>
                          <Label>Duration *</Label>
                          <Input value={med.duration} onChange={(e) => handleMedicationChange(index, "duration", e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <Label>Instructions</Label>
                        <Textarea
                          rows={2}
                          value={med.instructions}
                          onChange={(e) => handleMedicationChange(index, "instructions", e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={rxSubmitting} className="bg-sky-500 hover:bg-sky-600 text-white">
                    {rxSubmitting ? "Saving..." : "Save Draft"}
                  </Button>
                  <Button
                    type="button"
                    disabled={rxSubmitting}
                    onClick={() => submitPrescription(true)}
                    className="bg-sky-500 hover:bg-sky-600 text-white"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Issue to Patient
                  </Button>
                </div>
              </form>
            )
          ) : (
            // ─── PATIENT VIEW ───
              <div className="space-y-4">
                {prescription ? (
                  <>
                    {/* Prescription detail card */}
                    <div className="rounded-xl border border-slate-200 bg-sky-50 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-sky-600" />
                        <span className="font-semibold text-sky-800">Prescription Issued by Doctor</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div className="space-y-1">
                          <p className="text-slate-600 text-xs uppercase tracking-wide">Diagnosis</p>
                          <p className="font-medium text-slate-900">{prescription.diagnosis || "—"}</p>
                        </div>
                        {prescription.treatmentPlan && (
                          <div className="space-y-1">
                            <p className="text-slate-600 text-xs uppercase tracking-wide">Treatment Plan</p>
                            <p className="font-medium text-slate-900">{prescription.treatmentPlan}</p>
                          </div>
                        )}
                        {prescription.followUpRecommendations && (
                          <div className="space-y-1">
                            <p className="text-slate-600 text-xs uppercase tracking-wide">Follow-up</p>
                            <p className="font-medium text-slate-900">{prescription.followUpRecommendations}</p>
                          </div>
                        )}
                        {prescription.medications?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-slate-600 text-xs uppercase tracking-wide">Medications</p>
                            <p className="font-medium text-slate-900">{prescription.medications.map((m: any) => m.name).join(", ")}</p>
                          </div>
                        )}
                      </div>

                    {/* Expandable medications list */}
                    {prescription.medications?.length > 0 && (
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2"
                          onClick={() => setPrescriptionExpanded((p) => !p)}
                        >
                          {prescriptionExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                          {prescriptionExpanded ? "Hide" : "View"} full medication details
                        </Button>
                        {prescriptionExpanded && (
                          <div className="mt-2 space-y-2">
                            {prescription.medications.map((med: any, i: number) => (
                              <div key={i} className="rounded-lg border bg-white/80 p-3 text-xs space-y-1">
                                <p className="font-semibold text-sm">{med.name}</p>
                                <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                                  <span>Dosage: <strong className="text-foreground">{med.dosage}</strong></span>
                                  <span>Frequency: <strong className="text-foreground">{med.frequency}</strong></span>
                                  <span>Duration: <strong className="text-foreground">{med.duration}</strong></span>
                                  {med.instructions && <span className="col-span-2">Instructions: {med.instructions}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={() => setPrescriptionModalOpen(true)} className="bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-2">
                        <FileText className="h-4 w-4" /> View Full Prescription
                      </Button>
                    </div>

                    {/* AI Summary section */}
                    <div className="rounded-xl border border-slate-200 bg-sky-50 p-4 space-y-2">
                      <p className="text-xs font-semibold text-sky-800 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" /> AI Prescription Summary (powered by Gemini)
                      </p>
                    <PrescriptionAISummary
                      medications={prescription.medications || []}
                      diagnosis={prescription.diagnosis || ""}
                      treatmentPlan={prescription.treatmentPlan || ""}
                      followUpRecommendations={prescription.followUpRecommendations || ""}
                    />
                  </div>
                </>
              ) : (
                // ── No prescription yet ──
                <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                  <div className="h-16 w-16 rounded-full bg-sky-100 flex items-center justify-center">
                    <Clock className="h-8 w-8 text-sky-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-base text-slate-900">Prescription Not Generated Yet</p>
                    <p className="text-sm text-slate-600 mt-1 max-w-sm">
                      The doctor hasn't issued a prescription yet. It will appear here automatically once the doctor generates it.
                    </p>
                  </div>
                  {pollingActive ? (
                    <div className="flex items-center gap-2 text-xs text-slate-600 bg-sky-100 px-3 py-1.5 rounded-full">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Checking automatically every 6 seconds...
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-sky-200 hover:bg-sky-50 hover:border-sky-500"
                      onClick={() => { fetchPrescription(); setPollingActive(true); }}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" /> Check Now
                    </Button>
                  )}
                </div>
              )}
            </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Prescription Modal */}
      <Dialog open={endCallConfirmOpen} onOpenChange={setEndCallConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isDoctor ? "End this consultation?" : "Leave this consultation?"}</DialogTitle>
            <DialogDescription>
              You can continue the call, or go back to your dashboard now.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setEndCallConfirmOpen(false)}
            >
              Continue Call
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setEndCallConfirmOpen(false);
                performEndCall();
              }}
            >
              Go to Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Prescription Modal */}
      <Dialog open={prescriptionModalOpen} onOpenChange={setPrescriptionModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-600" />
              Prescription Details
            </DialogTitle>
            <DialogDescription>
              View complete prescription information
            </DialogDescription>
          </DialogHeader>
          
          {prescription && (
            <div className="space-y-4">
              {/* Prescription Header */}
              <div className="bg-sky-50 rounded-lg p-4 border border-sky-200">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-600 font-medium">Patient:</span>
                    <p className="text-slate-900">{appointment?.patientId?.name || appointment?.patientName || "Patient"}</p>
                  </div>
                  <div>
                    <span className="text-slate-600 font-medium">Doctor:</span>
                    <p className="text-slate-900">{appointment?.doctorId?.name || appointment?.doctorName || "Doctor"}</p>
                  </div>
                  <div>
                    <span className="text-slate-600 font-medium">Date:</span>
                    <p className="text-slate-900">{new Date(prescription.createdAt || prescription.issuedAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-600 font-medium">Status:</span>
                    <Badge className="capitalize bg-sky-100 text-sky-700">{prescription.status}</Badge>
                  </div>
                </div>
              </div>

              {/* Diagnosis */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-sky-600" />
                  Diagnosis
                </h3>
                <p className="text-slate-700 bg-slate-50 p-3 rounded-lg">{prescription.diagnosis}</p>
              </div>

              {/* Clinical Notes */}
              {prescription.clinicalNotes && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Clinical Notes</h3>
                  <p className="text-slate-700 bg-slate-50 p-3 rounded-lg">{prescription.clinicalNotes}</p>
                </div>
              )}

              {/* Treatment Plan */}
              {prescription.treatmentPlan && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Treatment Plan</h3>
                  <p className="text-slate-700 bg-slate-50 p-3 rounded-lg">{prescription.treatmentPlan}</p>
                </div>
              )}

              {/* Medications */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-sky-600" />
                  Medications ({prescription.medications?.length || 0})
                </h3>
                <div className="space-y-3">
                  {prescription.medications?.map((med: any, i: number) => (
                    <div key={i} className="border border-slate-200 rounded-lg p-3 bg-white">
                      <p className="font-semibold text-slate-900 mb-2">{i + 1}. {med.name}</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-slate-600">Dosage:</span>
                          <span className="ml-2 text-slate-900 font-medium">{med.dosage}</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Frequency:</span>
                          <span className="ml-2 text-slate-900 font-medium">{med.frequency}</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Duration:</span>
                          <span className="ml-2 text-slate-900 font-medium">{med.duration}</span>
                        </div>
                        {med.quantity > 0 && (
                          <div>
                            <span className="text-slate-600">Quantity:</span>
                            <span className="ml-2 text-slate-900 font-medium">{med.quantity}</span>
                          </div>
                        )}
                      </div>
                      {med.instructions && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <span className="text-slate-600 text-xs">Instructions:</span>
                          <p className="text-slate-900 text-sm mt-1">{med.instructions}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Follow-up */}
              {prescription.followUpRecommendations && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-2">Follow-up Recommendations</h3>
                  <p className="text-slate-700 bg-slate-50 p-3 rounded-lg">{prescription.followUpRecommendations}</p>
                  {prescription.followUpDate && (
                    <p className="text-sm text-slate-600 mt-2">Follow-up Date: {new Date(prescription.followUpDate).toLocaleDateString()}</p>
                  )}
                </div>
              )}

              {/* AI Summary */}
              {!isDoctor && (
                <div className="bg-sky-50 rounded-lg p-4 border border-sky-200">
                  <p className="text-xs font-semibold text-sky-800 mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> AI Prescription Summary
                  </p>
                  <PrescriptionAISummary
                    medications={prescription.medications || []}
                    diagnosis={prescription.diagnosis || ""}
                    treatmentPlan={prescription.treatmentPlan || ""}
                    followUpRecommendations={prescription.followUpRecommendations || ""}
                  />
                </div>
              )}

              {/* Valid Until */}
              {prescription.validUntil && (
                <p className="text-sm text-slate-600 text-center">
                  Valid until: {new Date(prescription.validUntil).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VideoConsultation;
