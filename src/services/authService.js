import { supabase } from "./supabaseClient";

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export async function getAuthProfile(userId) {
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
