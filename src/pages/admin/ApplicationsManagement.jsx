import { useEffect, useState } from "react";
import {
  APPLICATION_STATUS,
  APPLICATION_STATUS_OPTIONS,
  APPLICATION_STATUS_VALUES,
} from "../../constants/applicationStatuses";
import { supabase } from "../../services/supabaseClient";
import {
  getApplicationCounts,
  getApplicationStatusCategory as getStatusCategory,
} from "../../utils/applicationStatus";
import { formatDate } from "../../utils/dates";

const statusOptions = APPLICATION_STATUS_OPTIONS;
const supportedStatusValues = APPLICATION_STATUS_VALUES;

function ApplicationsManagement() {
  const [applications, setApplications] = useState([]);
  const [statusSelections, setStatusSelections] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingApplicationId, setUpdatingApplicationId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    fetchApplicationsData().then(({ data, error: requestError }) => {
      if (!isMounted) {
        return;
      }

      if (requestError) {
        setError(requestError.message || "Unable to load applications.");
        setApplications([]);
        setStatusSelections({});
      } else {
        setApplications(data);
        setStatusSelections(createStatusSelections(data));
      }

      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const counts = getApplicationCounts(applications);
  const referenceWarnings = getReferenceWarnings(applications);
  const filteredApplications = applications.filter((application) => {
    if (statusFilter === "all") {
      return true;
    }

    return getStatusCategory(application.status) === statusFilter;
  });

  function handleStatusSelection(applicationId, status) {
    setStatusSelections((currentSelections) => ({
      ...currentSelections,
      [applicationId]: status,
    }));
  }

  async function handleStatusUpdate(application) {
    const nextStatus = statusSelections[application.id];

    setError("");
    setSuccessMessage("");

    if (!nextStatus) {
      setError("Select an application status.");
      return;
    }

    if (nextStatus === application.status) {
      setSuccessMessage("The application already has that status.");
      return;
    }

    if (!supportedStatusValues.includes(nextStatus)) {
      setError("Select one of the supported application statuses.");
      return;
    }

    setUpdatingApplicationId(application.id);

    const { data: updatedApplication, error: updateError } = await supabase
      .from("applications")
      .update({ status: nextStatus })
      .eq("id", application.id)
      .select("id, status")
      .maybeSingle();

    if (updateError) {
      setError(updateError.message || "Unable to update application status.");
    } else if (!updatedApplication) {
      setError(
        "The application was not updated. Check the admin update policy in Supabase."
      );
    } else {
      setApplications((currentApplications) =>
        currentApplications.map((currentApplication) =>
          currentApplication.id === application.id
            ? { ...currentApplication, status: updatedApplication.status }
            : currentApplication
        )
      );
      setStatusSelections((currentSelections) => ({
        ...currentSelections,
        [application.id]: updatedApplication.status,
      }));
      setSuccessMessage("Application status updated successfully.");
    }

    setUpdatingApplicationId(null);
  }

  return (
    <section style={styles.panel}>
          <header style={styles.header}>
            <div>
              <p style={styles.eyebrow}>Admin</p>
              <h1 style={styles.title}>Applications Management</h1>
              <p style={styles.description}>
                Review student applications and maintain selection outcomes.
              </p>
            </div>
          </header>

          {error && <div style={styles.error}>{error}</div>}
          {successMessage && <div style={styles.success}>{successMessage}</div>}

          <section style={styles.summaryBand}>
            <StatusSummary label="All Applications" value={counts.total} />
            <StatusSummary label="Pending" value={counts.pending} />
            <StatusSummary label="Selected" value={counts.selected} />
            <StatusSummary label="Rejected" value={counts.rejected} />
            <StatusSummary label="Withdrawn" value={counts.withdrawn} />
          </section>

          <div style={styles.filterRow}>
            <label style={styles.label}>
              Filter by Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                style={styles.filterSelect}
              >
                <option value="all">All applications</option>
                <option value="pending">Pending</option>
                <option value="selected">Selected</option>
                <option value="rejected">Rejected</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </label>
          </div>

          {referenceWarnings.map((warning) => (
            <div key={warning} style={styles.warning}>
              {warning}
            </div>
          ))}

          {isLoading ? (
            <div style={styles.emptyState}>Loading applications...</div>
          ) : applications.length === 0 ? (
            <div style={styles.emptyState}>
              No student applications are available.
            </div>
          ) : filteredApplications.length === 0 ? (
            <div style={styles.emptyState}>
              No applications match the selected status.
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.tableHead}>Student</th>
                    <th style={styles.tableHead}>Roll Number</th>
                    <th style={styles.tableHead}>Branch</th>
                    <th style={styles.tableHead}>Placement Drive</th>
                    <th style={styles.tableHead}>Applied Date</th>
                    <th style={styles.tableHead}>Current Status</th>
                    <th style={styles.tableHead}>Update Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredApplications.map((application) => (
                    <tr key={application.id}>
                      <td style={styles.tableCell}>
                        <strong>{application.student_name}</strong>
                        <span style={styles.mutedText}>
                          {application.email || "Email not available"}
                        </span>
                        {!application.hasStudent && (
                          <span style={styles.warningText}>
                            Student record not found
                          </span>
                        )}
                        {application.hasStudent && !application.hasProfile && (
                          <span style={styles.warningText}>
                            Profile record not found
                          </span>
                        )}
                      </td>
                      <td style={styles.tableCell}>
                        {application.roll_number || "Not available"}
                      </td>
                      <td style={styles.tableCell}>
                        {application.branch || "Not available"}
                      </td>
                      <td style={styles.tableCell}>
                        <strong>{application.company_name}</strong>
                        <span style={styles.mutedText}>
                          {application.role || "Role not available"}
                        </span>
                        {!application.hasDrive && (
                          <span style={styles.warningText}>
                            Placement drive not found
                          </span>
                        )}
                        {application.hasDrive && !application.hasCompany && (
                          <span style={styles.warningText}>
                            Company record not found
                          </span>
                        )}
                      </td>
                      <td style={styles.tableCell}>
                        {formatDate(application.applied_at)}
                      </td>
                      <td style={styles.tableCell}>
                        <span style={getStatusBadgeStyle(application.status)}>
                          {application.status || "Not set"}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        <div style={styles.updateControls}>
                          <select
                            value={statusSelections[application.id] || ""}
                            onChange={(event) =>
                              handleStatusSelection(
                                application.id,
                                event.target.value
                              )
                            }
                            disabled={updatingApplicationId === application.id}
                            style={styles.statusSelect}
                          >
                            {getStatusOptions(application.status).map(
                              (option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              )
                            )}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleStatusUpdate(application)}
                            disabled={updatingApplicationId === application.id}
                            style={styles.button}
                          >
                            {updatingApplicationId === application.id
                              ? "Updating..."
                              : "Update"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </section>
  );
}

function StatusSummary({ label, value }) {
  return (
    <div style={styles.summaryItem}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

async function fetchApplicationsData() {
  const { data: applicationData, error: applicationsError } =
    await fetchAllApplications();

  if (applicationsError) {
    return { data: null, error: applicationsError };
  }

  const applications = applicationData || [];
  const studentIds = uniqueIds(
    applications.map((application) => application.student_id)
  );
  const driveIds = uniqueIds(
    applications.map((application) => application.drive_id)
  );
  const [studentsResult, drivesResult] = await Promise.all([
    fetchRowsByIds(
      "students",
      "id, profile_id, roll_number, branch",
      studentIds
    ),
    fetchRowsByIds(
      "placement_drives",
      "id, company_id, role",
      driveIds
    ),
  ]);

  if (studentsResult.error) {
    return { data: null, error: studentsResult.error };
  }

  if (drivesResult.error) {
    return { data: null, error: drivesResult.error };
  }

  const students = studentsResult.data;
  const drives = drivesResult.data;
  const profileIds = uniqueIds(students.map((student) => student.profile_id));
  const companyIds = uniqueIds(drives.map((drive) => drive.company_id));
  const [profilesResult, companiesResult] = await Promise.all([
    fetchRowsByIds("profiles", "id, full_name, email", profileIds),
    fetchRowsByIds("companies", "id, company_name", companyIds),
  ]);

  if (profilesResult.error) {
    return { data: null, error: profilesResult.error };
  }

  if (companiesResult.error) {
    return { data: null, error: companiesResult.error };
  }

  const studentById = new Map(students.map((student) => [student.id, student]));
  const profileById = new Map(
    profilesResult.data.map((profile) => [profile.id, profile])
  );
  const driveById = new Map(drives.map((drive) => [drive.id, drive]));
  const companyById = new Map(
    companiesResult.data.map((company) => [company.id, company])
  );

  const mappedApplications = applications.map((application) => {
    const student = studentById.get(application.student_id) || null;
    const profile = student
      ? profileById.get(student.profile_id) || null
      : null;
    const drive = driveById.get(application.drive_id) || null;
    const company = drive
      ? companyById.get(drive.company_id) || null
      : null;

    return {
      ...application,
      student_name: profile?.full_name || "Name not available",
      email: profile?.email || "",
      roll_number: student?.roll_number || "",
      branch: student?.branch || "",
      company_name: company?.company_name || "Company not available",
      role: drive?.role || "",
      hasStudent: Boolean(student),
      hasProfile: Boolean(profile),
      hasDrive: Boolean(drive),
      hasCompany: Boolean(company),
    };
  });

  return { data: mappedApplications, error: null };
}

async function fetchAllApplications() {
  const pageSize = 1000;
  const applications = [];
  let pageStart = 0;

  while (true) {
    const { data, error } = await supabase
      .from("applications")
      .select("id, student_id, drive_id, status, applied_at")
      .order("applied_at", { ascending: false })
      .range(pageStart, pageStart + pageSize - 1);

    if (error) {
      return { data: null, error };
    }

    const page = data || [];
    applications.push(...page);

    if (page.length < pageSize) {
      break;
    }

    pageStart += pageSize;
  }

  return { data: applications, error: null };
}

async function fetchRowsByIds(table, columns, ids) {
  if (ids.length === 0) {
    return { data: [], error: null };
  }

  const chunks = [];

  for (let index = 0; index < ids.length; index += 100) {
    chunks.push(ids.slice(index, index + 100));
  }

  const results = await Promise.all(
    chunks.map((idChunk) =>
      supabase.from(table).select(columns).in("id", idChunk)
    )
  );
  const failedResult = results.find((result) => result.error);

  if (failedResult) {
    return { data: null, error: failedResult.error };
  }

  return {
    data: results.flatMap((result) => result.data || []),
    error: null,
  };
}

function uniqueIds(ids) {
  return [...new Set(ids.filter(Boolean))];
}

function createStatusSelections(applications) {
  return Object.fromEntries(
    applications.map((application) => [
      application.id,
      application.status || APPLICATION_STATUS.APPLIED,
    ])
  );
}

function getStatusOptions(currentStatus) {
  if (!currentStatus || supportedStatusValues.includes(currentStatus)) {
    return statusOptions;
  }

  return [
    { value: currentStatus, label: `${currentStatus} (Current)` },
    ...statusOptions,
  ];
}

function getReferenceWarnings(applications) {
  const missingStudents = applications.filter(
    (application) => !application.hasStudent
  ).length;
  const missingProfiles = applications.filter(
    (application) => application.hasStudent && !application.hasProfile
  ).length;
  const missingDrives = applications.filter(
    (application) => !application.hasDrive
  ).length;
  const missingCompanies = applications.filter(
    (application) => application.hasDrive && !application.hasCompany
  ).length;
  const warnings = [];

  if (missingStudents > 0) {
    warnings.push(
      `${missingStudents} application(s) reference missing student records.`
    );
  }

  if (missingProfiles > 0) {
    warnings.push(
      `${missingProfiles} application(s) reference missing profile records.`
    );
  }

  if (missingDrives > 0) {
    warnings.push(
      `${missingDrives} application(s) reference missing placement drives.`
    );
  }

  if (missingCompanies > 0) {
    warnings.push(
      `${missingCompanies} application(s) reference missing company records.`
    );
  }

  return warnings;
}

function getStatusBadgeStyle(status) {
  const category = getStatusCategory(status);

  if (category === "selected") {
    return { ...styles.statusBadge, ...styles.selectedBadge };
  }

  if (category === "rejected") {
    return { ...styles.statusBadge, ...styles.rejectedBadge };
  }

  if (category === "withdrawn") {
    return { ...styles.statusBadge, ...styles.withdrawnBadge };
  }

  return { ...styles.statusBadge, ...styles.pendingBadge };
}

const styles = {
  panel: {
    maxWidth: "1220px",
    margin: "0 auto",
    background: "#ffffff",
    border: "1px solid #dfe4ea",
    borderRadius: "8px",
    padding: "32px",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
  },
  header: {
    marginBottom: "24px",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#2563eb",
    fontSize: "13px",
    fontWeight: 700,
    textTransform: "uppercase",
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
  summaryBand: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "16px",
    marginBottom: "22px",
    borderTop: "1px solid #e5e7eb",
    borderBottom: "1px solid #e5e7eb",
    padding: "18px 0",
  },
  summaryItem: {
    borderLeft: "3px solid #2563eb",
    paddingLeft: "14px",
  },
  summaryLabel: {
    display: "block",
    marginBottom: "6px",
    color: "#6b7280",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  summaryValue: {
    color: "#111827",
    fontSize: "26px",
    lineHeight: 1,
  },
  filterRow: {
    maxWidth: "320px",
    marginBottom: "20px",
  },
  label: {
    display: "grid",
    gap: "8px",
    color: "#1f2937",
    fontWeight: 600,
  },
  filterSelect: {
    width: "100%",
    minHeight: "44px",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    padding: "10px 12px",
    background: "#ffffff",
    color: "#111827",
    fontSize: "15px",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  table: {
    width: "100%",
    minWidth: "1180px",
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
    lineHeight: 1.5,
    verticalAlign: "top",
  },
  mutedText: {
    display: "block",
    marginTop: "5px",
    color: "#6b7280",
    fontSize: "14px",
  },
  warningText: {
    display: "block",
    marginTop: "5px",
    color: "#b45309",
    fontSize: "13px",
    fontWeight: 600,
  },
  statusBadge: {
    display: "inline-block",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "13px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  pendingBadge: {
    background: "#fef3c7",
    color: "#92400e",
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
  updateControls: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  statusSelect: {
    minWidth: "150px",
    minHeight: "40px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    padding: "8px 10px",
    background: "#ffffff",
    color: "#111827",
    fontSize: "14px",
  },
  button: {
    minHeight: "40px",
    border: "0",
    borderRadius: "6px",
    padding: "9px 12px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
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
  warning: {
    marginBottom: "16px",
    borderRadius: "6px",
    padding: "12px",
    background: "#fef3c7",
    color: "#92400e",
  },
};

export default ApplicationsManagement;
