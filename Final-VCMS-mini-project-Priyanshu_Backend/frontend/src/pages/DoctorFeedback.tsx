import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Star, MessageSquare, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import api from "@/services/api";
import { EmptyState } from "@/components/EmptyState";

interface Review {
  _id: string;
  patientId?: string;
  rating: number;
  comment: string;
  patientName: string;
  createdAt: string;
}

interface FeedbackSummary {
  total: number;
  averageRating: number;
}

const DoctorFeedback = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [feedback, setFeedback] = useState<Review[]>([]);
  const [summary, setSummary] = useState<FeedbackSummary>({ total: 0, averageRating: 0 });
  const [loading, setLoading] = useState(true);
  
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    reviewId: null as string | null,
    loading: false,
  });

  const [warnDialog, setWarnDialog] = useState({
    open: false,
    patientId: null as string | null,
    patientName: "",
    loading: false,
  });
  const [warnMessage, setWarnMessage] = useState("");

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const res = await api.get('/public/reviews/doctor/me?limit=1000');
      setFeedback(res.data?.reviews || []);
      setSummary({
        total: res.data?.summary?.total || 0,
        averageRating: res.data?.summary?.averageRating || 0,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load feedback",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFeedback = async () => {
    if (!deleteDialog.reviewId) return;

    try {
      setDeleteDialog(prev => ({ ...prev, loading: true }));
      
      const res = await api.delete(`/reviews/${deleteDialog.reviewId}`);
      
      if (res.data?.success) {
        toast({
          title: "Success",
          description: "Feedback deleted successfully",
        });
        setDeleteDialog({ open: false, reviewId: null, loading: false });
        fetchFeedback();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete feedback",
        variant: "destructive",
      });
    } finally {
      setDeleteDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const handleWarnPatient = async () => {
    if (!warnDialog.patientId || !warnMessage.trim()) return;

    try {
      setWarnDialog(prev => ({ ...prev, loading: true }));
      
      await api.put(`/admin/users/${warnDialog.patientId}/warn`, {
        message: warnMessage,
      });
      
      toast({
        title: "Success",
        description: `Warning sent to ${warnDialog.patientName}`,
      });
      setWarnDialog({ open: false, patientId: null, patientName: "", loading: false });
      setWarnMessage("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to send warning",
        variant: "destructive",
      });
    } finally {
      setWarnDialog(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    if (user?.role === 'doctor') {
      fetchFeedback();
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-6 space-y-5 max-w-7xl pb-12">
        
        {/* Hero Header - Cyan Style */}
        <div className="rounded-xl bg-sky-500 text-white p-6 shadow-md border border-sky-300">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <MessageSquare className="h-6 w-6" /> Patient Feedback
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-sky-100 text-sm">
                  {summary.total} total review{summary.total !== 1 ? 's' : ''}
                </p>
                {summary.averageRating > 0 && (
                  <Badge className="bg-white/15 text-white border-white/30 gap-1 px-2.5 py-1 text-sm">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    {summary.averageRating.toFixed(1)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Feedback List */}
        {loading ? (
          <Card className="border-slate-200 rounded-3xl shadow-sm bg-white">
            <CardContent className="py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-sky-100 flex items-center justify-center animate-pulse">
                  <MessageSquare className="h-6 w-6 text-sky-600" />
                </div>
                <p className="text-center text-slate-600 font-medium">Loading feedback...</p>
              </div>
            </CardContent>
          </Card>
        ) : feedback.length === 0 ? (
          <Card className="border-slate-200 rounded-3xl shadow-sm bg-white">
            <CardContent className="py-16">
              <EmptyState
                icon={MessageSquare}
                title="No feedback yet"
                description="Patient reviews will appear here once you have completed appointments and patients leave feedback."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-lg font-bold text-slate-900">
                All Reviews ({feedback.length})
              </h2>
            </div>
            
            {feedback.map((review) => (
              <Card key={review._id} className="border-slate-200 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300 bg-white group">
                <CardContent className="p-6">
                  <div className="flex items-start gap-5">
                    {/* Avatar */}
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-lg shadow-md">
                      {review.patientName.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-slate-900 text-base mb-2">{review.patientName}</h3>
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`}
                                />
                              ))}
                            </div>
                            <span className="text-sm font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
                              {review.rating}.0
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white gap-1.5 flex-shrink-0 group-hover:opacity-100 opacity-70 transition-opacity"
                            onClick={() => setWarnDialog({
                              open: true,
                              patientId: review.patientId || "",
                              patientName: review.patientName,
                              loading: false,
                            })}
                          >
                            <AlertTriangle className="h-4 w-4" />
                            Warn
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 gap-1.5 flex-shrink-0 group-hover:opacity-100 opacity-70 transition-opacity"
                            onClick={() => setDeleteDialog({
                              open: true,
                              reviewId: review._id,
                              loading: false,
                            })}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                      
                      {/* Comment */}
                      <div className="bg-slate-50 rounded-2xl p-4 mb-3 border border-slate-100">
                        <p className="text-slate-700 leading-relaxed">
                          {review.comment || (
                            <span className="italic text-slate-500">No written feedback provided</span>
                          )}
                        </p>
                      </div>
                      
                      {/* Date */}
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-slate-400"></span>
                        {new Date(review.createdAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="rounded-3xl border-2 border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-red-600 text-xl">
              <div className="h-10 w-10 rounded-2xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              Delete Feedback
            </DialogTitle>
            <DialogDescription className="text-slate-600 text-base pt-2">
              Are you sure you want to permanently delete this patient feedback? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-red-200 bg-red-50 rounded-2xl">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 font-medium">
              Deleting feedback will permanently remove this review from your profile and lower your average rating if applicable.
            </AlertDescription>
          </Alert>

          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, reviewId: null, loading: false })}
              disabled={deleteDialog.loading}
              className="rounded-xl border-slate-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFeedback}
              disabled={deleteDialog.loading}
              className="rounded-xl bg-red-600 hover:bg-red-700 gap-2"
            >
              {deleteDialog.loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Feedback
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warn Patient Dialog */}
      <Dialog open={warnDialog.open} onOpenChange={(open) => !open && setWarnDialog({ open: false, patientId: null, patientName: "", loading: false })}>
        <DialogContent className="max-w-lg rounded-2xl border border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900 font-bold flex items-center gap-2">
              <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              Send Warning
            </DialogTitle>
            <DialogDescription className="text-slate-600 text-base pt-2">
              Send a formal warning to {warnDialog.patientName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-slate-700 mb-2 block">Warning Message</label>
              <textarea
                value={warnMessage}
                onChange={(e) => setWarnMessage(e.target.value)}
                placeholder="Enter warning message..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => { setWarnDialog({ open: false, patientId: null, patientName: "", loading: false }); setWarnMessage(""); }}
              disabled={warnDialog.loading}
              className="rounded-xl border-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleWarnPatient}
              disabled={warnDialog.loading || !warnMessage.trim()}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              {warnDialog.loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Send Warning
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DoctorFeedback;
