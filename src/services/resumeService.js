import { createResumeAccessUrl, uploadResumeWithProgress } from "./resumeStorage";
import { updateStudentResumePath } from "./studentProfileService";
import { RESUME_SIGNED_URL_LIFETIME_SECONDS } from "../constants/storage";
import { validateResumeFile } from "../utils/studentProfileValidation";

export async function getTimedResumeAccess(path) {
  const requestedAt = Date.now();
  const result = await createResumeAccessUrl(path);
  if (result.error) throw result.error;
  if (!result.url || !result.path) throw new Error("The secure resume link is unavailable.");
  const url = new URL(result.url);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("The secure resume link is invalid.");
  return {
    path: result.path, url: url.href,
    expiresAt: requestedAt + (RESUME_SIGNED_URL_LIFETIME_SECONDS - 60) * 1000,
  };
}

export async function replaceStudentResume({ userId, accessToken, file, onProgress }) {
  if (!userId || !accessToken) throw new Error("Your session has expired. Please log in again.");
  const validationError = validateResumeFile(file);
  if (validationError) throw new Error(validationError);
  if (!/^[a-zA-Z0-9-]+$/.test(userId)) throw new Error("Invalid resume owner.");
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${userId}/${crypto.randomUUID()}/${Date.now()}-${cleanName}`;
  await uploadResumeWithProgress({ file, filePath: path, accessToken, onProgress });
  onProgress(90);
  try {
    await updateStudentResumePath(userId, path);
  } catch (cause) {
    const error = new Error(cause.message || "Unable to save the resume reference.");
    error.uploadedPath = path;
    error.warning = `The file uploaded, but its profile reference could not be verified. It was retained at ${path}. Reload your profile before retrying; no files were deleted.`;
    throw error;
  }
  return path;
}
