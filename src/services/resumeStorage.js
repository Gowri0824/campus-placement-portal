import { supabase } from "./supabaseClient";
import {
  RESUME_BUCKET,
  RESUME_SIGNED_URL_LIFETIME_SECONDS,
} from "../constants/storage";

export { RESUME_BUCKET } from "../constants/storage";
const storagePathMarkers = [
  `/storage/v1/object/public/${RESUME_BUCKET}/`,
  `/storage/v1/object/sign/${RESUME_BUCKET}/`,
  `/storage/v1/object/${RESUME_BUCKET}/`,
];

export function getResumeObjectPath(storedValue) {
  const value = String(storedValue || "").trim();

  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    const marker = storagePathMarkers.find((candidate) =>
      url.pathname.includes(candidate)
    );

    if (!marker) {
      return "";
    }

    return normalizeObjectPath(url.pathname.split(marker)[1]);
  } catch {
    return normalizeObjectPath(value);
  }
}

export async function createResumeAccessUrl(storedValue) {
  const path = getResumeObjectPath(storedValue);

  if (!path) {
    return { path: "", url: "", error: null };
  }

  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(path, RESUME_SIGNED_URL_LIFETIME_SECONDS);

  return {
    path,
    url: data?.signedUrl || "",
    error,
  };
}

export async function createSignedResumeRecords(records) {
  const normalizedRecords = records.map((record) => ({
    ...record,
    resume_path: getResumeObjectPath(record.resume_url),
  }));
  const paths = [
    ...new Set(
      normalizedRecords.map((record) => record.resume_path).filter(Boolean)
    ),
  ];

  if (paths.length === 0) {
    return { data: normalizedRecords, error: null };
  }

  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrls(paths, RESUME_SIGNED_URL_LIFETIME_SECONDS);

  if (error) {
    return { data: null, error };
  }

  const signedUrlByPath = new Map();
  let signingError = null;

  (data || []).forEach((signedResume) => {
    if (signedResume.error && !signingError) {
      signingError = new Error(signedResume.error);
    }

    if (signedResume.path && signedResume.signedUrl) {
      signedUrlByPath.set(signedResume.path, signedResume.signedUrl);
    }
  });

  if (signingError) {
    return { data: null, error: signingError };
  }

  return {
    data: normalizedRecords.map((record) => ({
      ...record,
      resume_url: signedUrlByPath.get(record.resume_path) || "",
    })),
    error: null,
  };
}

function normalizeObjectPath(value) {
  const withoutBucket = String(value || "")
    .replace(/^\/+/, "")
    .replace(new RegExp(`^${RESUME_BUCKET}/`), "");
  const segments = withoutBucket
    .split("/")
    .filter(Boolean)
    .map(safeDecodeURIComponent);

  if (segments.length === 0 || segments.some((segment) => segment === "..")) {
    return "";
  }

  return segments.join("/");
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
