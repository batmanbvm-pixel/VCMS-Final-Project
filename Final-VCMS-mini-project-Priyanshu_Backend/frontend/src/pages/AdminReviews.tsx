import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Star, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import api from "@/services/api";
import { EmptyState } from "@/components/EmptyState";

interface Review {
  _id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialization: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  reviewsByRating: Record<number, number>;
  topRatedDoctors: Array<{ name: string; count: number; rating: number }>;
  bottomRatedDoctors: Array<{ name: string; count: number; rating: number }>;
}

const DEFAULT_STATS: ReviewStats = {
  totalReviews: 0,
  averageRating: 0,
  reviewsByRating: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  topRatedDoctors: [],
  bottomRatedDoctors: [],
};

const AdminReviews = () => {
  const { toast } = useToast();
  const { isAuthenticated, user: authUser } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [deletingReview, setDeletingReview] = useState<Review | null>(null);
  const [viewMode, setViewMode] = useState<"all" | "doctor" | "patient">("all");
  const [sortFilter, setSortFilter] = useState<"newest" | "highest" | "lowest">("newest");
  const [warningDialog, setWarningDialog] = useState({
    open: false,
    userId: "",
    userName: "",
    userType: "" as 'doctor' | 'patient' | '',
    reason: "",
    message: "",
    loading: false,
  });

  // Redirect if not authenticated or not an admin
  useEffect(() => {
    if (!isAuthenticated || !authUser || authUser.role !== "admin") {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, authUser, navigate]);
  const [expandedDoctors, setExpandedDoctors] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());

  const toggleDoctorExpand = (doctorId: string) => {
    setExpandedDoctors(prev => {
      const newSet = new Set(prev);
      newSet.has(doctorId) ? newSet.delete(doctorId) : newSet.add(doctorId);
      return newSet;
    });
  };

  const togglePatientExpand = (patientId: string) => {
    setExpandedPatients(prev => {
      const newSet = new Set(prev);
      newSet.has(patientId) ? newSet.delete(patientId) : newSet.add(patientId);
      return newSet;
    });
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      
      // Try multiple endpoints for reviews
      let reviewsData: Review[] = [];
      let statsData: ReviewStats = DEFAULT_STATS;

      const normalizeReviews = (payload: any): Review[] => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.reviews)) return payload.reviews;
        if (Array.isArray(payload?.data)) return payload.data;
        return [];
      };
      
      try {
        const res = await api.get('/admin/reviews', { params: { limit: 500 } });
        reviewsData = normalizeReviews(res.data);
      } catch {
        try {
          const res = await api.get('/public/reviews');
          reviewsData = normalizeReviews(res.data);
        } catch {
          reviewsData = [];
        }
      }
      
      // Calculate stats from reviews
      if (reviewsData.length > 0) {
        const totalRating = reviewsData.reduce((sum, r) => sum + r.rating, 0);
        const avgRating = totalRating / reviewsData.length;
        const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        
        reviewsData.forEach(r => {
          ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1;
        });
        
        statsData = {
          totalReviews: reviewsData.length,
          averageRating: avgRating,
          reviewsByRating: ratingCounts,
          topRatedDoctors: [],
          bottomRatedDoctors: [],
        };
      }
      
      setReviews(reviewsData);
      setStats(statsData);
    } catch (err: any) {
      toast({
        title: "Error",
        description: "Failed to fetch reviews",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!deletingReview) return;
    try {
      await api.delete(`/admin/reviews/${deletingReview._id}`);
      toast({ title: "Success", description: "Review deleted successfully." });
      setReviews(reviews.filter(r => r._id !== deletingReview._id));
      setDeletingReview(null);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to delete review",
        variant: "destructive",
      });
    }
  };


  const handleSendWarning = async () => {
    if (!warningDialog.userId || !warningDialog.message.trim()) {
      toast({ title: "Required", description: "Please enter a warning message.", variant: "destructive" });
      return;
    }

    const reasonLabelMap: Record<string, string> = {
      "high-cancellation": "High Cancellation Rate",
      "no-show": "Frequent No-shows",
      "poor-ratings": "Poor Ratings",
      "inappropriate-feedback": "Inappropriate Feedback",
      "violation": "Policy Violation",
      "other": "Other",
    };
    const reasonLabel = warningDialog.reason ? reasonLabelMap[warningDialog.reason] || warningDialog.reason : "";
    const composedMessage = reasonLabel
      ? `${reasonLabel}: ${warningDialog.message.trim()}`
      : warningDialog.message.trim();

    try {
      setWarningDialog((prev) => ({ ...prev, loading: true }));
      await api.put(`/admin/users/${warningDialog.userId}/warn`, {
        message: composedMessage,
      });
      toast({
        title: "Success",
        description: `Warning sent to ${warningDialog.userName}`,
      });
      setWarningDialog({ open: false, userId: "", userName: "", userType: "", reason: "", message: "", loading: false });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to send warning",
        variant: "destructive",
      });
      setWarningDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const filteredReviews = reviews
    .filter((r) => {
      // Lenient validation: only filter out reviews that are completely broken
      // Must have at least one valid identifier
      const hasMinimalData = (r.doctorName || r.patientName) && r.rating;
      if (!hasMinimalData) return false;
      
      // Only filter out explicit invalid markers
      if (r.doctorName && (r.doctorName.toLowerCase() === 'unknown' || r.doctorName === 'N/A')) return false;
      if (r.patientName && (r.patientName.toLowerCase() === 'unknown' || r.patientName === 'N/A')) return false;
      
      const matchesSearch =
        (r.patientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.doctorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.comment || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRating = ratingFilter === "all" || r.rating === ratingFilter;
      return matchesSearch && matchesRating;
    })
    .sort((a, b) => {
      if (sortFilter === "highest") return b.rating - a.rating;
      if (sortFilter === "lowest") return a.rating - b.rating;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const hasActiveFilters = searchQuery.trim().length > 0 || ratingFilter !== "all" || sortFilter !== "newest";

  const clearFilters = () => {
    setSearchQuery("");
    setRatingFilter("all");
    setSortFilter("newest");
  };

  // Group reviews by doctor
  const reviewsByDoctor = filteredReviews.reduce((acc, review) => {
    if (!acc[review.doctorId]) {
      acc[review.doctorId] = {
        doctorId: review.doctorId,
        doctorName: review.doctorName,
        doctorSpecialization: review.doctorSpecialization,
        reviews: [],
        averageRating: 0,
        totalCount: 0,
      };
    }
    acc[review.doctorId].reviews.push(review);
    return acc;
  }, {} as Record<string, any>);

  // Group reviews by patient
  const reviewsByPatient = filteredReviews.reduce((acc, review) => {
    if (!acc[review.patientId]) {
      acc[review.patientId] = {
        patientId: review.patientId,
        patientName: review.patientName,
        reviews: [],
        averageRating: 0,
        totalCount: 0,
      };
    }
    acc[review.patientId].reviews.push(review);
    return acc;
  }, {} as Record<string, any>);

  // Calculate average rating per patient
  Object.keys(reviewsByPatient).forEach((patId) => {
    const patReviews = reviewsByPatient[patId].reviews;
    const totalRating = patReviews.reduce((sum, r) => sum + r.rating, 0);
    reviewsByPatient[patId].averageRating = totalRating / patReviews.length;
    reviewsByPatient[patId].totalCount = patReviews.length;
  });

  const patientStatsArray = Object.values(reviewsByPatient).sort((a, b) => {
    if (sortFilter === "highest") return b.averageRating - a.averageRating;
    if (sortFilter === "lowest") return a.averageRating - b.averageRating;
    const aLatest = a.reviews?.[0]?.createdAt ? new Date(a.reviews[0].createdAt).getTime() : 0;
    const bLatest = b.reviews?.[0]?.createdAt ? new Date(b.reviews[0].createdAt).getTime() : 0;
    return bLatest - aLatest;
  });

  // Calculate average rating per doctor
  Object.keys(reviewsByDoctor).forEach((docId) => {
    const docReviews = reviewsByDoctor[docId].reviews;
    const totalRating = docReviews.reduce((sum, r) => sum + r.rating, 0);
    reviewsByDoctor[docId].averageRating = totalRating / docReviews.length;
    reviewsByDoctor[docId].totalCount = docReviews.length;
  });

  const doctorStatsArray = Object.values(reviewsByDoctor).sort((a, b) => {
    if (sortFilter === "highest") return b.averageRating - a.averageRating;
    if (sortFilter === "lowest") return a.averageRating - b.averageRating;
    const aLatest = a.reviews?.[0]?.createdAt ? new Date(a.reviews[0].createdAt).getTime() : 0;
    const bLatest = b.reviews?.[0]?.createdAt ? new Date(b.reviews[0].createdAt).getTime() : 0;
    return bLatest - aLatest;
  });

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300"
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600">Loading reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl pb-12">
      {/* Header */}
      <div className="rounded-xl bg-sky-500 p-6 text-white shadow-md border border-sky-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Star className="h-6 w-6 fill-white" /> Patient Reviews & Feedback
            </h1>
            <p className="mt-1 text-sky-100 text-sm">View and manage all doctor reviews and patient feedback</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-white/15 border-white/30 text-white hover:bg-white/25"
            onClick={fetchReviews}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-slate-600 font-medium">Total Reviews</p>
              <p className="text-3xl font-bold text-sky-600 mt-2">{stats?.totalReviews || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-slate-600 font-medium">Average Rating</p>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-3xl font-bold text-amber-600">{(stats?.averageRating || 0).toFixed(1)}</p>
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-slate-600 font-medium">5 Star Reviews</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats?.reviewsByRating?.[5] || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-slate-600 font-medium">Low Ratings (&lt;3)</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {((stats?.reviewsByRating?.[1] || 0) + (stats?.reviewsByRating?.[2] || 0))}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap items-end">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by patient, doctor, or comment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-white border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all duration-200"
          />
        </div>
        <div className="flex gap-3">
          <Select value={String(ratingFilter)} onValueChange={(val) => setRatingFilter(val === "all" ? "all" : Number(val))}>
            <SelectTrigger className="w-40 h-10 bg-white border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-medium">All Ratings</SelectItem>
              <SelectItem value="5" className="font-medium text-yellow-600">
                <span className="flex items-center gap-2">
                  <span className="text-yellow-500">★★★★★</span> 5 Stars
                </span>
              </SelectItem>
              <SelectItem value="4" className="font-medium text-yellow-600">
                <span className="flex items-center gap-2">
                  <span className="text-yellow-500">★★★★</span> 4 Stars
                </span>
              </SelectItem>
              <SelectItem value="3" className="font-medium text-yellow-600">
                <span className="flex items-center gap-2">
                  <span className="text-yellow-500">★★★</span> 3 Stars
                </span>
              </SelectItem>
              <SelectItem value="2" className="font-medium text-orange-600">
                <span className="flex items-center gap-2">
                  <span className="text-orange-500">★★</span> 2 Stars
                </span>
              </SelectItem>
              <SelectItem value="1" className="font-medium text-red-600">
                <span className="flex items-center gap-2">
                  <span className="text-red-500">★</span> 1 Star
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortFilter} onValueChange={(val) => setSortFilter(val as "newest" | "highest" | "lowest")}>
            <SelectTrigger className="w-40 h-10 bg-white border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="highest">Highest First</SelectItem>
              <SelectItem value="lowest">Lowest First</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilters && (
          <Button
            size="sm"
            variant="outline"
            onClick={clearFilters}
            className="text-red-700 border-red-300 bg-red-50 hover:bg-red-100"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* View Mode Toggle - Three Tabs: All, Doctor Based, Patient Based */}
      <div className="flex gap-3 flex-wrap">
        <Button
          onClick={() => setViewMode("all")}
          className={`transition-all duration-200 shadow-sm hover:shadow-md ${
            viewMode === "all"
              ? "bg-sky-600 text-white hover:bg-sky-700 scale-105 shadow-md"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:scale-102"
          }`}
        >
          All Feedback
        </Button>
        <Button
          onClick={() => setViewMode("doctor")}
          className={`transition-all duration-200 shadow-sm hover:shadow-md ${
            viewMode === "doctor"
              ? "bg-emerald-600 text-white hover:bg-emerald-700 scale-105 shadow-md"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:scale-102"
          }`}
        >
          Doctor Based
        </Button>
        <Button
          onClick={() => setViewMode("patient")}
          className={`transition-all duration-200 shadow-sm hover:shadow-md ${
            viewMode === "patient"
              ? "bg-cyan-600 text-white hover:bg-cyan-700 scale-105 shadow-md"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:scale-102"
          }`}
        >
          Patient Based
        </Button>
      </div>

      {/* View: All Feedback */}
      {viewMode === "all" && (
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="border-b border-slate-200 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Reviews
              <span className="ml-2 inline-block bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-semibold">
                {filteredReviews.length}
              </span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow className="sticky top-0 z-10 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-300">
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Patient</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Doctor</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Rating</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Comment</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Date</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReviews.map((review, index) => (
                  <TableRow
                    key={review._id}
                    className={`border-b border-slate-100 hover:bg-slate-100/60 transition-all duration-200 ${
                      index % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                    }`}
                  >
                    <TableCell className="font-medium text-slate-900">
                      {review.patientName || 'Patient'}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      <div>
                        <p className="font-medium">Dr. {review.doctorName || 'Doctor'}</p>
                        <p className="text-xs text-slate-500">{review.doctorSpecialization || 'General'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {renderStars(review.rating)}
                        <span className="text-sm font-semibold text-slate-700">{review.rating}/5</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 max-w-xs truncate">
                      {review.comment || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {new Date(review.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          className="h-8 px-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold"
                          onClick={() => setWarningDialog({
                            open: true,
                            userId: review.doctorId,
                            userName: `Dr. ${review.doctorName}`,
                            userType: 'doctor',
                            reason: "",
                            message: "",
                            loading: false,
                          })}
                          title="Warn Doctor"
                          aria-label="Warn doctor"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                          Dr
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 px-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold"
                          onClick={() => setWarningDialog({
                            open: true,
                            userId: review.patientId,
                            userName: review.patientName,
                            userType: 'patient',
                            reason: "",
                            message: "",
                            loading: false,
                          })}
                          title="Warn Patient"
                          aria-label="Warn patient"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                          Pt
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                          onClick={() => setDeletingReview(review)}
                          title="Delete"
                          aria-label="Delete review"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredReviews.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <EmptyState
                        icon={Star}
                        title="No reviews found"
                        description="Try adjusting your search or rating filters"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* View: Feedback by Patient */}
      {viewMode === "patient" && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {patientStatsArray.length === 0 ? (
          <div className="col-span-full">
            <Card className="border-0 shadow-lg">
              <CardContent className="py-16">
                <EmptyState
                  icon={Star}
                  title="No patients with feedback"
                  description="No feedback data available for patients"
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          patientStatsArray.map((patient) => (
            <Card key={patient.patientId} className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden hover:scale-105 hover:border-cyan-300 border border-transparent">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white font-bold shadow-md flex-shrink-0">
                    {(patient.patientName || 'PT').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-slate-900">{patient.patientName || 'Patient'}</h3>
                    <p className="text-sm text-slate-500">Patient</p>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 mb-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Total Feedback Given</span>
                    <span className="font-bold text-lg text-cyan-600">{patient.totalCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Average Rating Given</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-600">{patient.averageRating.toFixed(1)}</span>
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs"
                    onClick={() => setWarningDialog({
                      open: true,
                      userId: patient.patientId,
                      userName: patient.patientName,
                      userType: 'patient',
                      reason: "",
                      message: "",
                      loading: false,
                    })}
                  >
                    Warn Patient
                  </Button>
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <h4 className="font-semibold text-sm text-slate-700">Recent Feedback</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(expandedPatients.has(patient.patientId) ? patient.reviews : patient.reviews.slice(0, 3)).map((review: Review) => (
                      <div key={review._id} className="bg-slate-50 rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-slate-900">Dr. {review.doctorName}</p>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-3 w-3 ${
                                  star <= review.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mb-1">{review.doctorSpecialization}</p>
                        <p className="text-slate-600 line-clamp-2">{review.comment || "—"}</p>
                      </div>
                    ))}
                    {patient.reviews.length > 3 && (
                      <button 
                        onClick={() => togglePatientExpand(patient.patientId)}
                        className="w-full text-center text-xs font-semibold text-cyan-600 hover:text-cyan-700 py-2 rounded-lg hover:bg-cyan-50 transition-colors"
                      >
                        {expandedPatients.has(patient.patientId) ? `Show less feedback` : `View all ${patient.reviews.length} feedback`}
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      )}

      {/* View: Feedback by Doctor - Item #8 */}
      {viewMode === "doctor" && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {doctorStatsArray.length === 0 ? (
          <div className="col-span-full">
            <Card className="border-0 shadow-lg">
              <CardContent className="py-16">
                <EmptyState
                  icon={Star}
                  title="No doctors with feedback"
                  description="No feedback data available for doctors"
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          doctorStatsArray.map((doctor) => (
            <Card key={doctor.doctorId} className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden hover:scale-105 hover:border-emerald-300 border border-transparent">
              <CardContent className="p-6">
                {/* Doctor Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold shadow-md flex-shrink-0">
                    {(doctor.doctorName || 'DR').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-slate-900">Dr. {doctor.doctorName || 'Doctor'}</h3>
                    <p className="text-sm text-slate-500">{doctor.doctorSpecialization || 'General'}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="border-t border-slate-200 pt-4 mb-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Total Feedback</span>
                    <span className="font-bold text-lg text-sky-600">{doctor.totalCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Average Rating</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-600">{doctor.averageRating.toFixed(1)}</span>
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs"
                    onClick={() => setWarningDialog({
                      open: true,
                      userId: doctor.doctorId,
                      userName: `Dr. ${doctor.doctorName}`,
                      userType: 'doctor',
                      reason: "",
                      message: "",
                      loading: false,
                    })}
                  >
                    Warn Doctor
                  </Button>
                </div>

                {/* Recent Feedback */}
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <h4 className="font-semibold text-sm text-slate-700">Recent Feedback</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(expandedDoctors.has(doctor.doctorId) ? doctor.reviews : doctor.reviews.slice(0, 3)).map((review: Review) => (
                      <div key={review._id} className="bg-slate-50 rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-slate-900">{review.patientName}</p>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-3 w-3 ${
                                  star <= review.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-slate-600 line-clamp-2">{review.comment || "—"}</p>
                      </div>
                    ))}
                    {doctor.reviews.length > 3 && (
                      <button 
                        onClick={() => toggleDoctorExpand(doctor.doctorId)}
                        className="w-full text-center text-xs font-semibold text-sky-600 hover:text-sky-700 py-2 rounded-lg hover:bg-sky-50 transition-colors"
                      >
                        {expandedDoctors.has(doctor.doctorId) ? `Show less feedback` : `View all ${doctor.reviews.length} feedback`}
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingReview} onOpenChange={() => setDeletingReview(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Review</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this review? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReview} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Warn User Dialog */}
      <Dialog open={warningDialog.open} onOpenChange={(openState) => setWarningDialog((prev) => ({ ...prev, open: openState }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Send Warning to {warningDialog.userType === 'doctor' ? 'Doctor' : 'Patient'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Send a formal warning to {warningDialog.userName}
            </DialogDescription>
          </DialogHeader>

          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-800">
              Send a clear warning to <strong>{warningDialog.userName}</strong>. This will be visible to the user.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <select
                className="w-full px-3 py-2 rounded-md border border-input text-sm"
                value={warningDialog.reason}
                onChange={(e) => setWarningDialog((prev) => ({ ...prev, reason: e.target.value }))}
              >
                <option value="">Select a reason...</option>
                {warningDialog.userType === 'doctor' ? (
                  <>
                    <option value="high-cancellation">High Cancellation Rate</option>
                    <option value="no-show">Frequent No-shows</option>
                    <option value="poor-ratings">Poor Ratings</option>
                  </>
                ) : (
                  <>
                    <option value="inappropriate-feedback">Inappropriate Feedback</option>
                    <option value="false-information">False Information</option>
                  </>
                )}
                <option value="violation">Policy Violation</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Warning Message *</label>
              <Textarea
                placeholder="Write a clear warning message..."
                value={warningDialog.message}
                onChange={(e) => setWarningDialog((prev) => ({ ...prev, message: e.target.value }))}
                className="text-sm resize-none"
                rows={4}
              />
              <div className="text-xs text-slate-500">Be specific about what needs to improve.</div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
              onClick={() => setWarningDialog((prev) => ({ ...prev, open: false }))}
              disabled={warningDialog.loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSendWarning}
              disabled={warningDialog.loading || !warningDialog.message.trim()}
            >
              {warningDialog.loading ? "Sending..." : "Send Warning"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReviews;
