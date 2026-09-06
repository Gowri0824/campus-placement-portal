import { Fragment } from "react";
import StudentDetails from "./StudentDetails";

function StudentsTable({
  students,
  filteredStudents,
  isLoading,
  expandedStudentId,
  resumeAccessUrls,
  openingResumeStudentId,
  onToggleDetails,
  onOpenResume,
}) {
  if (isLoading) {
    return <div style={styles.emptyState}>Loading student records...</div>;
  }

  if (students.length === 0) {
    return <div style={styles.emptyState}>No student records are available.</div>;
  }

  if (filteredStudents.length === 0) {
    return (
      <div style={styles.emptyState}>
        No students match the current search and filters.
      </div>
    );
  }

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.tableHead}>Student</th>
            <th style={styles.tableHead}>Roll Number</th>
            <th style={styles.tableHead}>Branch</th>
            <th style={styles.tableHead}>CGPA</th>
            <th style={styles.tableHead}>Graduation Year</th>
            <th style={styles.tableHead}>Resume</th>
            <th style={styles.tableHead}>Details</th>
          </tr>
        </thead>

        <tbody>
          {filteredStudents.map((student) => {
            const isExpanded = expandedStudentId === student.id;
            const resumeAccessUrl = resumeAccessUrls[student.id] || "";
            const isOpeningResume = openingResumeStudentId === student.id;

            return (
              <Fragment key={student.id}>
                <tr>
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
                    {resumeAccessUrl ? (
                      <a
                        href={resumeAccessUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.link}
                      >
                        View Resume
                      </a>
                    ) : student.resume_path ? (
                      <button
                        type="button"
                        onClick={() => onOpenResume(student)}
                        disabled={isOpeningResume}
                        style={styles.linkButton}
                      >
                        {isOpeningResume ? "Opening..." : "View Resume"}
                      </button>
                    ) : student.resume_url ? (
                      <span style={styles.warningText}>Invalid resume link</span>
                    ) : (
                      "Not uploaded"
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    <button
                      type="button"
                      onClick={() => onToggleDetails(student.id)}
                      style={styles.smallButton}
                    >
                      {isExpanded ? "Hide" : "View"}
                    </button>
                  </td>
                </tr>

                {isExpanded && <StudentDetails student={student} />}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  table: {
    width: "100%",
    minWidth: "1000px",
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
  linkButton: {
    border: 0,
    padding: 0,
    background: "transparent",
    color: "#1d4ed8",
    font: "inherit",
    fontWeight: 600,
    textDecoration: "underline",
    cursor: "pointer",
  },
  smallButton: {
    minWidth: "64px",
    border: "0",
    borderRadius: "6px",
    padding: "9px 12px",
    background: "#e0ecff",
    color: "#1d4ed8",
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
};

export default StudentsTable;
