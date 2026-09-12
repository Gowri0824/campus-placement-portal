import StatusMessage from "../common/StatusMessage";

export default function RecruiterCompanyFeedback({ isLoading, error, warning }) {
  return (
    <>
      {isLoading && <p role="status">Loading company information...</p>}
      <StatusMessage type="error">{error}</StatusMessage>
      <StatusMessage type="warning">{warning}</StatusMessage>
    </>
  );
}
