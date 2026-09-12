import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { fetchRecruiterManagementData, inviteRecruiter } from "../services/recruiterManagementService";
import { validateRecruiterInvitation } from "../utils/recruiterManagement";

const EMPTY_FORM = { fullName: "", email: "", companyId: "" };

export function useRecruiterManagement() {
  const { user } = useAuth();
  const profileId = user?.id;
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [feedback, setFeedback] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    let active = true;
    fetchRecruiterManagementData().then(
      (data) => { if (active) setResult({ profileId, version, ...data }); },
      (error) => { if (active) setResult({ profileId, version, error: error.message || "Unable to load recruiters." }); },
    );
    return () => { active = false; };
  }, [profileId, version]);

  const current = result?.profileId === profileId && result.version === version ? result : null;
  async function submit() {
    if (pending.current) return;
    setFeedback({});
    const validation = validateRecruiterInvitation(form);
    if (validation.error) { setFeedback({ error: validation.error }); return; }
    if (!current?.companies?.some((company) => company.id === validation.value.companyId)) {
      setFeedback({ error: "Reload and select an available company." });
      return;
    }
    pending.current = true;
    setIsSaving(true);
    try {
      const invitation = await inviteRecruiter(validation.value);
      if (!mounted.current) return;
      setFeedback(invitation.invited ? { success: invitation.message } : { warning: invitation.warning });
      if (invitation.invited) setForm(EMPTY_FORM);
      setVersion((value) => value + 1);
    } catch (error) {
      if (mounted.current) setFeedback({ error: error.message });
    } finally {
      pending.current = false;
      if (mounted.current) setIsSaving(false);
    }
  }
  return {
    form, setField: (field, value) => setForm((previous) => ({ ...previous, [field]: value })), submit,
    isSaving, isLoading: !current, companies: current?.companies || [], recruiters: current?.recruiters || [],
    loadError: current?.error || "", warning: current?.warning || "", feedback,
    refresh: () => setVersion((value) => value + 1),
  };
}
