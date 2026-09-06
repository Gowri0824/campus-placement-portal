import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import { useAuth } from "../../hooks/useAuth";

function StudentDashboard() {
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    setError("");

    // Signing out clears the Supabase session stored in the browser.
    try {
      await signOut();
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (logoutError) {
      setError(logoutError.message || "Unable to log out.");
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.panel}>
        <div>
          <p style={styles.eyebrow}>Student Dashboard</p>
          <h1 style={styles.title}>Welcome to your placement portal</h1>
          <p style={styles.description}>
            You are logged in as <strong>{user?.email || ""}</strong>.
          </p>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.actions}>
          <Link to={ROUTES.STUDENT_PROFILE} style={styles.profileCard}>
            <span style={styles.cardTitle}>Profile</span>
            <span style={styles.cardText}>
              View and update your academic details, skills, and resume
              information.
            </span>
          </Link>

          <Link to={ROUTES.STUDENT_DRIVES} style={styles.driveCard}>
            <span style={styles.cardTitle}>View Placement Drives</span>
            <span style={styles.cardText}>
              Explore available company drives and apply when you are eligible.
            </span>
          </Link>

          <Link to={ROUTES.STUDENT_APPLICATIONS} style={styles.applicationCard}>
            <span style={styles.cardTitle}>My Applications</span>
            <span style={styles.cardText}>
              Track the placement drives you have applied for and check status
              updates.
            </span>
          </Link>

          <button type="button" onClick={handleLogout} style={styles.button}>
            Logout
          </button>
        </div>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "32px",
  },
  panel: {
    maxWidth: "900px",
    margin: "0 auto",
    background: "#ffffff",
    border: "1px solid #dfe4ea",
    borderRadius: "8px",
    padding: "32px",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
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
    margin: "0 0 24px",
    color: "#4b5563",
    fontSize: "16px",
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },
  profileCard: {
    display: "grid",
    gap: "8px",
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
    padding: "18px",
    background: "#eff6ff",
    color: "#1e3a8a",
    textDecoration: "none",
  },
  driveCard: {
    display: "grid",
    gap: "8px",
    border: "1px solid #bbf7d0",
    borderRadius: "8px",
    padding: "18px",
    background: "#f0fdf4",
    color: "#14532d",
    textDecoration: "none",
  },
  applicationCard: {
    display: "grid",
    gap: "8px",
    border: "1px solid #fde68a",
    borderRadius: "8px",
    padding: "18px",
    background: "#fffbeb",
    color: "#78350f",
    textDecoration: "none",
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: 700,
  },
  cardText: {
    color: "#475569",
    lineHeight: 1.5,
  },
  button: {
    border: "0",
    borderRadius: "6px",
    padding: "12px 16px",
    background: "#dc2626",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    justifySelf: "start",
    gridColumn: "1 / -1",
  },
  error: {
    marginBottom: "16px",
    borderRadius: "6px",
    padding: "12px",
    background: "#fee2e2",
    color: "#991b1b",
  },
};

export default StudentDashboard;
