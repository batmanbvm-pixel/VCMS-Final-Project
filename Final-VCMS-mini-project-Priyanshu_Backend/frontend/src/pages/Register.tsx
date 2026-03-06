  import { useState } from "react";
  import { Link, useNavigate } from "react-router-dom";
  import { useAuth, UserRole } from "@/contexts/AuthContext";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { Activity, ArrowRight, Stethoscope, User, AlertCircle, CheckCircle } from "lucide-react";
  import { useToast } from "@/hooks/use-toast";

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
  ] as const;

  const Register = () => {
    const [role, setRole] = useState<UserRole>("patient");
    const [formData, setFormData] = useState({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      specialization: "", // holds dropdown value (or "other")
      experience: "", // years of practice for doctors
      dateOfBirth: "",
    });
    const [otherSpecialization, setOtherSpecialization] = useState("");
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { register } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    // Validation functions
    const validateEmail = (email: string) => {
      if (!email) return false;
      const trimmed = email.trim();
      const basicRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!basicRegex.test(trimmed)) return false;
      const parts = trimmed.split('@');
      if (parts.length !== 2) return false;
      const domain = parts[1].toLowerCase();
      // Only allow Gmail addresses for this project
      return domain === 'gmail.com';
    };

    const validatePhone = (phone: string) => {
      const cleanPhone = phone.replace(/\D/g, '');
      return cleanPhone.length === 10;
    };

    const validatePassword = (password: string) => {
      const regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      return regex.test(password);
    };

    const validateDOB = (dob: string) => {
      if (!dob) return false;
      const birthDate = new Date(dob);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        return age - 1 >= 18;
      }
      return age >= 18;
    };

    const validateForm = () => {
      const newErrors: Record<string, string> = {};

      // Name validation: allow letters, digits, spaces and _ - . ' characters
      // Require at least one alphabetic letter to avoid purely numeric names
      const nameAllowedRegex = /^[A-Za-z0-9 _\-.'À-ÖØ-öø-ÿ]+$/;
      const hasLetterRegex = /[A-Za-z]/;

      if (!formData.firstName || formData.firstName.trim() === "") {
        newErrors.firstName = "First name is required";
      } else {
        const v = formData.firstName.trim();
        if (!nameAllowedRegex.test(v)) newErrors.firstName = "First name contains invalid characters";
        else if (!hasLetterRegex.test(v)) newErrors.firstName = "First name must include at least one letter";
      }

      if (!formData.lastName || formData.lastName.trim() === "") {
        newErrors.lastName = "Last name is required";
      } else {
        const v = formData.lastName.trim();
        if (!nameAllowedRegex.test(v)) newErrors.lastName = "Last name contains invalid characters";
        else if (!hasLetterRegex.test(v)) newErrors.lastName = "Last name must include at least one letter";
      }

      // username removed: generated server-side from name or email

      if (!formData.email || !validateEmail(formData.email)) {
        newErrors.email = "Valid Gmail address is required (example@gmail.com)";
      }

      if (!formData.phone || !validatePhone(formData.phone)) {
        newErrors.phone = "Phone must be 10 digits";
      }

      if (!formData.password || !validatePassword(formData.password)) {
        newErrors.password = "Password must be 8+ chars with uppercase, number, and special char";
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }

      if (role === "patient") {
        if (!formData.dateOfBirth || !validateDOB(formData.dateOfBirth)) {
          newErrors.dateOfBirth = "You must be at least 18 years old";
        }
      }
      if (role === "doctor") {
        const exp = parseInt(formData.experience);
        if (isNaN(exp) || exp < 0) {
          newErrors.experience = "Enter a valid number of years";
        }
        if (!formData.specialization || formData.specialization === '') {
          newErrors.specialization = "Please select a specialization";
        } else if (formData.specialization === 'other') {
          if (!otherSpecialization || otherSpecialization.trim() === '') {
            newErrors.otherSpecialization = "Please specify your specialization";
          }
        }
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      // Clear error when user starts typing
      if (errors[name]) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    };

    const validateField = (name: string, value: string) => {
      const newErrors: Record<string, string> = { ...errors };
      const setError = (k: string, msg: string) => { newErrors[k] = msg; };
      const clearError = (k: string) => { delete newErrors[k]; };

      switch (name) {
        case "firstName": {
          const nameAllowedRegex = /^[A-Za-z0-9 _\-.'À-ÖØ-öø-ÿ]+$/;
          const hasLetterRegex = /[A-Za-z]/;
          if (!value || value.trim() === "") setError("firstName", "First name is required");
          else if (!nameAllowedRegex.test(value)) setError("firstName", "First name contains invalid characters");
          else if (!hasLetterRegex.test(value)) setError("firstName", "First name must include at least one letter");
          else clearError("firstName");
          break;
        }
        case "lastName": {
          const nameAllowedRegex = /^[A-Za-z0-9 _\-.'À-ÖØ-öø-ÿ]+$/;
          const hasLetterRegex = /[A-Za-z]/;
          if (!value || value.trim() === "") setError("lastName", "Last name is required");
          else if (!nameAllowedRegex.test(value)) setError("lastName", "Last name contains invalid characters");
          else if (!hasLetterRegex.test(value)) setError("lastName", "Last name must include at least one letter");
          else clearError("lastName");
          // Cross-field: if last name entered but first name missing
          if (value && (!formData.firstName || formData.firstName.trim() === "")) {
            setError("firstName", "Please enter first name before last name");
          }
          break;
        }
        case "email":
          if (!validateEmail(value)) setError("email", "Valid Gmail address is required (example@gmail.com)");
          else clearError("email");
          break;
        case "phone":
          if (!validatePhone(value)) setError("phone", "Phone must be 10 digits");
          else clearError("phone");
          break;
        case "password":
          if (!validatePassword(value)) setError("password", "Password must be 8+ chars with uppercase, number, and special char");
          else clearError("password");
          // also check confirm match
          if (formData.confirmPassword && value !== formData.confirmPassword) setError("confirmPassword", "Passwords do not match");
          else if (formData.confirmPassword && value === formData.confirmPassword) clearError("confirmPassword");
          break;
        case "confirmPassword":
          if (value !== formData.password) setError("confirmPassword", "Passwords do not match");
          else clearError("confirmPassword");
          break;
        case "dateOfBirth":
          if (role === "patient") {
            if (!validateDOB(value)) setError("dateOfBirth", "You must be at least 18 years old");
            else clearError("dateOfBirth");
          }
          break;
        case "experience":
          if (role === "doctor") {
            const num = parseInt(value);
            if (isNaN(num) || num < 0) setError("experience", "Enter a valid number of years");
            else clearError("experience");
          }
          break;
        case "specialization":
          if (role === "doctor") {
            if (!value || value === '') setError("specialization", "Please select a specialization");
            else clearError("specialization");
          }
          break;
        case "otherSpecialization":
          if (!value || value.trim() === '') setError("otherSpecialization", "Please specify your specialization");
          else clearError("otherSpecialization");
          break;
        default:
          break;
      }

      setErrors(newErrors);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      validateField(name, value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm()) {
        toast({
          title: "Validation Error",
          description: "Please fix the errors above",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);

      const result = await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        role,
        ...(role === "doctor" && {
          specialization: formData.specialization === 'other' ? otherSpecialization.trim() : formData.specialization,
          experience: parseInt(formData.experience) || 0,
        }),
        ...(role === "patient" && {
          dateOfBirth: formData.dateOfBirth,
        }),
      });

      if (result.success) {
        toast({
          title: "Registration Submitted",
          description: "Your registration is pending admin approval. Please check back later.",
        });
        navigate("/login");
      } else {
        toast({
          title: "Registration failed",
          description: result.message,
          variant: "destructive",
        });
      }

      setLoading(false);
    };

    return (
      <div className="min-h-screen bg-white">
        <div className="w-full max-w-[550px] mx-auto py-12 px-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Create your account</h1>
              <p className="text-slate-600">Join MediConnect — select your role</p>
            </div>

            {/* Role selector */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                type="button"
                onClick={() => setRole("patient")}
                aria-pressed={role === "patient"}
                className={`flex flex-col items-center gap-3 rounded-xl p-6 transition-all border ${
                  role === "patient"
                    ? "bg-sky-50 border-sky-500 shadow-sm scale-[1.01]"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:scale-[1.01]"
                }`}
              >
                <User className={`h-8 w-8 ${role === "patient" ? "text-sky-600" : "text-slate-400"}`} />
                <span className={`text-sm font-semibold ${role === "patient" ? "text-sky-700" : "text-slate-600"}`}>Patient</span>
                <span className="text-xs text-slate-500 text-center">Book & consult</span>
              </button>
              <button
                type="button"
                onClick={() => setRole("doctor")}
                aria-pressed={role === "doctor"}
                className={`flex flex-col items-center gap-3 rounded-xl p-6 transition-all border ${
                  role === "doctor"
                    ? "bg-sky-50 border-sky-500 shadow-sm scale-[1.01]"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:scale-[1.01]"
                }`}
              >
                <Stethoscope className={`h-8 w-8 ${role === "doctor" ? "text-sky-600" : "text-slate-400"}`} />
                <span className={`text-sm font-semibold ${role === "doctor" ? "text-sky-700" : "text-slate-600"}`}>Doctor</span>
                <span className="text-xs text-slate-500 text-center">Manage patients</span>
              </button>
            </div>

            {/* Approval notice */}
            <div className="flex items-start gap-3 p-4 bg-sky-50 border border-sky-200 rounded-xl mb-6">
              <AlertCircle className="h-5 w-5 text-sky-900 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-sky-900">
                Your registration is reviewed by an admin.{" "}
                {role === "doctor"
                  ? "Once approved, login to update your profile and start seeing patients."
                  : "Once approved, login to book appointments and consult doctors."}
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Name row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-slate-700 font-medium text-sm">First Name</Label>
                  <Input
                    id="firstName" name="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleChange} onBlur={handleBlur}
                    className={`input-premium h-11 ${errors.firstName ? "border-red-500/50" : ""}`}
                  />
                  {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-slate-700 font-medium text-sm">Last Name</Label>
                  <Input
                    id="lastName" name="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleChange} onBlur={handleBlur}
                    className={`input-premium h-11 ${errors.lastName ? "border-red-500/50" : ""}`}
                  />
                  {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-medium text-sm">Email Address</Label>
                <Input
                  id="email" name="email" type="email"
                  placeholder="example@gmail.com"
                  value={formData.email}
                  onChange={handleChange} onBlur={handleBlur}
                  className={`input-premium h-11 ${errors.email ? "border-red-500/50" : ""}`}
                />
                {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-700 font-medium text-sm">Phone Number</Label>
                <Input
                  id="phone" name="phone"
                  placeholder="9876543210 (10 digits)"
                  value={formData.phone}
                  onChange={handleChange} onBlur={handleBlur}
                  className={`input-premium h-11 ${errors.phone ? "border-red-500/50" : ""}`}
                />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
              </div>

              {/* Doctor-specific fields */}
              {role === "doctor" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="specialization" className="text-slate-700 font-medium text-sm">Specialization *</Label>
                    <Select
                      value={formData.specialization}
                      onValueChange={(val) => {
                        setFormData((prev) => ({ ...prev, specialization: val }));
                        if (val) setErrors((prev) => { const e = { ...prev }; delete e.specialization; return e; });
                        if (val !== 'other') { setOtherSpecialization(""); setErrors((prev) => { const e = { ...prev }; delete e.otherSpecialization; return e; }); }
                      }}
                    >
                      <SelectTrigger className={`input-premium h-11 ${errors.specialization ? "border-red-500/50" : ""}`}>
                        <SelectValue placeholder="Select your specialization" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200">
                        <SelectItem value="none">None</SelectItem>
                        {SPECIALIZATIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.specialization && <p className="text-xs text-red-500">{errors.specialization}</p>}
                  </div>
                  {formData.specialization === 'other' && (
                    <div className="space-y-2">
                      <Label htmlFor="otherSpecialization" className="text-slate-700 font-medium text-sm">Please Specify *</Label>
                      <Input
                        id="otherSpecialization" name="otherSpecialization"
                        placeholder="Enter your specialization"
                        value={otherSpecialization}
                        onChange={(e) => { setOtherSpecialization(e.target.value); if (e.target.value.trim()) setErrors((prev) => { const er = { ...prev }; delete er.otherSpecialization; return er; }); }}
                        onBlur={(e) => { if (!e.target.value.trim()) setErrors((prev) => ({ ...prev, otherSpecialization: "Please specify your specialization" })); }}
                        className={`input-premium h-11 ${errors.otherSpecialization ? "border-red-500/50" : ""}`}
                      />
                      {errors.otherSpecialization && <p className="text-xs text-red-500">{errors.otherSpecialization}</p>}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="experience" className="text-slate-700 font-medium text-sm">Years of Experience *</Label>
                    <Input
                      id="experience" name="experience" type="number" min="0"
                      placeholder="e.g. 5"
                      value={formData.experience}
                      onChange={handleChange} onBlur={handleBlur}
                      className={`input-premium h-11 ${errors.experience ? "border-red-500/50" : ""}`}
                    />
                    {errors.experience && <p className="text-xs text-red-500">{errors.experience}</p>}
                  </div>
                </>
              )}

              {/* Patient-specific field */}
              {role === "patient" && (
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth" className="text-slate-700 font-medium text-sm">Date of Birth * (18+)</Label>
                  <Input
                    id="dateOfBirth" name="dateOfBirth" type="date"
                    value={formData.dateOfBirth}
                    onChange={handleChange} onBlur={handleBlur}
                    className={`input-premium h-11 ${errors.dateOfBirth ? "border-red-500/50" : ""}`}
                  />
                  {errors.dateOfBirth && <p className="text-xs text-red-500">{errors.dateOfBirth}</p>}
                </div>
              )}

              {/* Password row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 font-medium text-sm">Password</Label>
                  <Input
                    id="password" name="password" type="password"
                    placeholder="Aa1@xxxx"
                    value={formData.password}
                    onChange={handleChange} onBlur={handleBlur}
                    className={`input-premium h-11 ${errors.password ? "border-red-500/50" : ""}`}
                  />
                  {errors.password && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                      <p className="text-xs text-red-700 font-medium flex items-start gap-2">
                        <span className="text-red-500 font-bold">✗</span>
                        <span>{errors.password}</span>
                      </p>
                    </div>
                  )}
                  {!errors.password && formData.password && validatePassword(formData.password) && (
                    <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 mt-2">
                      <p className="text-xs text-sky-700 font-medium flex items-start gap-2">
                        <span className="text-sky-500 font-bold">✓</span>
                        <span>Password meets all requirements</span>
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-700 font-medium text-sm">Confirm Password</Label>
                  <Input
                    id="confirmPassword" name="confirmPassword" type="password"
                    placeholder="Aa1@xxxx"
                    value={formData.confirmPassword}
                    onChange={handleChange} onBlur={handleBlur}
                    className={`input-premium h-11 ${errors.confirmPassword ? "border-red-500/50" : ""}`}
                  />
                  {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword}</p>}
                </div>
              </div>

              {/* Password strength indicator */}
              {formData.password && (
                <div className="space-y-2 bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 font-medium">Password Strength:</span>
                    <span className={`font-bold ${validatePassword(formData.password) ? "text-sky-600" : "text-amber-600"}`}>
                      {validatePassword(formData.password) ? "✓ Strong" : "■ Weak"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    8+ chars, 1 uppercase, 1 number & 1 special char (@$!%*?&)
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full btn-premium h-11 text-base flex items-center justify-center gap-2 mt-2
                  ${loading ? "opacity-70 cursor-not-allowed" : "transition-all duration-200 hover:scale-[1.01]"}`}
              >
                {loading ? (
                  <><div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating account...</>
                ) : (
                  <><span>Create Account</span><ArrowRight className="h-5 w-5" /></>
                )}
              </button>

              <p className="text-center text-sm text-slate-600 pt-4">
                Already have an account?{" "}
                <Link to="/login" className="text-sky-600 hover:text-sky-700 font-semibold">Sign in</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  };

  export default Register;
