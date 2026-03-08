import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import Chatbot from "@/components/Chatbot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Activity, LogOut, User, ArrowLeft, LayoutDashboard, Bell, CircleHelp, MessageCircle, UserCheck } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";
import api from "@/services/api";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get("/notifications/unread-count");
      setUnreadCount(res.data?.unreadCount ?? 0);
    } catch { /* ignore */ }
  }, [isAuthenticated]);

  const fetchPendingApprovals = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'admin') return;
    try {
      const [doctorsRes, patientsRes] = await Promise.all([
        api.get('/admin/doctors/pending-list').catch(() => ({ data: { doctors: [] } })),
        api.get('/admin/patients/pending').catch(() => ({ data: { patients: [] } })),
      ]);
      const doctors = doctorsRes.data?.doctors?.filter((d: any) => d.approvalStatus === 'pending') || [];
      const patients = patientsRes.data?.patients?.filter((p: any) => p.approvalStatus === 'pending') || [];
      setPendingApprovalsCount(doctors.length + patients.length);
    } catch { /* ignore */ }
  }, [isAuthenticated, user?.role]);

  // Fetch unread count on mount and when location changes (user navigates away from notifications page)
  useEffect(() => { fetchUnread(); }, [fetchUnread, location.pathname]);
  
  // Fetch pending approvals for admin
  useEffect(() => { fetchPendingApprovals(); }, [fetchPendingApprovals, location.pathname]);

  // Real-time: increment badge on new notifications
  useEffect(() => {
    if (!socket) return;
    const bump = () => setUnreadCount((c) => c + 1);
    socket.on("notification", bump);
    socket.on("notification:warning", bump);
    socket.on("admin:warning", bump);
    return () => {
      socket.off("notification", bump);
      socket.off("notification:warning", bump);
      socket.off("admin:warning", bump);
    };
  }, [socket]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Initialize loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  // Extract initials from name (e.g., "John Doe" -> "JD")
  const initials = user ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : "";
  const roleColor = "bg-orange-700";

  const isDashboard = isAuthenticated && (
    location.pathname === `/${user?.role}` || location.pathname === "/"
  );

  const showBackArrow = isAuthenticated && !isDashboard;

  // Hide Sign In / Register link in header when already on that page
  const currentPath = location.pathname.replace(/\/$/, "");
  const isLoginPage = currentPath === "/login";
  const isRegisterPage = currentPath === "/register";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="space-y-8 text-center animate-fade-in">
          {/* Logo */}
          <div className="relative mx-auto">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-white mx-auto shadow-lg">
              <Activity className="h-10 w-10" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-slate-900">MediConnect</h1>
            <p className="text-slate-600 text-lg">Initializing...</p>
            <div className="flex gap-2 justify-center">
              <div className="h-3 w-3 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="h-3 w-3 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="h-3 w-3 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navbar */}
      <header className="sticky top-0 z-50 navbar-glass animate-slide-down border-b border-slate-200">
        <div className="container mx-auto flex h-20 items-center justify-between px-6">
          {/* Left: Back arrow + Logo */}
          <div className="flex items-center gap-4">
            {showBackArrow && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-11 w-11 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 transition-all" 
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-white transition-all duration-300 group-hover:scale-105 shadow-lg">
                <Activity className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-semibold tracking-tight text-slate-900">
                  MediConnect
                </span>
                <span className="text-[10px] text-sky-600 tracking-wider uppercase">Virtual Healthcare</span>
              </div>
            </Link>
          </div>

          {/* Right: Quick Links + Notification + Profile */}
          <div className="flex items-center gap-3">
            {/* About & Contact - Ghost Buttons */}
            {(!isAuthenticated || user?.role !== "admin") && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex items-center gap-2.5 h-11 px-4 text-slate-700 hover:text-sky-700 hover:bg-sky-50/80 border border-slate-200/80 hover:border-sky-200 text-sm font-semibold rounded-2xl transition-all duration-200"
                  onClick={() => navigate("/about-us")}
                >
                  <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-sky-100 to-cyan-100 flex items-center justify-center border border-sky-200/70">
                    <CircleHelp className="h-4 w-4 text-sky-700" />
                  </span>
                  About
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex items-center gap-2.5 h-11 px-4 text-slate-700 hover:text-sky-700 hover:bg-sky-50/80 border border-slate-200/80 hover:border-sky-200 text-sm font-semibold rounded-2xl transition-all duration-200"
                  onClick={() => navigate("/contact-us")}
                >
                  <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-cyan-100 to-sky-100 flex items-center justify-center border border-cyan-200/70">
                    <MessageCircle className="h-4 w-4 text-cyan-700" />
                  </span>
                  Contact
                </Button>
              </>
            )}
            
            {/* Notification Bell */}
            {isAuthenticated && user && (
              <>
                {/* Pending Approvals Badge (Admin Only) */}
                {user.role === 'admin' && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="relative h-12 w-12 rounded-xl text-slate-700 bg-white hover:bg-amber-50 border border-amber-300 hover:border-amber-400 shadow-[0_2px_10px_rgba(245,158,11,0.18)] transition-all duration-200 hover:scale-105" 
                    onClick={() => navigate("/admin/approvals")}
                    aria-label="Pending approvals"
                    title="Pending approvals"
                  >
                    <UserCheck className="h-5 w-5 text-amber-700 fill-amber-200/90" />
                    {pendingApprovalsCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-600 text-[11px] text-white font-semibold shadow-lg ring-2 ring-white animate-pulse">
                        {pendingApprovalsCount > 9 ? "9+" : pendingApprovalsCount}
                      </span>
                    )}
                  </Button>
                )}
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative h-12 w-12 rounded-xl text-slate-700 bg-white hover:bg-sky-50 border border-sky-300 hover:border-sky-400 shadow-[0_2px_10px_rgba(2,132,199,0.18)] transition-all duration-200 hover:scale-105" 
                  onClick={() => navigate("/notifications")}
                  aria-label="Open notifications"
                  title="Open notifications"
                >
                  <Bell className="h-5 w-5 text-sky-700 fill-sky-200/90" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[11px] text-white font-semibold shadow-lg ring-2 ring-white animate-pulse">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </>
            )}
            
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-12 w-12 rounded-xl transition-all duration-200 hover:scale-105 bg-white hover:bg-slate-50 shadow-[0_2px_10px_rgba(15,23,42,0.12)]" aria-label="Open account menu" title="Open account menu">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className={`${roleColor} text-white text-sm font-semibold`}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 p-3 rounded-3xl bg-white border border-slate-200 text-slate-900 shadow-xl" align="end">
                  <div className="px-4 py-5 border border-sky-200 bg-sky-50 rounded-2xl mb-3">
                    <div className="relative flex flex-col items-center text-center">
                      <Avatar className="h-16 w-16 ring-2 ring-orange-500/50 mb-3">
                        <AvatarFallback className={`${roleColor} text-white text-2xl font-medium`}>
                          {initials?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-base font-semibold text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-600 mt-1">{user.email}</p>
                      <span className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-orange-700 px-3 py-1.5 text-[11px] font-semibold uppercase text-white">
                        <div className="h-2 w-2 rounded-full bg-white"></div>
                        {user.role}
                      </span>
                    </div>
                  </div>
                  <DropdownMenuSeparator className="my-3 bg-slate-200" />
                  <DropdownMenuItem 
                    onClick={() => navigate(`/${user.role}`)}
                    className="rounded-xl px-4 py-3 cursor-pointer text-slate-700 hover:text-sky-700 hover:bg-sky-50 font-semibold transition-all"
                  >
                    <LayoutDashboard className="mr-3 h-5 w-5" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => navigate("/profile")}
                    className="rounded-xl px-4 py-3 cursor-pointer text-slate-700 hover:text-sky-700 hover:bg-sky-50 font-semibold transition-all"
                  >
                    <User className="mr-3 h-5 w-5" />
                    My Profile
                  </DropdownMenuItem>
                  {user.role !== "admin" && (
                    <DropdownMenuItem 
                      onClick={() => navigate("/notifications")}
                      className="rounded-xl px-4 py-3 cursor-pointer text-slate-700 hover:text-sky-700 hover:bg-sky-50 font-semibold transition-all"
                    >
                      <Bell className="mr-3 h-5 w-5 text-sky-600 fill-sky-200" />
                      Notifications
                      {unreadCount > 0 && (
                        <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-xs font-semibold text-white shadow-lg">
                          {unreadCount}
                        </span>
                      )}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="my-3 bg-slate-200" />
                  <DropdownMenuItem 
                    onClick={handleLogout} 
                    className="rounded-xl px-4 py-3 text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer font-semibold transition-all"
                  >
                    <LogOut className="mr-3 h-5 w-5" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-3">
                {!isLoginPage && (
                  <Button 
                    size="sm" 
                    className="btn-premium h-11 px-6 text-sm" 
                    asChild
                  >
                    <Link to="/login">Sign In</Link>
                  </Button>
                )}
                {!isRegisterPage && (
                  <Button 
                    size="sm" 
                    className="h-11 px-6 rounded-xl font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-lg transition-all text-sm" 
                    asChild
                  >
                    <Link to="/register">Register</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
      
      {/* Chatbot Floating Widget */}
      <Chatbot />
    </div>
  );
};

export default Layout;
