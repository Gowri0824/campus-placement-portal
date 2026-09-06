import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { APPLICATION_STATUS } from "../../constants/applicationStatuses";
import { ROUTES } from "../../constants/routes";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../services/supabaseClient";
import { getApplicationErrorMessage } from "../../utils/applicationErrors";
import { getApplicationStatusCategory } from "../../utils/applicationStatus";
import {
  formatDate,
  formatDeadline,
  getDeadlineClosedMessage,
  isDeadlineOpen,
} from "../../utils/dates";

function MyApplications() {
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [withdrawingApplicationId, setWithdrawingApplicationId] =
    useState(null);
  const [reapplyingApplicationId, setReapplyingApplicationId] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    const loadApplications = async () => {
      if (!user) {
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const { data: studentData, error: studentError } = await supabase
          .from("students")
          .select("id")
          .eq("profile_id", user.id)
          .single();

        if (studentError) {
          throw studentError;
        }

        const { data: applicationData, error: applicationsError } =
          await supabase
            .from("applications")
            .select("id, status, applied_at, drive_id")
            .eq("student_id", studentData.id)
            .order("applied_at", { ascending: false });

        if (applicationsError) {
          throw applicationsError;
        }

        const driveIds = [
          ...new Set(
            (applicationData || []).map((application) => application.drive_id)
          ),
        ].filter(Boolean);
        let driveMap = new Map();
        let companyMap = new Map();

        if (driveIds.length > 0) {
          const { data: driveData, error: drivesError } = await supabase
            .from("placement_drives")
            .select("id, role, company_id, deadline")
            .in("id", driveIds);

          if (drivesError) {
            throw drivesError;
          }

          driveMap = new Map((driveData || []).map((drive) => [drive.id, drive]));

          const companyIds = [
            ...new Set((driveData || []).map((drive) => drive.company_id)),
          ].filter(Boolean);

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
        }

        setApplications(
          (applicationData || []).map((application) => {
            const drive = driveMap.get(application.drive_id);

            return {
              ...application,
              placement_drives: drive
                ? {
                    ...drive,
                    companies: companyMap.get(drive.company_id) || null,
                  }
                : null,
            };
          })
        );
      } catch (requestError) {
        setError(requestError.message || "Unable to load your applications.");
      } finally {
        setIsLoading(false);
      }
    };

    loadApplications();
  }, [user]);

  const handleWithdrawal = async (application) => {
    if (application.status !== APPLICATION_STATUS.APPLIED) {
      setError("Only applications with Applied status can be withdrawn.");
      return;
    }

    const shouldWithdraw = window.confirm(
      "Withdraw this application? You may re-apply while the drive deadline remains open."
    );

    if (!shouldWithdraw) {
      return;
    }

    setError("");
    setSuccessMessage("");
    setWithdrawingApplicationId(application.id);

    const { data: withdrawnApplication, error: withdrawalError } =
      await supabase
        .from("applications")
        .update({ status: APPLICATION_STATUS.WITHDRAWN })
        .eq("id", application.id)
        .eq("status", APPLICATION_STATUS.APPLIED)
        .select("id, status")
        .maybeSingle();

    if (withdrawalError) {
      setError(
        getApplicationErrorMessage(
          withdrawalError,
          "Unable to withdraw application."
        )
      );
    } else if (!withdrawnApplication) {
      setError(
        "The application was not withdrawn. Its status may have already changed."
      );
    } else {
      setApplications((currentApplications) =>
        currentApplications.map((currentApplication) =>
          currentApplication.id === withdrawnApplication.id
            ? {
                ...currentApplication,
                status: withdrawnApplication.status,
              }
            : currentApplication
        )
      );
      setSuccessMessage("Application withdrawn successfully.");
    }

    setWithdrawingApplicationId(null);
  };

  const handleReapply = async (application) => {
    if (application.status !== APPLICATION_STATUS.WITHDRAWN) {
      setError("Only withdrawn applications can be re-applied.");
      return;
    }

    const deadline = application.placement_drives?.deadline;

    if (!isDeadlineOpen(deadline)) {
      setError(getDeadlineClosedMessage(deadline));
      return;
    }

    const shouldReapply = window.confirm(
      "Re-apply to this placement drive using your current profile details?"
    );

    if (!shouldReapply) {
      return;
    }

    setError("");
    setSuccessMessage("");
    setReapplyingApplicationId(application.id);

    const { data: reactivatedApplication, error: reapplyError } =
      await supabase
        .from("applications")
        .update({ status: APPLICATION_STATUS.APPLIED })
        .eq("id", application.id)
        .eq("status", APPLICATION_STATUS.WITHDRAWN)
        .select("id, status")
        .maybeSingle();

    if (reapplyError) {
      setError(
        getApplicationErrorMessage(
          reapplyError,
          "Unable to re-apply to this placement drive."
        )
      );
    } else if (!reactivatedApplication) {
      setError(
        "The application was not re-applied. Its status may have already changed."
      );
    } else {
      setApplications((currentApplications) =>
        currentApplications.map((currentApplication) =>
          currentApplication.id === reactivatedApplication.id
            ? {
                ...currentApplication,
                status: reactivatedApplication.status,
              }
            : currentApplication
        )
      );
      setSuccessMessage("Application submitted again successfully.");
    }

    setReapplyingApplicationId(null);
  };

  if (isLoading) {
    return (
      <main style={styles.page}>
        <section style={styles.panel}>Loading applications...</section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.panel}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>My Applications</p>
            <h1 style={styles.title}>Track your applied drives</h1>
            <p style={styles.description}>
              See the placement drives you have applied to and their current
              status.
            </p>
          </div>

          <div style={styles.headerActions}>
            <Link to={ROUTES.STUDENT_DRIVES} style={styles.secondaryButton}>
              View Drives
            </Link>
            <Link to={ROUTES.STUDENT_DASHBOARD} style={styles.secondaryButton}>
              Dashboard
            </Link>
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {successMessage && <div style={styles.success}>{successMessage}</div>}

        {applications.length === 0 ? (
          <div style={styles.emptyState}>
            You have not applied to any placement drives yet.
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHead}>Company</th>
                  <th style={styles.tableHead}>Role</th>
                  <th style={styles.tableHead}>Status</th>
                  <th style={styles.tableHead}>Applied Date</th>
                  <th style={styles.tableHead}>Deadline</th>
                  <th style={styles.tableHead}>Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id}>
                    <td style={styles.tableCell}>
                      {getCompanyName(application)}
                    </td>
                    <td style={styles.tableCell}>
                      {application.placement_drives?.role || "Role not set"}
                    </td>
                    <td style={styles.tableCell}>
                      <span style={getStatusBadgeStyle(application.status)}>
                        {application.status || APPLICATION_STATUS.APPLIED}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      {formatDate(application.applied_at)}
                    </td>
                    <td style={styles.tableCell}>
                      {formatDeadline(
                        application.placement_drives?.deadline
                      )}
                    </td>
                    <td style={styles.tableCell}>
                      {application.status === APPLICATION_STATUS.APPLIED ? (
                        <button
                          type="button"
                          onClick={() => handleWithdrawal(application)}
                          disabled={
                            withdrawingApplicationId === application.id
                          }
                          style={styles.withdrawButton}
                        >
                          {withdrawingApplicationId === application.id
                            ? "Withdrawing..."
                            : "Withdraw Application"}
                        </button>
                      ) : application.status === APPLICATION_STATUS.WITHDRAWN &&
                        isDeadlineOpen(
                          application.placement_drives?.deadline
                        ) ? (
                        <button
                          type="button"
                          onClick={() => handleReapply(application)}
                          disabled={
                            reapplyingApplicationId === application.id
                          }
                          style={styles.reapplyButton}
                        >
                          {reapplyingApplicationId === application.id
                            ? "Re-applying..."
                            : "Re-apply"}
                        </button>
                      ) : application.status === APPLICATION_STATUS.WITHDRAWN ? (
                        <span style={styles.deadlineClosedText}>
                          {getDeadlineClosedMessage(
                            application.placement_drives?.deadline
                          )}
                        </span>
                      ) : (
                        <span style={styles.unavailableText}>Not available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function getCompanyName(application) {
  return application.placement_drives?.companies?.company_name || "Company";
}

function getStatusBadgeStyle(status) {
  const category = getApplicationStatusCategory(status);

  if (category === "selected") {
    return { ...styles.statusBadge, ...styles.selectedBadge };
  }

  if (category === "rejected") {
    return { ...styles.statusBadge, ...styles.rejectedBadge };
  }

  if (category === "withdrawn") {
    return { ...styles.statusBadge, ...styles.withdrawnBadge };
  }

  return { ...styles.statusBadge, ...styles.appliedBadge };
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "32px",
  },
  panel: {
    maxWidth: "1000px",
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
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  table: {
    width: "100%",
    minWidth: "1040px",
    borderCollapse: "collapse",
    background: "#ffffff",
  },
  tableHead: {
    padding: "14px 16px",
    background: "#f8fafc",
    borderBottom: "1px solid #e5e7eb",
    color: "#374151",
    fontSize: "13px",
    textAlign: "left",
    textTransform: "uppercase",
  },
  tableCell: {
    padding: "16px",
    borderBottom: "1px solid #eef2f7",
    color: "#111827",
    fontSize: "15px",
  },
  statusBadge: {
    display: "inline-block",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "13px",
    fontWeight: 700,
  },
  appliedBadge: {
    background: "#e0ecff",
    color: "#1d4ed8",
  },
  selectedBadge: {
    background: "#dcfce7",
    color: "#166534",
  },
  rejectedBadge: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  withdrawnBadge: {
    background: "#e5e7eb",
    color: "#374151",
  },
  withdrawButton: {
    minHeight: "40px",
    border: "1px solid #dc2626",
    borderRadius: "6px",
    padding: "9px 12px",
    background: "#ffffff",
    color: "#b91c1c",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  reapplyButton: {
    minHeight: "40px",
    border: 0,
    borderRadius: "6px",
    padding: "9px 12px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  deadlineClosedText: {
    color: "#b45309",
    fontSize: "14px",
    fontWeight: 600,
  },
  unavailableText: {
    color: "#6b7280",
    fontSize: "14px",
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

export default MyApplications;
