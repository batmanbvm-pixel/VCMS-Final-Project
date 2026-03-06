import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, AlertCircle, PlayCircle, UserCheck, FileCheck, MessageSquare, Ban } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  variant?: "default" | "outline";
  showIcon?: boolean;
}

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: any }> = {
  // Appointment statuses
  booked: { bg: "bg-sky-50 border-sky-200", text: "text-sky-700", label: "Booked", icon: Clock },
  pending: { bg: "bg-sky-50 border-sky-200", text: "text-sky-700", label: "Pending", icon: AlertCircle },
  accepted: { bg: "bg-sky-100 border-sky-300", text: "text-sky-700", label: "Accepted", icon: UserCheck },
  "in-progress": { bg: "bg-cyan-50 border-cyan-200", text: "text-cyan-700", label: "In Progress", icon: PlayCircle },
  "in progress": { bg: "bg-cyan-50 border-cyan-200", text: "text-cyan-700", label: "In Progress", icon: PlayCircle },
  completed: { bg: "bg-sky-100 border-sky-200", text: "text-sky-700", label: "Completed", icon: FileCheck },
  cancelled: { bg: "bg-red-50 border-red-200", text: "text-red-700", label: "Cancelled", icon: XCircle },
  rejected: { bg: "bg-red-50 border-red-200", text: "text-red-700", label: "Rejected", icon: Ban },

  // User statuses
  "pending-approval": { bg: "bg-sky-50 border-sky-200", text: "text-sky-700", label: "Pending Approval", icon: Clock },
  approved: { bg: "bg-sky-100 border-sky-300", text: "text-sky-700", label: "Approved", icon: CheckCircle },
  suspended: { bg: "bg-sky-50 border-sky-200", text: "text-sky-600", label: "Suspended", icon: Ban },
  active: { bg: "bg-sky-100 border-sky-300", text: "text-sky-700", label: "Active", icon: CheckCircle },
  locked: { bg: "bg-sky-50 border-sky-200", text: "text-sky-700", label: "Locked", icon: Ban },

  // Contact statuses
  open: { bg: "bg-sky-50 border-sky-200", text: "text-sky-700", label: "Open", icon: MessageSquare },
  resolved: { bg: "bg-cyan-50 border-cyan-200", text: "text-cyan-700", label: "Resolved", icon: CheckCircle },
  closed: { bg: "bg-sky-100 border-sky-200", text: "text-sky-600", label: "Closed", icon: XCircle },
};

export const StatusBadge = ({ status, variant = "default", showIcon = true }: StatusBadgeProps) => {
  const config = statusConfig[status?.toLowerCase() || ""] || {
    bg: "bg-slate-100 border-slate-200",
    text: "text-slate-800",
    label: status || "Unknown",
    icon: AlertCircle,
  };

  const Icon = config.icon;

  if (variant === "outline") {
    return (
      <Badge variant="outline" className={`border-current ${config.text} inline-flex items-center gap-1.5`}>
        {showIcon && <Icon className="h-3 w-3" />}
        {config.label}
      </Badge>
    );
  }

  return (
    <Badge className={`${config.bg} ${config.text} border shadow-sm hover:shadow transition-all duration-200 inline-flex items-center gap-1.5`}>
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
};

export default StatusBadge;

