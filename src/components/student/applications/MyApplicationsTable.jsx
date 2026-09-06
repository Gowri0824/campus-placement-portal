import { formatDate, formatDeadline } from "../../../utils/dates";
import ApplicationAction from "./ApplicationAction";
import ApplicationStatusBadge from "./ApplicationStatusBadge";
import { styles } from "./applicationStyles";

export default function MyApplicationsTable({
  applications, withdrawingApplicationId, reapplyingApplicationId,
  handleWithdrawal, handleReapply,
}) {
  return (
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
                {application.placement_drives?.companies?.company_name || "Company"}
              </td>
              <td style={styles.tableCell}>
                {application.placement_drives?.role || "Role not set"}
              </td>
              <td style={styles.tableCell}>
                <ApplicationStatusBadge status={application.status} />
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
                <ApplicationAction
                  application={application}
                  withdrawingApplicationId={withdrawingApplicationId}
                  reapplyingApplicationId={reapplyingApplicationId}
                  handleWithdrawal={handleWithdrawal}
                  handleReapply={handleReapply}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
