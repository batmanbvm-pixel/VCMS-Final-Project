import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Star, IndianRupee, VideoIcon } from "lucide-react";

interface DoctorCardProps {
  doctor: {
    _id: string;
    name: string;
    specialization: string;
    experience?: number;
    consultationFee?: number;
    location?: {
      city?: string;
      state?: string;
      address?: string;
    };
    rating?: number;
    totalReviews?: number;
    availability?: Array<{
      day: string;
      startTime: string;
      endTime: string;
    }>;
    bio?: string;
    languages?: string[];
    profileImage?: string;
    qualifications?: string[];
  };
  onBookClick: (doctorId: string) => void;
  isLoading?: boolean;
}

export const DoctorCard = ({ doctor, onBookClick, isLoading = false }: DoctorCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const cleanDoctorName = String(doctor.name || "Doctor").replace(/^dr\.?\s*/i, "").trim() || "Doctor";

  // Format available days
  const availableDays = doctor.availability
    ? [...new Set(doctor.availability.map(av => av.day))].slice(0, 3)
    : [];

  // Get location display
  const locationDisplay = doctor.location?.city 
    ? `${doctor.location.city}${doctor.location.state ? `, ${doctor.location.state}` : ''}`
    : 'Location not specified';

  return (
    <Card
      className="glass-card overflow-hidden h-full flex flex-col transition-all duration-300 hover:shadow-lg hover:scale-102"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header Section */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Doctor Avatar */}
          <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-sky-500 to-sky-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
            {cleanDoctorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'DR'}
          </div>

          {/* Rating */}
          {doctor.rating && doctor.rating > 0 && (doctor.totalReviews || 0) > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-xs font-semibold text-amber-900">
                {doctor.rating.toFixed(1)} ({doctor.totalReviews || 0})
              </span>
            </div>
          )}
        </div>

        {/* Name and Specialization */}
        <div className="mt-2">
          <CardTitle className="text-lg leading-tight">
            Dr. {cleanDoctorName}
          </CardTitle>
          <p className="text-sm text-sky-600 font-medium mt-1">
            {doctor.specialization || 'General Medicine'}
          </p>
        </div>
      </CardHeader>

      {/* Content Section */}
      <CardContent className="flex-grow space-y-4">
        {/* Experience and Fee */}
        <div className="flex gap-4 text-sm">
          {doctor.experience && (
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="h-4 w-4 text-sky-500" />
              <span>{doctor.experience}+ years exp.</span>
            </div>
          )}
          {doctor.consultationFee !== undefined && (
            <div className="flex items-center gap-2 text-slate-600 font-medium">
              <IndianRupee className="h-4 w-4 text-sky-500" />
              <span>₹{doctor.consultationFee}</span>
            </div>
          )}
        </div>

        {/* Location */}
        {locationDisplay && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="h-4 w-4 flex-shrink-0 text-sky-500" />
            <span>{locationDisplay}</span>
          </div>
        )}

        {/* Languages */}
        {doctor.languages && doctor.languages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {doctor.languages.slice(0, 3).map((lang, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs bg-slate-100">
                {lang}
              </Badge>
            ))}
          </div>
        )}

        {/* Available Days */}
        {availableDays.length > 0 && (
          <div className="text-sm">
            <p className="text-slate-600 font-medium mb-1">Available Days:</p>
            <div className="flex flex-wrap gap-1">
              {availableDays.map((day, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {day}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Bio / About */}
        {doctor.bio && isHovered && (
          <p className="text-xs text-slate-600 italic line-clamp-2">
            "{doctor.bio}"
          </p>
        )}
      </CardContent>

      {/* Footer Section - Book Button */}
      <div className="p-4 pt-0 border-t border-slate-200 bg-slate-50/50">
        <Button
          onClick={() => onBookClick(doctor._id)}
          disabled={isLoading}
          className="w-full h-10 text-sm px-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl gap-2"
        >
          <VideoIcon className="h-4 w-4" />
          {isLoading ? 'Booking...' : 'Book Now'}
        </Button>
      </div>
    </Card>
  );
};

export default DoctorCard;
