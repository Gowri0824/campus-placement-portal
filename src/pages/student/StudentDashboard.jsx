import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabaseClient";

function StudentDashboard() {
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      const { data, error: userError } = await supabase.auth.getUser();

      if (userError || !data.user) {
        navigate("/login", { replace: true });
        return;
      }

      setUserEmail(data.user.email || "");
      setIsLoading(false);
    };

    loadUser();
  }, [navigate]);

  const handleLogout = async () => {
    setError("");

    // Signing out clears the Supabase session stored in the browser.
    const { error: logoutError } = await supabase.auth.signOut();

    if (logoutError) {
      setError(logoutError.message);
      return;
    }

    navigate("/login", { replace: true });
  };

  if (isLoading) {
    return (
      <main style={styles.page}>
        <section style={styles.panel}>Loading dashboard...</section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.panel}>
        <div>
          <p style={styles.eyebrow}>Student Dashboard</p>
          <h1 style={styles.title}>Welcome to your placement portal</h1>
          <p style={styles.description}>
            You are logged in as <strong>{userEmail}</strong>.
          </p>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <button type="button" onClick={handleLogout} style={styles.button}>
          Logout
        </button>
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
  button: {
    border: "0",
    borderRadius: "6px",
    padding: "12px 16px",
    background: "#dc2626",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
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
