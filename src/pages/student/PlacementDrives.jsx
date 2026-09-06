import { Link } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import StatusMessage from "../../components/common/StatusMessage";
import { useStudentDrives } from "../../hooks/useStudentDrives";
import DrivesList from "../../components/student/drives/DrivesList";
import { styles } from "../../components/student/drives/driveStyles";

export default function PlacementDrives() {
  const { driveItems, isLoading, applyingDriveId, error, successMessage, handleApply } = useStudentDrives();

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

        <StatusMessage type="error" style={styles.error}>{error}</StatusMessage>
        <StatusMessage type="success" style={styles.success}>{successMessage}</StatusMessage>

        <DrivesList items={driveItems} applyingDriveId={applyingDriveId} onApply={handleApply} />
      </section>
    </main>
  );
}
