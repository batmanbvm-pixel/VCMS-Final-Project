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
import { AlertCircle, FileText, Zap, CheckCircle, Eye } from "lucide-react";

interface ReportAnalyzerAISummaryProps {
  reportType: "blood-test" | "xray" | "ultrasound" | "ct-scan" | "general";
  loading?: boolean;
  summary?: {
    findings: string[];
    normalValues: string[];
    abnormalValues: string[];
    recommendations: string[];
    followUp?: string;
  };
  error?: {
    type: "not-medical" | "insufficient-text" | "processing-error";
    message: string;
  };
}

const REPORT_TYPES = {
  "blood-test": {
    name: "Blood Test",
    icon: "🩸",
    color: "red",
  },
  xray: {
    name: "X-Ray",
    icon: "📋",
    color: "blue",
  },
  ultrasound: {
    name: "Ultrasound",
    icon: "📊",
    color: "cyan",
  },
  "ct-scan": {
    name: "CT Scan",
    icon: "🔬",
    color: "blue",
  },
  general: {
    name: "General Report",
    icon: "📄",
    color: "slate",
  },
};

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिंदी (Hindi)" },
  { code: "mr", name: "मराठी (Marathi)" },
  { code: "ta", name: "தமிழ்" },
  { code: "te", name: "తెలుగు" },
];

export const ReportAnalyzerAISummary = ({
  reportType = "general",
  loading = false,
  summary,
  error,
}: ReportAnalyzerAISummaryProps) => {
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const report = REPORT_TYPES[reportType as keyof typeof REPORT_TYPES];

  if (loading) {
    return (
      <Card className="border-2 border-sky-200 bg-sky-50">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <div className="inline-block animate-spin">
              <Zap className="h-8 w-8 text-sky-600" />
            </div>
            <p className="text-sm font-semibold text-sky-700">Analyzing Report...</p>
            <p className="text-xs text-muted-foreground">Using AI OCR & Analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const errorConfig = {
      "not-medical": {
        icon: AlertCircle,
        title: "⚠️ Not a Medical Document",
        color: "red",
        bgColor: "bg-red-50",
        borderColor: "border-red-300",
      },
      "insufficient-text": {
        icon: FileText,
        title: "⚠️ Unable to Extract Text",
        color: "orange",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-300",
      },
      "processing-error": {
        icon: AlertCircle,
        title: "❌ Processing Error",
        color: "red",
        bgColor: "bg-red-50",
        borderColor: "border-red-300",
      },
    };

    const config = errorConfig[error.type];
    const Icon = config.icon;

    return (
      <Card className={`border-2 ${config.bgColor} ${config.borderColor}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-red-700">
            <Icon className="h-5 w-5" />
            {config.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <p className="text-xs text-muted-foreground mt-3">
            💡 <strong>Tip:</strong> Please upload a clear medical report or prescription image.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-muted-foreground">No analysis available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Language Selector */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{report.icon}</span>
          <div>
            <h3 className="font-semibold text-foreground">{report.name}</h3>
            <p className="text-xs text-muted-foreground">AI Analysis</p>
          </div>
        </div>
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

      {/* Main Summary Card */}
      <Card className="border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white">
        <CardHeader className="pb-3 border-b bg-sky-50">
          <CardTitle className="text-base flex items-center gap-2 text-sky-700">
            <Zap className="h-5 w-5" />
            AI Summary & Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          {/* Normal Findings */}
          {summary.normalValues && summary.normalValues.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2 text-green-700">
                <CheckCircle className="h-4 w-4" />
                Normal Values
              </Label>
              <div className="space-y-1.5">
                {summary.normalValues.map((value, idx) => (
                  <div
                    key={idx}
                    className="flex gap-2 text-sm bg-green-50 p-3 rounded-lg border border-green-200"
                  >
                    <span className="text-sky-600 font-bold">✓</span>
                    <span className="text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Findings */}
          {summary.findings && summary.findings.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2 text-blue-700">
                <FileText className="h-4 w-4" />
                Key Findings
              </Label>
              <div className="space-y-1.5">
                {summary.findings.map((finding, idx) => (
                  <div
                    key={idx}
                    className="flex gap-2 text-sm bg-blue-50 p-3 rounded-lg border border-blue-200"
                  >
                    <span className="text-cyan-600 font-bold">•</span>
                    <span className="text-foreground">{finding}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Abnormal Values */}
          {summary.abnormalValues && summary.abnormalValues.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2 text-orange-700">
                <AlertCircle className="h-4 w-4" />
                Values That Need Attention
              </Label>
              <div className="space-y-1.5">
                {summary.abnormalValues.map((value, idx) => (
                  <div
                    key={idx}
                    className="flex gap-2 text-sm bg-orange-50 p-3 rounded-lg border border-orange-200"
                  >
                    <span className="text-sky-600 font-bold">⚠</span>
                    <span className="text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Doctor's Recommendations */}
          {summary.recommendations && summary.recommendations.length > 0 && (
            <div className="space-y-2 pt-3 border-t">
              <Label className="text-sm font-semibold flex items-center gap-2 text-cyan-700">
                <Eye className="h-4 w-4" />
                What Doctor Recommends
              </Label>
              <div className="space-y-2">
                {summary.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex gap-2 text-sm">
                    <Badge variant="outline" className="min-w-fit">
                      Step {idx + 1}
                    </Badge>
                    <span className="text-foreground">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up */}
          {summary.followUp && (
            <div className="pt-3 border-t bg-cyan-50 p-3 rounded-lg">
              <p className="text-sm font-semibold text-cyan-700">📅 Follow-up:</p>
              <p className="text-sm text-foreground mt-1">{summary.followUp}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1">
          Download Summary
        </Button>
        <Button className="flex-1 bg-sky-500 hover:bg-sky-600">
          Share with Doctor
        </Button>
      </div>

      {/* Disclaimer */}
      <div className="text-xs text-muted-foreground bg-sky-50 p-3 rounded border border-sky-200">
        ℹ️ This AI analysis is for informational purposes only. Always consult your doctor for medical decisions and treatment.
      </div>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Label } from "@/components/ui/label";

export default ReportAnalyzerAISummary;
