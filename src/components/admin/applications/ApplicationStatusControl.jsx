import { getStatusOptions } from "../../../utils/adminApplications";
import { styles } from "./applicationStyles";

export default function ApplicationStatusControl({
  application, selectedStatus, isUpdating, onSelect, onUpdate,
}) {
  return (
    <div style={styles.updateControls}>
      <select
        value={selectedStatus || ""}
        onChange={(event) =>
          onSelect(
            application.id,
            event.target.value
          )
        }
        disabled={isUpdating}
        style={styles.statusSelect}
      >
        {getStatusOptions(application.status).map(
          (option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          )
        )}
      </select>
      <button
        type="button"
        onClick={() => onUpdate(application)}
        disabled={isUpdating}
        style={styles.button}
      >
        {isUpdating
          ? "Updating..."
          : "Update"}
      </button>
    </div>
  );
}
