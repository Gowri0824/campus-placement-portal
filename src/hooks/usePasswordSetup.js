import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import { setCurrentUserPassword } from "../services/authService";
import { getPasswordLinkError, validateSetupPassword } from "../utils/passwordSetup";
import { ROUTES } from "../constants/routes";

export function usePasswordSetup() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [linkError] = useState(() => getPasswordLinkError(window.location));
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const pending = useRef(false);
  const isLoading = !auth.isAuthReady || auth.isLoading;
  const canSave = !isLoading && Boolean(auth.user) && !linkError && !auth.error;

  async function submit() {
    if (!canSave || pending.current) return;
    const validation = saved ? "" : validateSetupPassword(password, confirmation);
    if (validation) { setError(validation); return; }
    pending.current = true;
    setIsSaving(true);
    setError("");
    try {
      if (!saved) {
        await setCurrentUserPassword(password, auth.user.id);
        setSaved(true);
        setPassword("");
        setConfirmation("");
      }
      await auth.signOut();
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (failure) {
      setError(failure.message || "Unable to complete password setup.");
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  }
  return { password, setPassword, confirmation, setConfirmation, submit, saved, isSaving, isLoading, canSave,
    email: auth.user?.email || "", error: linkError || error || (auth.error ? "Your invitation account is not ready. Contact your administrator." : "") };
}
