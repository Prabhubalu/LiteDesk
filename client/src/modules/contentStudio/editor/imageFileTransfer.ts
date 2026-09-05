/** Extensions used when MIME is missing/generic (common on some OS drops). */
const IMAGE_EXTENSIONS = new Set([
  'apng',
  'avif',
  'bmp',
  'gif',
  'heic',
  'heif',
  'ico',
  'jfif',
  'jpeg',
  'jpg',
  'pjp',
  'pjpeg',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp',
]);

export function isImageFile(file: File | null | undefined): boolean {
  if (!file) return false;
  const mime = String(file.type || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  if (mime && mime !== 'application/octet-stream') return false;
  const ext = String(file.name || '').toLowerCase().split('.').pop() || '';
  return IMAGE_EXTENSIONS.has(ext);
}

function firstImageFromFileList(files: FileList | File[] | null | undefined): File | null {
  if (!files) return null;
  for (const file of Array.from(files)) {
    if (isImageFile(file)) return file;
  }
  return null;
}

function firstImageFromItems(items: DataTransferItemList | null | undefined): File | null {
  if (!items) return null;
  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue;
    const mime = String(item.type || '').toLowerCase();
    if (mime && !mime.startsWith('image/') && mime !== 'application/octet-stream') continue;
    const file = item.getAsFile();
    if (isImageFile(file)) return file;
  }
  return null;
}

export function extractImageFileFromClipboard(clipboardData: DataTransfer | null | undefined): File | null {
  if (!clipboardData) return null;
  return firstImageFromItems(clipboardData.items) || firstImageFromFileList(clipboardData.files);
}

/**
 * All image files from a paste (Gmail-style multi-image paste).
 * Prefer `items` over `files` — browsers often expose the same blob in both,
 * and File metadata differs enough that name/size/lastModified dedupe fails.
 */
export function extractImageFilesFromClipboard(clipboardData: DataTransfer | null | undefined): File[] {
  if (!clipboardData) return [];
  const seen = new Set<string>();
  const out: File[] = [];

  const push = (file: File | null | undefined) => {
    if (!isImageFile(file) || !file) return;
    // Ignore lastModified — getAsFile() vs files[] often differs for the same paste.
    const key = `${file.type}:${file.size}:${file.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(file);
  };

  const items = Array.from(clipboardData.items || []);
  let fromItems = 0;
  for (const item of items) {
    if (item.kind !== 'file') continue;
    const before = out.length;
    push(item.getAsFile());
    if (out.length > before) fromItems += 1;
  }
  // Only fall back to files[] when items had no image files (some browsers).
  if (fromItems === 0) {
    for (const file of Array.from(clipboardData.files || [])) {
      push(file);
    }
  }
  return out;
}

export function extractImageFileFromDataTransfer(dataTransfer: DataTransfer | null | undefined): File | null {
  if (!dataTransfer) return null;
  return firstImageFromFileList(dataTransfer.files) || firstImageFromItems(dataTransfer.items);
}
