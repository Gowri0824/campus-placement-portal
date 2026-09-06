import { useRef } from "react";
import { styles } from "./profileStyles";

export default function ResumeUpload({
  resumePath, resumeUrl, isUploadingResume, uploadProgress, handleResumeChange, openResume,
}) {
  const resumeInputRef = useRef(null);
  const openResumePicker = () => resumeInputRef.current?.click();
  return (
    <>
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
            : resumePath
              ? "Replace Resume"
              : "Upload Resume"}
        </button>

        {resumePath && (
          <a
            href={resumeUrl || "#"}
            onClick={openResume}
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
    </>
  );
}
