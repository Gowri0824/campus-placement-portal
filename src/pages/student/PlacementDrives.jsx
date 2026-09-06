import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { APPLICATION_STATUS } from "../../constants/applicationStatuses";
import { ROUTES } from "../../constants/routes";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../services/supabaseClient";
import {
  formatAllowedBranches,
  normalizeBranch,
  parseAllowedBranches,
} from "../../utils/branches";
import {
  getApplicationErrorMessage,
  isDuplicateApplicationError,
} from "../../utils/applicationErrors";
import {
  formatDeadline,
  getDeadlineClosedMessage,
  isDeadlineOpen,
} from "../../utils/dates";

function PlacementDrives() {
  const [student, setStudent] = useState(null);
  const [drives, setDrives] = useState([]);
  const [applicationStatusByDriveId, setApplicationStatusByDriveId] =
    useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [applyingDriveId, setApplyingDriveId] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    const loadPlacementDrives = async () => {
      if (!user) {
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const { data: studentData, error: studentError } = await supabase
          .from("students")
          .select("id, branch, cgpa")
          .eq("profile_id", user.id)
          .single();

        if (studentError) {
          throw studentError;
        }

        const { data: driveData, error: drivesError } = await supabase
          .from("placement_drives")
          .select(
            "id, company_id, role, min_cgpa, allowed_branches, deadline, created_at"
          )
          .order("created_at", { ascending: false });

        if (drivesError) {
          throw drivesError;
        }

        const companyIds = [
          ...new Set((driveData || []).map((drive) => drive.company_id)),
        ].filter(Boolean);
        let companyMap = new Map();

        if (companyIds.length > 0) {
          const { data: companyData, error: companiesError } = await supabase
            .from("companies")
            .select("id, company_name")
            .in("id", companyIds);

          if (companiesError) {
            throw companiesError;
          }

          companyMap = new Map(
            (companyData || []).map((company) => [company.id, company])
          );
        }

        const { data: applicationData, error: applicationsError } =
          await supabase
            .from("applications")
            .select("drive_id, status")
            .eq("student_id", studentData.id);

        if (applicationsError) {
          throw applicationsError;
        }

        setStudent(studentData);
        setDrives(
          (driveData || []).map((drive) => ({
            ...drive,
            companies: companyMap.get(drive.company_id) || null,
          }))
        );
        setApplicationStatusByDriveId(
          Object.fromEntries(
            (applicationData || []).map((application) => [
              application.drive_id,
              application.status,
            ])
          )
        );
      } catch (requestError) {
        setError(requestError.message || "Unable to load placement drives.");
      } finally {
        setIsLoading(false);
      }
    };

    loadPlacementDrives();
  }, [user]);

  const handleApply = async (drive) => {
    if (!student) {
      setError("Please complete your student profile before applying.");
      return;
    }

    if (!isDeadlineOpen(drive.deadline)) {
      setError(getDeadlineClosedMessage(drive.deadline));
      return;
    }

    setError("");
    setSuccessMessage("");
    setApplyingDriveId(drive.id);

    try {
      const { data: existingApplication, error: existingApplicationError } =
        await supabase
          .from("applications")
          .select("id, status")
          .eq("student_id", student.id)
          .eq("drive_id", drive.id)
          .maybeSingle();

      if (existingApplicationError) {
        throw existingApplicationError;
      }

      if (existingApplication) {
        setApplicationStatusByDriveId((currentStatuses) => ({
          ...currentStatuses,
          [drive.id]: existingApplication.status,
        }));
        setSuccessMessage(
          existingApplication.status === APPLICATION_STATUS.WITHDRAWN
            ? "This application was withdrawn. Re-apply from My Applications while the deadline is open."
            : "You have already applied for this drive."
        );
        return;
      }

      const { error: insertError } = await supabase
        .from("applications")
        .insert({
          student_id: student.id,
          drive_id: drive.id,
          status: APPLICATION_STATUS.APPLIED,
        });

      if (insertError) {
        throw insertError;
      }

      setApplicationStatusByDriveId((currentStatuses) => ({
        ...currentStatuses,
        [drive.id]: APPLICATION_STATUS.APPLIED,
      }));
      setSuccessMessage("Application submitted successfully.");
    } catch (requestError) {
      if (isDuplicateApplicationError(requestError)) {
        const { data: existingApplication } = await supabase
          .from("applications")
          .select("status")
          .eq("student_id", student.id)
          .eq("drive_id", drive.id)
          .maybeSingle();
        const existingStatus =
          existingApplication?.status || APPLICATION_STATUS.APPLIED;

        setApplicationStatusByDriveId((currentStatuses) => ({
          ...currentStatuses,
          [drive.id]: existingStatus,
        }));
        setSuccessMessage(
          existingStatus === APPLICATION_STATUS.WITHDRAWN
            ? "This application was withdrawn. Re-apply from My Applications while the deadline is open."
            : "You have already applied for this drive."
        );
      } else {
        setError(
          getApplicationErrorMessage(
            requestError,
            "Unable to submit application."
          )
        );
      }
    } finally {
      setApplyingDriveId(null);
    }
  };

  if (isLoading) {
    return (
      <main style={styles.page}>
        <section style={styles.panel}>Loading placement drives...</section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.panel}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Placement Drives</p>
            <h1 style={styles.title}>Available opportunities</h1>
            <p style={styles.description}>
              Review eligible drives and apply when the role matches your goals.
            </p>
          </div>

          <div style={styles.headerActions}>
            <Link to={ROUTES.STUDENT_APPLICATIONS} style={styles.secondaryButton}>
              My Applications
            </Link>
            <Link to={ROUTES.STUDENT_DASHBOARD} style={styles.secondaryButton}>
              Dashboard
            </Link>
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {successMessage && <div style={styles.success}>{successMessage}</div>}

        {drives.length === 0 ? (
          <div style={styles.emptyState}>
            No placement drives are available right now.
          </div>
        ) : (
          <div style={styles.driveGrid}>
            {drives.map((drive) => {
              const isEligible = checkEligibility(student, drive);
              const applicationStatus =
                applicationStatusByDriveId[drive.id] || null;
              const deadlineOpen = isDeadlineOpen(drive.deadline);

              return (
                <article key={drive.id} style={styles.driveCard}>
                  <div style={styles.cardHeader}>
                    <div>
                      <h2 style={styles.companyName}>
                        {getCompanyName(drive)}
                      </h2>
                      <p style={styles.role}>{drive.role || "Role not set"}</p>
                    </div>

                    <span
                      style={
                        isEligible ? styles.eligibleBadge : styles.blockedBadge
                      }
                    >
                      {isEligible ? "Eligible" : "Not Eligible"}
                    </span>
                  </div>

                  <div style={styles.requirements}>
                    <InfoItem
                      label="Minimum CGPA"
                      value={drive.min_cgpa ?? "Not specified"}
                    />
                    <InfoItem
                      label="Allowed Branches"
                      value={formatAllowedBranches(drive.allowed_branches)}
                    />
                    <InfoItem
                      label="Application Deadline"
                      value={formatDeadline(drive.deadline)}
                    />
                  </div>

                  <div style={styles.footer}>
                    {applicationStatus ? (
                      <span
                        style={
                          applicationStatus === APPLICATION_STATUS.WITHDRAWN
                            ? styles.withdrawnText
                            : styles.appliedText
                        }
                      >
                        {applicationStatus === APPLICATION_STATUS.WITHDRAWN
                          ? "Withdrawn - re-apply from My Applications"
                          : applicationStatus}
                      </span>
                    ) : !deadlineOpen ? (
                      <span style={styles.notEligibleText}>
                        {getDeadlineClosedMessage(drive.deadline)}
                      </span>
                    ) : isEligible ? (
                      <button
                        type="button"
                        onClick={() => handleApply(drive)}
                        disabled={applyingDriveId === drive.id}
                        style={styles.button}
                      >
                        {applyingDriveId === drive.id
                          ? "Applying..."
                          : "Apply"}
                      </button>
                    ) : (
                      <span style={styles.notEligibleText}>
                        Update your profile if your details have changed.
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}

function checkEligibility(student, drive) {
  if (!student || !drive) {
    return false;
  }

  const criteria = parseDriveCriteria(drive);

  if (!criteria.isValid) {
    return false;
  }

  if (criteria.minimumCgpa !== null) {
    const studentCgpa = Number(student.cgpa);

    if (!Number.isFinite(studentCgpa) || studentCgpa < criteria.minimumCgpa) {
      return false;
    }
  }

  if (criteria.allowedBranches !== null) {
    const studentBranch = normalizeBranch(student.branch);

    if (!studentBranch || !criteria.allowedBranches.includes(studentBranch)) {
      return false;
    }
  }

  return true;
}

function parseDriveCriteria(drive) {
  let minimumCgpa = null;

  if (
    drive.min_cgpa !== null &&
    drive.min_cgpa !== undefined &&
    drive.min_cgpa !== ""
  ) {
    const parsedMinimumCgpa = Number(drive.min_cgpa);

    if (
      !Number.isFinite(parsedMinimumCgpa) ||
      parsedMinimumCgpa < 0 ||
      parsedMinimumCgpa > 10
    ) {
      return { isValid: false, minimumCgpa: null, allowedBranches: null };
    }

    minimumCgpa = parsedMinimumCgpa;
  }

  const branchCriteria = parseAllowedBranches(drive.allowed_branches);

  return {
    isValid: !branchCriteria.error,
    minimumCgpa,
    allowedBranches: branchCriteria.branches,
  };
}

function getCompanyName(drive) {
  return drive.companies?.company_name || "Company";
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "32px",
  },
  panel: {
    maxWidth: "1040px",
    margin: "0 auto",
    background: "#ffffff",
    border: "1px solid #dfe4ea",
    borderRadius: "8px",
    padding: "32px",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: "24px",
  },
  headerActions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#2563eb",
    fontWeight: 700,
    textTransform: "uppercase",
    fontSize: "13px",
  },
  title: {
    margin: "0 0 12px",
    color: "#111827",
    fontSize: "30px",
  },
  description: {
    margin: 0,
    color: "#4b5563",
    fontSize: "16px",
  },
  driveGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
  },
  driveCard: {
    display: "grid",
    gap: "18px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "20px",
    background: "#f9fafb",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
  },
  companyName: {
    margin: "0 0 6px",
    color: "#111827",
    fontSize: "20px",
  },
  role: {
    margin: 0,
    color: "#4b5563",
    fontSize: "15px",
  },
  eligibleBadge: {
    borderRadius: "999px",
    padding: "6px 10px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: "13px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  blockedBadge: {
    borderRadius: "999px",
    padding: "6px 10px",
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: "13px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  requirements: {
    display: "grid",
    gap: "10px",
  },
  infoItem: {
    display: "grid",
    gap: "4px",
  },
  infoLabel: {
    color: "#6b7280",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  infoValue: {
    color: "#111827",
    fontSize: "15px",
    lineHeight: 1.5,
  },
  footer: {
    minHeight: "42px",
    display: "flex",
    alignItems: "center",
  },
  button: {
    border: "0",
    borderRadius: "6px",
    padding: "11px 16px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    borderRadius: "6px",
    padding: "10px 14px",
    background: "#e0ecff",
    color: "#1d4ed8",
    fontSize: "14px",
    fontWeight: 700,
    textDecoration: "none",
  },
  appliedText: {
    borderRadius: "6px",
    padding: "10px 14px",
    background: "#ecfdf5",
    color: "#047857",
    fontSize: "15px",
    fontWeight: 700,
  },
  withdrawnText: {
    borderRadius: "6px",
    padding: "10px 14px",
    background: "#e5e7eb",
    color: "#374151",
    fontSize: "14px",
    fontWeight: 700,
  },
  notEligibleText: {
    color: "#6b7280",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  emptyState: {
    border: "1px dashed #cbd5e1",
    borderRadius: "8px",
    padding: "24px",
    color: "#4b5563",
    background: "#f8fafc",
    textAlign: "center",
  },
  error: {
    marginBottom: "16px",
    borderRadius: "6px",
    padding: "12px",
    background: "#fee2e2",
    color: "#991b1b",
  },
  success: {
    marginBottom: "16px",
    borderRadius: "6px",
    padding: "12px",
    background: "#dcfce7",
    color: "#166534",
  },
};

export default PlacementDrives;
