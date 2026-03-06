import { useState, useEffect } from "react";
import { useAuth, User } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, CheckCircle, XCircle, Users, RefreshCw, Stethoscope, Shield, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
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
  const [warningUser, setWarningUser] = useState<User | null>(null);
  const [warningMessage, setWarningMessage] = useState("");
  const [localUsers, setLocalUsers] = useState<User[]>([]);

  // Use localUsers if fetched, else fall back to context users
  const users = localUsers.length > 0 ? localUsers : contextUsers;

  // Always fetch from admin/users for admin pages (high limit to get all)
  useEffect(() => {
    api.get('/admin/users', { params: { limit: 1000 } })
      .then(r => {
        const list = r.data.users || r.data;
        setLocalUsers(Array.isArray(list) ? list : []);
      })
      .catch(() => {/* silent fallback to context users */});
  }, []);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "all" || u.role === activeTab;
    return matchesSearch && matchesTab;
  });

  const handleDelete = async () => {
    if (deletingUser) {
      const result = await deleteUser(deletingUser._id);
      if (result.success) {
        toast({ title: "User deleted", description: `${deletingUser.name} has been removed.` });
        setDeletingUser(null);
      } else {
        toast({ title: "Delete failed", description: result.message, variant: "destructive" });
      }
    }
  };

  const handleWarn = async () => {
    if (warningUser && warningMessage.trim()) {
      const result = await warnUser(warningUser._id, warningMessage);
      if (result.success) {
        toast({ title: "Warning sent", description: `Warning sent to ${warningUser.name}.` });
        setWarningUser(null);
        setWarningMessage("");
      } else {
        toast({ title: "Warning failed", description: result.message, variant: "destructive" });
      }
    }
  };

  const tabs = [
    { value: "all", label: "All Users" },
    { value: "patient", label: "Patients" },
    { value: "doctor", label: "Doctors" },
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl pb-12">
      {/* Gradient Header */}
      <div className="rounded-xl bg-sky-500 p-6 text-white shadow-md border border-sky-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Users className="h-6 w-6" /> Manage Users</h1>
            <p className="mt-1 text-sky-100 text-sm">View and manage all registered users · <a href="/admin/approvals" className="underline text-white/90 hover:text-white">Pending approvals</a></p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 bg-white/15 border-white/30 text-white hover:bg-white/25" onClick={() => api.get('/admin/users', { params: { limit: 1000 } }).then(r => { const list = r.data.users || r.data; setLocalUsers(Array.isArray(list) ? list : []); })}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${
              activeTab === tab.value
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search by name or email..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          className="pl-9 h-10 bg-white border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition-all duration-200"
        />
      </div>

      {/* Users Table */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="border-b border-slate-200 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">All Users 
              <span className="ml-2 inline-block bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-semibold">
                {filteredUsers.length}
              </span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="bg-slate-50/50 border-b border-slate-200">
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase tracking-wider px-3 py-2">Name</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase tracking-wider px-3 py-2">Email</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase tracking-wider px-3 py-2">Phone</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase tracking-wider px-3 py-2">Role</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase tracking-wider px-3 py-2">Availability</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 uppercase tracking-wider px-3 py-2">Details</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700 uppercase tracking-wider px-3 py-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u, index) => (
                  <TableRow key={u._id} className={`border-b border-slate-100 hover:bg-slate-100/60 transition-all duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <TableCell className="font-medium px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-md transition-transform hover:scale-110 ${
                          u.role === "admin" ? "bg-gradient-to-br from-red-500 to-red-600" : 
                          u.role === "doctor" ? "bg-gradient-to-br from-sky-500 to-sky-600" : 
                          "bg-gradient-to-br from-cyan-500 to-cyan-600"
                        }`}>
                          {u.role === "doctor" && <Stethoscope className="h-4 w-4" />}
                          {u.role === "admin" && <Shield className="h-4 w-4" />}
                          {u.role === "patient" && <UserIcon className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{u.name}</p>
                          {u.role === "doctor" && u.approvalStatus && (
                            <StatusBadge status={u.approvalStatus} />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm px-3 py-2">{u.email}</TableCell>
                    <TableCell className="text-slate-600 text-sm px-3 py-2">{u.phone || "—"}</TableCell>
                    <TableCell className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase text-white transition-colors ${
                          u.role === "admin" ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800" : 
                          u.role === "doctor" ? "bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800" : 
                          "bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800"
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
                        <div className="flex items-center gap-2">
                          <div className={`h-2.5 w-2.5 rounded-full ${
                            ((u as any).available === true || String((u as any).onlineStatus || '').toLowerCase() === 'online') ? 'bg-sky-500 animate-pulse' : 'bg-slate-400'
                          }`}></div>
                          <span className={`text-xs font-semibold ${
                            ((u as any).available === true || String((u as any).onlineStatus || '').toLowerCase() === 'online') ? 'text-sky-700' : 'text-slate-500'
                          }`}>
                            {((u as any).available === true || String((u as any).onlineStatus || '').toLowerCase() === 'online') ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 px-3 py-2">
                      {u.role === "doctor" && <>{u.specialization} • ₹{u.consultationFee} • {formatLocation(u.location)}</>}
                      {u.role === "patient" && <>{u.age ? `Age: ${u.age}` : "—"} • {u.medicalHistory || "No history"}</>}
                      {u.role === "admin" && "System Admin"}
                    </TableCell>
                    <TableCell className="text-right px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          className="h-8 text-xs px-3 bg-sky-100 text-sky-700 hover:bg-sky-200 border border-sky-300 font-semibold transition-all duration-200 hover:scale-105"
                          onClick={() => setWarningUser(u)}
                          disabled={u.role === "admin"}
                        >
                          ⚠ Warn
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs px-3 bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 font-semibold transition-all duration-200 hover:scale-105"
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
      <AlertDialog open={!!warningUser} onOpenChange={() => { setWarningUser(null); setWarningMessage(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Warning to {warningUser?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              This warning will be visible on the user's notification page and profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Enter warning message..."
            value={warningMessage}
            onChange={(e) => setWarningMessage(e.target.value)}
            className="my-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleWarn} disabled={!warningMessage.trim()} className="bg-warning text-warning-foreground hover:bg-warning/90">
              Send Warning
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default AdminUsers;
