export class InviteError extends Error {
  constructor(message, status = 400, code = "INVITE_FAILED") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function databaseError(error) {
  if (error.code === "42501") return new InviteError("Administrator authorization or invitation verification failed.", 403);
  if (error.code === "23505") return new InviteError(error.message, 409, "ACCOUNT_EXISTS");
  if (["23503", "22023"].includes(error.code)) return new InviteError(error.message, 400);
  return new InviteError("Recruiter provisioning failed. Check the server deployment and database migration.", 503);
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const failure = databaseError(error);
    // A SQLSTATE response confirms transaction failure; transport errors do not.
    failure.rollbackConfirmed = /^[0-9A-Z]{5}$/.test(error.code || "");
    throw failure;
  }
  return data;
}

async function compensateNewAuthUser(client, userId, requestId) {
  // Only delete an account created by this request, before any invite is sent,
  // and only when the atomic RPC verifiably left no portal records behind.
  const [profile, membership, auth] = await Promise.all([
    client.from("profiles").select("id").eq("id", userId).maybeSingle(),
    client.from("recruiter_companies").select("profile_id").eq("profile_id", userId).maybeSingle(),
    client.auth.admin.getUserById(userId),
  ]);
  const user = auth.data?.user;
  if (profile.error || membership.error || auth.error || profile.data || membership.data
    || !user || user.id !== userId || user.email_confirmed_at || user.last_sign_in_at
    || user.app_metadata?.portal_recruiter_invite !== requestId) return false;
  const { error } = await client.auth.admin.deleteUser(userId);
  return !error;
}

export async function provisionRecruiter(client, adminId, input, redirectTo, requestId) {
  const { fullName, email, companyId } = input;
  const target = await rpc(client, "portal_recruiter_invite_target", {
    p_admin_id: adminId, p_email: email, p_company_id: companyId,
  });
  let userId = target?.user_id;
  let provisioningId = target?.request_id;
  let createdHere = false;
  if (userId) {
    const profile = await client.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (profile.error || !profile.data) {
      throw new InviteError("An invitation for this email is already being prepared or requires recovery. Reload and retry after it finishes; if this persists, ask the project owner to reconcile the pending Auth account.", 409, "PROVISIONING_IN_PROGRESS");
    }
  }
  if (!userId) {
    // Unlike inviteUserByEmail, createUser rejects existing unconfirmed accounts.
    // No shared/default password is supplied and no email is sent at this stage.
    const { data, error } = await client.auth.admin.createUser({
      email, email_confirm: false, user_metadata: { full_name: fullName },
      app_metadata: { portal_recruiter_invite: requestId, portal_recruiter_company: companyId },
    });
    if (error || !data?.user?.id) {
      throw new InviteError("Auth account creation could not be confirmed. Retry the same email/company; existing accounts will not be converted.",
        error?.status === 422 ? 409 : 503, "AUTH_CREATE_FAILED");
    }
    userId = data.user.id;
    provisioningId = requestId;
    createdHere = true;
  }
  const args = { p_admin_id: adminId, p_user_id: userId, p_request_id: provisioningId,
    p_full_name: fullName, p_email: email, p_company_id: companyId };
  let safeToCompensate = true;
  try {
    let provisionedId;
    try {
      provisionedId = await rpc(client, "portal_provision_recruiter", args);
    } catch (failure) {
      if (!failure.rollbackConfirmed) safeToCompensate = false;
      // Safe for an ambiguous response: the RPC is idempotent for this exact identity/company.
      provisionedId = await rpc(client, "portal_provision_recruiter", args);
    }
    if (provisionedId !== userId) throw new Error("Provisioning result mismatch.");
  } catch (failure) {
    let cleaned = false;
    if (createdHere && safeToCompensate && failure.rollbackConfirmed) {
      try { cleaned = await compensateNewAuthUser(client, userId, requestId); } catch { /* Fail closed on an unknown result. */ }
    }
    throw new InviteError(cleaned
      ? "Database provisioning failed. The new Auth account was removed; no invitation was sent."
      : `Provisioning could not be verified. No invitation was sent and no existing records were deleted. Retry the same email/company; if it persists, ask the project owner to reconcile account ${userId}.`,
    503, cleaned ? "PROVISIONING_ROLLED_BACK" : "PROVISIONING_REQUIRES_REVIEW");
  }
  // Record an authorized attempt before the external side effect. This is not a delivery receipt.
  try {
    const auditId = await rpc(client, "portal_audit_recruiter_invitation", {
      p_admin_id: adminId, p_user_id: userId, p_company_id: companyId, p_attempt_id: requestId,
    });
    if (auditId !== requestId) throw new Error("Invitation audit result mismatch.");
  } catch {
    throw new InviteError("Recruiter provisioned, but the invitation audit could not be confirmed. No email was sent. Retry the same email and company; no account was deleted.",
      503, "INVITATION_AUDIT_FAILED");
  }
  // Preserve a consistent pending recruiter if delivery fails or its result is unknown.
  try {
    const { data, error } = await client.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (error || data?.user?.id !== userId) throw new Error("Invitation delivery could not be confirmed.");
    return { userId, invited: true, message: "Recruiter provisioned. Invitation email accepted for delivery." };
  } catch {
    return { userId, invited: false, warning: "Recruiter provisioned, but invitation delivery could not be confirmed. Check Supabase email/redirect settings, then submit the same email and company to retry. No account was deleted." };
  }
}
