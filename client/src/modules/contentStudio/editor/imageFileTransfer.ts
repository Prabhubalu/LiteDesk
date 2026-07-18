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

export function extractImageFileFromDataTransfer(dataTransfer: DataTransfer | null | undefined): File | null {
  if (!dataTransfer) return null;
  return firstImageFromFileList(dataTransfer.files) || firstImageFromItems(dataTransfer.items);
}
