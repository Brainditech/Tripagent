import { z } from "zod";

import { requireEnv } from "@/server/config";
import type { CustomCover } from "@/server/db/schema";

// User-uploaded covers (Phase 8). The app sends the file straight to ImageKit with
// the parameters signed here, and ImageKit serves it resized through its CDN.

/** ImageKit's upload endpoint (API v1), which the app calls with the fields signed below. */
export const UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";

/** How long signed upload parameters stay valid. ImageKit refuses anything beyond one hour. */
const UPLOAD_TTL_SECONDS = 10 * 60;

/**
 * Applied by ImageKit before storing the file: the longer side is capped at 2000 px
 * (`c-at_max` never enlarges), so a phone photo of several megabytes is stored as a
 * few hundred kilobytes. The app then asks for the width it actually displays.
 */
export const COVER_PRE_TRANSFORMATION = "w-2000,h-2000,c-at_max";

/** Extension of the stored file, from the type the picker reports; anything else is called .jpg. */
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/avif": "avif",
};

/**
 * Folder of every cover of a user, under one folder named after the app (the ImageKit
 * media library is shared). Deleted with the account.
 */
export function userCoverFolder(userId: string): string {
  return `/tripagent/covers/${userId}`;
}

/** Folder of a trip's covers, one per trip inside the user's folder. */
export function coverFolder(userId: string, tripId: string): string {
  return `${userCoverFolder(userId)}/${tripId}`;
}

/** Whether `filePath` names a file right inside this trip's cover folder, as the signed upload produces. */
export function isCoverPath(filePath: string, userId: string, tripId: string): boolean {
  const prefix = `${coverFolder(userId, tripId)}/`;
  return filePath.startsWith(prefix) && /^[A-Za-z0-9_-]+(\.[A-Za-z0-9]+)?$/.test(filePath.slice(prefix.length));
}

/**
 * Body of `PUT /api/trips/[id]/cover`: the id ImageKit answered for the uploaded
 * file. The path the app may send along is ignored: the server reads the file back.
 */
export const customCoverSchema = z.object({
  fileId: z.string().min(1).max(100),
  filePath: z.string().max(500).optional(),
});

/**
 * Hex HMAC-SHA1 of `token + expire` with the private key: the signature ImageKit
 * checks on a client-side upload. Web Crypto, so it runs on Node and on EAS Hosting.
 */
export async function uploadSignature(privateKey: string, token: string, expire: number): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(privateKey), { name: "HMAC", hash: "SHA-1" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${token}${expire}`));
  return Array.from(new Uint8Array(mac), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Every multipart field of the upload but the file itself. */
export type CoverUploadFields = {
  publicKey: string;
  token: string;
  expire: string;
  signature: string;
  fileName: string;
  folder: string;
  useUniqueFileName: string;
  transformation: string;
};

/** What the app needs to upload a cover: the endpoint and the fields to send with the file. */
export type CoverUpload = { url: string; fields: CoverUploadFields };

/**
 * Signed parameters for uploading a new cover of a trip from the app. The private
 * key only serves to sign `token + expire` here; the folder, the file name and the
 * pre-transformation are decided here too. The name gets a unique suffix, so a new
 * cover never reuses the URL of the previous one (the CDN cache would serve the old one).
 */
export async function coverUpload(userId: string, tripId: string, mimeType?: string): Promise<CoverUpload> {
  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + UPLOAD_TTL_SECONDS;
  return {
    url: UPLOAD_URL,
    fields: {
      publicKey: requireEnv("IMAGEKIT_PUBLIC_KEY"),
      token,
      expire: String(expire),
      signature: await uploadSignature(requireEnv("IMAGEKIT_PRIVATE_KEY"), token, expire),
      fileName: `cover.${EXTENSIONS[mimeType ?? ""] ?? "jpg"}`,
      folder: coverFolder(userId, tripId),
      useUniqueFileName: "true",
      transformation: JSON.stringify({ pre: COVER_PRE_TRANSFORMATION }),
    },
  };
}

/** Public URL of a stored file, without transformation: the app appends the `tr` it needs. */
export function coverUrl(filePath: string): string {
  return `${requireEnv("IMAGEKIT_URL_ENDPOINT").replace(/\/+$/, "")}${filePath}`;
}

/** The stored cover as the API answers it, with its URL. */
export type CustomCoverWithUrl = CustomCover & { url: string };

export function coverWithUrl(cover: CustomCover | null): CustomCoverWithUrl | null {
  return cover ? { ...cover, url: coverUrl(cover.filePath) } : null;
}

// ImageKit's management API, authenticated with the private key (ADR 0005). Used to
// read a file back after a client-side upload and to delete files and folders.

const API_URL = "https://api.imagekit.io/v1";

function apiHeaders(): Record<string, string> {
  return { Authorization: `Basic ${btoa(`${requireEnv("IMAGEKIT_PRIVATE_KEY")}:`)}`, Accept: "application/json" };
}

/** What matters of a stored file: where it is and whether it is an image. */
export type StoredFile = { fileId: string; filePath: string; fileType: string; size: number | null };

/**
 * The file ImageKit holds under this id, or null when there is none. The upload
 * signature binds neither the folder nor the name, so a cover is recorded from
 * these details and never from what the app declares.
 */
export async function fileDetails(fileId: string, fetchImpl: typeof fetch = fetch): Promise<StoredFile | null> {
  const response = await fetchImpl(`${API_URL}/files/${encodeURIComponent(fileId)}/details`, { headers: apiHeaders() });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`ImageKit answered ${response.status} for file ${fileId}`);
  const file = (await response.json()) as { filePath?: unknown; fileType?: unknown; size?: unknown };
  if (typeof file.filePath !== "string" || typeof file.fileType !== "string") {
    throw new Error(`ImageKit answered without a path or a type for file ${fileId}`);
  }
  return { fileId, filePath: file.filePath, fileType: file.fileType, size: typeof file.size === "number" ? file.size : null };
}

/** Deletes a file; a file already gone counts as deleted. */
export async function deleteFile(fileId: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const response = await fetchImpl(`${API_URL}/files/${encodeURIComponent(fileId)}`, { method: "DELETE", headers: apiHeaders() });
  if (!response.ok && response.status !== 404) throw new Error(`ImageKit answered ${response.status} deleting file ${fileId}`);
}

/** Deletes a file without failing the caller: the database is already right, the leftover is logged. */
export async function tryDeleteFile(fileId: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    await deleteFile(fileId, fetchImpl);
    return true;
  } catch (error) {
    console.error(`[imagekit] file ${fileId} was not deleted`, error);
    return false;
  }
}

/** Deletes a folder with everything in it; a folder already gone counts as deleted. */
export async function deleteFolder(folderPath: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const response = await fetchImpl(`${API_URL}/folder/`, {
    method: "DELETE",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ folderPath }),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`ImageKit answered ${response.status} deleting folder ${folderPath}`);
  }
}
