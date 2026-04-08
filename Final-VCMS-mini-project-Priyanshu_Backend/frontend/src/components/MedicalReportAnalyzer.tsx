import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import geminiService from "@/services/geminiService";
import { FileText, Upload, Loader2, Download, X, AlertCircle, Brain, CheckCircle2, Clock, Plus, Languages, AlertTriangle, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { jsPDF } from "jspdf";

interface ReportAnalysis {
  fileName: string;
  fileSize: string;
  sourceFile?: File;
  extractedText: string;
  analysis: {
    summary: string;
    keyPoints: string[];
    recommendations: string[];
    detailedInstructions?: string;
    sideEffects?: string[];
    precautions?: string[];
    aiPowered?: boolean;
    aiWarning?: string;
  };
  isMedical: boolean;
  analyzedAt: string;
  language?: string;
}

interface QueueItem {
  file: File;
  status: "pending" | "extracting" | "analyzing" | "done" | "error";
  error?: string;
  result?: ReportAnalysis;
}

const conciseText = (value = "", maxSentences = 3): string => {
  const sentences = String(value || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?।॥])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, maxSentences);
  return sentences.join(" ").trim();
};

const conciseList = (items: string[] = [], maxItems = 6, sentenceLimit = 2): string[] => {
  return (Array.isArray(items) ? items : [])
    .map((x) => conciseText(String(x || ""), sentenceLimit))
    .filter(Boolean)
    .slice(0, maxItems);
};

const uniqueList = (items: string[] = []): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of (Array.isArray(items) ? items : [])) {
    const item = String(raw || "").trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

const normalizeStepContent = (value = "", language = "english"): string[] => {
  const text = String(value || "").trim();
  if (!text) return [];

  let chunks = text
    .split(/Step\s*\d+\s*:\s*|चरण\s*\d+\s*:\s*|પગલું\s*\d+\s*:\s*|\n+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (chunks.length <= 1) {
    chunks = text
      .split(/[।॥.;\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
  }

  const stepWord = language === "hindi" ? "चरण" : language === "gujarati" ? "પગલું" : "Step";
  return chunks.slice(0, 6).map((c, i) => `${stepWord} ${i + 1}: ${c}`);
};

const looksLikeEmbeddedAnalysisJson = (value = ""): boolean => {
  const text = String(value || "").trim();
  if (!text) return false;
  return /\{[\s\S]*"status"\s*:|\{[\s\S]*"input_type"\s*:|\{[\s\S]*"document_type"\s*:|\{[\s\S]*"ocr_extracted_text"\s*:/i.test(text);
};

const tryParseEmbeddedAnalysisJson = (value = ""): any | null => {
  const raw = String(value || "").trim();
  if (!looksLikeEmbeddedAnalysisJson(raw)) return null;

  const text = raw.replace(/```json|```/gi, '').trim();
  const objCandidate = text.match(/\{[\s\S]*\}/)?.[0] || text;

  const safeParse = (candidate: string) => {
    let normalized = String(candidate || '').trim().replace(/,\s*([}\]])/g, '$1');
    const openCurly = (normalized.match(/\{/g) || []).length;
    const closeCurly = (normalized.match(/\}/g) || []).length;
    const openSquare = (normalized.match(/\[/g) || []).length;
    const closeSquare = (normalized.match(/\]/g) || []).length;
    if (openSquare > closeSquare) normalized += ']'.repeat(openSquare - closeSquare);
    if (openCurly > closeCurly) normalized += '}'.repeat(openCurly - closeCurly);
    return JSON.parse(normalized);
  };

  try {
    const parsed = safeParse(objCandidate);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const isGenericSummaryText = (value = ""): boolean => {
  const text = String(value || "").toLowerCase().trim();
  if (!text) return true;
  const genericHit = [
    "medical document analyzed successfully",
    "your medical document has been analyzed",
    "analysis complete",
    "for informational purposes",
  ].some((p) => text.includes(p));

  const hasSpecificSignals = /(\b\d+\b|mg|ml|tablet|capsule|diagnosis|hemoglobin|glucose|cholesterol|creatinine|x-ray|mri|ultrasound|lab|patient|doctor)/i.test(text);
  return genericHit && !hasSpecificSignals;
};

const hasMedicalSignal = (value = ""): boolean => {
  const text = String(value || "").toLowerCase();
  if (!text) return false;
  return /(\b\d{2,3}\/\d{2,3}\b|\b\d+(?:\.\d+)?\s?(mg|ml|mcg|g\/dl|mmol\/l|bpm|iu|%)\b|diagnosis|impression|finding|prescription|medicine|medication|tablet|capsule|dose|dosage|hemoglobin|glucose|sugar|cholesterol|creatinine|urea|platelet|wbc|rbc|hb\b|blood\s*pressure|bp\b|pulse|x-ray|mri|ct\s*scan|ultrasound|ecg|lab\s*report|test\s*result|follow[-\s]?up|patient|doctor)/i.test(text);
};

const isLikelyMetadataLine = (value = ""): boolean => {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return true;
  return /(\.pdf$|^done\s+medical$|^professional\s+medical\s+care$|^regular\s+health\s+checkup$|^issued\s*:\s*\d{1,2}\/\d{1,2}\/\d{2,4}$|^mediconnect\b|^virtual\s+clinic\b)/i.test(text);
};

const isLowInfoPoint = (value = ""): boolean => {
  const text = String(value || "")
    .replace(/[•●▪◦◆▶️👉📌]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!text) return true;
  if (text.length <= 3) return true;
  if (/^(patient|doctor|medication|dosage|frequency|duration|instructions|draft)$/i.test(text)) return true;
  if (/(not mentioned|not applicable|n\/a|unknown)/i.test(text)) return true;
  return false;
};

const normalizeOutputLine = (value = ""): string => {
  return String(value || "")
    .replace(/^\s*[•●▪◦◆▶️👉📌\-]+\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const isTruncatedOutputLine = (value = ""): boolean => {
  const text = normalizeOutputLine(value).toLowerCase();
  if (!text) return true;
  if (/\bby\s+dr\.?$/.test(text)) return true;
  if (/\b(dr\.?|doctor)\s*:?$/.test(text)) return true;
  if (/[,:;\-–—/]$/.test(text)) return true;
  return false;
};

const isFragmentLikeOutputLine = (value = ""): boolean => {
  const text = normalizeOutputLine(value).toLowerCase();
  if (!text) return true;
  if (/^\d+(\.\d+)?\s?(mg|ml|mcg|g|iu|%)$/i.test(text)) return true;
  if (/^(once|twice|thrice|daily|nightly|bedtime|after meals?)\b/i.test(text)) return true;
  if (/^for\s+\d+\s*(day|days|week|weeks|month|months)\.?$/i.test(text)) return true;
  if (text.split(/\s+/).length <= 2 && !hasMedicalSignal(text)) return true;
  return false;
};

const cleanOutputList = (items: string[] = [], maxItems = 6): string[] => {
  return uniqueList(
    (Array.isArray(items) ? items : [])
      .map((x) => normalizeOutputLine(String(x || "")))
      .filter(Boolean)
      .filter((x) => !isLowInfoPoint(x))
      .filter((x) => !isLikelyMetadataLine(x))
      .filter((x) => !isTruncatedOutputLine(x))
      .filter((x) => !isFragmentLikeOutputLine(x))
  ).slice(0, maxItems);
};

const extractReadableHighlightsFromText = (text = ""): string[] => {
  return String(text || "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => l.length >= 4)
    .filter((l) => !/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(l))
    .filter((l) => !/^localhost:/i.test(l))
    .filter((l) => !/^https?:\/\//i.test(l))
    .filter((l) => !/^draft$/i.test(l))
    .filter((l) => !/^step\s*\d+/i.test(l))
    .filter((l) => !isLikelyMetadataLine(l))
    .slice(0, 8);
};

const isUsefulValue = (v: any) => {
  const s = String(v || "").trim();
  if (!s) return false;
  return !/^(not mentioned|not applicable|n\/a|unknown)$/i.test(s);
};

const collectTextDeep = (value: any, out: string[] = []): string[] => {
  if (value === null || value === undefined) return out;
  if (typeof value === "string") {
    const s = value.trim();
    if (s) out.push(s);
    return out;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    out.push(String(value));
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectTextDeep(item, out));
    return out;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((v) => collectTextDeep(v, out));
  }
  return out;
};

const toSentenceCandidates = (items: string[] = []): string[] => {
  return items
    .flatMap((s) => String(s || "").split(/(?<=[.!?।॥])\s+|\n+/))
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !looksLikeEmbeddedAnalysisJson(s))
    .filter((s) => s.length >= 12);
};

export const MedicalReportAnalyzer = () => {
  const MAX_FILES = 2;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analyzeInFlightRef = useRef(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [viewingResult, setViewingResult] = useState<ReportAnalysis | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("english");
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [showMaxFilesDialog, setShowMaxFilesDialog] = useState(false);

  const validateFile = (file: File): string | null => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(file.type)) return "Only JPG, PNG or PDF allowed.";
    if (file.size > 10 * 1024 * 1024) return "File must be under 10 MB.";
    return null;
  };

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const availableSlots = Math.max(0, MAX_FILES - queue.length);
    if (availableSlots === 0) {
      setShowMaxFilesDialog(true);
      return;
    }

    const newItems: QueueItem[] = [];
    for (const file of arr.slice(0, availableSlots)) {
      const err = validateFile(file);
      if (err) {
        toast({ title: `Skipped: ${file.name}`, description: err, variant: "destructive" });
        continue;
      }
      // Avoid exact duplicates in queue
      const alreadyIn = queue.some((q) => q.file.name === file.name && q.file.size === file.size);
      if (!alreadyIn) newItems.push({ file, status: "pending" });
    }

    if (arr.length > availableSlots) {
      toast({
        title: "Maximum 2 files allowed",
        description: "Only first 2 files were accepted.",
        variant: "destructive",
      });
    }

    if (newItems.length) setQueue((prev) => [...prev, ...newItems]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = ""; // allow selecting same file again
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const removeFromQueue = (idx: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== idx));
  };

  const openUploadedFile = (file: File) => {
    if (previewFile?.url) {
      URL.revokeObjectURL(previewFile.url);
    }
    const url = URL.createObjectURL(file);
    setPreviewFile({
      url,
      name: file.name,
      type: file.type,
    });
  };

  const closePreview = () => {
    if (previewFile?.url) {
      URL.revokeObjectURL(previewFile.url);
    }
    setPreviewFile(null);
  };

  useEffect(() => {
    return () => {
      if (previewFile?.url) {
        URL.revokeObjectURL(previewFile.url);
      }
    };
  }, [previewFile]);

  const analyzeAll = async () => {
    if (analyzeInFlightRef.current) return;

    const candidates = queue.filter((q) => q.status !== "extracting" && q.status !== "analyzing");
    if (!candidates.length) {
      toast({ title: "Nothing to analyze", description: "Add files first." });
      return;
    }

    analyzeInFlightRef.current = true;
    setProcessing(true);
    setOverallProgress(0);
    let lastResult: ReportAnalysis | null = null;
    const totalItems = candidates.length;
    let completedItems = 0;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status === "extracting" || item.status === "analyzing") continue;

      // Update progress percentage
      const progressPercent = Math.min(99, Math.max(1, Math.round((completedItems / totalItems) * 100)));
      setOverallProgress(progressPercent);

      // Mark extracting
      setQueue((prev) => prev.map((q, idx) => idx === i ? { ...q, status: "extracting" } : q));
      setOverallProgress((prev) => Math.max(prev, Math.min(90, progressPercent + 10)));

      let waitProgressTimer: ReturnType<typeof setInterval> | null = setInterval(() => {
        setOverallProgress((prev) => Math.min(92, prev + 2));
      }, 1200);

      try {
        // Mark analyzing
        setQueue((prev) => prev.map((q, idx) => idx === i ? { ...q, status: "analyzing" } : q));

        const analysisResult = await geminiService.analyzeMedicalDocument(item.file, selectedLanguage);

        if (analysisResult?.status === "ocr_failed") {
          if (waitProgressTimer) {
            clearInterval(waitProgressTimer);
            waitProgressTimer = null;
          }
          const ocrMessage = analysisResult?.message || "No OCR text detected. Please upload a clearer report image/PDF.";
          setQueue((prev) => prev.map((q, idx) => idx === i ? { ...q, status: "error", error: ocrMessage } : q));
          toast({ title: "OCR failed", description: ocrMessage, variant: "destructive" });
          completedItems += 1;
          const completePercent = Math.min(100, Math.max(0, Math.round((completedItems / totalItems) * 100)));
          setOverallProgress(completePercent);
          continue;
        }

        if (analysisResult?.status === "non_medical") {
          if (waitProgressTimer) {
            clearInterval(waitProgressTimer);
            waitProgressTimer = null;
          }
          const nonMedicalMessage = analysisResult?.message || "This document is not related to medical reports.";
          setQueue((prev) => prev.map((q, idx) => idx === i ? { ...q, status: "error", error: nonMedicalMessage } : q));
          toast({ title: "Non-medical document", description: nonMedicalMessage, variant: "destructive" });
          completedItems += 1;
          const completePercent = Math.min(100, Math.max(0, Math.round((completedItems / totalItems) * 100)));
          setOverallProgress(completePercent);
          continue;
        }

        if (analysisResult?.status !== "success") {
          if (waitProgressTimer) {
            clearInterval(waitProgressTimer);
            waitProgressTimer = null;
          }
          throw new Error(analysisResult?.message || "Analysis failed. Please try again.");
        }

        if (waitProgressTimer) {
          clearInterval(waitProgressTimer);
          waitProgressTimer = null;
        }

        const embeddedFromSummary = typeof analysisResult?.summary === "string"
          ? tryParseEmbeddedAnalysisJson(analysisResult.summary)
          : null;
        const embeddedFromKeyPoint = Array.isArray(analysisResult?.keyPoints)
          ? analysisResult.keyPoints.map((p: any) => tryParseEmbeddedAnalysisJson(String(p || ""))).find(Boolean)
          : null;
        const normalizedSource = (embeddedFromSummary || embeddedFromKeyPoint)
          ? { ...analysisResult, ...(embeddedFromSummary || embeddedFromKeyPoint) }
          : analysisResult;

        const extractedText = String(normalizedSource?.ocr_extracted_text || "");
        const overview = normalizedSource?.overview || {};
        const medicines = Array.isArray(normalizedSource?.medicines) ? normalizedSource.medicines : [];
        const labResults = Array.isArray(normalizedSource?.lab_results) ? normalizedSource.lab_results : [];
        const overviewPoints = Array.isArray(normalizedSource?.summary?.overview_points)
          ? conciseList(normalizedSource.summary.overview_points.filter(Boolean), 6, 1)
          : [];
        const directKeyPoints = Array.isArray(normalizedSource?.keyPoints)
          ? conciseList(
              normalizedSource.keyPoints
                .filter(Boolean)
                .map((v: any) => String(v || "").trim())
                .filter((v: string) => !looksLikeEmbeddedAnalysisJson(v)),
              6,
              1
            )
          : [];
        const usableDirectKeyPoints = directKeyPoints.filter((v) => !isLowInfoPoint(v));
        const directRecommendations = Array.isArray(normalizedSource?.recommendations)
          ? conciseList(
              normalizedSource.recommendations
                .filter(Boolean)
                .map((v: any) => String(v || "").trim())
                .filter((v: string) => !looksLikeEmbeddedAnalysisJson(v)),
              6,
              2
            )
          : [];
        const alertPoints = Array.isArray(normalizedSource?.alerts)
          ? conciseList(
              normalizedSource.alerts
                .map((a: any) => `${a?.emoji || ""} ${a?.title || ""} ${a?.description || ""}`.trim())
                .filter(Boolean),
              4,
              1
            )
          : [];
        const followupSteps = Array.isArray(normalizedSource?.followup?.repeat_tests)
          ? conciseList(normalizedSource.followup.repeat_tests.filter(Boolean), 4, 1)
          : [];
        const emergencySigns = Array.isArray(normalizedSource?.followup?.emergency_signs)
          ? conciseList(normalizedSource.followup.emergency_signs.filter(Boolean), 5, 1)
          : [];

        const medicineNames = medicines
          .map((m: any) => String(m?.name || "").trim())
          .filter(Boolean)
          .slice(0, 3);

        const medicineGuidance = medicines
          .map((m: any) => {
            const name = String(m?.name || "").trim();
            if (!name) return "";
            const dosage = String(m?.dosage || "").trim();
            const frequency = String(m?.frequency || "").trim();
            const duration = String(m?.duration || "").trim();
            const parts = [dosage, frequency, duration].filter(Boolean).join(" • ");
            return `💊 ${name}${parts ? ` — ${parts}` : ""}`;
          })
          .filter(Boolean)
          .slice(0, 4);

        const structuredKeyPoints = conciseList([
          isUsefulValue(overview?.patient_name) ? `👤 Patient: ${overview.patient_name}` : "",
          isUsefulValue(overview?.doctor_name) ? `👨‍⚕️ Doctor: ${overview.doctor_name}` : "",
          isUsefulValue(overview?.hospital_or_lab) ? `🏥 Facility: ${overview.hospital_or_lab}` : "",
          isUsefulValue(overview?.date) ? `📅 Report date: ${overview.date}` : "",
          isUsefulValue(overview?.diagnosis) ? `🩺 Diagnosis/Reason: ${overview.diagnosis}` : "",
          medicines.length > 0
            ? `💊 Medicines detected: ${medicines.slice(0, 3).map((m: any) => m?.name).filter(Boolean).join(', ')}`
            : "",
          labResults.length > 0
            ? `🧪 Lab parameters found: ${labResults.slice(0, 3).map((r: any) => r?.test_name).filter(Boolean).join(', ')}`
            : "",
        ].filter(Boolean), 6, 1);

        const structuredRecommendations = conciseList([
          isUsefulValue(normalizedSource?.followup?.next_visit) ? String(normalizedSource.followup.next_visit) : "",
          ...((Array.isArray(normalizedSource?.followup?.repeat_tests) ? normalizedSource.followup.repeat_tests : []).slice(0, 3)),
          ...(medicines.slice(0, 2).map((m: any) => {
            const name = String(m?.name || '').trim();
            const freq = String(m?.frequency || '').trim();
            const timing = Array.isArray(m?.timing) ? m.timing.filter(Boolean).join(', ') : '';
            const duration = String(m?.duration || '').trim();
            if (!name) return '';
            const parts = [freq, timing, duration].filter(Boolean).join(' • ');
            return parts ? `💊 ${name}: ${parts}` : `💊 ${name}: follow prescribed schedule`;
          })),
        ].filter(Boolean), 6, 2);

        const aiDetailedRaw = typeof normalizedSource?.detailedInstructions === "string"
          ? normalizedSource.detailedInstructions
          : "";
        const detailedSteps = normalizeStepContent(
          aiDetailedRaw && aiDetailedRaw.trim().length > 20 ? aiDetailedRaw : followupSteps.join("\n"),
          selectedLanguage
        );
        const extractedHighlights = extractReadableHighlightsFromText(extractedText);
        const summaryFromString = typeof normalizedSource?.summary === "string"
          && !looksLikeEmbeddedAnalysisJson(normalizedSource.summary)
          ? conciseText(normalizedSource.summary, 4)
          : "";
        const summaryFromOverviewPoints = Array.isArray(normalizedSource?.summary?.overview_points)
          ? conciseText(normalizedSource.summary.overview_points.filter(Boolean).join(" "), 4)
          : "";
        const deepSummaryParts = collectTextDeep(normalizedSource?.summary || []);
        const deepKeyParts = collectTextDeep(normalizedSource?.keyPoints || []);
        const deepRecommendationParts = collectTextDeep(normalizedSource?.recommendations || []);
        const deepOverviewParts = collectTextDeep(normalizedSource?.overview || []);

        const summaryCandidates = [
          summaryFromString,
          summaryFromOverviewPoints,
          usableDirectKeyPoints[0] || "",
          directRecommendations[0] || "",
          medicineGuidance[0] || "",
          ...toSentenceCandidates(deepSummaryParts).slice(0, 4),
          ...toSentenceCandidates(deepKeyParts).filter((v) => !isLowInfoPoint(v)).slice(0, 3),
          ...toSentenceCandidates(deepRecommendationParts).slice(0, 3),
          ...toSentenceCandidates(deepOverviewParts).slice(0, 2),
        ]
          .map((s) => conciseText(String(s || ""), 3))
          .filter(Boolean)
          .filter((s) => !isLowInfoPoint(s))
          .filter((s) => !isLikelyMetadataLine(s));

        const medicalSummaryCandidates = summaryCandidates.filter((s) => hasMedicalSignal(s));
        const summaryText =
          medicalSummaryCandidates.find((s) => !isGenericSummaryText(s)) ||
          summaryCandidates.find((s) => !isGenericSummaryText(s)) ||
          medicalSummaryCandidates[0] ||
          summaryCandidates[0] ||
          "";
        if (!summaryText || isLowInfoPoint(summaryText) || isGenericSummaryText(summaryText)) {
          throw new Error('Could not build readable summary from AI response. Please retry.');
        }

        const aiDerivedKeyPoints = conciseList(
          summaryText
            .split(/(?<=[.!?।॥])\s+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 15)
            .map((s) => s),
          6,
          1
        );

        const normalizedAnalysis = {
          summary: summaryText,
          keyPoints: cleanOutputList([
            ...structuredKeyPoints,
            ...overviewPoints.slice(1),
            ...usableDirectKeyPoints,
            ...alertPoints,
            ...aiDerivedKeyPoints,
          ], 6),
          recommendations: cleanOutputList(
            conciseList([...structuredRecommendations, ...directRecommendations, ...followupSteps, ...emergencySigns], 6, 2),
            6
          ),
          detailedInstructions: detailedSteps.join("\n"),
          sideEffects: Array.isArray(normalizedSource?.medicines)
            ? uniqueList(conciseList(
                normalizedSource.medicines
                  .flatMap((m: any) => Array.isArray(m?.side_effects) ? m.side_effects : [])
                  .filter(Boolean),
                5,
                1
              ))
            : [],
          precautions: Array.isArray(normalizedSource?.medicines)
            ? uniqueList(conciseList(
                normalizedSource.medicines
                  .flatMap((m: any) => Array.isArray(m?.what_to_avoid) ? m.what_to_avoid : [])
                  .filter(Boolean),
                5,
                1
              ))
            : [],
          aiPowered: true,
        };

        const result: ReportAnalysis = {
          fileName: item.file.name,
          fileSize: (item.file.size / 1024 / 1024).toFixed(2) + " MB",
          sourceFile: item.file,
          extractedText,
          analysis: normalizedAnalysis,
          isMedical: true,
          analyzedAt: new Date().toLocaleString(),
          language: selectedLanguage,
        };

        // Store the last result to open in dialog
        lastResult = result;

        setQueue((prev) => prev.map((q, idx) => idx === i
          ? { ...q, status: "done", result }
          : q));

        completedItems += 1;
        const completePercent = Math.min(100, Math.max(0, Math.round((completedItems / totalItems) * 100)));
        setOverallProgress(completePercent);

      } catch (err: any) {
        if (waitProgressTimer) {
          clearInterval(waitProgressTimer);
          waitProgressTimer = null;
        }
        setQueue((prev) => prev.map((q, idx) => idx === i
          ? { ...q, status: "error", error: err.message || "Analysis failed." }
          : q));
        completedItems += 1;
        const completePercent = Math.min(100, Math.max(0, Math.round((completedItems / totalItems) * 100)));
        setOverallProgress(completePercent);
      }
    }

    setOverallProgress(100);
    setProcessing(false);
    
    // Open dialog with the last result after a short delay to ensure queue has updated
    if (lastResult) {
      setTimeout(() => {
        setViewingResult(lastResult);
        setOverallProgress(0);
        toast({
          title: "✨ Analysis Ready!",
          description: "Your AI analysis report is now displayed below.",
        });
      }, 300);
    } else {
      setOverallProgress(0);
      toast({ title: "Analysis complete", description: "All reports processed." });
    }

    analyzeInFlightRef.current = false;
  };

  const sanitizePdfText = (value?: string) => {
    if (!value) return "";
    return value
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/\uFFFD/g, "")
      // Built-in jsPDF fonts do not reliably support Hindi/Gujarati glyphs.
      // Keep output readable by dropping unsupported glyph blocks from PDF text layer.
      .replace(/[^\x20-\x7E\n]/g, "")
      .trim();
  };

  const handleDownload = async (result: ReportAnalysis) => {
    const baseName = result.fileName.replace(/\.[^.]+$/, "") || "report";

    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 40;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const ensureSpace = (required = 22) => {
        if (y + required > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const writeHeading = (title: string) => {
        ensureSpace(28);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(title, margin, y);
        y += 20;
      };

      const writeParagraph = (text: string) => {
        const safe = sanitizePdfText(text || "-");
        const lines = doc.splitTextToSize(safe, contentWidth);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        for (const line of lines) {
          ensureSpace(16);
          doc.text(String(line), margin, y);
          y += 15;
        }
        y += 4;
      };

      const writeList = (items: string[] = []) => {
        const safeItems = items.filter(Boolean);
        if (!safeItems.length) return;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        for (const item of safeItems) {
          const lines = doc.splitTextToSize(`• ${sanitizePdfText(item)}`, contentWidth - 10);
          for (const line of lines) {
            ensureSpace(16);
            doc.text(String(line), margin + 8, y);
            y += 15;
          }
        }
        y += 4;
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Medical Report Analysis", margin, y);
      y += 24;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`File: ${sanitizePdfText(result.fileName)}`, margin, y);
      y += 14;
      doc.text(`Analyzed At: ${sanitizePdfText(result.analyzedAt)}`, margin, y);
      y += 14;
      doc.text(`Medical Content: ${result.isMedical ? "Yes" : "No / unclear"}`, margin, y);
      y += 20;

      writeHeading("What this report is about");
      writeParagraph(result.analysis.summary || "No summary available.");

      if (result.analysis.detailedInstructions?.trim()) {
        writeHeading("Detailed Guidance");
        writeList(result.analysis.detailedInstructions.split(/\n+/).map((x) => x.trim()).filter(Boolean));
      }

      if (result.analysis.keyPoints?.length) {
        writeHeading("What this means");
        writeList(result.analysis.keyPoints);
      }

      if (result.analysis.sideEffects?.length) {
        writeHeading("Medication-Specific Side Effects");
        writeList(result.analysis.sideEffects);
      }

      if (result.analysis.precautions?.length) {
        writeHeading("Medication-Specific Precautions");
        writeList(result.analysis.precautions);
      }

      if (result.analysis.recommendations?.length) {
        writeHeading("What to do now");
        writeList(result.analysis.recommendations);
      }

      ensureSpace(30);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.text(
        "For informational purposes only. Always consult your doctor for medical advice.",
        margin,
        y
      );

      doc.save(`${baseName}-analysis.pdf`);
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Could not generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadOriginalFile = (result: ReportAnalysis) => {
    if (!result.sourceFile) {
      toast({
        title: "Original file not available",
        description: "Please upload the report again to download the original file.",
        variant: "destructive",
      });
      return;
    }

    const url = URL.createObjectURL(result.sourceFile);
    const el = document.createElement("a");
    el.href = url;
    el.download = result.sourceFile.name;
    el.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const pendingCount = queue.filter((q) => q.status === "pending" || q.status === "error").length;
  const doneCount = queue.filter((q) => q.status === "done").length;
  const doneResults = queue.filter((q) => q.status === "done" && q.result).map((q) => q.result!)
  const uploadDisabled = queue.length >= MAX_FILES;

  const renderReportSections = (result: ReportAnalysis) => {
    const hasReadableText = !!result.extractedText && result.extractedText.trim().length >= 50;
    const isNonMedical = !result.isMedical;
    const showAnalysisSections = hasReadableText;

    return (
      <>
        {!hasReadableText && (
          <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-4 text-sm text-red-800 shadow-sm">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
            <div>
              <p className="font-bold">No OCR text detected.</p>
              <p className="mt-1">Please upload a clearer report image/PDF (good light, full page visible, readable text).</p>
            </div>
          </div>
        )}

        {hasReadableText && isNonMedical && (
          <div className="medical-warning-glow flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="font-bold">Non-medical document detected.</p>
              <p className="mt-1">Upload lab reports, prescriptions, or imaging reports for best results.</p>
            </div>
          </div>
        )}

        {showAnalysisSections && (
          <>
            {result.analysis.aiPowered === false && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-600" />
                <div>
                  <p className="font-bold">Live Gemini analysis unavailable</p>
                  <p className="mt-1">Please retry once Gemini is available.</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg border border-sky-100 p-3">
              <h4 className="text-sm font-bold text-sky-700 mb-2">📋 What this report is about</h4>
              <p className={`text-sm leading-relaxed text-slate-700 ${selectedLanguage === 'gujarati' || selectedLanguage === 'hindi' ? 'font-semibold' : ''}`}>
                {result.analysis.summary}
              </p>
            </div>

            {result.analysis.detailedInstructions && result.analysis.detailedInstructions.trim() && (
              <div className="bg-white rounded-lg border border-emerald-100 p-3">
                <h4 className="text-sm font-bold text-emerald-700 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  📝 Detailed Guidance
                </h4>
                <ul className="space-y-1 text-sm text-slate-700 ml-4 list-disc">
                  {result.analysis.detailedInstructions.split(/\n+/).filter(Boolean).map((line, idx) => (
                    <li key={idx}>{line.trim()}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.analysis.keyPoints.length > 0 && (
              <div className="bg-white rounded-lg border border-sky-100 p-3">
                <h4 className="text-sm font-bold text-sky-700 mb-2">💡 What this means</h4>
                <ul className="space-y-1 text-sm text-slate-700 ml-4 list-disc">
                  {result.analysis.keyPoints.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.analysis.sideEffects && result.analysis.sideEffects.length > 0 && (
              <div className="bg-orange-50 rounded-lg border border-orange-200 p-3">
                <h4 className="text-sm font-bold text-orange-700 mb-2">⚠️ Medication-Specific Side Effects</h4>
                <ul className="space-y-1 text-sm text-slate-700 ml-4 list-disc">
                  {result.analysis.sideEffects.map((effect, idx) => (
                    <li key={idx}>{effect}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.analysis.precautions && result.analysis.precautions.length > 0 && (
              <div className="bg-red-50 rounded-lg border border-red-200 p-3">
                <h4 className="text-sm font-bold text-red-700 mb-2">🚨 Medication-Specific Precautions</h4>
                <ul className="space-y-1 text-sm text-slate-700 ml-4 list-disc">
                  {result.analysis.precautions.map((precaution, idx) => (
                    <li key={idx}>{precaution}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.analysis.recommendations && result.analysis.recommendations.length > 0 && (
              <div className="bg-white rounded-lg border border-cyan-100 p-3">
                <h4 className="text-sm font-bold text-cyan-700 mb-2">💡 What to do now</h4>
                <ul className="space-y-1 text-sm text-slate-700 ml-4 list-disc">
                  {result.analysis.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-slate-600 border-t border-sky-100 pt-2">
              For informational purposes only. Always consult your doctor for medical advice.
            </p>
          </>
        )}
      </>
    );
  };

  return (
    <>
      <div className="p-5 space-y-5">
        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            if (uploadDisabled) {
              e.preventDefault();
              setIsDragOver(false);
              setShowMaxFilesDialog(true);
              return;
            }
            handleDrop(e);
          }}
          className={`border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer group ${
            uploadDisabled
              ? "border-slate-300 bg-slate-100/80 cursor-not-allowed"
              : isDragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/60 hover:bg-accent/30"
          }`}
          onClick={() => {
            if (uploadDisabled) {
              setShowMaxFilesDialog(true);
              return;
            }
            fileInputRef.current?.click();
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileInput}
            className="hidden"
            accept=".jpg,.jpeg,.png,.pdf"
          />
          <div className={`flex flex-col items-center justify-center gap-3 ${uploadDisabled ? "blur-[2px] opacity-95" : ""}`}>
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-colors ${
              uploadDisabled ? "bg-slate-200" : isDragOver ? "bg-primary/20" : "bg-primary/10 group-hover:bg-primary/20"
            }`}>
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Click to upload or drag &amp; drop</p>
              <p className="text-sm text-muted-foreground mt-0.5">JPG, PNG or PDF - max 10 MB each</p>
              <p className="text-sm text-red-600 font-semibold mt-1">Maximum 2 files can be uploaded at a time</p>
            </div>
          </div>
        </div>

        {/* File Queue */}
        {queue.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                Files ({queue.length}) - {doneCount} analyzed
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7"
                onClick={() => setQueue([])}
                disabled={processing}
              >
                Clear all
              </Button>
            </div>
            {queue.map((item, idx) => (
              <div key={idx} className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                item.status === "done" ? "border-green-200 bg-green-50/50" :
                item.status === "error" ? "border-red-200 bg-red-50/50" :
                item.status === "extracting" || item.status === "analyzing" ? "border-primary/20 bg-primary/5" :
                "border-border bg-muted/20"
              }`}>
                <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-border">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{item.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(item.file.size / 1024 / 1024).toFixed(2)} MB
                    {item.status === "extracting" && " - Extracting text..."}
                    {item.status === "analyzing" && " - AI analyzing..."}
                    {item.status === "done" && ` - Done ${item.result?.isMedical ? "Medical" : "Non-medical"}`}
                    {item.status === "error" && ` - Error: ${item.error}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-slate-600 hover:bg-slate-100"
                    onClick={() => openUploadedFile(item.file)}
                    title={item.file.type === "application/pdf" ? "Open PDF" : "Open file"}
                  >
                    {item.file.type === "application/pdf" ? "Open PDF" : "Open"}
                  </Button>
                  {(item.status === "extracting" || item.status === "analyzing") && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {item.status === "done" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                      onClick={() => { setViewingResult(item.result!); }}
                    >
                      View
                    </Button>
                  )}
                  {item.status === "error" && pendingCount > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-amber-600"
                      onClick={() => setQueue((prev) => prev.map((q, i) => i === idx ? { ...q, status: "pending", error: undefined } : q))}
                    >
                      Retry
                    </Button>
                  )}
                  <button
                    disabled={item.status === "extracting" || item.status === "analyzing"}
                    onClick={() => removeFromQueue(idx)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/30 border border-transparent transition-colors disabled:opacity-30"
                    title="Remove report from queue"
                    aria-label="Remove report from analysis queue"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Language Selection - Above Analyze Button */}
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Languages className="h-4 w-4 text-sky-600" />
              Report Language
            </label>
            <Select
              value={selectedLanguage}
              onValueChange={(language) => {
                setSelectedLanguage(language);
                setViewingResult(null);
                setQueue((prev) => prev.map((q) =>
                  q.status === "done"
                    ? { ...q, status: "pending", error: undefined }
                    : q
                ));
              }}
              disabled={processing}
            >
              <SelectTrigger className="border-sky-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="english">🇬🇧 English</SelectItem>
                <SelectItem value="hindi">🇮🇳 हिंदी (Hindi)</SelectItem>
                <SelectItem value="gujarati">🇮🇳 ગુજરાતી (Gujarati)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Analyze Button - More Attention Grabbing */}
        <Button
          onClick={analyzeAll}
          disabled={processing || pendingCount === 0}
          className="w-full bg-gradient-to-r from-sky-500 via-sky-600 to-cyan-600 hover:from-sky-600 hover:via-sky-700 hover:to-cyan-700 text-white font-bold text-lg h-14 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          size="lg"
        >
          {processing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-base font-bold">Analyzing...</span>
            </>
          ) : pendingCount > 0 ? (
            <>
              <Sparkles className="h-5 w-5 mr-2 animate-pulse" />
              <span className="text-base font-bold">✨ Analyze Reports with AI</span>
            </>
          ) : (
            <>
              <Brain className="h-5 w-5 mr-2" />
              <span className="text-base font-bold">Analyze Reports</span>
            </>
          )}
        </Button>

        {processing && (
          <div className="rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-cyan-900">
                Please wait about 15-20 seconds while reports are analyzed.
              </p>
              <Badge className="bg-cyan-100 text-cyan-800">Processing...</Badge>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {processing && overallProgress > 0 && (
          <div className="space-y-2 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-cyan-900">Processing documents...</p>
              <span className="text-xs font-medium text-cyan-700">{Math.min(100, Math.max(0, Math.round(overallProgress)))}%</span>
            </div>
            <div className="w-full bg-cyan-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, Math.round(overallProgress)))}%` }}
              />
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="flex gap-3 rounded-xl border border-sky-200/60 bg-sky-50/60 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-sky-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-sky-700 leading-relaxed">
            AI analysis is for informational purposes only. Always consult your doctor for medical advice.
            Upload multiple reports at once - they will be processed one by one.
          </p>
        </div>
      </div>

      {/* ✅ INLINE RESULTS - Simplified like PrescriptionAISummary */}
      {doneResults.length === 2 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {doneResults.map((r, idx) => (
            <Card key={idx} className="border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-sky-700">Medical Analysis</CardTitle>
                <p className="text-xs text-slate-600 mt-1">
                  <span className="font-semibold text-slate-800">PDF Name:</span> {r.fileName}
                </p>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {renderReportSections(r)}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button onClick={() => handleDownload(r)} className="w-full">
                    <Download className="h-4 w-4 mr-2" /> Download Analysis PDF
                  </Button>
                  <Button variant="outline" onClick={() => handleDownloadOriginalFile(r)} className="w-full">
                    <FileText className="h-4 w-4 mr-2" /> Download Original File
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {viewingResult && doneResults.length !== 2 && (
        <div className="mt-8 space-y-3">
          <Card className="border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50">
            <CardHeader className="pb-3 border-b border-sky-200">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-sky-700">
                  <Sparkles className="h-5 w-5 text-sky-600" />
                  Medical Analysis
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewingResult(null)}
                  className="text-sky-600 hover:text-sky-700 hover:bg-sky-100"
                  title="Close Medical Analysis"
                  aria-label="Close Medical Analysis"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {renderReportSections(viewingResult)}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button onClick={() => handleDownload(viewingResult)} className="w-full">
                  <Download className="h-4 w-4 mr-2" /> Download Analysis PDF
                </Button>
                <Button variant="outline" onClick={() => handleDownloadOriginalFile(viewingResult)} className="w-full">
                  <FileText className="h-4 w-4 mr-2" /> Download Original File
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <Dialog open={!!previewFile} onOpenChange={(open) => { if (!open) closePreview(); }}>
      <DialogContent className="max-w-5xl h-[88vh] p-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-slate-200">
          <DialogTitle className="text-sm font-semibold text-slate-900 truncate">
            {previewFile?.name || "Report Preview"}
          </DialogTitle>
        </DialogHeader>
        <div className="h-[calc(88vh-58px)] bg-slate-50">
          {previewFile?.type === "application/pdf" ? (
            <iframe
              src={previewFile.url}
              title={previewFile.name}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full overflow-auto flex items-start justify-center p-4">
              <img src={previewFile?.url} alt={previewFile?.name || "Uploaded report"} className="max-w-full h-auto rounded-lg border border-slate-200" />
            </div>
          )}
        </div>
      </DialogContent>
      </Dialog>

      <Dialog open={showMaxFilesDialog} onOpenChange={setShowMaxFilesDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Maximum 2 files allowed</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-700">Please remove one file from queue before uploading another.</p>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MedicalReportAnalyzer;
