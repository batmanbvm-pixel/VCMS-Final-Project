import { Navigate } from "react-router-dom";
import { useAuth, UserRole } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const normalizedUserRole = String(user?.role || "").trim().toLowerCase();
  const normalizedAllowedRoles = allowedRoles?.map((role) => String(role || "").trim().toLowerCase());

  if (normalizedAllowedRoles && user && !normalizedAllowedRoles.includes(normalizedUserRole)) {
    return <Navigate to={`/${normalizedUserRole || "login"}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
