import { ScanLine, Brain, Upload, Sparkles, FileCheck2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MedicalReportAnalyzer from "@/components/MedicalReportAnalyzer";

const PatientAIAnalyzer = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-primary/5">
      <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl pb-12">
      <div className="rounded-xl bg-sky-500 p-6 shadow-md border border-sky-300 text-white">
        <div className="pointer-events-none absolute -top-14 -right-14 h-52 w-52 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-white">AI Report Analyzer</h1>
            <p className="text-sky-100 mt-1.5 text-sm max-w-2xl">Upload your medical report and get fast OCR extraction with a patient-friendly AI summary.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full lg:w-auto">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center min-w-[98px]">
              <p className="text-lg font-bold text-white">PDF</p>
              <p className="text-sky-100 text-xs mt-0.5">PNG · JPG</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 text-center min-w-[98px]">
              <p className="text-lg font-bold text-white">10 MB</p>
              <p className="text-sky-100 text-xs mt-0.5">Max size</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {[
          { icon: Upload, step: "1", title: "Upload Report", desc: "Choose PDF, PNG, or JPG", color: "bg-sky-50 text-sky-600" },
          { icon: ScanLine, step: "2", title: "OCR Extraction", desc: "Text is detected automatically", color: "bg-primary/10 text-primary" },
          { icon: Sparkles, step: "3", title: "AI Summary", desc: "See key findings quickly", color: "bg-emerald-50 text-emerald-600" },
        ].map((item) => (
          <div key={item.step} className="rounded-lg border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-3 flex items-start gap-2.5">
            <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${item.color}`}>
              <item.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Step {item.step}</p>
              <p className="text-xs font-bold text-slate-900 mt-0.5">{item.title}</p>
              <p className="text-xs text-slate-600 mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden shadow-sm border border-border bg-white/90 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-border bg-muted/70">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
              <Brain className="h-4 w-4 text-sky-600" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground leading-none">Upload &amp; Analyse</h2>
              <p className="text-xs text-muted-foreground mt-1">Select your report to generate insights</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/patient/medical-history')}
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1.5 transition-all duration-200 hover:scale-105"
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            Back to Medical History
          </button>
        </div>
        <MedicalReportAnalyzer />
      </div>
      </div>
    </div>
  );
};

export default PatientAIAnalyzer;
