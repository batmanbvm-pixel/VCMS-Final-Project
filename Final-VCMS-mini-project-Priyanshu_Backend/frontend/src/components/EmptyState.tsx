import { Button } from "@/components/ui/button";
import { LucideIcon, AlertCircle, Sparkles } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: "default" | "info" | "warning" | "success";
}

export const EmptyState = ({
  icon: Icon = AlertCircle,
  title,
  description,
  action,
  variant = "default",
}: EmptyStateProps) => {
  const colorMap = {
    default: {
      bg: "bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50",
      iconBg: "bg-gradient-to-br from-sky-100 to-blue-100",
      iconColor: "text-sky-600",
      border: "border-sky-200",
      badge: "bg-sky-100 text-sky-700",
    },
    info: {
      bg: "bg-gradient-to-br from-cyan-50 to-sky-50",
      iconBg: "bg-gradient-to-br from-sky-100 to-cyan-100",
      iconColor: "text-sky-600",
      border: "border-sky-200",
      badge: "bg-sky-100 text-sky-700",
    },
    warning: {
      bg: "bg-gradient-to-br from-amber-50 to-orange-50",
      iconBg: "bg-gradient-to-br from-amber-100 to-orange-100",
      iconColor: "text-amber-600",
      border: "border-amber-200",
      badge: "bg-amber-100 text-amber-700",
    },
    success: {
      bg: "bg-gradient-to-br from-green-50 to-emerald-50",
      iconBg: "bg-gradient-to-br from-green-100 to-emerald-100",
      iconColor: "text-green-600",
      border: "border-green-200",
      badge: "bg-green-100 text-green-700",
    },
  };

  const colors = colorMap[variant];

  return (
    <div className={`relative overflow-hidden rounded-2xl ${colors.bg} border-2 ${colors.border} p-8 md:p-16 min-h-64 flex flex-col items-center justify-center animate-fade-in`}>
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/30 rounded-full blur-3xl -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/20 rounded-full blur-2xl -ml-16 -mb-16" />

      {/* Content */}
      <div className="relative z-10 text-center max-w-md">
        {/* Icon */}
        <div className={`rounded-full ${colors.iconBg} p-6 w-fit mx-auto mb-6 shadow-lg ring-2 ring-white`}>
          <Icon className={`h-12 w-12 ${colors.iconColor} animate-bounce`} />
        </div>

        {/* Title */}
        <h3 className="font-bold text-2xl text-foreground mb-2">{title}</h3>

        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{description}</p>
        )}

        {/* Badge */}
        <div className={`inline-block ${colors.badge} px-3 py-1 rounded-full text-xs font-semibold mb-6`}>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            {variant === "success" ? "All Set!" : "Take Action"}
          </span>
        </div>

        {/* Action Button */}
        {action && (
          <Button
            onClick={action.onClick}
            size="lg"
            className={`w-full sm:w-auto bg-gradient-to-r ${
              variant === "success"
                ? "from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                : "from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700"
            } text-white shadow-lg font-semibold rounded-xl transition-all duration-300 hover:shadow-xl hover:scale-105`}
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
};

interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const ErrorState = ({
  title = "Something went wrong",
  description = "Please try again or contact support.",
  action,
}: ErrorStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-4 rounded-2xl border border-destructive/20 bg-destructive/5 animate-fade-in">
      <div className="rounded-2xl bg-destructive/10 p-4 shadow-sm">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div className="text-center max-w-sm">
        <h3 className="font-bold text-lg text-destructive">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{description}</p>
        )}
      </div>
      {action && (
        <Button
          onClick={action.onClick}
          size="sm"
          variant="outline"
          className="mt-2 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;

