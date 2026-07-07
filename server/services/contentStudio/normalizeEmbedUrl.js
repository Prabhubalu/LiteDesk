'use strict';

function parseYoutubeTimestamp(value) {
  const trimmed = String(value || '').trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  let seconds = 0;
  const hours = trimmed.match(/(\d+)h/i);
  const minutes = trimmed.match(/(\d+)m/i);
  const secs = trimmed.match(/(\d+)s/i);
  if (hours) seconds += Number(hours[1]) * 3600;
  if (minutes) seconds += Number(minutes[1]) * 60;
  if (secs) seconds += Number(secs[1]);
  return seconds;
}

function buildYoutubeEmbedUrl(videoId, sourceUrl) {
  const embed = new URL(`https://www.youtube.com/embed/${videoId}`);
  const timestamp =
    sourceUrl.searchParams.get('t') ||
    sourceUrl.searchParams.get('start') ||
    sourceUrl.hash.replace(/^#t=/, '');
  if (timestamp) {
    const start = parseYoutubeTimestamp(timestamp);
    if (start > 0) embed.searchParams.set('start', String(start));
  }
  return embed.toString();
}

function extractYoutubeVideoId(url) {
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');

  if (host === 'youtu.be') {
    return url.pathname.slice(1).split('/')[0] || '';
  }

  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') {
    return '';
  }

  if (url.pathname === '/watch') {
    return url.searchParams.get('v') || '';
  }

  const pathMatch = url.pathname.match(/^\/(?:embed|shorts|v|live)\/([^/?#]+)/);
  return pathMatch?.[1] || '';
}

function isGoogleMapsEmbedUrl(url) {
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'google.com' && url.pathname.startsWith('/maps/embed')) {
    return true;
  }
  return host === 'maps.google.com' && url.pathname.startsWith('/maps/embed');
}

function normalizeEmbedUrl(raw) {
  const input = String(raw || '').trim();
  if (!input) return '';

  let url;
  try {
    url = new URL(input);
  } catch {
    return '';
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return '';
  }

  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');

  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
    const videoId = extractYoutubeVideoId(url);
    if (!videoId) return '';
    if (url.pathname.startsWith('/embed/')) {
      return input;
    }
    return buildYoutubeEmbedUrl(videoId, url);
  }

  if (host === 'vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) {
      return `https://player.vimeo.com/video/${id}`;
    }
    return '';
  }

  if (host === 'player.vimeo.com') {
    return input;
  }

  if (isGoogleMapsEmbedUrl(url)) {
    return input;
  }

  return '';
}

function isEmbeddableUrl(raw) {
  return Boolean(normalizeEmbedUrl(raw));
}

module.exports = {
  normalizeEmbedUrl,
  isEmbeddableUrl,
};
