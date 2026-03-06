import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import geminiService from '@/services/geminiService';
import {
  Upload,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  Brain,
  Pill,
  TestTube,
  Heart,
  Activity,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface MedicalAnalysisResult {
  status: 'success' | 'ocr_failed' | 'non_medical' | 'error';
  message?: string;
  input_type?: 'image' | 'pdf';
  document_type?: 'prescription' | 'lab_report' | 'discharge_summary' | 'radiology_report';
  ocr_extracted_text?: string;
  overview?: any;
  medicines?: any[];
  lab_results?: any[];
  radiology_findings?: any;
  alerts?: any[];
  lifestyle?: any;
  followup?: any;
  summary?: any;
  disclaimer?: string;
}

const MedicalDocumentAnalyzer = () => {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [result, setResult] = useState<MedicalAnalysisResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    medicines: true,
    labResults: true,
    lifestyle: false,
    followup: false,
    ocrText: false
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload JPG, PNG, or PDF files only.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Please upload files smaller than 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    setResult(null); // Clear previous result
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a medical document to analyze.',
        variant: 'destructive',
      });
      return;
    }

    setAnalyzing(true);
    setAnalysisProgress(0);
    setProgressMessage('Preparing document...');
    
    try {
      // Simulate progress: 10% after starting
      setTimeout(() => {
        setAnalysisProgress(10);
        setProgressMessage('Reading medical document...');
      }, 300);

      // Simulate progress: 30% while uploading
      setTimeout(() => {
        setAnalysisProgress(30);
        setProgressMessage('Extracting text with OCR...');
      }, 1000);

      // Simulate progress: 60% while analyzing
      setTimeout(() => {
        setAnalysisProgress(60);
        setProgressMessage('Analyzing medical content...');
      }, 2000);

      const analysisResult = await geminiService.analyzeMedicalDocument(selectedFile);
      
      // Update progress to 90% before showing results
      setAnalysisProgress(90);
      setProgressMessage('Processing results...');
      
      // Small delay then show complete
      await new Promise(resolve => setTimeout(resolve, 500));
      setAnalysisProgress(100);
      setProgressMessage('Analysis complete!');
      
      setResult(analysisResult);

      if (analysisResult.status === 'success') {
        toast({
          title: '✅ Analysis Complete',
          description: 'Your medical document has been analyzed successfully.',
        });
      } else if (analysisResult.status === 'ocr_failed') {
        toast({
          title: '❌ OCR Failed',
          description: analysisResult.message,
          variant: 'destructive',
        });
      } else if (analysisResult.status === 'non_medical') {
        toast({
          title: '⚠️ Non-Medical Document',
          description: analysisResult.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Failed to analyze document. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
      setTimeout(() => {
        setAnalysisProgress(0);
        setProgressMessage('');
      }, 1000);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const downloadJSON = () => {
    if (!result) return;
    const dataStr = JSON.stringify(result, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `medical-analysis-${Date.now()}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-gray-900">Medical Document OCR Analyzer</h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Upload a prescription, lab report, or medical document. Our AI will read, validate, analyze, 
            and return a comprehensive structured analysis.
          </p>
        </div>

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Medical Document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Input */}
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer relative">
              <input
                type="file"
                onChange={handleFileSelect}
                accept=".jpg,.jpeg,.png,.pdf"
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="space-y-2">
                <FileText className="h-12 w-12 mx-auto text-gray-400" />
                <div>
                  <p className="font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm text-gray-500">JPG, PNG, or PDF (max 10MB)</p>
                </div>
              </div>
            </div>

            {/* Selected File */}
            {selectedFile && (
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-gray-600">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedFile(null)}
                  className="transition-all duration-200 hover:scale-105"
                >
                  Remove
                </Button>
              </div>
            )}

            {/* Analyze Button */}
            <Button
              onClick={handleAnalyze}
              disabled={!selectedFile || analyzing}
              className="w-full transition-all duration-200 hover:scale-[1.01]"
              size="lg"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Analyzing Document...
                </>
              ) : (
                <>
                  <Brain className="h-5 w-5 mr-2" />
                  Analyze Document
                </>
              )}
            </Button>

            {/* Progress Bar */}
            {analyzing && analysisProgress > 0 && (
              <div className="space-y-2 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-cyan-900">{progressMessage}</p>
                  <span className="text-xs font-medium text-cyan-700">{analysisProgress}%</span>
                </div>
                <div className="w-full bg-cyan-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full transition-all duration-300 ease-out"
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Info */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Supports prescriptions, lab reports, discharge summaries, and radiology reports.
                The system will automatically detect the document type and extract relevant information.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Status Banner */}
            {result.status === 'success' && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-green-900">Analysis Successful</h3>
                      <p className="text-sm text-green-700">
                        Document Type: {result.document_type?.replace('_', ' ').toUpperCase()} | 
                        Input: {result.input_type?.toUpperCase()}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={downloadJSON} className="transition-all duration-200 hover:scale-105">
                      <Download className="h-4 w-4 mr-2" />
                      Download JSON
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {result.status === 'ocr_failed' && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-6 w-6 text-red-600" />
                    <div>
                      <h3 className="font-semibold text-red-900">OCR Failed</h3>
                      <p className="text-sm text-red-700">{result.message}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {result.status === 'non_medical' && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                    <div>
                      <h3 className="font-semibold text-amber-900">Non-Medical Document</h3>
                      <p className="text-sm text-amber-700">{result.message}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Success Content */}
            {result.status === 'success' && (
              <>
                {/* Summary */}
                {result.summary?.overview_points && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Quick Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {result.summary.overview_points.map((point: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <span className="text-lg">{point.split(' ')[0]}</span>
                            <span className="flex-1">{point.substring(point.indexOf(' ') + 1)}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Overview */}
                {result.overview && (
                  <Card>
                    <CardHeader
                      className="cursor-pointer"
                      onClick={() => toggleSection('overview')}
                    >
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Heart className="h-5 w-5" />
                          Patient & Document Overview
                        </CardTitle>
                        {expandedSections.overview ? <ChevronUp /> : <ChevronDown />}
                      </div>
                    </CardHeader>
                    {expandedSections.overview && (
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500">Hospital/Lab</p>
                            <p className="font-semibold">{result.overview.hospital_or_lab}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Doctor</p>
                            <p className="font-semibold">{result.overview.doctor_name}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Patient</p>
                            <p className="font-semibold">{result.overview.patient_name}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Age</p>
                            <p className="font-semibold">{result.overview.patient_age}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Date</p>
                            <p className="font-semibold">{result.overview.date}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Diagnosis</p>
                            <p className="font-semibold">{result.overview.diagnosis}</p>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* Medicines */}
                {result.medicines && result.medicines.length > 0 && (
                  <Card>
                    <CardHeader
                      className="cursor-pointer"
                      onClick={() => toggleSection('medicines')}
                    >
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Pill className="h-5 w-5" />
                          Medications ({result.medicines.length})
                        </CardTitle>
                        {expandedSections.medicines ? <ChevronUp /> : <ChevronDown />}
                      </div>
                    </CardHeader>
                    {expandedSections.medicines && (
                      <CardContent className="space-y-6">
                        {result.medicines.map((med: any, idx: number) => (
                          <div key={idx} className="p-4 bg-blue-50 rounded-lg space-y-3">
                            <div>
                              <h4 className="text-lg font-bold text-blue-900">{med.name}</h4>
                              {med.generic_name !== 'Not available' && (
                                <p className="text-sm text-blue-700">Generic: {med.generic_name}</p>
                              )}
                            </div>
                            
                            <p className="text-sm">{med.what_it_does}</p>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="font-semibold">Dosage:</span> {med.dosage}
                              </div>
                              <div>
                                <span className="font-semibold">Frequency:</span> {med.frequency}
                              </div>
                              <div>
                                <span className="font-semibold">Duration:</span> {med.duration}
                              </div>
                              <div>
                                <span className="font-semibold">Take with:</span> {med.take_with}
                              </div>
                            </div>

                            {med.timing && med.timing.length > 0 && (
                              <div>
                                <p className="font-semibold text-sm mb-1">Timing:</p>
                                <ul className="space-y-1">
                                  {med.timing.map((time: string, tIdx: number) => (
                                    <li key={tIdx} className="text-sm ml-4">• {time}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {med.side_effects && med.side_effects.length > 0 && (
                              <div>
                                <p className="font-semibold text-sm mb-1">Possible Side Effects:</p>
                                <ul className="space-y-1">
                                  {med.side_effects.map((effect: string, eIdx: number) => (
                                    <li key={eIdx} className="text-sm ml-4">• {effect}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {med.what_to_avoid && med.what_to_avoid.length > 0 && (
                              <div>
                                <p className="font-semibold text-sm mb-1">What to Avoid:</p>
                                <ul className="space-y-1">
                                  {med.what_to_avoid.map((avoid: string, aIdx: number) => (
                                    <li key={aIdx} className="text-sm ml-4 text-red-700">• {avoid}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {med.important_tip && (
                              <div className="bg-yellow-100 p-2 rounded">
                                <p className="text-sm font-medium">{med.important_tip}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* Lab Results */}
                {result.lab_results && result.lab_results.length > 0 && (
                  <Card>
                    <CardHeader
                      className="cursor-pointer"
                      onClick={() => toggleSection('labResults')}
                    >
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <TestTube className="h-5 w-5" />
                          Lab Test Results ({result.lab_results.length})
                        </CardTitle>
                        {expandedSections.labResults ? <ChevronUp /> : <ChevronDown />}
                      </div>
                    </CardHeader>
                    {expandedSections.labResults && (
                      <CardContent className="space-y-4">
                        {result.lab_results.map((test: any, idx: number) => (
                          <div key={idx} className="p-4 bg-cyan-50 rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold">{test.test_name}</h4>
                              <Badge
                                variant={test.status === 'NORMAL' ? 'default' : 'destructive'}
                              >
                                {test.status_emoji} {test.status}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="font-semibold">Your Value:</span> {test.your_value}
                              </div>
                              <div>
                                <span className="font-semibold">Normal Range:</span> {test.normal_range}
                              </div>
                            </div>

                            {test.what_it_means && test.what_it_means.length > 0 && (
                              <div>
                                <p className="font-semibold text-sm mb-1">What It Means:</p>
                                <ul className="space-y-1">
                                  {test.what_it_means.map((meaning: string, mIdx: number) => (
                                    <li key={mIdx} className="text-sm ml-4">• {meaning}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {test.what_to_do && test.what_to_do.length > 0 && (
                              <div>
                                <p className="font-semibold text-sm mb-1">What To Do:</p>
                                <ul className="space-y-1">
                                  {test.what_to_do.map((action: string, aIdx: number) => (
                                    <li key={aIdx} className="text-sm ml-4">• {action}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* Alerts */}
                {result.alerts && result.alerts.length > 0 && (
                  <Card className="border-red-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-red-700">
                        <AlertTriangle className="h-5 w-5" />
                        Important Alerts
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {result.alerts.map((alert: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg ${
                            alert.level === 'CRITICAL'
                              ? 'bg-red-100 border border-red-300'
                              : alert.level === 'WARNING'
                              ? 'bg-yellow-100 border border-yellow-300'
                              : 'bg-blue-100 border border-blue-300'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-xl">{alert.emoji}</span>
                            <div className="flex-1">
                              <h4 className="font-bold">{alert.title}</h4>
                              <p className="text-sm mt-1">{alert.description}</p>
                              <p className="text-sm font-semibold mt-2">{alert.action}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Lifestyle */}
                {result.lifestyle && (
                  <Card>
                    <CardHeader
                      className="cursor-pointer"
                      onClick={() => toggleSection('lifestyle')}
                    >
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Activity className="h-5 w-5" />
                          Lifestyle Recommendations
                        </CardTitle>
                        {expandedSections.lifestyle ? <ChevronUp /> : <ChevronDown />}
                      </div>
                    </CardHeader>
                    {expandedSections.lifestyle && (
                      <CardContent className="space-y-4">
                        {result.lifestyle.diet && result.lifestyle.diet.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Diet</h4>
                            <ul className="space-y-1">
                              {result.lifestyle.diet.map((item: string, idx: number) => (
                                <li key={idx} className="text-sm ml-4">• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {result.lifestyle.exercise && result.lifestyle.exercise.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Exercise</h4>
                            <ul className="space-y-1">
                              {result.lifestyle.exercise.map((item: string, idx: number) => (
                                <li key={idx} className="text-sm ml-4">• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {result.lifestyle.hydration && result.lifestyle.hydration.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Hydration</h4>
                            <ul className="space-y-1">
                              {result.lifestyle.hydration.map((item: string, idx: number) => (
                                <li key={idx} className="text-sm ml-4">• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {result.lifestyle.sleep && result.lifestyle.sleep.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Sleep</h4>
                            <ul className="space-y-1">
                              {result.lifestyle.sleep.map((item: string, idx: number) => (
                                <li key={idx} className="text-sm ml-4">• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {result.lifestyle.avoid && result.lifestyle.avoid.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2 text-red-700">Avoid</h4>
                            <ul className="space-y-1">
                              {result.lifestyle.avoid.map((item: string, idx: number) => (
                                <li key={idx} className="text-sm ml-4 text-red-700">• {item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* Follow-up */}
                {result.followup && (
                  <Card>
                    <CardHeader
                      className="cursor-pointer"
                      onClick={() => toggleSection('followup')}
                    >
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          Follow-up & Emergency Signs
                        </CardTitle>
                        {expandedSections.followup ? <ChevronUp /> : <ChevronDown />}
                      </div>
                    </CardHeader>
                    {expandedSections.followup && (
                      <CardContent className="space-y-4">
                        {result.followup.next_visit && (
                          <div>
                            <h4 className="font-semibold mb-2">Next Visit</h4>
                            <p className="text-sm">{result.followup.next_visit}</p>
                          </div>
                        )}

                        {result.followup.repeat_tests && result.followup.repeat_tests.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Tests to Repeat</h4>
                            <ul className="space-y-1">
                              {result.followup.repeat_tests.map((test: string, idx: number) => (
                                <li key={idx} className="text-sm ml-4">• {test}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {result.followup.emergency_signs && result.followup.emergency_signs.length > 0 && (
                          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            <h4 className="font-semibold mb-2 text-red-900 flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5" />
                              Emergency Warning Signs
                            </h4>
                            <ul className="space-y-1">
                              {result.followup.emergency_signs.map((sign: string, idx: number) => (
                                <li key={idx} className="text-sm ml-4 text-red-800">• {sign}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* OCR Extracted Text */}
                {result.ocr_extracted_text && (
                  <Card>
                    <CardHeader
                      className="cursor-pointer"
                      onClick={() => toggleSection('ocrText')}
                    >
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Raw Extracted Text
                        </CardTitle>
                        {expandedSections.ocrText ? <ChevronUp /> : <ChevronDown />}
                      </div>
                    </CardHeader>
                    {expandedSections.ocrText && (
                      <CardContent>
                        <pre className="text-xs bg-gray-100 p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap">
                          {result.ocr_extracted_text}
                        </pre>
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* Disclaimer */}
                {result.disclaimer && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="pt-6">
                      <p className="text-sm text-blue-900 text-center">{result.disclaimer}</p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicalDocumentAnalyzer;
