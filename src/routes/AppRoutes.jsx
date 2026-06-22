import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import Login from "../pages/auth/Login";
import Signup from "../pages/auth/Signup";
import Profile from "../pages/student/Profile";
import StudentDashboard from "../pages/student/StudentDashboard";
import { supabase } from "../services/supabaseClient";

function ProtectedRoute({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState(null);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      // getSession reads the current browser session without forcing a login.
      const { data } = await supabase.auth.getSession();

      if (isMounted) {
        setSession(data.session);
        setIsLoading(false);
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <main style={styles.loadingPage}>
        <p style={styles.loadingText}>Checking session...</p>
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

const styles = {
  loadingPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f7fb",
  },
  loadingText: {
    color: "#4b5563",
    fontSize: "16px",
  },
};

export default AppRoutes;
