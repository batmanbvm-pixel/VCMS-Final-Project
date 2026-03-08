import { useState, useEffect, useCallback } from "react";
import { useAuth, User } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Users, RefreshCw, Stethoscope, Shield, User as UserIcon, AlertTriangle, Filter, Eye, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams, Link } from "react-router-dom";
import api from "@/services/api";
import { EmptyState } from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

// Helper to format location
const formatLocation = (loc: any): string => {
  if (!loc) return "";
  if (typeof loc === "string") return loc;
  if (typeof loc === "object") {
    const parts = [loc.city, loc.state, loc.country].filter(Boolean);
    return parts.join(", ") || "";
  }
  return "";
};

const AdminUsers = () => {
  const { users: contextUsers, deleteUser, warnUser } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "all";

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [warningDialog, setWarningDialog] = useState({
    open: false,
    userId: "",
    userName: "",
    userRole: "",
    reason: "",
    message: "",
    loading: false,
  });
  const [localUsers, setLocalUsers] = useState<User[]>([]);
  const [hasFetchedUsers, setHasFetchedUsers] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dbTotals, setDbTotals] = useState({ total: 0, dbName: "", dbHost: "" });
  const [statusFilter, setStatusFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [detailsDialog, setDetailsDialog] = useState<{ open: boolean; userId: string; user: User | null; loading: boolean; error: string }>({
    open: false,
    userId: "",
    user: null,
    loading: false,
    error: "",
  });

  // Use fetched users once available (even if empty), else fall back to context users
  const users = hasFetchedUsers ? localUsers : contextUsers;

  const getPrimaryStatus = (u: User): string => {
    const approvalStatus = String((u as any).approvalStatus || "").toLowerCase();
    const accountStatus = String((u as any).accountStatus || "").toLowerCase();
    const isApproved = (u as any).isApproved === true;
    const role = String(u.role || '').toLowerCase();

    // Keep status consistent with Pending Approvals logic
    if (role === 'patient' && isApproved) return 'approved';
    if (role === 'doctor' && ((u as any).approvedAt || (u as any).isPublic === true) && approvalStatus !== 'rejected') {
      return 'approved';
    }

    if (approvalStatus) return approvalStatus;
    if (accountStatus) return accountStatus;
    if (u.role === "admin") return "approved";
    return "active";
  };

  const isUserOnline = (u: User): boolean => {
    const role = String(u.role || '').toLowerCase();
    if (role !== 'doctor') return false;

    const approvalStatus = String((u as any).approvalStatus || '').toLowerCase();
    const completion = Number((u as any).profileCompletionPercentage || 0);
    const isApprovedAndComplete = (u as any).isApprovedAndComplete === true || (approvalStatus === 'approved' && completion === 100);
    if (!isApprovedAndComplete) return false;

    const onlineStatus = String((u as any).onlineStatus || "").toLowerCase();
    if (onlineStatus === "online") return true;
    if ((u as any).available === true) return true;
    return false;
  };

  const fetchUsers = useCallback(async (showToast = false) => {
    try {
      setIsRefreshing(true);
      const r = await api.get('/admin/users', { params: { limit: 1000 } });
      const list = r.data.users || r.data;
      setLocalUsers(Array.isArray(list) ? list : []);
      setDbTotals({
        total: Number(r.data?.pagination?.total ?? (Array.isArray(list) ? list.length : 0)),
        dbName: String(r.data?.pagination?.dbName || ""),
        dbHost: String(r.data?.pagination?.dbHost || ""),
      });
      setHasFetchedUsers(true);
      if (showToast) {
        toast({ title: "Refreshed", description: "User list updated successfully." });
      }
    } catch {
      if (showToast) {
        toast({ title: "Refresh failed", description: "Could not refresh users.", variant: "destructive" });
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [toast]);

  // Always fetch from admin/users for admin pages (high limit to get all)
  useEffect(() => {
    fetchUsers(false);
  }, [fetchUsers]);

  const filteredUsers = users
    .filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === "all" || u.role === activeTab;
      const matchesStatus = statusFilter === "all" || getPrimaryStatus(u) === statusFilter;
      const isDoctor = String(u.role || "").toLowerCase() === "doctor";
      const matchesAvailability =
        availabilityFilter === "all" ||
        (isDoctor && (availabilityFilter === "online" ? isUserOnline(u) : !isUserOnline(u)));

      return matchesSearch && matchesTab && matchesStatus && matchesAvailability;
    })
    .slice()
    .sort((a, b) => {
      if (sortBy === "name-asc") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "name-desc") {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === "role") {
        return a.role.localeCompare(b.role);
      }
      if (sortBy === "status") {
        return getPrimaryStatus(a).localeCompare(getPrimaryStatus(b));
      }
      if (sortBy === "online-first") {
        return Number(isUserOnline(b)) - Number(isUserOnline(a));
      }
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    statusFilter !== "all" ||
    availabilityFilter !== "all" ||
    sortBy !== "newest";

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setAvailabilityFilter("all");
    setSortBy("newest");
  };

  const handleDelete = async () => {
    if (deletingUser) {
      const result = await deleteUser(deletingUser._id);
      if (result.success) {
        setLocalUsers((prev) => prev.filter((u) => u._id !== deletingUser._id));
        toast({ title: "User deleted", description: `${deletingUser.name} has been removed.` });
        setDeletingUser(null);
      } else {
        toast({ title: "Delete failed", description: result.message, variant: "destructive" });
      }
    }
  };

  const handleWarn = async () => {
    if (!warningDialog.userId || !warningDialog.message.trim()) {
      toast({ title: "Required", description: "Please enter a warning message.", variant: "destructive" });
      return;
    }

    const reasonLabelMap: Record<string, string> = {
      "high-cancellation": "High Cancellation Rate",
      "no-show": "Frequent No-shows",
      "poor-ratings": "Poor Patient Ratings",
      "violation": "Policy Violation",
      "inappropriate-behavior": "Inappropriate Behavior",
      "other": "Other",
    };
    const reasonLabel = warningDialog.reason ? reasonLabelMap[warningDialog.reason] || warningDialog.reason : "";
    const composedMessage = reasonLabel
      ? `${reasonLabel}: ${warningDialog.message.trim()}`
      : warningDialog.message.trim();

    try {
      setWarningDialog((prev) => ({ ...prev, loading: true }));
      const result = await warnUser(warningDialog.userId, composedMessage);
      if (result.success) {
        toast({ title: "Warning sent", description: `Warning sent to ${warningDialog.userName}.` });
        setWarningDialog({ open: false, userId: "", userName: "", userRole: "", reason: "", message: "", loading: false });
      } else {
        toast({ title: "Warning failed", description: result.message, variant: "destructive" });
        setWarningDialog((prev) => ({ ...prev, loading: false }));
      }
    } catch {
      toast({ title: "Warning failed", description: "Failed to send warning", variant: "destructive" });
      setWarningDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const tabs = [
    { value: "all", label: "All Users" },
    { value: "patient", label: "Patients" },
    { value: "doctor", label: "Doctors" },
  ];

  const openUserDetails = async (userId: string) => {
    setDetailsDialog({ open: true, userId, user: null, loading: true, error: "" });
    try {
      const res = await api.get(`/users/${userId}`);
      const freshUser = (res.data?.user || res.data) as User;
      setDetailsDialog({ open: true, userId, user: freshUser || null, loading: false, error: "" });
    } catch (error: any) {
      const msg = error?.userMessage || error?.response?.data?.message || "Failed to load latest user details.";
      setDetailsDialog({ open: true, userId, user: null, loading: false, error: msg });
    }
  };

  const getDisplayValue = (value: any, fallback = "—") => {
    if (value === null || value === undefined || value === "") return fallback;
    return String(value);
  };

  const formatDateTime = (value?: string) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  };

  const formatList = (value: any, fallback = "—") => {
    if (!Array.isArray(value) || value.length === 0) return fallback;
    return value.filter(Boolean).join(", ");
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl pb-12">
      {/* Gradient Header */}
      <div className="rounded-xl bg-sky-500 p-6 text-white shadow-md border border-sky-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Users className="h-6 w-6" /> Manage Users</h1>
            <p className="mt-1 text-sky-100 text-sm">View and manage all registered users</p>
          </div>
          <div className="flex gap-3">
            <Link to="/admin/approvals">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-amber-500 hover:bg-amber-600 text-white border-amber-400 hover:border-amber-500 shadow-md font-semibold"
              >
                <Bell className="h-4 w-4" />
                Pending Approvals
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-white/15 border-white/30 text-white hover:bg-white/25"
              onClick={() => fetchUsers(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} /> {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 rounded-t-lg ${
              activeTab === tab.value
                ? "border-sky-500 text-sky-700 bg-sky-50"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-white border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all duration-200"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <select
            className="w-full h-10 rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="active">Active</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
            <option value="locked">Locked</option>
          </select>
        </div>

        <div className="relative">
          <select
            className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
          >
            <option value="all">All Availability</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>

        <div className="relative">
          <select
            className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Sort: Newest</option>
            <option value="name-asc">Sort: Name A-Z</option>
            <option value="name-desc">Sort: Name Z-A</option>
            <option value="role">Sort: Role</option>
            <option value="status">Sort: Status</option>
            <option value="online-first">Sort: Online First</option>
          </select>
        </div>

        {hasActiveFilters && (
          <div className="lg:col-span-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="text-red-700 border-red-300 bg-red-50 hover:bg-red-100"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Users Table */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-200 pb-4 bg-slate-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">All Users 
              <span className="ml-2 inline-block bg-sky-100 text-sky-700 px-3 py-1 rounded-full text-sm font-semibold border border-sky-200">
                {filteredUsers.length}
              </span>
            </CardTitle>
            <p className="text-xs text-slate-600">
              Total: <span className="font-semibold text-slate-800">{dbTotals.total}</span>
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
                  <TableHead className="w-[19%] text-xs font-semibold text-slate-700 uppercase tracking-wider px-3 py-2">Name</TableHead>
                  <TableHead className="w-[23%] text-xs font-semibold text-slate-700 uppercase tracking-wider px-3 py-2">Email</TableHead>
                  <TableHead className="w-[12%] text-xs font-semibold text-slate-700 uppercase tracking-wider px-3 py-2">Phone</TableHead>
                  <TableHead className="w-[10%] text-xs font-semibold text-slate-700 uppercase tracking-wider px-3 py-2">Role</TableHead>
                  <TableHead className="w-[10%] text-xs font-semibold text-slate-700 uppercase tracking-wider px-3 py-2">Availability</TableHead>
                  <TableHead className="w-[8%] text-xs font-semibold text-slate-700 uppercase tracking-wider px-3 py-2">Fee</TableHead>
                  <TableHead className="w-[18%] text-right text-xs font-semibold text-slate-700 uppercase tracking-wider px-3 py-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u, index) => (
                  <TableRow key={u._id} className={`border-b border-slate-100 hover:bg-sky-50/70 transition-all duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                    <TableCell className="font-medium px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-md transition-transform hover:scale-110 ${
                          u.role === "admin" ? "bg-violet-700" : 
                          u.role === "doctor" ? "bg-sky-600" : 
                          "bg-emerald-600"
                        }`}>
                          {u.role === "doctor" && <Stethoscope className="h-4 w-4" />}
                          {u.role === "admin" && <Shield className="h-4 w-4" />}
                          {u.role === "patient" && <UserIcon className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{u.name}</p>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <StatusBadge status={getPrimaryStatus(u)} />
                            {(u as any).accountStatus && ["suspended", "locked"].includes(String((u as any).accountStatus).toLowerCase()) && String((u as any).accountStatus).toLowerCase() !== getPrimaryStatus(u) && (
                              <StatusBadge status={String((u as any).accountStatus)} />
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm px-3 py-2 break-all">{u.email}</TableCell>
                    <TableCell className="text-slate-600 text-sm px-3 py-2 whitespace-nowrap">{u.phone || "—"}</TableCell>
                    <TableCell className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase transition-colors ${
                          u.role === "admin" ? "bg-violet-100 text-violet-700 border border-violet-200" : 
                          u.role === "doctor" ? "bg-sky-100 text-sky-700 border border-sky-200" : 
                          "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        }`}>
                          {u.role === "doctor" && <Stethoscope className="h-3 w-3" />}
                          {u.role === "admin" && <Shield className="h-3 w-3" />}
                          {u.role === "patient" && <UserIcon className="h-3 w-3" />}
                          {u.role}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      {u.role === "doctor" ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                            isUserOnline(u)
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              : 'bg-amber-100 text-amber-700 border-amber-200'
                          }`}
                        >
                          {isUserOnline(u) ? 'Online' : 'Offline'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border bg-slate-100 text-slate-500 border-slate-200">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-700 px-3 py-2">
                      {u.role === "doctor"
                        ? (typeof u.consultationFee === "number" && u.consultationFee > 0
                          ? `₹${Number(u.consultationFee).toLocaleString('en-IN')}`
                          : "Not set")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs px-3 bg-white text-sky-700 hover:bg-sky-50 border border-sky-200 font-semibold transition-all duration-200 hover:scale-105"
                          onClick={() => openUserDetails(u._id)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Details
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs px-3 bg-amber-500 text-white hover:bg-amber-600 border border-amber-400 font-semibold transition-all duration-200 hover:scale-105"
                          onClick={() => setWarningDialog({
                            open: true,
                            userId: u._id,
                            userName: u.name,
                            userRole: u.role,
                            reason: "",
                            message: "",
                            loading: false,
                          })}
                          disabled={u.role === "admin"}
                        >
                          ⚠ Warn
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs px-3 bg-red-500 text-white hover:bg-red-600 border border-red-400 font-semibold transition-all duration-200 hover:scale-105"
                          onClick={() => setDeletingUser(u)}
                          disabled={u.role === "admin"}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <EmptyState 
                        icon={Users}
                        title="No users found"
                        description="Try adjusting your search or filters"
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <Dialog open={detailsDialog.open} onOpenChange={(openState) => setDetailsDialog((prev) => ({ ...prev, open: openState }))}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border border-sky-100">
          <div className="bg-sky-50 border-b border-sky-100 px-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-sky-900">User Details</DialogTitle>
              <DialogDescription className="text-sky-700">
                Full information for {detailsDialog.user?.name || "selected user"}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {detailsDialog.loading && (
              <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-8 text-center text-sky-700 text-sm">
                Loading latest details from database...
              </div>
            )}

            {!detailsDialog.loading && detailsDialog.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {detailsDialog.error}
              </div>
            )}

            {!detailsDialog.loading && detailsDialog.user && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="font-medium text-slate-600">Name:</span> <span className="text-slate-900">{getDisplayValue(detailsDialog.user.name)}</span></div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="font-medium text-slate-600">Email:</span> <span className="text-slate-900">{getDisplayValue(detailsDialog.user.email)}</span></div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="font-medium text-slate-600">Phone:</span> <span className="text-slate-900">{getDisplayValue(detailsDialog.user.phone)}</span></div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="font-medium text-slate-600">Role:</span> <span className="text-slate-900">{getDisplayValue(detailsDialog.user.role)}</span></div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="font-medium text-slate-600">Primary Status:</span> <span className="text-slate-900">{getPrimaryStatus(detailsDialog.user)}</span></div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="font-medium text-slate-600">Availability:</span> <span className="text-slate-900">{detailsDialog.user.role === "doctor" ? (isUserOnline(detailsDialog.user) ? "Online" : "Offline") : "—"}</span></div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="font-medium text-slate-600">Warnings:</span> <span className="text-slate-900">{Array.isArray((detailsDialog.user as any).adminWarnings) ? (detailsDialog.user as any).adminWarnings.length : 0}</span></div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="font-medium text-slate-600">Gender:</span> <span className="text-slate-900">{getDisplayValue((detailsDialog.user as any).gender)}</span></div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="font-medium text-slate-600">DOB:</span> <span className="text-slate-900">{formatDateTime((detailsDialog.user as any).dateOfBirth)}</span></div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm md:col-span-2"><span className="font-medium text-slate-600">Address:</span> <span className="text-slate-900">{getDisplayValue((detailsDialog.user as any).address)}</span></div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="font-medium text-slate-600">Created:</span> <span className="text-slate-900">{formatDateTime((detailsDialog.user as any).createdAt)}</span></div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm md:col-span-2"><span className="font-medium text-slate-600">Updated:</span> <span className="text-slate-900">{formatDateTime((detailsDialog.user as any).updatedAt)}</span></div>
                </div>

                {detailsDialog.user.role === "doctor" && (
                  <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 mb-2">Doctor Information</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="font-medium text-slate-600">Specialization:</span> <span className="text-slate-900">{getDisplayValue(detailsDialog.user.specialization, "General")}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="font-medium text-slate-600">Consultation Fee:</span> <span className="text-slate-900">{typeof detailsDialog.user.consultationFee === "number" && detailsDialog.user.consultationFee > 0 ? `₹${Number(detailsDialog.user.consultationFee).toLocaleString('en-IN')}` : "Not set"}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="font-medium text-slate-600">Experience:</span> <span className="text-slate-900">{(detailsDialog.user as any).experience ? `${(detailsDialog.user as any).experience} years` : "—"}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="font-medium text-slate-600">Completion:</span> <span className="text-slate-900">{getDisplayValue((detailsDialog.user as any).profileCompletionPercentage, "0")}%</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm md:col-span-2"><span className="font-medium text-slate-600">Location:</span> <span className="text-slate-900">{getDisplayValue(formatLocation((detailsDialog.user as any).location || detailsDialog.user.location), "Location N/A")}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm md:col-span-2"><span className="font-medium text-slate-600">City / State:</span> <span className="text-slate-900">{getDisplayValue([detailsDialog.user.city, detailsDialog.user.state].filter(Boolean).join(", "))}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm md:col-span-2"><span className="font-medium text-slate-600">Qualifications:</span> <span className="text-slate-900">{formatList((detailsDialog.user as any).qualifications)}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm md:col-span-2"><span className="font-medium text-slate-600">Languages:</span> <span className="text-slate-900">{formatList((detailsDialog.user as any).languages)}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm md:col-span-2"><span className="font-medium text-slate-600">Symptoms Covered:</span> <span className="text-slate-900">{formatList((detailsDialog.user as any).symptoms || (detailsDialog.user as any).expertise_symptoms)}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm md:col-span-2"><span className="font-medium text-slate-600">Bio:</span> <span className="text-slate-900">{getDisplayValue((detailsDialog.user as any).bio)}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm md:col-span-2">
                        <span className="font-medium text-slate-600">Availability Slots:</span>
                        {Array.isArray((detailsDialog.user as any).availability) && (detailsDialog.user as any).availability.length > 0 ? (
                          <ul className="mt-2 space-y-1 text-slate-900 list-disc pl-5">
                            {(detailsDialog.user as any).availability.map((slot: any, idx: number) => (
                              <li key={`${slot?.day || 'day'}-${idx}`}>
                                {getDisplayValue(slot?.day, "Day N/A")} : {getDisplayValue(slot?.startTime, "--:--")} - {getDisplayValue(slot?.endTime, "--:--")}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-900 ml-1">No slots set</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {detailsDialog.user.role === "patient" && (
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">Patient Information</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="font-medium text-slate-600">Age:</span> <span className="text-slate-900">{getDisplayValue(detailsDialog.user.age)}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm md:col-span-2"><span className="font-medium text-slate-600">Medical History:</span> <span className="text-slate-900">{getDisplayValue(detailsDialog.user.medicalHistory, "No history")}</span></div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="border-t border-slate-100 bg-white px-5 py-4">
            <Button
              variant="outline"
              className="border-sky-200 text-sky-700 hover:bg-sky-50"
              onClick={() => detailsDialog.userId && openUserDetails(detailsDialog.userId)}
              disabled={!detailsDialog.userId || detailsDialog.loading}
            >
              Refresh Data
            </Button>
            <Button variant="outline" className="border-slate-300" onClick={() => setDetailsDialog({ open: false, userId: "", user: null, loading: false, error: "" })}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingUser?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Warning Dialog */}
      <Dialog open={warningDialog.open} onOpenChange={(openState) => setWarningDialog((prev) => ({ ...prev, open: openState }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Send Warning to {warningDialog.userRole === 'doctor' ? 'Doctor' : 'User'}
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
                <option value="high-cancellation">High Cancellation Rate</option>
                <option value="no-show">Frequent No-shows</option>
                <option value="poor-ratings">Poor Ratings</option>
                <option value="inappropriate-behavior">Inappropriate Behavior</option>
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
              onClick={() => handleWarn()}
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

export default AdminUsers;
