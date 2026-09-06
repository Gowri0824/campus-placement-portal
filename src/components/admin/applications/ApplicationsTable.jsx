import { formatDate } from "../../../utils/dates";
import { styles, getStatusBadgeStyle } from "./applicationStyles";
import ApplicationStatusControl from "./ApplicationStatusControl";

export default function ApplicationsTable({
  applications, statusSelections, updatingApplicationId, onSelect, onUpdate,
}) {
  return (
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
          {applications.map((application) => (
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
                <ApplicationStatusControl
                  application={application}
                  selectedStatus={statusSelections[application.id]}
                  isUpdating={updatingApplicationId === application.id}
                  onSelect={onSelect}
                  onUpdate={onUpdate}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
