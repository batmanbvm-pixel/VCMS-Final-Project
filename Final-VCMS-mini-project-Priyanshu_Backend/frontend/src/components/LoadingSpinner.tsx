import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  text?: string;
  size?: "sm" | "md" | "lg";
}

export const LoadingSpinner = ({ text = "Loading...", size = "md" }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 animate-fade-in">
      <div className="relative">
        <Loader2 className={`${sizeClasses[size]} text-primary animate-spin`} />
        <div className="absolute inset-0 bg-gradient-to-tr from-primary to-secondary opacity-20 rounded-full blur-xl animate-pulse" />
      </div>
      {text && <p className="text-sm font-medium text-muted-foreground animate-pulse">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;

