import { supabase } from "./supabaseClient";

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

const pendingProfiles = new Map();

// Session initialization and auth events can overlap. Share only pending reads;
// never retain resolved roles or errors, so later refreshes still query RLS.
export function getAuthProfile(userId) {
  if (!pendingProfiles.has(userId)) {
    const request = readAuthProfile(userId).finally(() => pendingProfiles.delete(userId));
    pendingProfiles.set(userId, request);
  }
  return pendingProfiles.get(userId);
}

async function readAuthProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function signInWithPassword(credentials) {
  const { data, error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export function subscribeToAuthChanges(listener) {
  const { data } = supabase.auth.onAuthStateChange(listener);

  return () => data.subscription.unsubscribe();
}

export async function setCurrentUserPassword(password, expectedUserId) {
  const session = await getCurrentSession();
  if (!expectedUserId || session?.user?.id !== expectedUserId) {
    throw new Error("Your session changed. Reopen the invitation link before setting a password.");
  }
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  if (data.user?.id !== expectedUserId) throw new Error("The password update could not be verified. Please sign in again.");
}
