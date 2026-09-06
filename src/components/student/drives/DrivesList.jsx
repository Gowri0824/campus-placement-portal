import DriveCard from "./DriveCard";
import { styles } from "./driveStyles";

export default function DrivesList({ items, applyingDriveId, onApply }) {
  if (items.length === 0) {
    return <div style={styles.emptyState}>No placement drives are available right now.</div>;
  }
  return (
    <div style={styles.driveGrid}>
      {items.map(({ drive, state }) => (
        <DriveCard key={drive.id} drive={drive} state={state}
          applyingDriveId={applyingDriveId} onApply={onApply} />
      ))}
    </div>
  );
}
