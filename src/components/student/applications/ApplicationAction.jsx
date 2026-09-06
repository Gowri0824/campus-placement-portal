import { APPLICATION_STATUS } from "../../../constants/applicationStatuses";
import { getStudentApplicationActions } from "../../../utils/studentApplications";
import { getDeadlineClosedMessage } from "../../../utils/dates";
import { styles } from "./applicationStyles";

export default function ApplicationAction({
  application, withdrawingApplicationId, reapplyingApplicationId,
  handleWithdrawal, handleReapply,
}) {
  const { canWithdraw, canReapply } = getStudentApplicationActions(application);
  return (
    <>
      {canWithdraw ? (
        <button
          type="button"
          onClick={() => handleWithdrawal(application)}
          disabled={
            withdrawingApplicationId === application.id
          }
          style={styles.withdrawButton}
        >
          {withdrawingApplicationId === application.id
            ? "Withdrawing..."
            : "Withdraw Application"}
        </button>
      ) : canReapply ? (
        <button
          type="button"
          onClick={() => handleReapply(application)}
          disabled={
            reapplyingApplicationId === application.id
          }
          style={styles.reapplyButton}
        >
          {reapplyingApplicationId === application.id
            ? "Re-applying..."
            : "Re-apply"}
        </button>
      ) : application.status === APPLICATION_STATUS.WITHDRAWN ? (
        <span style={styles.deadlineClosedText}>
          {getDeadlineClosedMessage(
            application.placement_drives?.deadline
          )}
        </span>
      ) : (
        <span style={styles.unavailableText}>Not available</span>
      )}
    </>
  );
}
