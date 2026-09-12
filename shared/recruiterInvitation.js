const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Pure request contract shared by React and the Edge Function. SQL validates again.
export function validateRecruiterInvitation(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Enter a full name, email and company." };
  }
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const companyId = typeof input.companyId === "string" ? input.companyId : "";
  const hasControlCharacter = Array.from(fullName).some((character) => character.codePointAt(0) < 32 || character.codePointAt(0) === 127);
  if (!fullName || fullName.length > 120 || hasControlCharacter) {
    return { error: "Full name must contain 1 to 120 characters without control characters." };
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (!UUID.test(companyId)) return { error: "Select a valid company." };
  return { value: { fullName, email, companyId }, error: "" };
}
