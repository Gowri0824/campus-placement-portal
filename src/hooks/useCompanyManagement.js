import { useCallback, useEffect, useRef, useState } from "react";
import {
  createCompany,
  deleteCompany,
  fetchCompanies,
  updateCompany,
} from "../services/companiesService";
import {
  createEmptyCompanyForm,
  validateCompanyForm,
} from "../utils/companyValidation";

function companyToFormData(company) {
  return {
    companyName: company.company_name || "",
    website: company.website || "",
    location: company.location || "",
    description: company.description || "",
  };
}

function getErrorMessage(error, fallbackMessage) {
  return error?.message || fallbackMessage;
}

export function useCompanyManagement() {
  const [companies, setCompanies] = useState([]);
  const [formData, setFormData] = useState(createEmptyCompanyForm);
  const [editingCompanyId, setEditingCompanyId] = useState(null);
  const [deleteConfirmCompanyId, setDeleteConfirmCompanyId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingCompanyId, setDeletingCompanyId] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const isMounted = useRef(false);

  const loadCompanies = useCallback(async () => {
    try {
      const records = await fetchCompanies();

      if (isMounted.current) {
        setCompanies(records);
      }
    } catch (loadError) {
      if (isMounted.current) {
        setError(getErrorMessage(loadError, "Unable to load companies."));
        setCompanies([]);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;

    fetchCompanies()
      .then((records) => {
        if (isMounted.current) {
          setCompanies(records);
        }
      })
      .catch((loadError) => {
        if (isMounted.current) {
          setError(getErrorMessage(loadError, "Unable to load companies."));
          setCompanies([]);
        }
      })
      .finally(() => {
        if (isMounted.current) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted.current = false;
    };
  }, []);

  const resetForm = useCallback(() => {
    setFormData(createEmptyCompanyForm());
    setEditingCompanyId(null);
    setDeleteConfirmCompanyId(null);
  }, []);

  function updateFormField(name, value) {
    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  function startEdit(company) {
    setError("");
    setSuccessMessage("");
    setDeleteConfirmCompanyId(null);
    setEditingCompanyId(company.id);
    setFormData(companyToFormData(company));
  }

  async function saveCompany() {
    setError("");
    setSuccessMessage("");

    const validationError = validateCompanyForm(formData);

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);

    try {
      if (editingCompanyId) {
        await updateCompany(editingCompanyId, formData);
        setSuccessMessage("Company updated successfully.");
      } else {
        await createCompany(formData);
        setSuccessMessage("Company added successfully.");
      }

      resetForm();
      await loadCompanies();
    } catch (saveError) {
      const fallbackMessage = editingCompanyId
        ? "Unable to update company."
        : "Unable to add company.";
      setError(getErrorMessage(saveError, fallbackMessage));
    } finally {
      if (isMounted.current) {
        setIsSaving(false);
      }
    }
  }

  async function removeCompany(companyId) {
    setError("");
    setSuccessMessage("");
    setDeletingCompanyId(companyId);

    try {
      await deleteCompany(companyId);
      setSuccessMessage("Company deleted successfully.");

      if (editingCompanyId === companyId) {
        resetForm();
      }

      await loadCompanies();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Unable to delete company."));
    } finally {
      if (isMounted.current) {
        setDeletingCompanyId(null);
        setDeleteConfirmCompanyId(null);
      }
    }
  }

  return {
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
    requestDelete: setDeleteConfirmCompanyId,
    cancelDelete: () => setDeleteConfirmCompanyId(null),
    removeCompany,
  };
}
