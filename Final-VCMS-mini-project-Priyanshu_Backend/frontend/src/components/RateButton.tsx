import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RateButtonProps {
  rated: boolean;
  onClick?: () => void;
}

/**
 * Shared Rate / Rated button used across:
 *  - PatientAppointments
 *  - PatientDashboard (compact preview)
 *  - PatientPrescriptions
 */
const RateButton = ({ rated, onClick }: RateButtonProps) => {
  if (rated) {
    return (
      <Button
        size="sm"
        disabled
        title="Already Rated"
        className="h-8 px-3 gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-500 text-white text-xs font-semibold opacity-90 cursor-not-allowed"
      >
        <Star className="h-3.5 w-3.5 fill-white text-white" />
        Rated
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      title="Rate Doctor"
      className="h-8 px-3 gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold"
      onClick={onClick}
    >
      <Star className="h-3.5 w-3.5 fill-white text-white" />
      Rate
    </Button>
  );
};

export default RateButton;
