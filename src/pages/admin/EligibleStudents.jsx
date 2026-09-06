import StatusMessage from "../../components/common/StatusMessage";
import DriveSelector from "../../components/admin/eligibility/DriveSelector";
import EligibilitySummary from "../../components/admin/eligibility/EligibilitySummary";
import EligibleStudentsTable from "../../components/admin/eligibility/EligibleStudentsTable";
import { styles } from "../../components/admin/eligibility/eligibilityStyles";
import { useEligibleStudents } from "../../hooks/useEligibleStudents";

export default function EligibleStudents() {
  const directory = useEligibleStudents();
  const { drives, selectedDrive, eligibility, isLoading, error } = directory;

  return (
    <section style={styles.panel}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Admin</p>
          <h1 style={styles.title}>Eligible Students</h1>
          <p style={styles.description}>
            Select a placement drive to review students who meet its
            academic criteria.
          </p>
        </div>
      </header>
      <StatusMessage type="error" style={styles.error}>{error}</StatusMessage>
      <DriveSelector
        drives={drives}
        selectedDriveId={directory.selectedDriveId}
        onChange={directory.selectDrive}
        disabled={directory.isLoadingDrives}
      />
      {isLoading ? (
        <div style={styles.emptyState}>Loading eligibility data...</div>
      ) : drives.length === 0 ? (
        <div style={styles.emptyState}>No placement drives are available.</div>
      ) : !selectedDrive ? (
        <div style={styles.emptyState}>Select a placement drive to view eligible students.</div>
      ) : directory.studentError ? null : (
        <>
          <EligibilitySummary drive={selectedDrive} count={eligibility.students.length} />
          {!selectedDrive.hasKnownCompany && (
            <StatusMessage type="warning" style={styles.warning}>
              This drive references a company record that is not available.
            </StatusMessage>
          )}
          {eligibility.warnings.map((warning) => (
            <StatusMessage key={warning} type="warning" style={styles.warning}>
              {warning}
            </StatusMessage>
          ))}
          {eligibility.students.length === 0 ? (
            <div style={styles.emptyState}>
              No students meet this drive&apos;s eligibility criteria.
            </div>
          ) : (
            <EligibleStudentsTable
              students={eligibility.students}
              resumeAccessUrls={directory.resumeAccessUrls}
              openingResumeStudentId={directory.openingResumeStudentId}
              onOpenResume={directory.openStudentResume}
            />
          )}
        </>
      )}
    </section>
  );
}
