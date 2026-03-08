import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import api from "@/services/api";
import { Shield, CheckCircle, AlertCircle, Clock, User, Stethoscope, Calendar, Lock, Edit3, Save, X, BadgeCheck } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SPECIALIZATIONS = [
  "Cardiology",
  "Dermatology",
  "Endocrinology",
  "Gastroenterology",
  "General Medicine",
  "General Surgery",
  "Gynecology & Obstetrics",
  "Hematology",
  "Nephrology",
  "Neurology",
  "Oncology",
  "Ophthalmology",
  "Orthopedics",
  "Otolaryngology (ENT)",
  "Pediatrics",
  "Psychiatry",
  "Pulmonology",
  "Radiology",
  "Rheumatology",
  "Urology",
];

const DOCTOR_SYMPTOM_OPTIONS = [
  "Fever",
  "Cough",
  "Headache",
  "Chest Pain",
  "Breathing Difficulty",
  "Stomach Pain",
  "Skin Rash",
  "Joint Pain",
  "Back Pain",
  "Anxiety/Stress",
  "Sleep Problems",
  "General Weakness",
];

const PREDEFINED_QUALIFICATIONS = [
  "MBBS",
  "MD",
  "DO",
  "BDS",
  "BNYS",
  "BAMS",
  "B.Sc Nursing",
  "Other"
];

const PREDEFINED_SPECIALIZATION_QUALIFICATIONS: { [key: string]: string[] } = {
  "Cardiology": ["MD (Cardiology)", "DM (Cardiology)", "FACC"],
  "Dermatology": ["MD (Dermatology)", "DNB (Dermatology)"],
  "Orthopedics": ["MD (Orthopedics)", "DNB (Orthopedics)", "FRCS"],
  "Pediatrics": ["MD (Pediatrics)", "DNB (Pediatrics)"],
  "Gynecology & Obstetrics": ["MD (ObGyn)", "DNB (ObGyn)"],
  "Neurology": ["MD (Neurology)", "DM (Neurology)"],
  "General Medicine": ["MD (Internal Medicine)", "DNB (General Medicine)"],
};

const PREDEFINED_LANGUAGES = [
  "English",
  "Hindi",
  "Marathi",
  "Bengali",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Punjabi",
  "Gujarati",
  "Spanish",
  "French",
  "Arabic",
  "Urdu",
  "Other"
];

const Profile = () => {
  const { user, updateUser, changePassword, sendOtp, verifyOtp, resetPassword } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    age: user?.age?.toString() || "",
    medicalHistory: user?.medicalHistory || "",
    specialization: user?.specialization || "",
    experience: user?.experience?.toString() || "",
    consultationFee: user?.consultationFee?.toString() || "",
    location: user?.location || "",
    city: user?.city || "",
    state: user?.state || "",
    availability: user?.availability || [],
    symptoms: (user?.symptoms && user.symptoms.length > 0 ? user.symptoms : (user as any)?.expertise_symptoms || []).join(", "),
    bio: user?.bio || "",
    qualifications: user?.qualifications || [],
    languages: user?.languages || [],
  });

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordState, setPasswordState] = useState<"initial" | "otp-sent" | "otp-verified">("initial");
  const [otpValue, setOtpValue] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Time slot management
  const [timeSlotDay, setTimeSlotDay] = useState<number>(0);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedDoctorSymptoms, setSelectedDoctorSymptoms] = useState<string[]>([]);
  const [otherSymptomText, setOtherSymptomText] = useState("");
  // Qualifications and Languages management
  const [newQualification, setNewQualification] = useState("");
  const [selectedQualification, setSelectedQualification] = useState("");
  const [newLanguage, setNewLanguage] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("");

  useEffect(() => {
    // Update form when user changes
    if (user) {
      setForm({
        name: user.name || "",
        phone: user.phone || "",
        age: user.age?.toString() || "",
        medicalHistory: user.medicalHistory || "",
        specialization: user.specialization || "",
        experience: user.experience?.toString() || "",
        consultationFee: user.consultationFee?.toString() || "",
        location: user.location || "",
        city: user.city || "",
        state: user.state || "",
        availability: user.availability || [],
        symptoms: ((user.symptoms && user.symptoms.length > 0) ? user.symptoms : (user as any).expertise_symptoms || []).join(", "),
        bio: user.bio || "",
        qualifications: user.qualifications || [],
        languages: user.languages || [],
      });

      const userSymptoms = (user.symptoms && user.symptoms.length > 0)
        ? user.symptoms
        : ((user as any).expertise_symptoms || []);
      const predefined = userSymptoms.filter((symptom) =>
        DOCTOR_SYMPTOM_OPTIONS.some(
          (option) => option.toLowerCase() === String(symptom).toLowerCase()
        )
      );
      const custom = userSymptoms.filter(
        (symptom) =>
          !DOCTOR_SYMPTOM_OPTIONS.some(
            (option) => option.toLowerCase() === String(symptom).toLowerCase()
          )
      );

      setSelectedDoctorSymptoms(predefined.map((s) => String(s)));
      setOtherSymptomText(custom.join(", "));
    }
  }, [user]);

  useEffect(() => {
    const loadCompleteProfile = async () => {
      if (!user) return;
      try {
        const res = await api.get('/auth/me');
        const completeUser = res.data?.user;
        if (!completeUser) return;

        const completeSymptoms =
          (Array.isArray(completeUser.symptoms) && completeUser.symptoms.length > 0)
            ? completeUser.symptoms
            : (Array.isArray(completeUser.expertise_symptoms) ? completeUser.expertise_symptoms : []);

        setForm((prev) => ({
          ...prev,
          specialization: completeUser.specialization || prev.specialization,
          experience: completeUser.experience?.toString() || prev.experience,
          consultationFee: completeUser.consultationFee?.toString() || prev.consultationFee,
          location: completeUser.location || prev.location,
          city: completeUser.city || prev.city,
          state: completeUser.state || prev.state,
          availability: Array.isArray(completeUser.availability) && completeUser.availability.length > 0
            ? completeUser.availability
            : prev.availability,
          symptoms: completeSymptoms.length > 0 ? completeSymptoms.join(', ') : prev.symptoms,
          bio: completeUser.bio || prev.bio,
          qualifications: Array.isArray(completeUser.qualifications) && completeUser.qualifications.length > 0
            ? completeUser.qualifications
            : prev.qualifications,
          languages: Array.isArray(completeUser.languages) && completeUser.languages.length > 0
            ? completeUser.languages
            : prev.languages,
        }));

        const predefined = completeSymptoms.filter((symptom: string) =>
          DOCTOR_SYMPTOM_OPTIONS.some((option) => option.toLowerCase() === String(symptom).toLowerCase())
        );
        const custom = completeSymptoms.filter((symptom: string) =>
          !DOCTOR_SYMPTOM_OPTIONS.some((option) => option.toLowerCase() === String(symptom).toLowerCase())
        );
        setSelectedDoctorSymptoms(predefined.map((s: string) => String(s)));
        setOtherSymptomText(custom.join(', '));
      } catch {
        // Ignore profile sync errors and keep existing values
      }
    };

    loadCompleteProfile();
  }, [user?._id]);

  // OTP timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpTimer > 0) {
      interval = setInterval(() => setOtpTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  if (!user) return null;

  const handleSave = async () => {
    try {
      const updates: Record<string, unknown> = {
        name: form.name,
        phone: form.phone,
      };

      if (user.role === "patient") {
        updates.age = form.age ? parseInt(form.age) : undefined;
        updates.medicalHistory = form.medicalHistory;
      }

      if (user.role === "doctor") {
        const customSymptoms = otherSymptomText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        updates.specialization = form.specialization;
        updates.experience = form.experience ? parseInt(form.experience) : undefined;
        updates.consultationFee = form.consultationFee ? parseInt(form.consultationFee) : undefined;
        updates.location = form.location;
        updates.city = form.city;
        updates.state = form.state;
        updates.availability = form.availability;
        updates.symptoms = [...selectedDoctorSymptoms, ...customSymptoms];
        updates.bio = form.bio;
        updates.qualifications = form.qualifications;
        updates.languages = form.languages;
      }

      const result = await updateUser(user._id, updates);
      if (result.success) {
        toast({ title: "Profile updated successfully", description: result.message });
        setEditing(false);
      } else {
        toast({
          title: "Update failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error updating profile",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const handleSendOtp = async () => {
    try {
      const result = await sendOtp(user.phone);
      if (result.success) {
        setPasswordState("otp-sent");
        setOtpTimer(600); // 10 minutes
        toast({ title: "OTP sent", description: "Check your phone/email" });
      } else {
        toast({ title: "Failed to send OTP", description: result.message, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error sending OTP", description: "Please try again", variant: "destructive" });
    }
  };

  const handleVerifyOtp = async () => {
    try {
      const result = await verifyOtp(user.phone, otpValue);
      if (result.success && result.verified) {
        setPasswordState("otp-verified");
        setOtpTimer(300); // 5 minutes to change password
        toast({ title: "OTP verified successfully" });
      } else {
        toast({ title: "Invalid OTP", description: "Please enter the correct OTP", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error verifying OTP", description: "Please try again", variant: "destructive" });
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast({
        title: "Invalid password",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }

    setPasswordLoading(true);
    try {
      const result = await resetPassword(user.phone, otpValue, newPassword, confirmPassword);
      if (result.success) {
        toast({ title: "Password changed successfully", description: result.message });
        setShowPasswordChange(false);
        setPasswordState("initial");
        setOtpValue("");
        setNewPassword("");
        setConfirmPassword("");
        setOtpTimer(0);
      } else {
        toast({
          title: "Password change failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error changing password",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const addTimeSlot = () => {
    if (!startTime || !endTime) {
      toast({ title: "Please enter both start and end times", variant: "destructive" });
      return;
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      toast({ 
        title: "Invalid time format", 
        description: "Please use HH:MM format (e.g., 09:30)",
        variant: "destructive" 
      });
      return;
    }

    // Convert times to minutes for comparison
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = endHour * 60 + endMin;

    // Check if start time is before end time
    if (startTotalMin >= endTotalMin) {
      toast({ 
        title: "Invalid time range", 
        description: `Start time (${startTime}) must be before end time (${endTime})`,
        variant: "destructive" 
      });
      return;
    }

    // Check for overlapping slots on same day
    const daySlots = form.availability.filter(slot => slot.day === DAYS[timeSlotDay]);
    const hasOverlap = daySlots.some(slot => {
      const [existStart, existEnd] = [slot.startTime, slot.endTime].map(time => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
      });
      // Check if new slot overlaps with existing slot
      return (startTotalMin < existEnd && endTotalMin > existStart);
    });

    if (hasOverlap) {
      toast({ 
        title: "Overlapping time slot", 
        description: `This time conflicts with an existing slot on ${DAYS[timeSlotDay]}`,
        variant: "destructive" 
      });
      return;
    }

    const newSlot = { day: DAYS[timeSlotDay], startTime, endTime };
    const updated = [...form.availability, newSlot];
    setForm((prev) => ({ ...prev, availability: updated }));

    setStartTime("");
    setEndTime("");
    setTimeSlotDay(0);
    toast({ title: "Time slot added successfully" });
  };

  const removeTimeSlot = (index: number) => {
    const updated = form.availability.filter((_, i) => i !== index);
    setForm((prev) => ({ ...prev, availability: updated }));
  };

  const toggleDoctorSymptom = (symptom: string, checked: boolean) => {
    setSelectedDoctorSymptoms((prev) =>
      checked ? [...prev, symptom] : prev.filter((s) => s !== symptom)
    );
  };

  const addQualification = () => {
    const qualToAdd = selectedQualification === "Other" ? newQualification : selectedQualification;
    
    if (!qualToAdd.trim()) {
      toast({ title: "Please select or enter a qualification", variant: "destructive" });
      return;
    }

    if (form.qualifications.includes(qualToAdd.trim())) {
      toast({ title: "This qualification is already added", variant: "destructive" });
      return;
    }
    
    setForm((prev) => ({
      ...prev,
      qualifications: [...prev.qualifications, qualToAdd.trim()],
    }));
    setNewQualification("");
    setSelectedQualification("");
    toast({ title: "Qualification added" });
  };

  const removeQualification = (index: number) => {
    setForm((prev) => ({
      ...prev,
      qualifications: prev.qualifications.filter((_, i) => i !== index),
    }));
  };

  const addLanguage = () => {
    const langToAdd = selectedLanguage === "Other" ? newLanguage : selectedLanguage;
    
    if (!langToAdd.trim()) {
      toast({ title: "Please select or enter a language", variant: "destructive" });
      return;
    }
    if (form.languages.includes(langToAdd.trim())) {
      toast({ title: "Language already added", variant: "destructive" });
      return;
    }
    setForm((prev) => ({
      ...prev,
      languages: [...prev.languages, langToAdd.trim()],
    }));
    setNewLanguage("");
    setSelectedLanguage("");
    toast({ title: "Language added" });
  };

  const removeLanguage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      languages: prev.languages.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-primary/5 p-4 md:p-6 space-y-6 max-w-3xl mx-auto pb-12">

      {/* Hero Header */}
      <div className="rounded-2xl bg-sky-500 p-6 md:p-7 shadow-lg border border-sky-300 text-white">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            {/* Avatar */}
            <div className="relative h-20 w-20 rounded-full bg-white/20 border border-white/35 flex items-center justify-center flex-shrink-0 shadow-lg">
              <User className="h-9 w-9 text-white" />
              <span className="absolute -bottom-1 -right-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-white text-sky-700 px-2 text-[10px] font-bold shadow-sm border border-sky-100">
                {user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold truncate">{user.name}</h1>
                {user.role === "doctor" && user.approvalStatus === "approved" && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-500 text-white border border-emerald-300/60 px-2 py-1 rounded-full shadow-sm">
                    <BadgeCheck className="h-4 w-4" /> Verified
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-white/20 border border-white/30 px-3 py-1 text-xs font-semibold capitalize">
                  {user.role} account
                </span>
                <span className="text-sm text-white/90 truncate">{user.email}</span>
              </div>
            </div>
          </div>

          <Button
            size="sm"
            variant={editing ? "outline" : "secondary"}
            className={editing ? "bg-white/10 border-white/35 text-white hover:bg-white/20 font-semibold" : "bg-white text-sky-700 hover:bg-sky-50 font-semibold border border-white/60"}
            onClick={() => editing ? setEditing(false) : setEditing(true)}
          >
            {editing ? <><X className="h-3.5 w-3.5 mr-1" /> Cancel</> : <><Edit3 className="h-3.5 w-3.5 mr-1" /> Edit Profile</>}
          </Button>
        </div>
      </div>

      {/* Basic Info Card */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3 border-b bg-sky-50">
          <CardTitle className="text-base flex items-center gap-2 text-sky-700">
            <User className="h-4 w-4 text-sky-600" /> Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Full Name</Label>
              <Input
                disabled={!editing}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={!editing ? "bg-muted/30" : ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email <span className="text-[10px] font-normal normal-case text-muted-foreground/70">(cannot be changed)</span></Label>
              <Input disabled value={user.email} className="bg-muted/30" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone</Label>
              <Input
                disabled={!editing}
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="10-digit phone number"
                className={!editing ? "bg-muted/30" : ""}
              />
            </div>
          </div>

          {/* Patient-Specific Fields */}
          {user.role === "patient" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Age</Label>
                <Input
                  disabled={!editing}
                  type="number"
                  min="18"
                  value={form.age}
                  onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))}
                  className={!editing ? "bg-muted/30" : ""}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Medical History</Label>
                <Textarea
                  disabled={!editing}
                  value={form.medicalHistory}
                  onChange={(e) => setForm((p) => ({ ...p, medicalHistory: e.target.value }))}
                  placeholder="Your medical history..."
                  rows={3}
                  className={!editing ? "bg-muted/30" : ""}
                />
              </div>
            </div>
          )}

          {editing && (
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} className="gap-2 transition-all duration-200 hover:scale-105">
                <Save className="h-4 w-4" /> Save Changes
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)} className="transition-all duration-200 hover:scale-105">Cancel</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Doctor-Specific Card */}
      {user.role === "doctor" && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3 border-b bg-cyan-50">
            <CardTitle className="text-base flex items-center gap-2 text-cyan-700">
              <Stethoscope className="h-4 w-4 text-cyan-600" /> Professional Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specialization</Label>
                <Select
                  disabled={!editing}
                  value={form.specialization}
                  onValueChange={(val) => setForm((p) => ({ ...p, specialization: val }))}
                >
                  <SelectTrigger className={!editing ? "bg-muted/30" : "focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all duration-200"}>
                    <SelectValue placeholder="Select specialization" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALIZATIONS.map((spec) => (
                      <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location / Clinic</Label>
                <Input
                  disabled={!editing}
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="Clinic address or area"
                  className={!editing ? "bg-muted/30" : ""}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">City</Label>
                  <Input
                    disabled={!editing}
                    value={form.city}
                    onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                    placeholder="e.g. Mumbai"
                    className={!editing ? "bg-muted/30" : ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">State</Label>
                  <Input
                    disabled={!editing}
                    value={form.state}
                    onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                    placeholder="e.g. Maharashtra"
                    className={!editing ? "bg-muted/30" : ""}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Experience (Years)</Label>
                <Input
                  disabled={!editing}
                  type="number"
                  min="0"
                  max="99"
                  value={form.experience}
                  onChange={(e) => setForm((p) => ({ ...p, experience: e.target.value }))}
                  placeholder="e.g. 8"
                  className={!editing ? "bg-muted/30" : ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-700">Consultation Fee</Label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-700 font-bold text-lg">₹</span>
                  <Input
                    disabled={!editing}
                    type="number"
                    min="0"
                    value={form.consultationFee}
                    onChange={(e) => setForm((p) => ({ ...p, consultationFee: e.target.value }))}
                    placeholder="e.g. 800"
                    className={!editing ? "bg-muted/30" : ""}
                  />
                </div>
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Professional Bio
              </Label>
              <Textarea
                disabled={!editing}
                value={form.bio}
                onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Write a brief description about yourself, your expertise, and approach to patient care..."
                rows={4}
                className={!editing ? "bg-muted/30" : ""}
              />
            </div>

            {/* Qualifications */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Qualifications & Degrees
              </Label>
              {editing && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div className="col-span-1">
                      <Label className="text-xs mb-1.5 block">Select or Custom</Label>
                      <Select value={selectedQualification} onValueChange={setSelectedQualification}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose qualification..." />
                        </SelectTrigger>
                        <SelectContent>
                          {PREDEFINED_QUALIFICATIONS.map((qual) => (
                            <SelectItem key={qual} value={qual}>{qual}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedQualification === "Other" && (
                      <div className="col-span-1">
                        <Label className="text-xs mb-1.5 block">Custom Value</Label>
                        <Input
                          value={newQualification}
                          onChange={(e) => setNewQualification(e.target.value)}
                          placeholder="e.g., FRCS, DNB"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addQualification();
                            }
                          }}
                        />
                      </div>
                    )}
                    <Button size="sm" onClick={addQualification} className="col-span-1 transition-all duration-200 hover:scale-105">Add</Button>
                  </div>
                </div>
              )}
              {form.qualifications.length > 0 ? (
                <div className="space-y-2">
                  {form.qualifications.map((qual: string, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-2.5">
                      <span className="text-sm font-medium text-foreground">{qual}</span>
                      {editing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeQualification(i)}
                          className="text-destructive h-7 px-2 text-xs transition-all duration-200 hover:scale-105"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No qualifications added yet.</p>
              )}
            </div>

            {/* Languages */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Languages Spoken
              </Label>
              {editing && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div className="col-span-1">
                      <Label className="text-xs mb-1.5 block">Select or Custom</Label>
                      <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose language..." />
                        </SelectTrigger>
                        <SelectContent>
                          {PREDEFINED_LANGUAGES.map((lang) => (
                            <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedLanguage === "Other" && (
                      <div className="col-span-1">
                        <Label className="text-xs mb-1.5 block">Custom Value</Label>
                        <Input
                          value={newLanguage}
                          onChange={(e) => setNewLanguage(e.target.value)}
                          placeholder="e.g., Mandarin, Portuguese"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addLanguage();
                            }
                          }}
                        />
                      </div>
                    )}
                    <Button size="sm" onClick={addLanguage} className="col-span-1 transition-all duration-200 hover:scale-105">Add</Button>
                  </div>
                </div>
              )}
              {form.languages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {form.languages.map((lang: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-sm px-3 py-1">
                      {lang}
                      {editing && (
                        <button
                          onClick={() => removeLanguage(i)}
                          className="ml-2 text-destructive hover:text-destructive/80"
                          aria-label="Remove language"
                          title="Remove language"
                        >
                          ×
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No languages added yet.</p>
              )}
            </div>

            {/* Available Time Slots */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-700 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-sky-600" /> Available Time Slots
              </Label>
              {editing && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <Select value={timeSlotDay.toString()} onValueChange={(val) => setTimeSlotDay(parseInt(val))}>
                      <SelectTrigger className="border-sky-200"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAYS.map((day, i) => <SelectItem key={day} value={i.toString()}>{day}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="Start" className="border-sky-200" />
                    <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="End" className="border-sky-200" />
                  </div>
                  <Button size="sm" onClick={addTimeSlot} className="w-full bg-sky-500 hover:bg-sky-600 text-white transition-all duration-200 hover:scale-105">Add Slot</Button>
                </div>
              )}
              {form.availability.length > 0 ? (
                <div className="space-y-2">
                  {form.availability.map((slot: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                      <span className="text-sm font-semibold text-slate-700">
                        {slot.day}: 
                        <span className="font-normal text-slate-600 ml-2">{slot.startTime} → {slot.endTime}</span>
                      </span>
                      {editing && (
                        <Button size="sm" variant="ghost" onClick={() => removeTimeSlot(i)} className="text-red-600 hover:text-red-700 h-7 px-2 text-xs transition-all duration-200 hover:scale-105">Remove</Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600 bg-sky-50 rounded-lg p-3 border border-sky-100">No time slots added yet</p>
              )}
            </div>

            {/* Symptoms You Treat */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Symptoms You Treat</Label>
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DOCTOR_SYMPTOM_OPTIONS.map((symptom) => (
                    <label key={symptom} className="flex items-center gap-2.5 text-sm cursor-pointer">
                      <Checkbox
                        disabled={!editing}
                        checked={selectedDoctorSymptoms.includes(symptom)}
                        onCheckedChange={(checked) => toggleDoctorSymptom(symptom, Boolean(checked))}
                      />
                      <span className={!editing ? "text-muted-foreground" : ""}>{symptom}</span>
                    </label>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Other (comma separated)</Label>
                  <Input
                    disabled={!editing}
                    value={otherSymptomText}
                    onChange={(e) => setOtherSymptomText(e.target.value)}
                    placeholder="e.g. migraine, sinusitis"
                    className={!editing ? "bg-muted/30" : ""}
                  />
                </div>
              </div>
            </div>

            {editing && (
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} className="gap-2 transition-all duration-200 hover:scale-105"><Save className="h-4 w-4" /> Save Changes</Button>
                <Button variant="outline" onClick={() => setEditing(false)} className="transition-all duration-200 hover:scale-105">Cancel</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Change Password Card */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3 border-b bg-red-50">
          <CardTitle className="text-base flex items-center gap-2 text-red-700">
            <Shield className="h-4 w-4 text-red-600" /> Security &amp; Password
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {!showPasswordChange ? (
            <Button variant="outline" className="gap-2 transition-all duration-200 hover:scale-105" onClick={() => setShowPasswordChange(true)}>
              <Lock className="h-4 w-4" /> Change Password
            </Button>
          ) : passwordState === "initial" ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
              <p className="text-sm text-muted-foreground">We'll send an OTP to your registered phone for verification.</p>
              <div className="flex gap-2">
                <Button onClick={handleSendOtp} size="sm" className="transition-all duration-200 hover:scale-105">Send OTP</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowPasswordChange(false)} className="transition-all duration-200 hover:scale-105">Cancel</Button>
              </div>
            </div>
          ) : passwordState === "otp-sent" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Enter the OTP sent to your phone.</p>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label>OTP Code</Label>
                  <Input placeholder="Enter 6-digit OTP" maxLength={6} value={otpValue} onChange={(e) => setOtpValue(e.target.value)} className="focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200" />
                </div>
                {otpTimer > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground pb-3">
                    <Clock className="h-3.5 w-3.5" />
                    {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, "0")}
                  </div>
                )}
              </div>
              <Button onClick={handleVerifyOtp} disabled={otpValue.length !== 6} size="sm" className="transition-all duration-200 hover:scale-105">Verify OTP</Button>
              {otpTimer === 0 && (
                <Button variant="link" size="sm" onClick={handleSendOtp} className="transition-all duration-200 hover:scale-105">Resend OTP</Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 border border-green-200">
                <CheckCircle className="h-4 w-4" /> OTP Verified - set your new password
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>New Password</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="min 8 chars" className="focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200" />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm Password</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" className="focus:ring-2 focus:ring-sky-200 focus:border-sky-500 transition-all duration-200" />
                </div>
              </div>
              {otpTimer > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Time remaining: {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, "0")}
                </p>
              )}
              <div className="flex gap-2">
                <Button onClick={handleChangePassword} disabled={passwordLoading || otpTimer === 0} size="sm" className="transition-all duration-200 hover:scale-105">
                  {passwordLoading ? "Updating..." : "Update Password"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  setShowPasswordChange(false);
                  setPasswordState("initial");
                  setOtpValue(""); setNewPassword(""); setConfirmPassword(""); setOtpTimer(0);
                }} className="transition-all duration-200 hover:scale-105">Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Warnings */}
      {user.adminWarnings && user.adminWarnings.length > 0 && (
        <Card className="border-0 shadow-lg border-l-4 border-l-destructive">
          <CardHeader className="pb-3 border-b bg-red-50/40">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" /> System Warnings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-2">
            {user.adminWarnings.map((warning: any, i: number) => (
              <div key={i} className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                • {warning.message || warning}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Profile;