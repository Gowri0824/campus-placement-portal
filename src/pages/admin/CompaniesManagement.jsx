import CompaniesTable from "../../components/admin/companies/CompaniesTable";
import CompanyForm from "../../components/admin/companies/CompanyForm";
import StatusMessage from "../../components/common/StatusMessage";
import { useCompanyManagement } from "../../hooks/useCompanyManagement";

function CompaniesManagement() {
  const {
    companies,
    formData,
    editingCompanyId,
    deleteConfirmCompanyId,
    isLoading,
    isSaving,
    deletingCompanyId,
    error,
    successMessage,
    updateFormField,
    saveCompany,
    startEdit,
    resetForm,
    requestDelete,
    cancelDelete,
    removeCompany,
  } = useCompanyManagement();

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Admin</p>
          <h1 style={styles.title}>Companies Management</h1>
          <p style={styles.description}>
            Add and maintain companies before creating placement drives.
          </p>
        </div>
      </div>

      <StatusMessage type="error">{error}</StatusMessage>
      <StatusMessage type="success">{successMessage}</StatusMessage>

      <CompanyForm
        formData={formData}
        isEditing={Boolean(editingCompanyId)}
        isSaving={isSaving}
        onFieldChange={updateFormField}
        onSubmit={saveCompany}
        onCancel={resetForm}
      />

      <CompaniesTable
        companies={companies}
        isLoading={isLoading}
        deleteConfirmCompanyId={deleteConfirmCompanyId}
        deletingCompanyId={deletingCompanyId}
        onEdit={startEdit}
        onRequestDelete={requestDelete}
        onCancelDelete={cancelDelete}
        onDelete={removeCompany}
      />
    </section>
  );
}

const styles = {
  panel: {
    maxWidth: "1120px",
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

export default CompaniesManagement;
