import { supabase } from "./supabaseClient";

export async function fetchRowsByIds(table, columns, ids) {
  if (ids.length === 0) {
    return { data: [], error: null };
  }

  const chunks = [];

  for (let index = 0; index < ids.length; index += 100) {
    chunks.push(ids.slice(index, index + 100));
  }

  const results = await Promise.all(
    chunks.map((idChunk) =>
      supabase.from(table).select(columns).in("id", idChunk)
    )
  );
  const failedResult = results.find((result) => result.error);

  if (failedResult) {
    return { data: null, error: failedResult.error };
  }

  return {
    data: results.flatMap((result) => result.data || []),
    error: null,
  };
}
