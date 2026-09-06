import StudentFilters from "../../components/admin/students/StudentFilters";
import StudentsTable from "../../components/admin/students/StudentsTable";
import StatusMessage from "../../components/common/StatusMessage";
import { useStudentDirectory } from "../../hooks/useStudentDirectory";

function StudentsManagement() {
  const {
    students,
    filteredStudents,
    branches,
    graduationYears,
    searchTerm,
    branchFilter,
    graduationYearFilter,
    minimumCgpaFilter,
    minimumCgpaError,
    expandedStudentId,
    resumeAccessUrls,
    openingResumeStudentId,
    missingProfileCount,
    profileRoleMismatchCount,
    isLoading,
    error,
    setSearchTerm,
    setBranchFilter,
    setGraduationYearFilter,
    setMinimumCgpaFilter,
    resetFilters,
    toggleStudentDetails,
    openStudentResume,
  } = useStudentDirectory();

  return (
    <section style={styles.panel}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Admin</p>
          <h1 style={styles.title}>Students Management</h1>
          <p style={styles.description}>
            Review student academic profiles and placement information.
          </p>
        </div>
      </header>

      <StatusMessage type="error">{error}</StatusMessage>

      <section style={styles.summaryBand}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Total Students</span>
          <strong style={styles.summaryValue}>{students.length}</strong>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Matching Students</span>
          <strong style={styles.summaryValue}>{filteredStudents.length}</strong>
        </div>
      </section>

      <StudentFilters
        searchTerm={searchTerm}
        branchFilter={branchFilter}
        graduationYearFilter={graduationYearFilter}
        minimumCgpaFilter={minimumCgpaFilter}
        branches={branches}
        graduationYears={graduationYears}
        onSearchChange={setSearchTerm}
        onBranchChange={setBranchFilter}
        onGraduationYearChange={setGraduationYearFilter}
        onMinimumCgpaChange={setMinimumCgpaFilter}
        onClear={resetFilters}
      />

      <StatusMessage type="warning" style={styles.warningSpacing}>
        {minimumCgpaError}
      </StatusMessage>

      <StatusMessage type="warning" style={styles.warningSpacing}>
        {missingProfileCount > 0
          ? `${missingProfileCount} student record(s) do not have a matching profile.`
          : ""}
      </StatusMessage>

      <StatusMessage type="warning" style={styles.warningSpacing}>
        {profileRoleMismatchCount > 0
          ? `${profileRoleMismatchCount} student record(s) map to profiles whose role is not student.`
          : ""}
      </StatusMessage>

      <StudentsTable
        students={students}
        filteredStudents={filteredStudents}
        isLoading={isLoading}
        expandedStudentId={expandedStudentId}
        resumeAccessUrls={resumeAccessUrls}
        openingResumeStudentId={openingResumeStudentId}
        onToggleDetails={toggleStudentDetails}
        onOpenResume={openStudentResume}
      />
    </section>
  );
}

const styles = {
  panel: {
    maxWidth: "1220px",
    margin: "0 auto",
    background: "#ffffff",
    border: "1px solid #dfe4ea",
    borderRadius: "8px",
    padding: "32px",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
  },
  header: {
    marginBottom: "24px",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#2563eb",
    fontSize: "13px",
    fontWeight: 700,
    textTransform: "uppercase",
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
  summaryBand: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "16px",
    marginBottom: "22px",
    borderTop: "1px solid #e5e7eb",
    borderBottom: "1px solid #e5e7eb",
    padding: "18px 0",
  },
  summaryItem: {
    borderLeft: "3px solid #2563eb",
    paddingLeft: "14px",
  },
  summaryLabel: {
    display: "block",
    marginBottom: "6px",
    color: "#6b7280",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  summaryValue: {
    color: "#111827",
    fontSize: "26px",
    lineHeight: 1,
  },
  warningSpacing: {
    marginBottom: "16px",
  },
};

export default StudentsManagement;
