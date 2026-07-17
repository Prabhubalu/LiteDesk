/** Parse YouTube watch / short / embed URLs into a video id. */
export function extractYoutubeVideoId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*v=|youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{6,})/i,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function youtubeEmbedUrl(raw: string | null | undefined): string | null {
  const id = extractYoutubeVideoId(raw);
  if (!id) return null;
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

export function isSafeMediaUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const value = String(raw).trim();
  if (!value) return false;
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
