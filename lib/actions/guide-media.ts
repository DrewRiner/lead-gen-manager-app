"use server";

import { randomUUID } from "node:crypto";

import { requireUser } from "@/lib/auth";
import { GUIDE_MEDIA_BUCKET, getServiceClient } from "@/lib/supabase/service";

// Upload limits. Larger videos should be an external embed (YouTube/Loom).
const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function sanitizeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  return ext ? `${randomUUID()}.${ext}` : randomUUID();
}

/**
 * Upload one image/video to the guide-media bucket and return its public URL.
 * Validates type and size; the caller (an image/video block) stores the URL.
 */
export async function uploadGuideMedia(
  formData: FormData,
): Promise<UploadResult> {
  await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file provided." };
  }

  const type = file.type || "";
  const isImage = type.startsWith("image/");
  const isVideo = type.startsWith("video/");
  if (!isImage && !isVideo) {
    return { ok: false, error: "Only image and video files are allowed." };
  }

  if (isImage && file.size > IMAGE_MAX_BYTES) {
    return { ok: false, error: "Images must be 10 MB or smaller." };
  }
  if (isVideo && file.size > VIDEO_MAX_BYTES) {
    return {
      ok: false,
      error:
        "Videos must be 100 MB or smaller. For a larger video, use a YouTube or Loom embed instead.",
    };
  }

  const folder = isImage ? "images" : "videos";
  const path = `${folder}/${sanitizeName(file.name)}`;

  const supabase = getServiceClient();
  const { error } = await supabase.storage
    .from(GUIDE_MEDIA_BUCKET)
    .upload(path, file, { contentType: type, upsert: false });

  if (error) {
    const msg = /bucket.*not.*found/i.test(error.message)
      ? `Storage bucket "${GUIDE_MEDIA_BUCKET}" doesn't exist yet — create it (public) in Supabase Storage.`
      : `Upload failed: ${error.message}`;
    return { ok: false, error: msg };
  }

  const { data } = supabase.storage.from(GUIDE_MEDIA_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
