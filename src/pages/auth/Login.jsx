import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabaseClient";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      // signInWithPassword validates credentials against Supabase Auth.
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        throw loginError;
      }

      navigate("/student/dashboard", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to login. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={styles.title}>Student Login</h1>
        <p style={styles.subtitle}>Welcome back to the placement portal.</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={styles.input}
              placeholder="student@example.com"
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={styles.input}
              placeholder="Enter your password"
            />
          </label>

          <button type="submit" disabled={isSubmitting} style={styles.button}>
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
        </form>

        <p style={styles.footerText}>
          New student? <Link to="/signup">Create an account</Link>
        </p>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f7fb",
    padding: "24px",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    background: "#ffffff",
    border: "1px solid #dfe4ea",
    borderRadius: "8px",
    padding: "32px",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
  },
  title: {
    margin: "0 0 8px",
    color: "#111827",
    fontSize: "28px",
  },
  subtitle: {
    margin: "0 0 24px",
    color: "#5b6472",
  },
  form: {
    display: "grid",
    gap: "16px",
  },
  label: {
    display: "grid",
    gap: "8px",
    color: "#1f2937",
    fontWeight: 600,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    padding: "12px",
    fontSize: "15px",
  },
  button: {
    border: "0",
    borderRadius: "6px",
    padding: "12px 16px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: "16px",
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
  footerText: {
    margin: "20px 0 0",
    color: "#4b5563",
    textAlign: "center",
  },
};

export default Login;
