import { styles } from "./eligibilityStyles";

export default function EligibleStudentsTable({ students, resumeAccessUrls, openingResumeStudentId, onOpenResume }) {
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
            <th style={styles.tableHead}>Skills</th>
            <th style={styles.tableHead}>Resume</th>
          </tr>
        </thead>

        <tbody>
          {students.map((student) => (
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
                {student.resume_path ? (
                  <a
                    href={resumeAccessUrls[student.id] || "#"}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.link}
                    onClick={(event) => onOpenResume(student, event)}
                    aria-disabled={openingResumeStudentId !== null}
                  >
                    {openingResumeStudentId === student.id ? "Opening..." : "View Resume"}
                  </a>
                ) : (
                  "Not uploaded"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
