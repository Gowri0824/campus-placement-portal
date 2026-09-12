import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import { ROUTES } from "../constants/routes";

export function useRecruiterWorkspace() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const logoutPending = useRef(false);

  async function logout() {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setIsLoggingOut(true);
    setError("");
    try {
      await signOut();
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error) {
      setError(error.message || "Unable to log out.");
      setIsLoggingOut(false);
    } finally {
      logoutPending.current = false;
    }
  }

  return {
    fullName: profile?.full_name || "Not available",
    email: profile?.email || user?.email || "Not available",
    isLoggingOut, error, logout,
  };
}
