import { useEffect, useRef, useState } from "react";
import { getTimedResumeAccess } from "../services/resumeService";
import { canPreviewApplicantResume } from "../utils/recruiterApplicants";

export function useRecruiterApplicantResume(scope) {
  const [result, setResult] = useState(null);
  const pending = useRef(null);
  const current = result?.scope === scope ? result : null;

  // An account/assignment refresh must not reuse access from the previous scope.
  useEffect(() => () => {
    pending.current?.window?.close();
    pending.current = null;
  }, [scope]);

  async function openResume(application, event) {
    const student = application.student;
    if (!scope || !canPreviewApplicantResume(application)) {
      event?.preventDefault();
      return;
    }
    if (current?.studentId === student.id && current.access?.path === student.resume_path
      && current.access.expiresAt > Date.now()) return;
    event?.preventDefault();
    if (pending.current) return;
    const request = { window: window.open("about:blank", "_blank") };
    if (request.window) request.window.opener = null;
    pending.current = request;
    setResult({ scope, studentId: student.id, loading: true, error: "" });
    try {
      const access = await getTimedResumeAccess(student.resume_path);
      if (pending.current !== request) { request.window?.close(); return; }
      setResult({ scope, studentId: student.id, access, loading: false, error: "",
        warning: request.window ? "" : "The secure link is ready. Select View Resume again to open it." });
      request.window?.location.replace(access.url);
    } catch (error) {
      request.window?.close();
      if (pending.current === request) setResult({ scope, studentId: student.id, loading: false,
        error: error?.message || "Resume access is unavailable. Reload to check the current application status." });
    } finally {
      if (pending.current === request) pending.current = null;
    }
  }

  return { openResume, openingStudentId: current?.loading ? current.studentId : null,
    access: current?.access || null, studentId: current?.studentId,
    error: current?.error || "", warning: current?.warning || "" };
}
