import { Link } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import { useStudentProfile } from "../../hooks/useStudentProfile";
import StatusMessage from "../../components/common/StatusMessage";
import ProfileForm from "../../components/student/profile/ProfileForm";
import ProfileOverview from "../../components/student/profile/ProfileOverview";
import { styles } from "../../components/student/profile/profileStyles";

export default function Profile() {
  const directory = useStudentProfile();
  const {
    profile, formData, isLoading, isSaving, error, successMessage, handleChange, handleSubmit,
  } = directory;

  if (isLoading) {
    return (
      <main style={styles.page}>
        <section style={styles.panel}>Loading profile...</section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.panel}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Student Profile</p>
            <h1 style={styles.title}>Manage your profile</h1>
            <p style={styles.description}>
              Keep your academic details and skills ready for placement drives.
            </p>
          </div>

          <Link to={ROUTES.STUDENT_DASHBOARD} style={styles.secondaryButton}>
            Back to Dashboard
          </Link>
        </div>

        <StatusMessage type="error" style={styles.error}>{error}</StatusMessage>
        <StatusMessage type="warning" style={{ marginBottom: "16px", padding: "12px" }}>{directory.warning}</StatusMessage>
        <StatusMessage type="success" style={styles.success}>{successMessage}</StatusMessage>

        <ProfileOverview profile={profile} resume={directory} />
        <ProfileForm formData={formData} isSaving={isSaving}
          handleChange={handleChange} handleSubmit={handleSubmit} />
      </section>
    </main>
  );
}
