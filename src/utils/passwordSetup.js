export function validateSetupPassword(password, confirmation) {
  if (password.length < 8) return "Use a password with at least 8 characters.";
  if (new TextEncoder().encode(password).length > 72) return "Password must be at most 72 bytes.";
  if (password !== confirmation) return "Passwords do not match.";
  return "";
}

export function getPasswordLinkError(location) {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(location.search);
  return hash.has("error") || hash.has("error_code") || query.has("error") || query.has("error_code")
    ? "This invitation link is invalid or expired. Ask your administrator to send another invitation." : "";
}
