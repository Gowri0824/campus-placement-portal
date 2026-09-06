import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { useResumeUpload } from "./useResumeUpload";
import { fetchStudentProfile, updateStudentProfile } from "../services/studentProfileService";
import { toStudentProfileForm, toStudentProfilePayload, validateStudentProfile } from "../utils/studentProfileValidation";

const initialProfile = {
  fullName: "", email: "", rollNumber: "", branch: "", cgpa: "",
  graduationYear: "", skills: "", resumePath: "",
};

export function useStudentProfile() {
  const { user, session } = useAuth();
  const userId = user?.id;
  const email = user?.email;
  const [profile, setProfile] = useState(initialProfile);
  const [formData, setFormData] = useState(toStudentProfileForm(initialProfile));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [warning, setWarning] = useState("");
  const activeUser = useRef(null);
  const saving = useRef(false);
  const onUploaded = useCallback((resumePath) => {
    setProfile((current) => ({ ...current, resumePath }));
  }, []);
  const resume = useResumeUpload({
    userId, accessToken: session?.access_token, resumePath: profile.resumePath,
    onUploaded, setError, setSuccessMessage, setWarning,
  });

  useEffect(() => {
    let active = true;
    activeUser.current = userId;
    async function load() {
      if (!userId) return;
      setIsLoading(true);
      setError("");
      try {
        const loaded = await fetchStudentProfile(userId, email);
        if (!active) return;
        setProfile(loaded);
        setFormData(toStudentProfileForm(loaded));
      } catch (error) {
        if (active) setError(error.message || "Unable to load your profile.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    load();
    return () => { active = false; activeUser.current = null; };
  }, [userId, email]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving.current) return;
    setError("");
    setSuccessMessage("");
    const validationError = validateStudentProfile(formData);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!userId) {
      setError("Your session has expired. Please log in again.");
      return;
    }
    saving.current = true;
    setIsSaving(true);
    try {
      const updated = await updateStudentProfile(userId, toStudentProfilePayload(formData));
      if (activeUser.current !== userId) return;
      setProfile((current) => ({
        ...current, branch: updated.branch, cgpa: updated.cgpa,
        graduationYear: updated.graduation_year, skills: updated.skills,
      }));
      setSuccessMessage("Profile updated successfully.");
    } catch (error) {
      if (activeUser.current === userId) setError(error.message || "Unable to save your profile.");
    } finally {
      saving.current = false;
      if (activeUser.current === userId) setIsSaving(false);
    }
  }

  return {
    profile, formData, isLoading, isSaving, error, successMessage, warning,
    handleChange, handleSubmit, ...resume,
  };
}
