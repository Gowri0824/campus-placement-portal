import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDrive,
  deleteDrive,
  fetchDriveManagementData,
  updateDrive,
} from "../services/drivesService";
import {
  createEmptyDriveForm,
  driveToFormData,
  toDrivePayload,
  validateDriveForm,
} from "../utils/driveValidation";

function getErrorMessage(error, fallbackMessage) {
  return error?.message || fallbackMessage;
}

export function useDriveManagement() {
  const [drives, setDrives] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [formData, setFormData] = useState(createEmptyDriveForm);
  const [editingDriveId, setEditingDriveId] = useState(null);
  const [deleteConfirmDriveId, setDeleteConfirmDriveId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingDriveId, setDeletingDriveId] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const isMounted = useRef(false);

  const loadDriveManagementData = useCallback(async () => {
    try {
      const data = await fetchDriveManagementData();

      if (isMounted.current) {
        setDrives(data.drives);
        setCompanies(data.companies);
      }
    } catch (loadError) {
      if (isMounted.current) {
        setError(
          getErrorMessage(loadError, "Unable to load placement drives."),
        );
        setDrives([]);
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

    fetchDriveManagementData()
      .then((data) => {
        if (isMounted.current) {
          setDrives(data.drives);
          setCompanies(data.companies);
        }
      })
      .catch((loadError) => {
        if (isMounted.current) {
          setError(
            getErrorMessage(loadError, "Unable to load placement drives."),
          );
          setDrives([]);
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
    setFormData(createEmptyDriveForm());
    setEditingDriveId(null);
    setDeleteConfirmDriveId(null);
  }, []);

  function updateFormField(name, value) {
    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  function startEdit(drive) {
    setError("");
    setSuccessMessage("");
    setDeleteConfirmDriveId(null);
    setEditingDriveId(drive.id);
    setFormData(driveToFormData(drive));
  }

  async function saveDrive() {
    setError("");
    setSuccessMessage("");

    const validationError = validateDriveForm(formData, companies);

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    const drivePayload = toDrivePayload(formData);

    try {
      if (editingDriveId) {
        await updateDrive(editingDriveId, drivePayload);
        setSuccessMessage("Placement drive updated successfully.");
      } else {
        await createDrive(drivePayload);
        setSuccessMessage("Placement drive added successfully.");
      }

      resetForm();
      await loadDriveManagementData();
    } catch (saveError) {
      const fallbackMessage = editingDriveId
        ? "Unable to update placement drive."
        : "Unable to add placement drive.";
      setError(getErrorMessage(saveError, fallbackMessage));
    } finally {
      if (isMounted.current) {
        setIsSaving(false);
      }
    }
  }

  async function removeDrive(driveId) {
    setError("");
    setSuccessMessage("");
    setDeletingDriveId(driveId);

    try {
      await deleteDrive(driveId);
      setSuccessMessage("Placement drive deleted successfully.");

      if (editingDriveId === driveId) {
        resetForm();
      }

      await loadDriveManagementData();
    } catch (deleteError) {
      setError(
        getErrorMessage(deleteError, "Unable to delete placement drive."),
      );
    } finally {
      if (isMounted.current) {
        setDeletingDriveId(null);
        setDeleteConfirmDriveId(null);
      }
    }
  }

  return {
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
    requestDelete: setDeleteConfirmDriveId,
    cancelDelete: () => setDeleteConfirmDriveId(null),
    removeDrive,
  };
}
