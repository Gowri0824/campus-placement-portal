import { useEffect, useMemo, useRef, useState } from "react";
import { useRecruiterCompany } from "./useRecruiterCompany";
import { useRecruiterApplicantResume } from "./useRecruiterApplicantResume";
import { decideRecruiterApplication, fetchRecruiterApplicants } from "../services/recruiterApplicantsService";
import { filterRecruiterApplicants } from "../utils/recruiterApplicants";
import { APPLICATION_STATUS, RECRUITER_DECISION_STATUSES } from "../constants/applicationStatuses";
import { getApplicationErrorMessage } from "../utils/applicationErrors";

const EMPTY = [];
const PAGE_SIZE = 25;

export function useRecruiterApplicants() {
  const companyState = useRecruiterCompany();
  const { company } = companyState;
  const [result, setResult] = useState(null);
  const [filters, setFilters] = useState({ driveId: "", status: "" });
  const [requestedPage, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [decision, setDecision] = useState(null);
  const pendingDecision = useRef(null);

  useEffect(() => () => { pendingDecision.current = null; }, [company]);

  useEffect(() => {
    if (!company) return;
    let active = true;
    fetchRecruiterApplicants(company).then(
      (data) => { if (active) setResult({ company, ...data, error: "" }); },
      (error) => { if (active) setResult({ company, error: error?.message || "Unable to load applicants. Please try again." }); },
    );
    return () => { active = false; };
  }, [company]);

  const current = result?.company === company ? result : null;
  const applications = current?.applications || EMPTY;
  const drives = current?.drives || EMPTY;
  const driveId = drives.some((drive) => drive.id === filters.driveId) ? filters.driveId : "";
  const filtered = useMemo(() => filterRecruiterApplicants(applications, driveId, filters.status), [applications, driveId, filters.status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const resume = useRecruiterApplicantResume(current);
  const currentDecision = decision?.company === company ? decision : null;

  async function decideApplication(application, status) {
    if (pendingDecision.current || !current || current.error) return;
    const row = applications.find((record) => record.id === application.id);
    if (row?.status !== APPLICATION_STATUS.APPLIED || !RECRUITER_DECISION_STATUSES.includes(status)) return;
    const action = status === APPLICATION_STATUS.SELECTED ? "Select" : "Reject";
    if (!window.confirm(`${action} ${row.student_name} for ${row.role}? You cannot change this decision afterward.`)) return;
    const request = {};
    pendingDecision.current = request;
    setDecision({ company, applicationId: row.id, loading: true });
    try {
      const updated = await decideRecruiterApplication(row.id, row.drive_id, status);
      if (pendingDecision.current !== request) return;
      const next = { ...current, applications: applications.map((record) =>
        record.id === updated.id ? { ...record, status: updated.status } : record) };
      setResult(next);
      setExpanded((previous) => previous?.scope === current ? { ...previous, scope: next } : previous);
      setDecision({ company, success: `Application marked ${updated.status}.` });
    } catch (error) {
      if (pendingDecision.current === request) setDecision({ company,
        error: getApplicationErrorMessage(error, "Unable to save the decision. Reload before trying again.") });
    } finally {
      if (pendingDecision.current === request) pendingDecision.current = null;
    }
  }

  function changeFilters(nextFilters) {
    setFilters(nextFilters);
    setPage(1);
    setExpanded(null);
  }

  return {
    companyState, drives, filters: { driveId, status: filters.status },
    changeFilters, clearFilters: () => changeFilters({ driveId: "", status: "" }),
    applications: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: applications.length, matching: filtered.length, page, pageCount,
    changePage: (nextPage) => { setPage(nextPage); setExpanded(null); },
    expandedId: expanded?.scope === current ? expanded.id : null,
    toggleDetails: (id) => setExpanded((previous) => ({ scope: current, id: previous?.scope === current && previous.id === id ? null : id })),
    isLoading: companyState.isLoading || (Boolean(company) && !current),
    error: current?.error || "", warnings: current?.warnings || EMPTY,
    decideApplication, updatingId: currentDecision?.loading ? currentDecision.applicationId : null,
    decisionError: currentDecision?.error || "", success: currentDecision?.success || "",
    refresh: () => { setPage(1); setExpanded(null); companyState.refresh(); },
    resume,
  };
}
