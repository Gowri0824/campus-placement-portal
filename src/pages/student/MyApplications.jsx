import { Link } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import StatusMessage from "../../components/common/StatusMessage";
import { useStudentApplications } from "../../hooks/useStudentApplications";
import MyApplicationsTable from "../../components/student/applications/MyApplicationsTable";
import { styles } from "../../components/student/applications/applicationStyles";

export default function MyApplications() {
  const {
    applications, isLoading, withdrawingApplicationId, reapplyingApplicationId,
    error, successMessage, handleWithdrawal, handleReapply,
  } = useStudentApplications();

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

        <StatusMessage type="error" style={styles.error}>{error}</StatusMessage>
        <StatusMessage type="success" style={styles.success}>{successMessage}</StatusMessage>

        {applications.length === 0 ? (
          <div style={styles.emptyState}>
            You have not applied to any placement drives yet.
          </div>
        ) : (
          <MyApplicationsTable applications={applications}
            withdrawingApplicationId={withdrawingApplicationId}
            reapplyingApplicationId={reapplyingApplicationId}
            handleWithdrawal={handleWithdrawal} handleReapply={handleReapply} />
        )}
      </section>
    </main>
  );
}
