import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabaseClient";

const RESUME_BUCKET = "resumes";
const MAX_RESUME_SIZE_IN_MB = 10;

const initialProfile = {
  fullName: "",
  email: "",
  rollNumber: "",
  branch: "",
  cgpa: "",
  graduationYear: "",
  skills: "",
  resumeUrl: "",
};

function Profile() {
  const resumeInputRef = useRef(null);
  const [profile, setProfile] = useState(initialProfile);
  const [formData, setFormData] = useState({
    branch: "",
    cgpa: "",
    graduationYear: "",
    skills: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      setError("");

      try {
        // Get the logged-in Supabase Auth user before reading private data.
        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError || !userData.user) {
          navigate("/login", { replace: true });
          return;
        }

        const userId = userData.user.id;

        // profiles contains common user details such as name and email.
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", userId)
          .single();

        if (profileError) {
          throw profileError;
        }

        // students contains student-specific placement profile details.
        const { data: studentData, error: studentError } = await supabase
          .from("students")
          .select(
            "roll_number, branch, cgpa, graduation_year, skills, resume_url"
          )
          .eq("profile_id", userId)
          .single();

        if (studentError) {
          throw studentError;
        }

        const loadedProfile = {
          fullName: profileData.full_name || "",
          email: profileData.email || userData.user.email || "",
          rollNumber: studentData.roll_number || "",
          branch: studentData.branch || "",
          cgpa: studentData.cgpa ?? "",
          graduationYear: studentData.graduation_year ?? "",
          skills: studentData.skills || "",
          resumeUrl: studentData.resume_url || "",
        };

        setProfile(loadedProfile);
        setFormData({
          branch: loadedProfile.branch,
          cgpa: String(loadedProfile.cgpa),
          graduationYear: String(loadedProfile.graduationYear),
          skills: loadedProfile.skills,
        });
      } catch (requestError) {
        setError(requestError.message || "Unable to load your profile.");
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  };

  const openResumePicker = () => {
    if (resumeInputRef.current) {
      resumeInputRef.current.click();
    }
  };

  const validateResumeFile = (file) => {
    if (!file) {
      return "Please select a resume file.";
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return "Only PDF resume files are allowed.";
    }

    const fileSizeInMb = file.size / (1024 * 1024);
    if (fileSizeInMb > MAX_RESUME_SIZE_IN_MB) {
      return `Resume must be ${MAX_RESUME_SIZE_IN_MB} MB or smaller.`;
    }

    return "";
  };

  const handleResumeChange = async (event) => {
    const file = event.target.files?.[0];
    const validationError = validateResumeFile(file);

    setError("");
    setSuccessMessage("");

    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }

    setIsUploadingResume(true);
    setUploadProgress(5);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        navigate("/login", { replace: true });
        return;
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        navigate("/login", { replace: true });
        return;
      }

      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const filePath = `${userData.user.id}/${Date.now()}-${cleanFileName}`;

      // XMLHttpRequest is used here because Supabase Storage's browser helper
      // does not currently expose upload progress events.
      await uploadResumeWithProgress({
        file,
        filePath,
        accessToken: sessionData.session.access_token,
        onProgress: setUploadProgress,
      });

      setUploadProgress(90);

      const { data: publicUrlData } = supabase.storage
        .from(RESUME_BUCKET)
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("students")
        .update({ resume_url: publicUrlData.publicUrl })
        .eq("profile_id", userData.user.id);

      if (updateError) {
        throw updateError;
      }

      setProfile((currentProfile) => ({
        ...currentProfile,
        resumeUrl: publicUrlData.publicUrl,
      }));
      setUploadProgress(100);
      setSuccessMessage("Resume uploaded successfully.");
    } catch (requestError) {
      setError(requestError.message || "Unable to upload your resume.");
      setUploadProgress(0);
    } finally {
      setIsUploadingResume(false);
      event.target.value = "";
    }
  };

  const validateForm = () => {
    if (!formData.branch || !formData.cgpa || !formData.graduationYear) {
      return "Please fill in branch, CGPA, and graduation year.";
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
    setSuccessMessage("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        navigate("/login", { replace: true });
        return;
      }

      const updatedStudentDetails = {
        branch: formData.branch.trim(),
        cgpa: Number(formData.cgpa),
        graduation_year: Number(formData.graduationYear),
        skills: formData.skills.trim(),
      };

      // Update only the editable student fields for the logged-in profile.
      const { error: updateError } = await supabase
        .from("students")
        .update(updatedStudentDetails)
        .eq("profile_id", userData.user.id);

      if (updateError) {
        throw updateError;
      }

      setProfile((currentProfile) => ({
        ...currentProfile,
        branch: updatedStudentDetails.branch,
        cgpa: updatedStudentDetails.cgpa,
        graduationYear: updatedStudentDetails.graduation_year,
        skills: updatedStudentDetails.skills,
      }));
      setSuccessMessage("Profile updated successfully.");
    } catch (requestError) {
      setError(requestError.message || "Unable to save your profile.");
    } finally {
      setIsSaving(false);
    }
  };

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

          <Link to="/student/dashboard" style={styles.secondaryButton}>
            Back to Dashboard
          </Link>
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {successMessage && <div style={styles.success}>{successMessage}</div>}

        <div style={styles.grid}>
          <section style={styles.infoBox}>
            <h2 style={styles.sectionTitle}>Basic Information</h2>

            <div style={styles.infoList}>
              <ProfileItem label="Full Name" value={profile.fullName} />
              <ProfileItem label="Email" value={profile.email} />
              <ProfileItem label="Roll Number" value={profile.rollNumber} />
              <ProfileItem
                label="Uploaded Resume"
                value={getResumeName(profile.resumeUrl) || "Not uploaded"}
              />
            </div>

            <div style={styles.resumeActions}>
              <input
                ref={resumeInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleResumeChange}
                style={styles.hiddenInput}
              />

              <button
                type="button"
                onClick={openResumePicker}
                disabled={isUploadingResume}
                style={styles.button}
              >
                {isUploadingResume
                  ? "Uploading..."
                  : profile.resumeUrl
                    ? "Replace Resume"
                    : "Upload Resume"}
              </button>

              {profile.resumeUrl && (
                <a
                  href={profile.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.viewButton}
                >
                  View Resume
                </a>
              )}
            </div>

            {isUploadingResume && (
              <div style={styles.progressWrap}>
                <div style={styles.progressTrack}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${uploadProgress}%`,
                    }}
                  />
                </div>
                <span style={styles.progressText}>{uploadProgress}%</span>
              </div>
            )}
          </section>

          <section style={styles.infoBox}>
            <h2 style={styles.sectionTitle}>Current Profile Summary</h2>

            <div style={styles.infoList}>
              <ProfileItem label="Branch" value={profile.branch} />
              <ProfileItem label="CGPA" value={profile.cgpa} />
              <ProfileItem
                label="Graduation Year"
                value={profile.graduationYear}
              />
              <ProfileItem
                label="Skills"
                value={profile.skills || "No skills added yet"}
              />
            </div>
          </section>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <h2 style={styles.sectionTitle}>Edit Placement Details</h2>

          <div style={styles.formGrid}>
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

          <label style={styles.label}>
            Skills
            <textarea
              name="skills"
              value={formData.skills}
              onChange={handleChange}
              style={styles.textarea}
              placeholder="React, JavaScript, SQL, Communication"
            />
          </label>

          <button type="submit" disabled={isSaving} style={styles.button}>
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </section>
    </main>
  );
}

function ProfileItem({ label, value }) {
  return (
    <div style={styles.profileItem}>
      <span style={styles.profileLabel}>{label}</span>
      <span style={styles.profileValue}>{value || "Not available"}</span>
    </div>
  );
}

function uploadResumeWithProgress({ file, filePath, accessToken, onProgress }) {
  return new Promise((resolve, reject) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      reject(new Error("Supabase environment variables are missing."));
      return;
    }

    const encodedFilePath = filePath.split("/").map(encodeURIComponent).join("/");
    const uploadUrl = `${supabaseUrl.replace(
      /\/$/,
      ""
    )}/storage/v1/object/${RESUME_BUCKET}/${encodedFilePath}`;
    const request = new XMLHttpRequest();

    request.open("POST", uploadUrl);
    request.setRequestHeader("apikey", supabaseAnonKey);
    request.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    request.setRequestHeader("Content-Type", "application/pdf");
    request.setRequestHeader("x-upsert", "true");

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 85);
        onProgress(Math.max(progress, 5));
      }
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }

      reject(new Error(getStorageErrorMessage(request)));
    };

    request.onerror = () => {
      reject(new Error("Network error while uploading the resume."));
    };

    request.send(file);
  });
}

function getStorageErrorMessage(request) {
  try {
    const response = JSON.parse(request.responseText);
    return (
      response.message ||
      response.error ||
      `Resume upload failed with status ${request.status}.`
    );
  } catch {
    return `Resume upload failed with status ${request.status}.`;
  }
}

function getResumeName(resumeUrl) {
  if (!resumeUrl) {
    return "";
  }

  try {
    const url = new URL(resumeUrl);
    const fileName = decodeURIComponent(url.pathname.split("/").pop() || "");
    return fileName.replace(/^\d+-/, "");
  } catch {
    const fileName = resumeUrl.split("/").pop() || "";
    return decodeURIComponent(fileName).replace(/^\d+-/, "");
  }
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "32px",
  },
  panel: {
    maxWidth: "1000px",
    margin: "0 auto",
    background: "#ffffff",
    border: "1px solid #dfe4ea",
    borderRadius: "8px",
    padding: "32px",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "24px",
    flexWrap: "wrap",
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
    margin: 0,
    color: "#4b5563",
    fontSize: "16px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  infoBox: {
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "20px",
    background: "#f9fafb",
  },
  sectionTitle: {
    margin: "0 0 16px",
    color: "#111827",
    fontSize: "20px",
  },
  infoList: {
    display: "grid",
    gap: "12px",
  },
  resumeActions: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: "18px",
  },
  hiddenInput: {
    display: "none",
  },
  profileItem: {
    display: "grid",
    gap: "4px",
  },
  profileLabel: {
    color: "#6b7280",
    fontSize: "13px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  profileValue: {
    color: "#111827",
    fontSize: "15px",
    overflowWrap: "anywhere",
  },
  form: {
    display: "grid",
    gap: "16px",
    borderTop: "1px solid #e5e7eb",
    paddingTop: "24px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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
  textarea: {
    width: "100%",
    minHeight: "110px",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    padding: "12px",
    fontSize: "15px",
    fontFamily: "inherit",
    resize: "vertical",
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
    justifySelf: "start",
  },
  viewButton: {
    borderRadius: "6px",
    padding: "11px 14px",
    background: "#ecfdf5",
    color: "#047857",
    fontSize: "15px",
    fontWeight: 700,
    textDecoration: "none",
  },
  secondaryButton: {
    borderRadius: "6px",
    padding: "10px 14px",
    background: "#e0ecff",
    color: "#1d4ed8",
    fontSize: "14px",
    fontWeight: 700,
    textDecoration: "none",
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
  progressWrap: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    marginTop: "16px",
  },
  progressTrack: {
    flex: 1,
    height: "10px",
    overflow: "hidden",
    borderRadius: "999px",
    background: "#e5e7eb",
  },
  progressFill: {
    height: "100%",
    borderRadius: "999px",
    background: "#2563eb",
    transition: "width 0.2s ease",
  },
  progressText: {
    minWidth: "44px",
    color: "#4b5563",
    fontSize: "14px",
    fontWeight: 700,
    textAlign: "right",
  },
};

export default Profile;
