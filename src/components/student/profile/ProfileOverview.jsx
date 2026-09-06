import { getResumeName } from "../../../utils/studentProfileValidation";
import ResumeUpload from "./ResumeUpload";
import { styles } from "./profileStyles";

export default function ProfileOverview({ profile, resume }) {
  return (
    <div style={styles.grid}>
      <section style={styles.infoBox}>
        <h2 style={styles.sectionTitle}>Basic Information</h2>

        <div style={styles.infoList}>
          <ProfileItem label="Full Name" value={profile.fullName} />
          <ProfileItem label="Email" value={profile.email} />
          <ProfileItem label="Roll Number" value={profile.rollNumber} />
          <ProfileItem
            label="Uploaded Resume"
            value={
              getResumeName(profile.resumePath) ||
              "Not uploaded"
            }
          />
        </div>

        <ResumeUpload resumePath={profile.resumePath} {...resume} />
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
