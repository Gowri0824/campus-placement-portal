import DriveForm from "../../components/admin/drives/DriveForm";
import DrivesTable from "../../components/admin/drives/DrivesTable";
import StatusMessage from "../../components/common/StatusMessage";
import { useDriveManagement } from "../../hooks/useDriveManagement";

function PlacementDrivesManagement() {
  const {
    drives,
    companies,
    formData,
    editingDriveId,
    deleteConfirmDriveId,
    isLoading,
    isSaving,
    deletingDriveId,
    error,
    successMessage,
    updateFormField,
    saveDrive,
    startEdit,
    resetForm,
    requestDelete,
    cancelDelete,
    removeDrive,
  } = useDriveManagement();

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Admin</p>
          <h1 style={styles.title}>Placement Drives Management</h1>
          <p style={styles.description}>
            Create and maintain placement opportunities for students.
          </p>
        </div>
      </div>

      <StatusMessage type="error">{error}</StatusMessage>
      <StatusMessage type="success">{successMessage}</StatusMessage>

      <DriveForm
        companies={companies}
        formData={formData}
        isEditing={Boolean(editingDriveId)}
        isLoading={isLoading}
        isSaving={isSaving}
        onFieldChange={updateFormField}
        onSubmit={saveDrive}
        onCancel={resetForm}
      />

      <DrivesTable
        drives={drives}
        isLoading={isLoading}
        deleteConfirmDriveId={deleteConfirmDriveId}
        deletingDriveId={deletingDriveId}
        onEdit={startEdit}
        onRequestDelete={requestDelete}
        onCancelDelete={cancelDelete}
        onDelete={removeDrive}
      />
    </section>
  );
}

const styles = {
  panel: {
    maxWidth: "1180px",
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
    flexWrap: "wrap",
    marginBottom: "24px",
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
};

export default PlacementDrivesManagement;
