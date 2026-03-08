import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Filter,
  Eye,
  Mail,
  Phone,
  User,
  Calendar,
  Tag,
  Zap,
  Send,
  ArrowRight,
  Pencil,
  Info,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import api from "@/services/api";

interface ContactStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  urgent: number;
  byType: Record<string, number>;
  byRole: Record<string, number>;
}

interface Contact {
  _id: string;
  userId?: {
    _id: string;
    name: string;
    email: string;
  } | string | null;
  userName: string;
  userEmail: string;
  userPhone: string;
  userRole: string;
  problemType: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  progressStage?: string;
  adminNotes?: string;
  adminReply?: string;
  repliedAt?: string;
  repliedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminContacts() {
  const { toast } = useToast();
  const { isAuthenticated, user: authUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Redirect if not authenticated or not an admin
  useEffect(() => {
    if (!isAuthenticated || !authUser || authUser.role !== "admin") {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, authUser, navigate]);
  const [showDetails, setShowDetails] = useState(false);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [tableView, setTableView] = useState<"unresolved" | "resolved">("unresolved");
  const [detailsMode, setDetailsMode] = useState<"view" | "edit">("view");
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [replyValidationError, setReplyValidationError] = useState("");
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    status: "all",
    priority: "all",
    userRole: "all",
    problemType: "all",
    search: "",
  });

  // Status update form
  const [statusForm, setStatusForm] = useState({
    status: "open",
    progressStage: "open",
    adminReply: "",
  });

  const toTitleCase = (value?: string) =>
    String(value || "")
      .replace(/[-_]/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || "—";

  const formatPersonName = (value?: string) => {
    const clean = String(value || "").trim();
    if (!clean) return "Unknown User";
    return clean
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const isMeaningfulText = (value?: string) => {
    const text = String(value || "").trim();
    if (!text) return false;
    const normalized = text.toLowerCase();
    const junkValues = ["no", "n/a", "na", "none", "null", "undefined", "-"];
    return !junkValues.includes(normalized);
  };

  const normalizeContact = (c: any): Contact => {
    const populatedUser = c?.userId && typeof c.userId === "object" ? c.userId : null;
    const isPlaceholder = (value?: string) => {
      const normalized = String(value || "").trim().toLowerCase();
      return ["", "unknown user", "n/a", "na", "none", "null", "undefined", "user", "other"].includes(normalized);
    };

    const normalizedType = String(c?.problemType || c?.type || "other").toLowerCase();
    const normalizedRole = String(c?.userRole || populatedUser?.role || "user").toLowerCase();

    return {
      ...c,
      userName: !isPlaceholder(c?.userName)
        ? c?.userName
        : (!isPlaceholder(populatedUser?.name) ? populatedUser?.name : "Unknown User"),
      userEmail: !isPlaceholder(c?.userEmail)
        ? c?.userEmail
        : (!isPlaceholder(populatedUser?.email) ? populatedUser?.email : "N/A"),
      userPhone: !isPlaceholder(c?.userPhone)
        ? c?.userPhone
        : (!isPlaceholder(populatedUser?.phone) ? populatedUser?.phone : "N/A"),
      userRole: isPlaceholder(normalizedRole) ? "user" : normalizedRole,
      problemType: isPlaceholder(normalizedType) ? "other" : normalizedType,
      description: c?.description || c?.message || "",
      priority: String(c?.priority || "low").toLowerCase(),
      status: String(c?.status || "open").toLowerCase(),
      progressStage: String(c?.progressStage || "open").toLowerCase(),
    } as Contact;
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [contacts, filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, contactsRes] = await Promise.all([
        api.get("/contact/stats/dashboard").catch(() => ({ data: { success: false } })),
        api.get("/contact/").catch(() => ({ data: { success: false } })),
      ]);

      if (statsRes.data?.success) {
        const rawStats = statsRes.data.stats || {};
        setStats({
          total: rawStats.total?.[0]?.count || 0,
          open: rawStats.open?.[0]?.count || 0,
          inProgress: rawStats.inProgress?.[0]?.count || 0,
          resolved: rawStats.resolved?.[0]?.count || 0,
          closed: rawStats.closed?.[0]?.count || 0,
          urgent: rawStats.urgent?.[0]?.count || 0,
          byType: rawStats.byType || {},
          byRole: rawStats.byRole || {},
        });
      }

      if (contactsRes.data?.success) {
        const mapped = (contactsRes.data.contacts || []).map((c: any) => normalizeContact(c));
        setContacts(mapped);
      } else {
        setContacts([]);
      }
    } catch (error) {
      setContacts([]);
      setFilteredContacts([]);
      toast({
        title: "Warning",
        description: "Contacts data temporarily unavailable",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = contacts;

    if (filters.status !== "all") {
      filtered = filtered.filter((c) => c.status === filters.status);
    }

    if (filters.priority !== "all") {
      filtered = filtered.filter((c) => c.priority === filters.priority);
    }

    if (filters.userRole !== "all") {
      filtered = filtered.filter((c) => c.userRole === filters.userRole);
    }

    if (filters.problemType !== "all") {
      filtered = filtered.filter((c) => c.problemType === filters.problemType);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          String(c.userName || "").toLowerCase().includes(searchLower) ||
          String(c.userEmail || "").toLowerCase().includes(searchLower) ||
          String(c.subject || "").toLowerCase().includes(searchLower) ||
          String(c.description || "").toLowerCase().includes(searchLower)
      );
    }

    setFilteredContacts(filtered);
  };

  const openContactDetails = async (contact: Contact, mode: "view" | "edit" = "view") => {
    setSelectedContact(contact);
    setDetailsMode(mode);
    setDetailsLoading(true);
    setStatusForm({
      status: contact.status,
      progressStage: contact.progressStage || "open",
      adminReply: isMeaningfulText(contact.adminReply) ? String(contact.adminReply) : "",
    });
    setReplyValidationError("");
    setShowDetails(true);

    try {
      const response = await api.get(`/contact/${contact._id}`);
      const fresh = normalizeContact(response?.data?.contact || response?.data || contact);
      setSelectedContact(fresh);
      setStatusForm({
        status: fresh.status,
        progressStage: fresh.progressStage || "open",
        adminReply: isMeaningfulText(fresh.adminReply) ? String(fresh.adminReply) : "",
      });
      setReplyValidationError("");
    } catch {
      toast({
        title: "Warning",
        description: "Showing latest available cached details",
        variant: "destructive",
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedContact) return;

    const nextStatus = String(statusForm.status || "").toLowerCase();
    const replyText = String(statusForm.adminReply || "").trim();
    
    // Check if status or progress stage changed
    const statusChanged = statusForm.status !== selectedContact.status;
    const progressChanged = statusForm.progressStage !== selectedContact.progressStage;
    
    // Require reply if making any changes
    if ((statusChanged || progressChanged) && replyText.length < 20) {
      setReplyValidationError("Please write a reply (min 20 characters) when updating status/progress");
      replyTextareaRef.current?.focus();
      return;
    }

    // Extra check for resolved/closed
    if (["resolved", "closed"].includes(nextStatus) && replyText.length < 20) {
      setReplyValidationError("Reply must be at least 20 characters");
      replyTextareaRef.current?.focus();
      return;
    }

    setReplyValidationError("");

    try {
      setStatusUpdateLoading(true);
      const response = await api.put(`/contact/${selectedContact._id}/status`, {
        status: statusForm.status,
        progressStage: statusForm.progressStage,
        adminReply: statusForm.adminReply,
      });

      if (response.data?.success) {
        toast({
          title: "Success",
          description: "Contact status and reply sent successfully",
        });

        setShowDetails(false);
        fetchData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update contact status",
        variant: "destructive",
      });
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-green-100 text-green-800";
    }
  };

  const getRoleColor = (role: string) => {
    switch (String(role || "").toLowerCase()) {
      case "doctor":
        return "bg-sky-100 text-sky-800 border-sky-200";
      case "patient":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "admin":
        return "bg-violet-100 text-violet-800 border-violet-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getTypeColor = (problemType: string) => {
    switch (String(problemType || "").toLowerCase()) {
      case "payment-issue":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "appointment-issue":
        return "bg-cyan-100 text-cyan-800 border-cyan-200";
      case "medical-concern":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "technical-issue":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "feedback":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "account-issue":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const unresolvedContacts = (filteredContacts || []).filter(
    (c) => !["resolved", "closed"].includes(String(c.status || "").toLowerCase())
  );
  const resolvedContacts = (filteredContacts || []).filter(
    (c) => ["resolved", "closed"].includes(String(c.status || "").toLowerCase())
  );
  const tableContacts = tableView === "unresolved" ? unresolvedContacts : resolvedContacts;



  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center py-12">
          <div className="inline-block">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-primary rounded-full animate-spin"/>
          </div>
          <p className="text-gray-600 mt-4">Loading contacts...</p>
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
            <h1 className="text-2xl font-bold tracking-tight">Contact Management</h1>
            <p className="mt-1 text-sky-100 text-sm">View and manage all customer contact submissions</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 bg-white/15 border-white/30 text-white hover:bg-white/25" onClick={fetchData}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Dashboard Stats - Enhanced with Better Hover Effects */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 hover:border-blue-300 border border-transparent rounded-xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-semibold uppercase">Total</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">
                    {stats.total}
                  </p>
                </div>
                <MessageSquare className="w-10 h-10 text-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 hover:border-sky-300 border border-transparent rounded-xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-semibold uppercase">Open</p>
                  <p className="text-3xl font-bold text-sky-600 mt-2">
                    {stats.open}
                  </p>
                </div>
                <AlertCircle className="w-10 h-10 text-sky-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 hover:border-yellow-300 border border-transparent rounded-xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-semibold uppercase">In Progress</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">
                    {stats.inProgress}
                  </p>
                </div>
                <Clock className="w-10 h-10 text-yellow-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 hover:border-green-300 border border-transparent rounded-xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-semibold uppercase">Resolved</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">
                    {stats.resolved}
                  </p>
                </div>
                <CheckCircle2 className="w-10 h-10 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 hover:border-slate-300 border border-transparent rounded-xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-semibold uppercase">Closed</p>
                  <p className="text-3xl font-bold text-slate-600 mt-2">
                    {stats.closed}
                  </p>
                </div>
                <CheckCircle2 className="w-10 h-10 text-slate-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 hover:border-red-300 border border-transparent rounded-xl">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-semibold uppercase">Urgent</p>
                  <p className="text-3xl font-bold text-red-600 mt-2">
                    {stats.urgent}
                  </p>
                </div>
                <Zap className="w-10 h-10 text-red-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50/50 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="w-5 h-5 text-slate-600" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Input
              placeholder="Search by name, email, subject..."
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
              className="sm:col-span-2 lg:col-span-1 h-10 bg-white border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all duration-200"
            />

            <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
              <SelectTrigger className="h-10 bg-white border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all duration-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.priority} onValueChange={(value) => setFilters({ ...filters, priority: value })}>
              <SelectTrigger className="h-10 bg-white border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all duration-200">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.userRole} onValueChange={(value) => setFilters({ ...filters, userRole: value })}>
              <SelectTrigger className="h-10 bg-white border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all duration-200">
                <SelectValue placeholder="User Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="doctor">Doctor</SelectItem>
                <SelectItem value="patient">Patient</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.problemType} onValueChange={(value) => setFilters({ ...filters, problemType: value })}>
              <SelectTrigger className="h-10 bg-white border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all duration-200">
                <SelectValue placeholder="Problem Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="technical-issue">Technical Issue</SelectItem>
                <SelectItem value="payment-issue">Payment Issue</SelectItem>
                <SelectItem value="account-issue">Account Issue</SelectItem>
                <SelectItem value="appointment-issue">Appointment Issue</SelectItem>
                <SelectItem value="medical-concern">Medical Concern</SelectItem>
                <SelectItem value="feedback">Feedback</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setFilters({ status: "all", priority: "all", userRole: "all", problemType: "all", search: "" })}
              className="text-red-700 border-red-300 bg-red-50 hover:bg-red-100 transition-all duration-200 hover:shadow-sm hover:scale-105"
            >
              Clear Filters
            </Button>
            <div className="flex-1 text-right">
              <p className="text-sm text-muted-foreground">{filteredContacts?.length || 0} results</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacts List */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b border-slate-200 pb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">
              {tableView === "unresolved" ? "Open / In Progress Contacts" : "Resolved / Closed Contacts"}
              <span className="ml-2 inline-block bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-semibold">
                {tableContacts.length}
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={tableView === "unresolved" ? "default" : "outline"}
                onClick={() => setTableView("unresolved")}
                className={tableView === "unresolved" ? "bg-sky-600 hover:bg-sky-700 text-white" : ""}
              >
                Unresolved ({unresolvedContacts.length})
              </Button>
              <Button
                size="sm"
                variant={tableView === "resolved" ? "default" : "outline"}
                onClick={() => setTableView("resolved")}
                className={tableView === "resolved" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
              >
                Resolved ({resolvedContacts.length})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {tableContacts.length === 0 ? (
            <div className="py-16 px-4">
              <EmptyState 
                icon={MessageSquare}
                title={tableView === "unresolved" ? "No unresolved contacts" : "No resolved contacts"}
                description="Try adjusting your search or filters"
              />
            </div>
          ) : (
            <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[940px]">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-slate-300 bg-gradient-to-r from-slate-100 to-slate-50">
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-slate-700 uppercase tracking-wide w-[18%]">
                      User
                    </th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-slate-700 uppercase tracking-wide w-[20%]">
                      Email
                    </th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-slate-700 uppercase tracking-wide w-[23%]">
                      Subject
                    </th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-slate-700 uppercase tracking-wide w-[12%]">
                      Type
                    </th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-slate-700 uppercase tracking-wide w-[8%]">
                      Priority
                    </th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-slate-700 uppercase tracking-wide w-[9%]">
                      Status
                    </th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-slate-700 uppercase tracking-wide w-[6%]">
                      Date
                    </th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-slate-700 uppercase tracking-wide w-[4%]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableContacts.map((contact) => (
                    <tr
                      key={contact._id}
                      className="border-b border-slate-100 hover:bg-sky-50/70 transition-all duration-200 cursor-pointer even:bg-slate-50/40 hover:shadow-sm"
                    >
                      <td className="py-2.5 px-3 align-top">
                        <div className="space-y-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate" title={formatPersonName(contact.userName)}>
                            {formatPersonName(contact.userName)}
                          </p>
                          <p className={`text-[11px] border w-fit px-2 py-0.5 rounded-full font-semibold ${getRoleColor(contact.userRole)}`}>
                            {toTitleCase(contact.userRole)}
                          </p>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <p className="text-xs text-gray-600 max-w-[230px] truncate" title={contact.userEmail || "N/A"}>
                          {contact.userEmail || "N/A"}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <p className="text-sm text-gray-900 font-medium max-w-[220px] truncate" title={contact.subject}>
                          {contact.subject}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getTypeColor(contact.problemType)}`} title={toTitleCase(contact.problemType)}>
                          {toTitleCase(contact.problemType)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <span
                          className={`inline-flex w-[78px] justify-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${getPriorityColor(
                            contact.priority
                          )}`}
                        >
                          {contact.priority}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <div className="w-[100px] text-xs">
                          <StatusBadge status={contact.status} />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        <span className="text-xs text-gray-600">
                          {new Date(contact.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        {tableView === "unresolved" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openContactDetails(contact, "edit")}
                            className="gap-1 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all duration-200 h-7 px-2 text-xs"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openContactDetails(contact, "view")}
                              className="gap-1 bg-sky-100 text-sky-700 border border-sky-200 hover:bg-sky-200 transition-all duration-200 h-7 px-2 text-xs"
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openContactDetails(contact, "edit")}
                              className="gap-1 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all duration-200 h-7 px-2 text-xs"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Detail View Modal with Reply & Progress Tracking */}
      {showDetails && selectedContact && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b bg-gradient-to-r from-sky-50 to-blue-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{detailsMode === "edit" ? "Edit Contact" : "View Contact Details"}</CardTitle>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-500 hover:text-gray-700 w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {detailsLoading && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                  Loading latest details from database...
                </div>
              )}

              {/* User Information */}
              <div>
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  User Information
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-600">Name</p>
                    <p className="font-medium text-slate-900">
                      {selectedContact.userName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Role</p>
                    <p className="font-medium text-slate-900">
                      {toTitleCase(selectedContact.userRole)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      Email
                    </p>
                    <p className="font-medium text-gray-900">
                      {selectedContact.userEmail}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      Phone
                    </p>
                    <p className="font-medium text-gray-900">
                      {selectedContact.userPhone || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Tracker */}
              <div className="bg-gradient-to-br from-blue-50 to-sky-50 p-6 rounded-xl border-2 border-blue-200">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  Problem Resolution Progress
                </h3>
                <div className="flex items-center justify-between">
                  {[
                    { key: "open", label: "Open", hint: "Issue reported", color: "from-red-500 to-red-600" },
                    { key: "processing", label: "Processing", hint: "Working on it", color: "from-yellow-500 to-yellow-600" },
                    { key: "waiting", label: "Waiting", hint: "Awaiting user response", color: "from-orange-500 to-orange-600" },
                    { key: "final-stage", label: "Final Stage", hint: "Final checks", color: "from-sky-500 to-sky-600" },
                    { key: "resolved", label: "Resolved", hint: "Completed", color: "from-green-500 to-green-600" },
                  ].map((step, idx, arr) => (
                    <div key={step.key} className="contents">
                      <div className={`flex-1 text-center ${statusForm.progressStage === step.key ? "opacity-100" : "opacity-60"}`}>
                        <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white font-bold ${
                          statusForm.progressStage === step.key ? `bg-gradient-to-br ${step.color}` : "bg-gray-400"
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="mt-2 font-semibold text-sm">{step.label}</div>
                        <div className="text-xs text-slate-600">{step.hint}</div>
                      </div>
                      {idx < arr.length - 1 && <ArrowRight className={`w-8 h-8 ${statusForm.progressStage === arr[idx + 1].key ? "text-blue-600" : "text-gray-300"}`} />}
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {detailsMode === "edit" ? "Update Progress Stage:" : "Current Progress Stage:"}
                  </label>
                  {detailsMode === "edit" ? (
                    <Select
                      value={statusForm.progressStage}
                      onValueChange={(value) =>
                        setStatusForm({ ...statusForm, progressStage: value })
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            Open - Issue just reported
                          </div>
                        </SelectItem>
                        <SelectItem value="processing">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            Processing - Working on solution
                          </div>
                        </SelectItem>
                        <SelectItem value="waiting">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                            Waiting - Awaiting user response
                          </div>
                        </SelectItem>
                        <SelectItem value="final-stage">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-sky-500"></div>
                            Final Stage - Solution ready
                          </div>
                        </SelectItem>
                        <SelectItem value="resolved">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            Resolved - Closed successfully
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800">
                      {toTitleCase(statusForm.progressStage)}
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Details */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Contact Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Subject</p>
                    <p className="font-medium text-gray-900">
                      {selectedContact.subject}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Description</p>
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {selectedContact.description}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Problem Type</p>
                      <p className="font-medium text-gray-900">
                        {toTitleCase(selectedContact.problemType)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Priority</p>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(
                          selectedContact.priority
                        )}`}
                      >
                        {toTitleCase(selectedContact.priority)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Date
                      </p>
                      <p className="font-medium text-gray-900">
                        {new Date(selectedContact.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Current Status</p>
                      <p className="font-medium text-gray-900">
                        {toTitleCase(statusForm.status)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Admin Reply Section */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-slate-200">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-600" />
                  Admin Reply
                </h3>

                {/* VIEW MODE */}
                {detailsMode === "view" && (
                  <div className="space-y-3">
                    {selectedContact.adminReply && selectedContact.adminReply.trim().length > 0 ? (
                      <>
                        <div className="bg-white border border-slate-200 rounded-lg p-4">
                          <p className="text-sm text-slate-600 font-medium mb-2">Reply sent to user:</p>
                          <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                            <p className="text-slate-800 whitespace-pre-wrap">
                              {selectedContact.adminReply}
                            </p>
                          </div>
                          {selectedContact.repliedAt && (
                            <p className="text-xs text-slate-500 mt-2">
                              Sent: {new Date(selectedContact.repliedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <p className="text-sm text-slate-600">No reply sent yet.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* EDIT MODE */}
                {detailsMode === "edit" && (
                  <div className="space-y-3">
                    {selectedContact.adminReply && selectedContact.adminReply.trim().length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-700 font-medium mb-1">Previous reply:</p>
                        <p className="text-xs text-blue-900 italic">"{selectedContact.adminReply}"</p>
                        {selectedContact.repliedAt && (
                          <p className="text-xs text-blue-600 mt-1">
                            {new Date(selectedContact.repliedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reply to User <span className="text-red-600">*</span>
                      </label>
                      <Textarea
                        ref={replyTextareaRef}
                        placeholder="Write your reply here... (minimum 20 characters)"
                        value={statusForm.adminReply}
                        onChange={(e) =>
                          {
                            const nextValue = e.target.value;
                            setStatusForm({
                              ...statusForm,
                              adminReply: nextValue,
                            });
                            if (replyValidationError && nextValue.trim().length >= 20) {
                              setReplyValidationError("");
                            }
                          }
                        }
                        rows={5}
                        className={`bg-white ${replyValidationError ? "border-2 border-red-600 focus-visible:ring-2 focus-visible:ring-red-500" : ""}`}
                      />
                      {replyValidationError && (
                        <p className="text-sm font-semibold text-red-600 mt-2">⚠️ {replyValidationError}</p>
                      )}
                      {!replyValidationError && (
                        <p className="text-xs text-slate-500 mt-2">
                          Note: Required when changing status/progress (min. 20 characters)
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Update */}
              {detailsMode === "edit" && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Update Status
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    {detailsMode === "edit" ? (
                      <Select
                        value={statusForm.status}
                        onValueChange={(value) =>
                          setStatusForm({ ...statusForm, status: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800">
                        {toTitleCase(statusForm.status)}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={handleUpdateStatus}
                      disabled={statusUpdateLoading}
                      className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {statusUpdateLoading ? "Sending..." : "Send Reply & Update"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowDetails(false)}
                      className="flex-1"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
              )}

              {detailsMode === "view" && (
                <div className="flex gap-3 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => setShowDetails(false)}
                    className="w-full"
                  >
                    Close
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
