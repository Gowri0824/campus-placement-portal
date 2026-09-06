import { APPLICATION_STATUS } from "../../../constants/applicationStatuses";
import { getDeadlineClosedMessage } from "../../../utils/dates";
import { styles } from "./driveStyles";

export default function ApplyAction({ drive, state, applyingDriveId, onApply }) {
  const { applicationStatus, deadlineOpen, isEligible } = state;
  return (
    <div style={styles.footer}>
      {applicationStatus ? (
        <span
          style={
            applicationStatus === APPLICATION_STATUS.WITHDRAWN
              ? styles.withdrawnText
              : styles.appliedText
          }
        >
          {applicationStatus === APPLICATION_STATUS.WITHDRAWN
            ? "Withdrawn - re-apply from My Applications"
            : applicationStatus}
        </span>
      ) : !deadlineOpen ? (
        <span style={styles.notEligibleText}>
          {getDeadlineClosedMessage(drive.deadline)}
        </span>
      ) : isEligible ? (
        <button
          type="button"
          onClick={() => onApply(drive)}
          disabled={applyingDriveId === drive.id}
          style={styles.button}
        >
          {applyingDriveId === drive.id
            ? "Applying..."
            : "Apply"}
        </button>
      ) : (
        <span style={styles.notEligibleText}>
          Update your profile if your details have changed.
        </span>
      )}
    </div>
  );
}
