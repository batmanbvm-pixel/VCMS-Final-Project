import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import geminiService from "@/services/geminiService";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Languages, X, Pill } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PrescriptionSummaryProps {
  medications: any[];
  diagnosis: string;
  treatmentPlan: string;
  followUpRecommendations: string;
}

interface MedicineDetail {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  purpose?: string;
  howToTake?: string;
  sideEffects?: string[];
  precautions?: string[];
  recoveryTime?: string;
}

interface SummaryState {
  summary: string;
  keyPoints: string[];
  recommendations: string[];
  detailedInstructions?: string;
  sideEffects?: string[];
  precautions?: string[];
  language?: string;
  aiPowered?: boolean;
  aiWarning?: string;
}

const isGenericSummary = (value = "") => {
  const text = String(value || "").toLowerCase();
  return [
    "medical document analyzed",
    "please review",
    "follow your doctor",
    "summary generated",
  ].some((p) => text.includes(p));
};

const buildPersonalizedPrescriptionFallback = (
  medications: any[],
  diagnosis: string,
  treatmentPlan: string,
  followUpRecommendations: string,
  language: string
) => {
  const meds = Array.isArray(medications) ? medications.filter(Boolean) : [];
  const medLines = meds.slice(0, 6).map((m) => {
    const name = m?.name || 'Medicine';
    const dosage = m?.dosage ? ` ${m.dosage}` : '';
    const frequency = m?.frequency ? `, ${m.frequency}` : '';
    const duration = m?.duration ? ` for ${m.duration}` : '';
    return `💊 ${name}${dosage}${frequency}${duration}`.trim();
  });

  const summary = diagnosis
    ? `This prescription is for ${diagnosis}. ${meds.length ? `It includes ${meds.length} medicine${meds.length > 1 ? 's' : ''} with specific timing and duration.` : 'Please follow your doctor instructions carefully.'}`
    : `This prescription includes ${meds.length || 'multiple'} medicine instructions. Follow exact dosage and timing for best recovery.`;

  const keyPoints = medLines.length ? medLines : [
    '💊 Follow exact dosage and timing written in prescription.',
    '🕒 Do not skip doses or stop medicines early without doctor advice.',
  ];

  const recommendations = [
    followUpRecommendations ? `📅 Follow-up: ${followUpRecommendations}` : '📅 Schedule follow-up visit as advised by your doctor.',
    treatmentPlan ? `🩺 Treatment plan: ${treatmentPlan}` : '🩺 Continue treatment plan exactly as prescribed.',
    '⚠️ Contact doctor immediately if severe side effects appear.',
  ].filter(Boolean);

  const detailedInstructions = medLines.length
    ? medLines.map((line, idx) => `Step ${idx + 1}: ${line.replace(/^💊\s*/, '')}`).join('\n')
    : 'Step 1: Take medicines exactly as prescribed by your doctor.';

  return {
    summary,
    keyPoints,
    recommendations,
    detailedInstructions,
    language,
  };
};

const toFriendlySummaryError = (message: string) => {
  const lower = String(message || '').toLowerCase();

  if (lower.includes('timeout') || lower.includes('took too long')) {
    return {
      title: 'It is taking longer than expected.',
      description: 'Please try again. The AI server may be busy right now.',
      hint: 'Tip: Retry in 1-2 minutes if this keeps happening.'
    };
  }

  if (lower.includes('busy') || lower.includes('503') || lower.includes('service unavailable')) {
    return {
      title: 'AI service is busy right now.',
      description: 'Please wait a minute and try again.',
      hint: 'Tip: English may respond faster during peak load.'
    };
  }

  if (lower.includes('quota') || lower.includes('429') || lower.includes('limit')) {
    return {
      title: 'Daily AI limit reached.',
      description: 'Please try again later.',
      hint: 'Tip: Ask your admin to add another Gemini API key.'
    };
  }

  if (lower.includes('not reachable') || lower.includes('network') || lower.includes('failed to fetch')) {
    return {
      title: 'Cannot connect to server.',
      description: 'Please check backend server and internet connection.',
      hint: 'Tip: Make sure backend is running on the configured port.'
    };
  }

  if (lower.includes('unauthorized') || lower.includes('401')) {
    return {
      title: 'Session expired.',
      description: 'Please login again and retry.',
      hint: 'Tip: Refresh page after login.'
    };
  }

  return {
    title: 'Could not generate summary.',
    description: 'Please try again.',
    hint: 'If issue continues, contact support with this time and prescription ID.'
  };
};

const extractMedicinesFromSummary = (medications: any[], keyPoints: string[]): MedicineDetail[] => {
  const medicineList: MedicineDetail[] = [];
  
  // First try to extract from medications prop directly
  if (medications && medications.length > 0) {
    medications.forEach(med => {
      medicineList.push({
        name: med.name || 'Medicine',
        dosage: med.dosage || '',
        frequency: med.frequency || '',
        duration: med.duration || '',
        purpose: '',
        howToTake: `${med.frequency || ''} ${med.dosage ? `(${med.dosage})` : ''}`.trim(),
        sideEffects: [],
        precautions: [],
        recoveryTime: med.duration || ''
      });
    });
  }
  
  // Extract from keyPoints if they contain medicine info (language-agnostic)
  if (keyPoints && keyPoints.length > 0) {
    keyPoints.forEach(point => {
      const lowerPoint = point.toLowerCase();
      
      // Check if this keyPoint contains medicine-like info (dosage indicators in any language)
      const hasMedicineIndicators = /\d+\s*(mg|ml|tablet|capsule|dose|times|daily|twice|thrice|मिलीग्राम|गोली|टैबलेट|बार|દવા|ગોળી|વખત)/i.test(point);
      
      if (hasMedicineIndicators) {
        // Try to extract medicine name (supports Unicode characters for Hindi/Gujarati)
        const nameMatch = point.match(/^[💊]?\s*([A-Za-z\u0900-\u097F\u0A80-\u0AFF]+(?:\s+[A-Za-z\u0900-\u097F\u0A80-\u0AFF]+)?)\s*(?:\d+|—|•|$)/);
        const name = nameMatch ? nameMatch[1].trim() : (point.startsWith('💊') ? point.substring(2).split(/[—•|]/)[0].trim() : 'Medicine');
        
        // Check if we already have this medicine
        const existing = medicineList.find(m => m.name.toLowerCase() === name.toLowerCase());
        if (!existing) {
          // Parse out different parts from the point
          const parts = point.split(/[—•|]/).map(p => p.trim()).filter(Boolean);
          medicineList.push({
            name,
            dosage: parts[1] || '',
            frequency: parts[2] || '',
            duration: parts[3] || '',
            purpose: point,
            howToTake: parts.slice(1).join(' ') || point,
            sideEffects: [],
            precautions: [],
            recoveryTime: parts[3] || ''
          });
        } else {
          // Enhance existing medicine info
          if (!existing.purpose) existing.purpose = point;
        }
      }
    });
  }
  
  return medicineList;
};

export const PrescriptionAISummary = ({
  medications,
  diagnosis,
  treatmentPlan,
  followUpRecommendations,
}: PrescriptionSummaryProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryState | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("english");
  const summaryInFlightRef = useRef(false);
  const friendlyError = summaryError ? toFriendlySummaryError(summaryError) : null;
  
  // Extract detailed medicine info
  const medicineDetails = summaryData ? extractMedicinesFromSummary(medications, summaryData.keyPoints) : [];

  const handleGenerateSummary = async () => {
    if (summaryInFlightRef.current) return;

    try {
      summaryInFlightRef.current = true;
      setLoading(true);
      setSummaryError(null);
      
      const result = await geminiService.summarizePrescription(
        medications,
        diagnosis,
        treatmentPlan,
        followUpRecommendations,
        selectedLanguage
      );

      // Do not show predefined/rule-based fallback in this screen.
      // If live Gemini is unavailable, show a clear error instead.
      if (result?.aiPowered === false) {
        throw new Error(
          result?.aiWarning ||
          'Live Gemini summary is unavailable right now. Please retry when quota resets.'
        );
      }

      const normalizedResult = { ...result };
      const noUsefulKeyPoints = !Array.isArray(normalizedResult.keyPoints) || normalizedResult.keyPoints.length === 0;
      const noUsefulRecommendations = !Array.isArray(normalizedResult.recommendations) || normalizedResult.recommendations.length === 0;
      if (!normalizedResult.summary || isGenericSummary(normalizedResult.summary) || noUsefulKeyPoints || noUsefulRecommendations) {
        const fallback = buildPersonalizedPrescriptionFallback(
          medications,
          diagnosis,
          treatmentPlan,
          followUpRecommendations,
          selectedLanguage
        );
        normalizedResult.summary = (!normalizedResult.summary || isGenericSummary(normalizedResult.summary))
          ? fallback.summary
          : normalizedResult.summary;
        normalizedResult.keyPoints = noUsefulKeyPoints ? fallback.keyPoints : normalizedResult.keyPoints;
        normalizedResult.recommendations = noUsefulRecommendations ? fallback.recommendations : normalizedResult.recommendations;
        normalizedResult.detailedInstructions = normalizedResult.detailedInstructions || fallback.detailedInstructions;
      }

      setSummaryData({...normalizedResult, language: selectedLanguage});
      setExpanded(true);
      toast({
        title: "Summary Generated",
        description: `AI has analyzed your prescription in ${selectedLanguage === 'hindi' ? 'हिंदी' : selectedLanguage === 'gujarati' ? 'ગુજરાતી' : 'English'}.`,
      });
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "Could not generate summary. Please try again.");
    } finally {
      summaryInFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Language Selection */}
      <div className="flex gap-3 items-center">
        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Languages className="h-4 w-4 text-sky-600" />
            Select Language
          </label>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage} disabled={loading}>
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

      <Button
        onClick={handleGenerateSummary}
        disabled={loading}
        className="w-full gap-2 bg-sky-500 hover:bg-sky-600 text-white"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating Detailed Summary...
          </>
        ) : summaryData ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Summary Ready
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate AI Summary
          </>
        )}
      </Button>

      {friendlyError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-500" />
          <div>
            <p className="font-semibold">{friendlyError.title}</p>
            <p className="mt-1 text-xs text-red-600/90">{friendlyError.description}</p>
            <p className="mt-1 text-[11px] text-red-600/75">{friendlyError.hint}</p>
          </div>
        </div>
      )}

      {summaryData && (
        <Card className="border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50">
          <CardHeader className="pb-3 border-b border-sky-200">
            <div className="flex items-start justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-sky-700">
                <Sparkles className="h-5 w-5 text-sky-600" />
                Treatment Guide
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="text-sky-600 hover:text-sky-700 hover:bg-sky-100"
                >
                  {expanded ? "−" : "+"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSummaryData(null);
                    setSummaryError(null);
                    setExpanded(true);
                  }}
                  className="text-sky-600 hover:text-sky-700 hover:bg-sky-100"
                  title="Close AI Summary"
                  aria-label="Close AI Summary"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-2 space-y-2">
            {expanded && (
              <>
                {/* Main Summary - Converted to Bullets with better parsing */}
                <div className="bg-white rounded-lg border border-sky-100 p-2">
                  <h4 className="text-sm font-bold text-sky-700 mb-1">📋 What This Document Says</h4>
                  <ul className="space-y-0.5 text-xs text-slate-700 ml-4">
                    {(() => {
                      // Smart bullet parsing: split on periods, semicolons, or sentence-like breaks
                      const text = summaryData.summary || '';
                      const bullets = text.split(/[।॥\.|;]/).filter(s => s.trim().length > 10);
                      return bullets.length > 1 
                        ? bullets.map((sentence, idx) => (
                            <li key={idx} className="list-disc leading-tight">{sentence.trim()}{!sentence.trim().match(/[\.|।॥]$/) ? '.' : ''}</li>
                          ))
                        : [<li key={0} className="list-disc leading-tight">{text}</li>];
                    })()}
                  </ul>
                </div>

                {/* Detailed Instructions - STEP-BY-STEP with smart parsing */}
                {summaryData.detailedInstructions && summaryData.detailedInstructions.trim() && (
                  <div className="bg-white rounded-lg border border-emerald-100 p-2">
                    <h4 className="text-sm font-bold text-emerald-700 mb-1">📝 Steps to Follow</h4>
                    <ul className="space-y-0.5 text-xs text-slate-700 ml-4">
                      {(() => {
                        const text = summaryData.detailedInstructions || '';
                        // Try numbered steps first, then split by sentence/comma
                        let bullets = text.split(/Step \d+:|\n\n|चरण \d+:|પગલું \d+:/).filter(s => s.trim());
                        if (bullets.length === 1) {
                          // No step markers, try splitting by periods/commas/semicolons
                          bullets = text.split(/[।॥\.|,|;]/).filter(s => s.trim().length > 15);
                        }
                        return bullets.map((step, idx) => (
                          <li key={idx} className="list-disc leading-tight">{step.trim()}{!step.trim().match(/[\.|।॥]$/) ? '.' : ''}</li>
                        ));
                      })()}
                    </ul>
                  </div>
                )}

                {/* Compact Medicine Cards - 2-column layout */}
                {medicineDetails.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-indigo-700 mb-1">💊 {summaryData.language === 'hindi' ? 'विस्तृत दवा गाइड' : summaryData.language === 'gujarati' ? 'વિગતવાર દવા માર્ગદર્શિકા' : 'Detailed Medicine Guide'}</h4>
                    <div className="space-y-2">
                      {medicineDetails.map((medicine, idx) => (
                        <div key={idx} className="bg-gradient-to-r from-indigo-50 to-white rounded-lg border border-indigo-200 p-2 flex gap-3">
                          <div className="flex-shrink-0">
                            <div className="bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                              {idx + 1}
                            </div>
                          </div>
                          <div className="flex-1">
                            <h5 className="text-sm font-bold text-indigo-900 mb-1 flex items-center gap-1">
                              <Pill className="h-3 w-3" />
                              {medicine.name}
                              {medicine.dosage && <span className="text-xs font-normal text-indigo-600 ml-1">• {medicine.dosage}</span>}
                            </h5>
                            <div className="bg-white rounded p-2 border border-indigo-100">
                              <ul className="space-y-0.5 text-xs text-slate-700">
                                {medicine.howToTake && <li className="flex gap-1"><span className="text-indigo-600">•</span> <span><strong>{summaryData.language === 'hindi' ? 'कैसे लें:' : summaryData.language === 'gujarati' ? 'કેવી રીતે લો:' : 'How to take:'}</strong> {medicine.howToTake}</span></li>}
                                {medicine.purpose && <li className="flex gap-1"><span className="text-indigo-600">•</span> <span><strong>{summaryData.language === 'hindi' ? 'उद्देश्य:' : summaryData.language === 'gujarati' ? 'હેતુ:' : 'Purpose:'}</strong> {medicine.purpose}</span></li>}
                                {medicine.frequency && <li className="flex gap-1"><span className="text-indigo-600">•</span> <span><strong>{summaryData.language === 'hindi' ? 'कब लें:' : summaryData.language === 'gujarati' ? 'ક્યારે લો:' : 'When to take:'}</strong> {medicine.frequency}</span></li>}
                                {medicine.duration && <li className="flex gap-1"><span className="text-indigo-600">•</span> <span><strong>{summaryData.language === 'hindi' ? 'अवधि:' : summaryData.language === 'gujarati' ? 'અવધિ:' : 'Duration:'}</strong> {medicine.duration}</span></li>}
                                {medicine.sideEffects && medicine.sideEffects.length > 0 && (
                                  <li className="flex gap-1"><span className="text-orange-600">•</span> <span><strong>{summaryData.language === 'hindi' ? 'दुष्प्रभाव:' : summaryData.language === 'gujarati' ? 'આડઅસર:' : 'Side effects:'}</strong> {medicine.sideEffects.join(', ')}</span></li>
                                )}
                                {medicine.precautions && medicine.precautions.length > 0 && (
                                  <li className="flex gap-1"><span className="text-red-600">•</span> <span><strong>{summaryData.language === 'hindi' ? 'सावधानियाँ:' : summaryData.language === 'gujarati' ? 'સાવચેતી:' : 'Precautions:'}</strong> {medicine.precautions.join(', ')}</span></li>
                                )}
                                {medicine.recoveryTime && <li className="flex gap-1"><span className="text-green-600">•</span> <span><strong>{summaryData.language === 'hindi' ? 'रिकवरी समय:' : summaryData.language === 'gujarati' ? 'પુનઃપ્રાપ્તિ સમય:' : 'Recovery time:'}</strong> {medicine.recoveryTime}</span></li>}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Points - Only show if no detailed medicine cards */}
                {summaryData.keyPoints.length > 0 && medicineDetails.length === 0 && (
                  <div className="bg-white rounded-lg border border-sky-100 p-2">
                    <h4 className="text-sm font-bold text-sky-700 mb-1">💊 {summaryData.language === 'hindi' ? 'मुख्य बिंदु' : summaryData.language === 'gujarati' ? 'મુખ્ય મુદ્દાઓ' : 'Key Points'}</h4>
                    <ul className="space-y-0.5 text-xs text-slate-700 ml-4">
                      {summaryData.keyPoints.map((point, idx) => (
                        <li key={idx} className="list-disc leading-tight">{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Side Effects - Only show if no detailed medicine cards */}
                {summaryData.sideEffects && summaryData.sideEffects.length > 0 && medicineDetails.length === 0 && (
                  <div className="bg-orange-50 rounded-lg border border-orange-200 p-2">
                    <h4 className="text-sm font-bold text-orange-700 mb-1">⚠️ {summaryData.language === 'hindi' ? 'दुष्प्रभाव' : summaryData.language === 'gujarati' ? 'આડઅસરો' : 'Side Effects'}</h4>
                    <ul className="space-y-0.5 text-xs text-slate-700 ml-4">
                      {summaryData.sideEffects.map((effect, idx) => (
                        <li key={idx} className="list-disc leading-tight">{effect}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Precautions - Only show if no detailed medicine cards */}
                {summaryData.precautions && summaryData.precautions.length > 0 && medicineDetails.length === 0 && (
                  <div className="bg-red-50 rounded-lg border border-red-200 p-2">
                    <h4 className="text-sm font-bold text-red-700 mb-1">🚨 {summaryData.language === 'hindi' ? 'सावधानियाँ' : summaryData.language === 'gujarati' ? 'સાવચેતીઓ' : 'Precautions'}</h4>
                    <ul className="space-y-0.5 text-xs text-slate-700 ml-4">
                      {summaryData.precautions.map((precaution, idx) => (
                        <li key={idx} className="list-disc leading-tight">{precaution}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations - Compact bullets */}
                {summaryData.recommendations && summaryData.recommendations.length > 0 && (
                  <div className="bg-white rounded-lg border border-cyan-100 p-2">
                    <h4 className="text-sm font-bold text-cyan-700 mb-1">💡 {summaryData.language === 'hindi' ? 'याद रखें' : summaryData.language === 'gujarati' ? 'યાદ રાખો' : 'What to Do Now'}</h4>
                    <ul className="space-y-0.5 text-xs text-slate-700 ml-4">
                      {summaryData.recommendations.map((rec, idx) => (
                        <li key={idx} className="list-disc leading-tight">{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2 pt-2 mt-2 border-t border-sky-100 text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {summaryData.language === 'hindi' 
                      ? 'केवल सूचना के लिए। चिकित्सा सलाह के लिए हमेशा अपने डॉक्टर से परामर्श करें।'
                      : summaryData.language === 'gujarati'
                      ? 'માત્ર માહિતી માટે. તબીબી સલાહ માટે હંમેશા તમારા ડૉક્ટરની સલાહ લો.'
                      : 'For informational purposes only. Always consult your doctor for medical advice.'}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PrescriptionAISummary;
