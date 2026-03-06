import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, FileText, AlertCircle, CheckCircle } from "lucide-react";

interface MedicalHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  medicalHistory?: string;
  symptoms?: string[];
  pastConditions?: string[];
  allergies?: string[];
  medications?: string[];
  surgeries?: string[];
  lastCheckup?: string;
}

export const MedicalHistoryModal = ({
  isOpen,
  onClose,
  patientName,
  medicalHistory,
  symptoms = [],
  pastConditions = [],
  allergies = [],
  medications = [],
  surgeries = [],
  lastCheckup,
}: MedicalHistoryModalProps) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const sections = [
    {
      id: "history",
      title: "Medical History",
      icon: FileText,
      content: medicalHistory || "No medical history recorded",
      isEmpty: !medicalHistory,
      color: "blue",
    },
    {
      id: "symptoms",
      title: "Current Symptoms",
      icon: AlertCircle,
      items: symptoms,
      color: "orange",
    },
    {
      id: "conditions",
      title: "Past Conditions",
      icon: CheckCircle,
      items: pastConditions,
      color: "red",
    },
    {
      id: "allergies",
      title: "Allergies",
      icon: AlertCircle,
      items: allergies,
      color: "red",
    },
    {
      id: "medications",
      title: "Current Medications",
      icon: FileText,
      items: medications,
      color: "green",
    },
    {
      id: "surgeries",
      title: "Past Surgeries",
      icon: FileText,
      items: surgeries,
      color: "cyan",
    },
  ];

  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    red: "bg-red-50 border-red-200 text-red-700",
    green: "bg-green-50 border-green-200 text-green-700",
    cyan: "bg-cyan-50 border-cyan-200 text-cyan-700",
  };

  const badgeColors = {
    blue: "bg-blue-100 text-blue-800 border-blue-300",
    orange: "bg-orange-100 text-orange-800 border-orange-300",
    red: "bg-red-100 text-red-800 border-red-300",
    green: "bg-green-100 text-green-800 border-green-300",
    cyan: "bg-cyan-100 text-cyan-800 border-cyan-300",
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-white z-10 pb-4 border-b">
          <DialogTitle className="text-2xl">Medical History - {patientName}</DialogTitle>
          {lastCheckup && (
            <p className="text-xs text-muted-foreground mt-2">Last Checkup: {lastCheckup}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {sections.map((section) => {
            const Icon = section.icon;
            const hasContent =
              (section.items && section.items.length > 0) ||
              (section.content && !section.isEmpty);
            const isExpanded = expandedSection === section.id;

            return (
              <Card
                key={section.id}
                className={`border-2 cursor-pointer transition-all hover:shadow-md ${
                  isExpanded ? colorClasses[section.color as keyof typeof colorClasses] : ""
                }`}
              >
                <CardHeader
                  className="pb-3 cursor-pointer"
                  onClick={() =>
                    setExpandedSection(isExpanded ? null : section.id)
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      <CardTitle className="text-base">{section.title}</CardTitle>
                      {hasContent && (
                        <Badge variant="outline" className="ml-2">
                          {section.items?.length || 1}
                        </Badge>
                      )}
                    </div>
                    <div
                      className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    >
                      ▼
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-3 border-t pt-4">
                    {section.content ? (
                      <p className="text-sm">{section.content}</p>
                    ) : section.items && section.items.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {section.items.map((item, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className={`${
                              badgeColors[
                                section.color as keyof typeof badgeColors
                              ]
                            }`}
                          >
                            {item}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No {section.title.toLowerCase()} recorded
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        <div className="flex gap-2 pt-4 border-t sticky bottom-0 bg-white">
          <Button onClick={onClose} className="w-full" variant="outline">
            Close
          </Button>
          <Button onClick={onClose} className="w-full bg-sky-500 hover:bg-sky-600 text-white">
            Understand History
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MedicalHistoryModal;
