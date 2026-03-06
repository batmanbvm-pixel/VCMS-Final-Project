import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Brain, 
  AlertTriangle, 
  Activity,
  Pill,
  TrendingUp,
  Shield,
  BookOpen,
  Loader2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

interface MedicalIntelligenceReportProps {
  prescriptionId: string;
  onClose?: () => void;
}

const PrescriptionMedicalIntelligenceReport: React.FC<MedicalIntelligenceReportProps> = ({ 
  prescriptionId, 
  onClose 
}) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [language, setLanguage] = useState('English');

  const generateReport = async () => {
    try {
      setLoading(true);
      const response = await api.post(`/medical-intelligence/prescription/${prescriptionId}/analyze`, {
        language
      });

      if (response.data.success) {
        setReport(response.data.report);
        toast.success('Medical Intelligence Report generated successfully');
      }
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast.error(error.response?.data?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  if (!report) {
    return (
      <Card className="border-sky-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-sky-50 to-blue-50 border-b border-sky-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-sky-600" />
              Medical Intelligence Report
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Generate an advanced 8-step clinical reasoning analysis for this prescription.
          </p>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Select Language</label>
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Spanish">Spanish</option>
            </select>
          </div>

          <Button 
            onClick={generateReport}
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Analysis...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Generate Advanced Clinical Analysis
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { analysis } = report;

  return (
    <div className="space-y-6 max-h-[80vh] overflow-y-auto p-4">
      {/* Header */}
      <Card className="border-sky-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-sky-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2 mb-2">
                <Brain className="h-6 w-6" />
                Medical Intelligence Report
              </CardTitle>
              <p className="text-sm text-white/90">8-Step Clinical Reasoning Analysis</p>
            </div>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/20">
                <XCircle className="h-5 w-5" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6 bg-white">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Patient:</span>
              <span className="ml-2 font-medium">{report.patientName}</span>
            </div>
            <div>
              <span className="text-slate-500">Doctor:</span>
              <span className="ml-2 font-medium">{report.doctorName}</span>
            </div>
            <div>
              <span className="text-slate-500">Diagnosis:</span>
              <span className="ml-2 font-medium">{report.diagnosis}</span>
            </div>
            <div>
              <span className="text-slate-500">Generated:</span>
              <span className="ml-2 font-medium">{new Date(report.generatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Clinical Interpretation */}
      <Card className="border-l-4 border-l-sky-500">
        <CardHeader className="bg-sky-50">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-5 w-5 text-sky-600" />
            Step 1: Clinical Interpretation
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-slate-500 text-xs mb-1">Condition Type</div>
              <div className="font-semibold capitalize">{analysis.clinicalInterpretation.conditionType}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-slate-500 text-xs mb-1">Severity</div>
              <div className="font-semibold capitalize">{analysis.clinicalInterpretation.severity}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="text-slate-500 text-xs mb-1">Diagnosis</div>
              <div className="font-semibold">{analysis.clinicalInterpretation.diagnosis}</div>
            </div>
          </div>
          <p className="text-sm text-slate-700">{analysis.clinicalInterpretation.summary}</p>
          <div className="text-xs text-slate-600 bg-amber-50 p-2 rounded border border-amber-200">
            <span className="font-medium">Note:</span> {analysis.clinicalInterpretation.missingRedFlags}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Symptom Correlation */}
      <Card className="border-l-4 border-l-cyan-500">
        <CardHeader className="bg-cyan-50">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-cyan-600" />
            Step 2: Symptom Correlation
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm text-slate-700">{analysis.symptomCorrelation.summary}</p>
          <div className="space-y-2">
            {analysis.symptomCorrelation.correlations.map((corr: any, idx: number) => (
              <div key={idx} className="bg-slate-50 p-3 rounded-lg">
                <div className="font-medium text-sm text-slate-800 mb-1 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-600" />
                  {corr.symptom}
                </div>
                <p className="text-xs text-slate-600">{corr.explanation}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Medication Rationale */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="bg-blue-50">
          <CardTitle className="text-base flex items-center gap-2">
            <Pill className="h-5 w-5 text-blue-600" />
            Step 3: Medication Rationale
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm text-slate-700">{analysis.medicationRationale.summary}</p>
          <div className="space-y-3">
            {analysis.medicationRationale.analysis.map((med: any, idx: number) => (
              <div key={idx} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="font-semibold text-sm text-slate-800 mb-2">{med.medication}</div>
                <div className="space-y-1 text-xs">
                  <div><span className="text-slate-500">Purpose:</span> <span className="text-slate-700">{med.purpose}</span></div>
                  <div><span className="text-slate-500">Mechanism:</span> <span className="text-slate-700">{med.mechanism}</span></div>
                  <div><span className="text-slate-500">Expected Effect:</span> <span className="text-slate-700">{med.expectedEffect}</span></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 4: Treatment Logic */}
      <Card className="border-l-4 border-l-indigo-500">
        <CardHeader className="bg-indigo-50">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            Step 4: Treatment Logic
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-2 text-sm">
            <div><span className="font-medium text-slate-700">Approach:</span> {analysis.treatmentLogic.approach}</div>
            <div><span className="font-medium text-slate-700">Rationale:</span> {analysis.treatmentLogic.rationale}</div>
            <div><span className="font-medium text-slate-700">Expected Timeline:</span> {analysis.treatmentLogic.expectedTimeline}</div>
          </div>
          <div className="bg-indigo-50 p-3 rounded-lg">
            <div className="font-medium text-sm text-indigo-800 mb-2">Progress Indicators:</div>
            <ul className="space-y-1 text-xs text-slate-700">
              {analysis.treatmentLogic.progressIndicators.map((indicator: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3 w-3 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <span>{indicator}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Step 5: Safety Analysis */}
      <Card className="border-l-4 border-l-amber-500">
        <CardHeader className="bg-amber-50">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600" />
            Step 5: Side Effects & Interactions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-medium text-slate-700 mb-2">Common Side Effects:</div>
              <ul className="space-y-1 text-xs text-slate-600">
                {analysis.safetyAnalysis.commonSideEffects.map((effect: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{effect}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
              <div className="font-medium text-amber-800 mb-2">Warnings:</div>
              <ul className="space-y-1 text-xs text-amber-700">
                {analysis.safetyAnalysis.warnings.map((warning: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 6: Lifestyle Guidance */}
      <Card className="border-l-4 border-l-teal-500">
        <CardHeader className="bg-teal-50">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-5 w-5 text-teal-600" />
            Step 6: Lifestyle Guidance
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="bg-teal-50 p-3 rounded-lg">
              <div className="font-medium text-teal-800 mb-2">Dietary</div>
              <ul className="space-y-1 text-xs text-slate-700">
                {analysis.lifestyleGuidance.dietary.map((item: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 text-teal-600 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="font-medium text-blue-800 mb-2">Activity</div>
              <ul className="space-y-1 text-xs text-slate-700">
                {analysis.lifestyleGuidance.activity.map((item: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-cyan-50 p-3 rounded-lg">
              <div className="font-medium text-cyan-800 mb-2">Hygiene</div>
              <ul className="space-y-1 text-xs text-slate-700">
                {analysis.lifestyleGuidance.hygiene.map((item: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 text-cyan-600 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 7: Red Flags */}
      <Card className="border-l-4 border-l-red-500">
        <CardHeader className="bg-red-50">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Step 7: Red Flags & Follow-up
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="bg-red-50 p-3 rounded-lg border border-red-200">
            <div className="font-medium text-red-800 mb-2">Warning Signs:</div>
            <ul className="space-y-1 text-xs text-red-700">
              {analysis.redFlags.warningSigns.map((sign: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{sign}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="text-sm space-y-1">
            <div><span className="font-medium text-slate-700">Follow-up:</span> {analysis.redFlags.followUpSchedule}</div>
            <div><span className="font-medium text-slate-700">Emergency:</span> {analysis.redFlags.emergencyContacts}</div>
          </div>
        </CardContent>
      </Card>

      {/* Step 8: Patient Education */}
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader className="bg-purple-50">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-purple-600" />
            Step 8: Patient Education
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-medium text-slate-700 mb-1">Understanding:</div>
              <p className="text-xs text-slate-600">{analysis.patientEducation.understanding}</p>
            </div>
            <div>
              <div className="font-medium text-slate-700 mb-1">Expectations:</div>
              <p className="text-xs text-slate-600">{analysis.patientEducation.expectations}</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
              <div className="font-medium text-purple-800 mb-2">Empowerment Checklist:</div>
              <ul className="space-y-1 text-xs text-slate-700">
                {analysis.patientEducation.empowerment.map((item: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrescriptionMedicalIntelligenceReport;
