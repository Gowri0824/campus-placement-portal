import { formatDate } from "../../../utils/dates";

function StudentDetails({ student }) {
  return (
    <tr>
      <td colSpan={7} style={styles.detailCell}>
        <div style={styles.detailGrid}>
          <DetailItem label="Full Name" value={student.full_name} />
          <DetailItem label="Email" value={student.email} />
          <DetailItem label="Roll Number" value={student.roll_number} />
          <DetailItem label="Branch" value={student.branch} />
          <DetailItem label="CGPA" value={student.cgpa} />
          <DetailItem label="Graduation Year" value={student.graduation_year} />
          <DetailItem label="Skills" value={student.skills} />
          <DetailItem label="Profile Role" value={student.profile_role} />
          <DetailItem
            label="Student Record Created"
            value={formatDate(student.created_at)}
          />
          <DetailItem
            label="Profile Created"
            value={formatDate(student.profile_created_at)}
          />
        </div>
      </td>
    </tr>
  );
}

function DetailItem({ label, value }) {
  return (
    <div style={styles.detailItem}>
      <span style={styles.detailLabel}>{label}</span>
      <span style={styles.detailValue}>
        {value === null || value === undefined || value === ""
          ? "Not available"
          : value}
      </span>
    </div>
  );
}

const styles = {
  detailCell: {
    padding: "18px",
    borderBottom: "1px solid #dfe4ea",
    background: "#f8fafc",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
  },
  detailItem: {
    minWidth: 0,
  },
  detailLabel: {
    display: "block",
    marginBottom: "5px",
    color: "#6b7280",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  detailValue: {
    display: "block",
    color: "#111827",
    fontSize: "15px",
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },
};

export default StudentDetails;
