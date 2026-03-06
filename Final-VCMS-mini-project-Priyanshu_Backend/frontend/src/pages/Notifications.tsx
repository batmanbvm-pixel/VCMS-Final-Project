import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import api from "@/services/api";
import { Bell, CheckCircle2, Trash2, Eye, AlertCircle, Calendar, Pill, ClipboardList, UserCheck, Settings } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  from: any;
  link?: string;
  isRead: boolean;
  readAt?: string;
  priority: string;
  createdAt: string;
  data?: Record<string, any>;
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; bg: string; text: string; border: string }> = {
  appointment:      { label: "Appointment",     icon: Calendar,      bg: "bg-sky-50",        text: "text-sky-600",     border: "border-sky-200" },
  prescription:     { label: "Prescription",    icon: Pill,          bg: "bg-cyan-50",       text: "text-cyan-600",    border: "border-cyan-200" },
  "medical-history":{ label: "Medical History", icon: ClipboardList, bg: "bg-sky-50",        text: "text-sky-600",     border: "border-sky-200" },
  "doctor-approval":{ label: "Doctor Approval", icon: UserCheck,     bg: "bg-cyan-50",       text: "text-cyan-600",    border: "border-cyan-200" },
  system:           { label: "System",          icon: Settings,      bg: "bg-slate-100",     text: "text-slate-600",   border: "border-slate-200" },
};

const Notifications = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);

  const filterTabs = [
    { key: "all", label: "All Notifications" },
    { key: "unread", label: "Unread Only" },
  ];

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [user, selectedType, page]);

  useEffect(() => {
    if (!socket || !user?._id) return;
    const handleNewNotification = (data: any) => {
      if (data.userId === user._id || data.toUserId === user._id) {
        setNotifications((prev) => [data, ...prev]);
        setUnreadCount((prev) => prev + 1);
        toast({ title: data.title || "New Notification", description: data.message });
      }
    };
    socket.on("notification", handleNewNotification);
    return () => socket.off("notification", handleNewNotification);
  }, [socket, user?._id, toast]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      let url = `/notifications?page=${page}&limit=15`;
      if (selectedType === "unread") url += `&unreadOnly=true`;
      const response = await api.get(url);
      if (response.data?.success) setNotifications(response.data.notifications || []);
    } catch (error: any) {
      toast({ title: "Error", description: error?.response?.data?.message || "Failed to load notifications", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get("/notifications/unread-count");
      if (response.data?.success) setUnreadCount(response.data.unreadCount || 0);
    } catch { /* silent */ }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/mark-read`);
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
      fetchUnreadCount();
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to mark as read", variant: "destructive" });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post("/notifications/mark-all-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast({ title: "Done", description: "All marked as read" });
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to mark all as read", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const handleDeleteAll = async () => {
    try {
      const response = await api.delete("/notifications");
      const deletedCount = response.data?.deletedCount || 0;
      setNotifications([]);
      setUnreadCount(0);
      setPage(1);
      toast({ title: "Cleared", description: `${deletedCount} notification(s) deleted` });
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to clear notifications", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-50">
      <div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl pb-12">

      {/* Hero Header */}
      <div className="rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 p-6 text-white shadow-md">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">Notifications</h1>
              <p className="text-sky-100 text-sm mt-0.5">
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "You're all caught up! 🎉"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 text-sm font-semibold text-white bg-white/15 hover:bg-white/25 px-4 py-2 rounded-xl transition-colors border border-white/20 backdrop-blur-sm"
              >
                <CheckCircle2 className="h-4 w-4" /> Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={() => setShowClearAllDialog(true)}
                className="flex items-center gap-2 text-sm font-semibold text-white bg-red-500/80 hover:bg-red-600/90 px-4 py-2 rounded-xl transition-colors border border-red-300/30 backdrop-blur-sm"
              >
                <Trash2 className="h-4 w-4" /> Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-md overflow-hidden">
        <div className="flex gap-2 p-2 bg-slate-50/50">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setSelectedType(tab.key); setPage(1); }}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                selectedType === tab.key
                  ? "bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-md"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white"
              }`}
            >
              {tab.label}
              {tab.key === "all" && unreadCount > 0 && (
                <span className="ml-2 bg-white/25 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="p-8">
            <LoadingSpinner text="Loading notifications..." />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 px-6">
            <EmptyState
              icon={Bell}
              title={selectedType === "unread" ? "No unread notifications" : "No notifications yet"}
              description={selectedType === "unread" ? "All caught up! 🎉" : "When you receive notifications, they'll appear here."}
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {notifications.map((notif) => {
              const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
              const Icon = cfg.icon;
              const isUrgent = notif.priority === "urgent" || notif.priority === "high";
              return (
                <div
                  key={notif._id}
                  className={`flex items-start gap-4 px-5 py-4 transition-all duration-200 hover:bg-slate-50/60 ${!notif.isRead ? "bg-sky-50/30" : ""}`}
                >
                  {/* Icon */}
                  <div className={`flex-shrink-0 h-11 w-11 rounded-xl ${cfg.bg} flex items-center justify-center border ${cfg.border}`}>
                    <Icon className={`h-5 w-5 ${cfg.text}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                        {cfg.label}
                      </span>
                      {isUrgent && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                          <AlertCircle className="h-3 w-3" /> Urgent
                        </span>
                      )}
                      {!notif.isRead && (
                        <span className="h-2 w-2 bg-sky-500 rounded-full animate-pulse" />
                      )}
                      <span className="text-[10px] text-slate-500 ml-auto font-medium">
                        {new Date(notif.createdAt).toLocaleDateString()} · {new Date(notif.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 leading-snug mb-0.5">{notif.title}</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{notif.message}</p>
                    {notif.from && (
                      <p className="text-xs text-slate-500 mt-1.5">From: <span className="font-semibold text-slate-700">{notif.from.name}</span></p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex items-center gap-1">
                    {!notif.isRead && (
                      <button
                        onClick={() => handleMarkAsRead(notif._id)}
                        title="Mark as read"
                        aria-label="Mark notification as read"
                        className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition-all duration-200 border border-transparent hover:border-sky-200 hover:scale-105"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(notif._id)}
                      title="Delete"
                      aria-label="Delete notification"
                      className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 border border-transparent hover:border-red-200 hover:scale-105"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {notifications.length > 0 && (
          <div className="flex gap-3 justify-center px-4 py-4 border-t border-slate-200 bg-slate-50/50">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page === 1} 
              onClick={() => setPage(page - 1)} 
              className="rounded-xl border-slate-200 font-semibold hover:bg-white transition-all duration-200 hover:scale-105"
            >
              ← Previous
            </Button>
            <span className="flex items-center px-3 text-sm font-medium text-slate-600">Page {page}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(page + 1)} 
              disabled={notifications.length < 15} 
              className="rounded-xl border-slate-200 font-semibold hover:bg-white transition-all duration-200 hover:scale-105"
            >
              Next →
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-slate-900">Clear All Notifications</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              This will permanently delete all notifications from your account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="rounded-xl border-slate-200">No, Keep</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold"
              onClick={() => {
                handleDeleteAll();
                setShowClearAllDialog(false);
              }}
            >
              Yes, Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
};

export default Notifications;