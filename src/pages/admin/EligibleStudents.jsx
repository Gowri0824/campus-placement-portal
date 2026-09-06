import { useEffect, useState } from "react";
import { ROLES } from "../../constants/roles";
import { createSignedResumeRecords } from "../../services/resumeStorage";
import { supabase } from "../../services/supabaseClient";
import {
  formatAllowedBranches,
  normalizeBranch,
  parseAllowedBranches,
} from "../../utils/branches";

function EligibleStudents() {
  const [drives, setDrives] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedDriveId, setSelectedDriveId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    fetchEligibilityData().then(({ data, error: requestError }) => {
      if (!isMounted) {
        return;
      }

      if (requestError) {
        setError(requestError.message || "Unable to load eligibility data.");
        setDrives([]);
        setStudents([]);
      } else {
        setDrives(data.drives);
        setStudents(data.students);
      }

      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedDrive =
    drives.find((drive) => drive.id === selectedDriveId) || null;
  const eligibility = selectedDrive
    ? getEligibleStudents(students, selectedDrive)
    : { students: [], warnings: [] };

  return (
    <section style={styles.panel}>
          <header style={styles.header}>
            <div>
              <p style={styles.eyebrow}>Admin</p>
              <h1 style={styles.title}>Eligible Students</h1>
              <p style={styles.description}>
                Select a placement drive to review students who meet its
                academic criteria.
              </p>
            </div>
          </header>

          {error && <div style={styles.error}>{error}</div>}

          <section style={styles.selectorSection}>
            <label style={styles.label}>
              Placement Drive
              <select
                value={selectedDriveId}
                onChange={(event) => setSelectedDriveId(event.target.value)}
                disabled={isLoading || drives.length === 0}
                style={styles.select}
              >
                <option value="">Select placement drive</option>
                {drives.map((drive) => (
                  <option key={drive.id} value={drive.id}>
                    {getDriveLabel(drive)}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {isLoading ? (
            <div style={styles.emptyState}>Loading eligibility data...</div>
          ) : drives.length === 0 ? (
            <div style={styles.emptyState}>
              No placement drives are available.
            </div>
          ) : !selectedDrive ? (
            <div style={styles.emptyState}>
              Select a placement drive to view eligible students.
            </div>
          ) : (
            <>
              <section style={styles.criteriaBand}>
                <div>
                  <span style={styles.criteriaLabel}>Company</span>
                  <strong style={styles.criteriaValue}>
                    {selectedDrive.company_name}
                  </strong>
                </div>
                <div>
                  <span style={styles.criteriaLabel}>Role</span>
                  <strong style={styles.criteriaValue}>
                    {selectedDrive.role || "Not specified"}
                  </strong>
                </div>
                <div>
                  <span style={styles.criteriaLabel}>Minimum CGPA</span>
                  <strong style={styles.criteriaValue}>
                    {selectedDrive.min_cgpa ?? "No restriction"}
                  </strong>
                </div>
                <div>
                  <span style={styles.criteriaLabel}>Allowed Branches</span>
                  <strong style={styles.criteriaValue}>
                    {formatAllowedBranches(selectedDrive.allowed_branches)}
                  </strong>
                </div>
                <div style={styles.countBlock}>
                  <span style={styles.criteriaLabel}>Eligible Students</span>
                  <strong style={styles.count}>{eligibility.students.length}</strong>
                </div>
              </section>

              {!selectedDrive.hasKnownCompany && (
                <div style={styles.warning}>
                  This drive references a company record that is not available.
                </div>
              )}

              {eligibility.warnings.map((warning) => (
                <div key={warning} style={styles.warning}>
                  {warning}
                </div>
              ))}

              {eligibility.students.length === 0 ? (
                <div style={styles.emptyState}>
                  No students meet this drive&apos;s eligibility criteria.
                </div>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.tableHead}>Student</th>
                        <th style={styles.tableHead}>Roll Number</th>
                        <th style={styles.tableHead}>Branch</th>
                        <th style={styles.tableHead}>CGPA</th>
                        <th style={styles.tableHead}>Graduation Year</th>
                        <th style={styles.tableHead}>Skills</th>
                        <th style={styles.tableHead}>Resume</th>
                      </tr>
                    </thead>

                    <tbody>
                      {eligibility.students.map((student) => (
                        <tr key={student.id}>
                          <td style={styles.tableCell}>
                            <strong>{student.full_name}</strong>
                            <span style={styles.mutedText}>
                              {student.email || "Email not available"}
                            </span>
                            {!student.hasProfile && (
                              <span style={styles.warningText}>
                                Profile record not found
                              </span>
                            )}
                            {student.hasProfile && !student.hasStudentRole && (
                              <span style={styles.warningText}>
                                Profile role is not student
                              </span>
                            )}
                          </td>
                          <td style={styles.tableCell}>
                            {student.roll_number || "Not available"}
                          </td>
                          <td style={styles.tableCell}>
                            {student.branch || "Not available"}
                          </td>
                          <td style={styles.tableCell}>
                            {student.cgpa ?? "Not available"}
                          </td>
                          <td style={styles.tableCell}>
                            {student.graduation_year ?? "Not available"}
                          </td>
                          <td style={styles.tableCell}>
                            {student.skills || "Not provided"}
                          </td>
                          <td style={styles.tableCell}>
                            {student.resume_url ? (
                              <a
                                href={student.resume_url}
                                target="_blank"
                                rel="noreferrer"
                                style={styles.link}
                              >
                                View Resume
                              </a>
                            ) : student.resume_path ? (
                              <span style={styles.warningText}>
                                Resume unavailable
                              </span>
                            ) : (
                              "Not uploaded"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
    </section>
  );
}

async function fetchEligibilityData() {
  const [drivesResult, companiesResult, studentsResult] = await Promise.all([
    supabase
      .from("placement_drives")
      .select(
        "id, company_id, role, min_cgpa, allowed_branches, package, deadline, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("companies")
      .select("id, company_name")
      .order("company_name", { ascending: true }),
    supabase
      .from("students")
      .select(
        "id, profile_id, roll_number, branch, cgpa, graduation_year, skills, resume_url, created_at"
      )
      .order("roll_number", { ascending: true }),
  ]);

  if (drivesResult.error) {
    return { data: null, error: drivesResult.error };
  }

  if (companiesResult.error) {
    return { data: null, error: companiesResult.error };
  }

  if (studentsResult.error) {
    return { data: null, error: studentsResult.error };
  }

  const students = studentsResult.data || [];
  const profileIds = [
    ...new Set(students.map((student) => student.profile_id).filter(Boolean)),
  ];
  const { data: profiles, error: profilesError } =
    await fetchProfilesByIds(profileIds);

  if (profilesError) {
    return { data: null, error: profilesError };
  }

  const companies = companiesResult.data || [];
  const companyNameById = new Map(
    companies.map((company) => [company.id, company.company_name])
  );
  const profileById = new Map(
    profiles.map((profile) => [profile.id, profile])
  );

  const mappedDrives = (drivesResult.data || []).map((drive) => ({
    ...drive,
    company_name:
      companyNameById.get(drive.company_id) || "Unknown company",
    hasKnownCompany: companyNameById.has(drive.company_id),
  }));
  const mappedStudents = students.map((student) => {
    const profile = profileById.get(student.profile_id) || null;

    return {
      ...student,
      full_name: profile?.full_name || "Name not available",
      email: profile?.email || "",
      hasProfile: Boolean(profile),
      hasStudentRole: profile?.role === ROLES.STUDENT,
    };
  });

  const { data: studentsWithSignedResumes, error: resumeError } =
    await createSignedResumeRecords(mappedStudents);

  if (resumeError) {
    return { data: null, error: resumeError };
  }

  return {
    data: { drives: mappedDrives, students: studentsWithSignedResumes },
    error: null,
  };
}

async function fetchProfilesByIds(profileIds) {
  if (profileIds.length === 0) {
    return { data: [], error: null };
  }

  const chunks = [];

  for (let index = 0; index < profileIds.length; index += 100) {
    chunks.push(profileIds.slice(index, index + 100));
  }

  const results = await Promise.all(
    chunks.map((profileIdChunk) =>
      supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("id", profileIdChunk)
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

function getEligibleStudents(students, drive) {
  const parsedCriteria = parseDriveCriteria(drive);

  if (!parsedCriteria.isValid) {
    return { students: [], warnings: parsedCriteria.warnings };
  }

  const eligibleStudents = students.filter((student) => {
    if (parsedCriteria.minimumCgpa !== null) {
      const studentCgpa = parseStudentCgpa(student.cgpa);

      if (
        studentCgpa === null ||
        studentCgpa < parsedCriteria.minimumCgpa
      ) {
        return false;
      }
    }

    if (parsedCriteria.allowedBranches !== null) {
      const studentBranch = normalizeBranch(student.branch);

      if (
        !studentBranch ||
        !parsedCriteria.allowedBranches.includes(studentBranch)
      ) {
        return false;
      }
    }

    return true;
  });

  return { students: eligibleStudents, warnings: parsedCriteria.warnings };
}

function parseDriveCriteria(drive) {
  const warnings = [];
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
      warnings.push(
        "This drive has an invalid minimum CGPA. Eligibility is withheld until the criterion is corrected."
      );
    } else {
      minimumCgpa = parsedMinimumCgpa;
    }
  }

  const branchCriteria = parseAllowedBranches(drive.allowed_branches);

  if (branchCriteria.error) {
    warnings.push(
      "This drive has malformed allowed branches. Eligibility is withheld until the criterion is corrected."
    );
  }

  return {
    minimumCgpa,
    allowedBranches: branchCriteria.branches,
    isValid: warnings.length === 0,
    warnings,
  };
}

function parseStudentCgpa(cgpa) {
  if (cgpa === null || cgpa === undefined || cgpa === "") {
    return null;
  }

  const parsedCgpa = Number(cgpa);

  if (!Number.isFinite(parsedCgpa) || parsedCgpa < 0 || parsedCgpa > 10) {
    return null;
  }

  return parsedCgpa;
}

function getDriveLabel(drive) {
  return `${drive.company_name} - ${drive.role || "Role not specified"}`;
}

const styles = {
  panel: {
    maxWidth: "1180px",
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
  selectorSection: {
    maxWidth: "620px",
    marginBottom: "24px",
  },
  label: {
    display: "grid",
    gap: "8px",
    color: "#1f2937",
    fontWeight: 600,
  },
  select: {
    width: "100%",
    minHeight: "46px",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    padding: "10px 12px",
    background: "#ffffff",
    color: "#111827",
    fontSize: "15px",
  },
  criteriaBand: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "16px",
    alignItems: "start",
    marginBottom: "20px",
    borderTop: "1px solid #e5e7eb",
    borderBottom: "1px solid #e5e7eb",
    padding: "18px 0",
  },
  criteriaLabel: {
    display: "block",
    marginBottom: "6px",
    color: "#6b7280",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  criteriaValue: {
    display: "block",
    color: "#111827",
    fontSize: "15px",
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  countBlock: {
    borderLeft: "3px solid #2563eb",
    paddingLeft: "14px",
  },
  count: {
    display: "block",
    color: "#1d4ed8",
    fontSize: "28px",
    lineHeight: 1,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  table: {
    width: "100%",
    minWidth: "1050px",
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
  link: {
    color: "#1d4ed8",
    fontWeight: 600,
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
  warning: {
    marginBottom: "16px",
    borderRadius: "6px",
    padding: "12px",
    background: "#fef3c7",
    color: "#92400e",
  },
};

export default EligibleStudents;
