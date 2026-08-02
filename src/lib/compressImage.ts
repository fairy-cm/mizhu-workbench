/** Compress image File to under maxBytes (default 5MB) via canvas JPEG/WebP. */
export async function compressImageUnderSize(file: File, maxBytes = 5 * 1024 * 1024): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件");
  }
  if (file.size <= maxBytes) return file;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法压缩图片");

  let width = bitmap.width;
  let height = bitmap.height;
  const maxSide = 2048;
  if (width > maxSide || height > maxSide) {
    const scale = maxSide / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const preferWebp = typeof canvas.toBlob === "function";
  let quality = 0.88;
  let blob: Blob | null = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    blob = await new Promise<Blob | null>((resolve) => {
      if (preferWebp) {
        canvas.toBlob((b) => resolve(b), "image/webp", quality);
      } else {
        canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
      }
    });

    // fallback jpeg if webp unsupported
    if (!blob || blob.size === 0) {
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
      });
    }

    if (blob && blob.size <= maxBytes) break;

    if (quality > 0.45) {
      quality -= 0.1;
    } else {
      width = Math.round(width * 0.82);
      height = Math.round(height * 0.82);
      quality = Math.max(0.4, quality);
    }
  }

  bitmap.close();

  if (!blob) throw new Error("图片压缩失败");
  if (blob.size > maxBytes) {
    throw new Error("压缩后仍超过 5MB，请换一张更小的图");
  }

  const ext = blob.type.includes("webp") ? "webp" : "jpg";
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.${ext}`, { type: blob.type, lastModified: Date.now() });
}
