import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabaseClient";

const initialForm = {
  fullName: "",
  email: "",
  password: "",
  rollNumber: "",
  branch: "",
  cgpa: "",
  graduationYear: "",
};

function Signup() {
  const [formData, setFormData] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  };

  const validateForm = () => {
    if (
      !formData.fullName ||
      !formData.email ||
      !formData.password ||
      !formData.rollNumber ||
      !formData.branch ||
      !formData.cgpa ||
      !formData.graduationYear
    ) {
      return "Please fill in all fields.";
    }

    if (formData.password.length < 6) {
      return "Password must be at least 6 characters long.";
    }

    const cgpa = Number(formData.cgpa);
    if (Number.isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
      return "CGPA must be a number between 0 and 10.";
    }

    const graduationYear = Number(formData.graduationYear);
    if (
      !Number.isInteger(graduationYear) ||
      graduationYear < 2000 ||
      graduationYear > 2100
    ) {
      return "Please enter a valid graduation year.";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      // Supabase Auth creates the login account and returns the new user's id.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        throw authError;
      }

      const user = authData.user;
      if (!user) {
        throw new Error("Signup failed. Please try again.");
      }

      // The profile row stores shared user information and the app role.
      const { error: profileError } = await supabase.from("profiles").insert({
        id: user.id,
        role: "student",
        full_name: formData.fullName,
        email: formData.email,
      });

      if (profileError) {
        throw profileError;
      }

      // The student row stores placement-specific student details.
      const { error: studentError } = await supabase.from("students").insert({
        profile_id: user.id,
        roll_number: formData.rollNumber,
        branch: formData.branch,
        cgpa: Number(formData.cgpa),
        graduation_year: Number(formData.graduationYear),
      });

      if (studentError) {
        throw studentError;
      }

      setMessage("Signup successful. Redirecting to login...");
      setFormData(initialForm);

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (requestError) {
      setError(requestError.message || "Unable to create your account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={styles.title}>Create Student Account</h1>
        <p style={styles.subtitle}>Sign up to access placement updates.</p>

        {error && <div style={styles.error}>{error}</div>}
        {message && <div style={styles.success}>{message}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Full Name
            <input
              name="fullName"
              type="text"
              value={formData.fullName}
              onChange={handleChange}
              style={styles.input}
              placeholder="Enter your full name"
            />
          </label>

          <label style={styles.label}>
            Email
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              style={styles.input}
              placeholder="student@example.com"
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              style={styles.input}
              placeholder="Minimum 6 characters"
            />
          </label>

          <label style={styles.label}>
            Roll Number
            <input
              name="rollNumber"
              type="text"
              value={formData.rollNumber}
              onChange={handleChange}
              style={styles.input}
              placeholder="Enter roll number"
            />
          </label>

          <label style={styles.label}>
            Branch
            <input
              name="branch"
              type="text"
              value={formData.branch}
              onChange={handleChange}
              style={styles.input}
              placeholder="Computer Science"
            />
          </label>

          <div style={styles.row}>
            <label style={styles.label}>
              CGPA
              <input
                name="cgpa"
                type="number"
                min="0"
                max="10"
                step="0.01"
                value={formData.cgpa}
                onChange={handleChange}
                style={styles.input}
                placeholder="8.5"
              />
            </label>

            <label style={styles.label}>
              Graduation Year
              <input
                name="graduationYear"
                type="number"
                value={formData.graduationYear}
                onChange={handleChange}
                style={styles.input}
                placeholder="2026"
              />
            </label>
          </div>

          <button type="submit" disabled={isSubmitting} style={styles.button}>
            {isSubmitting ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p style={styles.footerText}>
          Already have an account? <Link to="/login">Login</Link>
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
    maxWidth: "520px",
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
  row: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
  success: {
    marginBottom: "16px",
    borderRadius: "6px",
    padding: "12px",
    background: "#dcfce7",
    color: "#166534",
  },
  footerText: {
    margin: "20px 0 0",
    color: "#4b5563",
    textAlign: "center",
  },
};

export default Signup;
