import { useEffect, useRef, useState } from "react";
import { getTimedResumeAccess, replaceStudentResume } from "../services/resumeService";
import { validateResumeFile } from "../utils/studentProfileValidation";

export function useResumeUpload({
  userId, accessToken, resumePath, onUploaded, setError, setSuccessMessage, setWarning,
}) {
  const [access, setAccess] = useState(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const activeUser = useRef(null);
  const uploading = useRef(false);
  const opening = useRef(false);
  const signingVersion = useRef(0);
  const lastUploadedPath = useRef("");

  useEffect(() => {
    activeUser.current = userId;
    return () => { activeUser.current = null; };
  }, [userId]);

  useEffect(() => {
    let active = true;
    const version = ++signingVersion.current;
    if (resumePath) {
      getTimedResumeAccess(resumePath).then((result) => {
        if (active && version === signingVersion.current) setAccess(result);
      }).catch(() => {
        if (active && version === signingVersion.current) {
          if (lastUploadedPath.current === resumePath) setSuccessMessage("");
          setError(lastUploadedPath.current === resumePath
            ? "Resume uploaded, but the secure preview link is unavailable."
            : "Profile loaded, but the secure resume link is unavailable.");
        }
      });
    }
    return () => { active = false; };
  }, [resumePath, setError, setSuccessMessage]);

  async function openResume(event) {
    if (access?.path === resumePath && access.expiresAt > Date.now()) return;
    event.preventDefault();
    if (opening.current || !resumePath) return;
    opening.current = true;
    const version = ++signingVersion.current;
    const preview = window.open("about:blank", "_blank");
    if (preview) preview.opener = null;
    try {
      const result = await getTimedResumeAccess(resumePath);
      if (activeUser.current !== userId || version !== signingVersion.current) {
        preview?.close();
        return;
      }
      setAccess(result);
      setError("");
      if (preview) preview.location.replace(result.url);
      else setError("The secure resume link is ready. Select View Resume again to open it.");
    } catch (error) {
      preview?.close();
      if (activeUser.current === userId) setError(error.message || "Unable to open your resume.");
    } finally {
      opening.current = false;
    }
  }

  async function handleResumeChange(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (uploading.current) return;
    setError("");
    setSuccessMessage("");
    setWarning("");
    const validationError = validateResumeFile(file);
    if (validationError) {
      setError(validationError);
      input.value = "";
      return;
    }
    uploading.current = true;
    setIsUploadingResume(true);
    setUploadProgress(5);
    const isCurrent = () => activeUser.current === userId;
    try {
      const path = await replaceStudentResume({
        userId, accessToken, file,
        onProgress: (value) => { if (isCurrent()) setUploadProgress(value); },
      });
      if (!isCurrent()) return;
      lastUploadedPath.current = path;
      onUploaded(path);
      setUploadProgress(100);
      setSuccessMessage("Resume uploaded successfully.");
      if (resumePath) {
        setWarning("The previous resume file was retained in private storage. No files were deleted.");
      }
    } catch (error) {
      if (isCurrent()) {
        setError(error.message || "Unable to upload your resume.");
        setWarning(error.warning || "");
        setUploadProgress(0);
      }
    } finally {
      uploading.current = false;
      if (isCurrent()) setIsUploadingResume(false);
      input.value = "";
    }
  }

  return {
    resumeUrl: access?.path === resumePath ? access.url : "",
    isUploadingResume, uploadProgress, handleResumeChange, openResume,
  };
}
