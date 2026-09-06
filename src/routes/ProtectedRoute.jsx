import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ROUTES, getRoleHomePath } from "../constants/routes";
import { useAuth } from "../hooks/useAuth";

function ProtectedRoute({ allowedRoles, children }) {
  const { error, isAuthenticated, isAuthReady, isLoading, role } = useAuth();
  const location = useLocation();

  if (!isAuthReady || isLoading) {
    return <main>Checking access...</main>;
  }

  if (!isAuthenticated || error || !role) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (allowedRoles?.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={getRoleHomePath(role) || ROUTES.LOGIN} replace />;
  }

  return children || <Outlet />;
}

export default ProtectedRoute;
