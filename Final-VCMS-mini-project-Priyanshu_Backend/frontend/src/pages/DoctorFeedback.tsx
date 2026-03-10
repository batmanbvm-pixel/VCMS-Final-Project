import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Star, MessageSquare, Trash2, AlertTriangle, Loader2, User, RefreshCw, Reply, Send } from "lucide-react";
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | '5star' | '4star' | '3star' | 'low'>('all');
  
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    reviewId: null as string | null,
    loading: false,
  });

  const [warnDialog, setWarnDialog] = useState({
    open: false,
    patientId: null as string | null,
    patientName: "",
    reason: "",
    message: "",
    loading: false,
  });

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
    if (!warnDialog.patientId || !warnDialog.message.trim()) {
      toast({ title: "Required", description: "Please enter your reply message.", variant: "destructive" });
      return;
    }

    const composedMessage = `Doctor's Response: ${warnDialog.message.trim()}`;

    try {
      setWarnDialog(prev => ({ ...prev, loading: true }));
      
      await api.put(`/admin/users/${warnDialog.patientId}/warn`, {
        message: composedMessage,
      });
      
      toast({
        title: "Success",
        description: `Reply sent to ${warnDialog.patientName}`,
      });
      setWarnDialog({ open: false, patientId: null, patientName: "", reason: "", message: "", loading: false });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to send reply",
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchFeedback();
      toast({ title: "Refreshed", description: "Feedback updated successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to refresh feedback", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter feedback
  const filteredFeedback = feedback.filter(review => {
    if (activeFilter === 'all') return true;
    if (activeFilter === '5star') return review.rating === 5;
    if (activeFilter === '4star') return review.rating === 4;
    if (activeFilter === '3star') return review.rating === 3;
    if (activeFilter === 'low') return review.rating <= 2;
    return true;
  });

  const filterCounts = {
    all: feedback.length,
    fiveStar: feedback.filter(r => r.rating === 5).length,
    fourStar: feedback.filter(r => r.rating === 4).length,
    threeStar: feedback.filter(r => r.rating === 3).length,
    low: feedback.filter(r => r.rating <= 2).length,
  };

  return (
    <>
      <div className="container mx-auto px-6 py-8 space-y-6 max-w-7xl pb-12">
        
        {/* Hero Header */}
        <div className="rounded-xl bg-sky-500 text-white p-6 shadow-md border border-sky-300">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <MessageSquare className="h-7 w-7" /> Patient Feedback
              </h1>
              <p className="mt-2 text-white/90 text-sm">
                Total: {summary.total} reviews • Average: {summary.averageRating > 0 ? summary.averageRating.toFixed(1) : 'N/A'} ⭐
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 bg-white/15 text-white border-white/30 hover:bg-white/25 transition-all duration-200 hover:scale-105" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> 
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <Card className="border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setActiveFilter('all')}
                variant={activeFilter === 'all' ? 'default' : 'outline'}
                className={`h-9 px-4 ${
                  activeFilter === 'all'
                    ? 'bg-sky-500 hover:bg-sky-600 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                All ({filterCounts.all})
              </Button>
              <Button
                onClick={() => setActiveFilter('5star')}
                variant={activeFilter === '5star' ? 'default' : 'outline'}
                className={`h-9 px-4 ${
                  activeFilter === '5star'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Star className="h-4 w-4 mr-2 fill-current" />
                5 Star ({filterCounts.fiveStar})
              </Button>
              <Button
                onClick={() => setActiveFilter('4star')}
                variant={activeFilter === '4star' ? 'default' : 'outline'}
                className={`h-9 px-4 ${
                  activeFilter === '4star'
                    ? 'bg-sky-500 hover:bg-sky-600 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Star className="h-4 w-4 mr-2 fill-current" />
                4 Star ({filterCounts.fourStar})
              </Button>
              <Button
                onClick={() => setActiveFilter('3star')}
                variant={activeFilter === '3star' ? 'default' : 'outline'}
                className={`h-9 px-4 ${
                  activeFilter === '3star'
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Star className="h-4 w-4 mr-2 fill-current" />
                3 Star ({filterCounts.threeStar})
              </Button>
              <Button
                onClick={() => setActiveFilter('low')}
                variant={activeFilter === 'low' ? 'default' : 'outline'}
                className={`h-9 px-4 ${
                  activeFilter === 'low'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Low (≤2★) ({filterCounts.low})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Feedback List */}
        {loading ? (
          <Card className="border-slate-200 shadow-sm bg-white rounded-xl">
            <CardContent className="py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-sky-100 flex items-center justify-center animate-pulse">
                  <MessageSquare className="h-6 w-6 text-sky-600" />
                </div>
                <p className="text-center text-slate-600 font-medium">Loading feedback...</p>
              </div>
            </CardContent>
          </Card>
        ) : filteredFeedback.length === 0 ? (
          <Card className="border-slate-200 shadow-sm bg-white rounded-xl">
            <CardContent className="py-16">
              <EmptyState
                icon={MessageSquare}
                title={activeFilter === 'all' ? "No feedback yet" : "No reviews match this filter"}
                description={activeFilter === 'all' 
                  ? "Patient reviews will appear here once you have completed appointments and patients leave feedback."
                  : "Try selecting a different rating filter to view reviews."
                }
              />
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="min-w-[220px]">Patient</TableHead>
                      <TableHead className="min-w-[140px]">Rating</TableHead>
                      <TableHead className="min-w-[300px]">Feedback</TableHead>
                      <TableHead className="min-w-[160px]">Date</TableHead>
                      <TableHead className="text-right min-w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFeedback.map((review) => (
                      <TableRow key={review._id} className="hover:bg-slate-50/60">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-9 w-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                              <User className="h-5 w-5 text-sky-600" />
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{review.patientName}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3.5 w-3.5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`}
                                />
                              ))}
                            </div>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                              review.rating === 5 ? 'bg-emerald-100 text-emerald-700' :
                              review.rating === 4 ? 'bg-sky-100 text-sky-700' :
                              review.rating === 3 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {review.rating}.0
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-slate-700 max-w-md">
                            {review.comment ? (
                              <p className="line-clamp-2">{review.comment}</p>
                            ) : (
                              <span className="italic text-slate-500 text-xs">No comment provided</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-slate-700">
                            {new Date(review.createdAt).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(review.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="xs"
                              variant="outline"
                              className="h-7 px-2 gap-1 bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100 text-xs font-medium"
                              onClick={() => setWarnDialog({
                                open: true,
                                patientId: review.patientId || "",
                                patientName: review.patientName,
                                reason: "",
                                message: "",
                                loading: false,
                              })}
                            >
                              <Reply className="h-3 w-3" />
                              Reply
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              className="h-7 px-2 gap-1 bg-red-50 text-red-600 border-red-200 hover:bg-red-100 text-xs font-medium"
                              onClick={() => setDeleteDialog({
                                open: true,
                                reviewId: review._id,
                                loading: false,
                              })}
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
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

      {/* Reply to Patient Dialog */}
      <Dialog open={warnDialog.open} onOpenChange={(open) => !open && setWarnDialog({ open: false, patientId: null, patientName: "", reason: "", message: "", loading: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sky-700">
              <div className="h-9 w-9 rounded-full bg-sky-100 flex items-center justify-center">
                <Reply className="w-4 h-4 text-sky-600" />
              </div>
              Reply to Patient Feedback
            </DialogTitle>
            <DialogDescription>
              Send a response to <strong>{warnDialog.patientName}</strong>'s feedback
            </DialogDescription>
          </DialogHeader>

          <Alert className="bg-sky-50 border-sky-200">
            <MessageSquare className="h-4 w-4 text-sky-600" />
            <AlertDescription className="text-sm text-sky-800">
              Your message will be sent to <strong>{warnDialog.patientName}</strong> and they will be notified.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Response Message *</label>
              <Textarea
                placeholder="Thank you for your feedback. I appreciate your comments..."
                value={warnDialog.message}
                onChange={(e) => setWarnDialog((prev) => ({ ...prev, message: e.target.value }))}
                className="text-sm resize-none"
                rows={5}
              />
              <div className="text-xs text-slate-500">Write a professional response to the patient's feedback.</div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
              onClick={() => setWarnDialog({ open: false, patientId: null, patientName: "", reason: "", message: "", loading: false })}
              disabled={warnDialog.loading}
            >
              Cancel
            </Button>
            <Button
              className="bg-sky-500 hover:bg-sky-600"
              onClick={handleWarnPatient}
              disabled={warnDialog.loading || !warnDialog.message.trim()}
            >
              {warnDialog.loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Reply
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DoctorFeedback;
