import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pill, AlertCircle, Clock, CheckCircle, Zap } from "lucide-react";

interface AISummaryProps {
  prescription: {
    medicines: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      purpose: string;
    }>;
    precautions: string[];
    sideEffects: string[];
    followUpDate?: string;
    notes?: string;
  };
  loading?: boolean;
  aiGenerated?: boolean;
}

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिंदी (Hindi)" },
  { code: "mr", name: "मराठी (Marathi)" },
  { code: "ta", name: "தமிழ் (Tamil)" },
  { code: "te", name: "తెలుగు (Telugu)" },
  { code: "bn", name: "বাংলা (Bengali)" },
  { code: "gu", name: "ગુજરાતી (Gujarati)" },
];

export const AIPrescriptionSummary = ({ prescription, loading = false, aiGenerated = true }: AISummaryProps) => {
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [showDetails, setShowDetails] = useState(false);

  if (loading) {
    return (
      <Card className="border-2 border-sky-200 bg-sky-50">
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <div className="inline-block animate-spin">
              <Zap className="h-6 w-6 text-sky-600" />
            </div>
            <p className="text-sm text-muted-foreground">Generating AI Summary...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Language Selector */}
      <div className="flex items-center gap-2">
        <Label className="text-xs font-semibold uppercase text-muted-foreground">View in:</Label>
        <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Doctor's Instructions Card */}
      <Card className="border-2 border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            Doctor's Instructions for You
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Medicines Section */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2 text-green-800">
              <Pill className="h-4 w-4" />
              Your Medicines
            </Label>
            {prescription.medicines.map((med, idx) => (
              <div
                key={idx}
                className="bg-white rounded-lg border border-green-200 p-3 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{med.name}</p>
                    <p className="text-sm text-muted-foreground">{med.dosage}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    {med.frequency}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <p>
                    <strong>Duration:</strong> {med.duration}
                  </p>
                  <p>
                    <strong>Purpose:</strong> {med.purpose}
                  </p>
                </div>
                <div className="flex gap-1 pt-1">
                  <Badge variant="outline" className="text-xs">
                    Take as prescribed
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Precautions */}
          {prescription.precautions.length > 0 && (
            <div className="space-y-2 pt-3 border-t">
              <Label className="text-sm font-semibold flex items-center gap-2 text-orange-700">
                <AlertCircle className="h-4 w-4" />
                Important Precautions
              </Label>
              <ul className="space-y-2">
                {prescription.precautions.map((precaution, idx) => (
                  <li
                    key={idx}
                    className="flex gap-2 text-sm bg-orange-50 p-2 rounded border border-orange-200"
                  >
                    <span className="text-orange-600 font-bold min-w-fit">•</span>
                    <span>{precaution}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Side Effects */}
          {prescription.sideEffects.length > 0 && (
            <div className="space-y-2 pt-3 border-t">
              <Label className="text-sm font-semibold flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                Possible Side Effects (Consult Doctor If Severe)
              </Label>
              <ul className="space-y-1">
                {prescription.sideEffects.map((effect, idx) => (
                  <li
                    key={idx}
                    className="flex gap-2 text-sm text-muted-foreground bg-red-50 p-2 rounded border border-red-200"
                  >
                    <span className="text-red-600 font-bold">⚠</span>
                    <span>{effect}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Follow-up */}
          {prescription.followUpDate && (
            <div className="space-y-2 pt-3 border-t bg-blue-50 p-3 rounded">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                <Clock className="h-4 w-4" />
                Follow-up Appointment
              </div>
              <p className="text-sm">{prescription.followUpDate}</p>
            </div>
          )}

          {/* Additional Notes */}
          {prescription.notes && (
            <div className="space-y-2 pt-3 border-t">
              <Label className="text-sm font-semibold">Additional Information</Label>
              <p className="text-sm text-muted-foreground">{prescription.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setShowDetails(!showDetails)}
          className="flex-1"
        >
          {showDetails ? "Hide Details" : "Show More Details"}
        </Button>
        <Button className="flex-1 bg-sky-500 hover:bg-sky-600">
          Print Prescription
        </Button>
      </div>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Label } from "@/components/ui/label";

export default AIPrescriptionSummary;
