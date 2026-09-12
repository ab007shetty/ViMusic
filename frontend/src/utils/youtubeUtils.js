// src/utils/youtubeUtils.js

/**
 * Parses a YouTube or YouTube Music URL (or plain text query) and extracts
 * the video ID and source.
 *
 * Supported formats:
 *   https://www.youtube.com/watch?v=TUVcZfQe-Kw
 *   https://youtube.com/watch?v=TUVcZfQe-Kw
 *   https://youtu.be/TUVcZfQe-Kw
 *   https://music.youtube.com/watch?v=TUVcZfQe-Kw
 *
 * @param {string} input - Raw input from the search bar
 * @returns {{ videoId: string, source: 'youtube'|'youtubeMusic', isShort?: boolean } | null}
 *          Returns null when the input is a plain search query (not a URL).
 */
export function parseYouTubeUrl(input) {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();

  // Quick bail-out: if it doesn't look like a URL at all, skip regex work
  if (!trimmed.includes('youtube.com') && !trimmed.includes('youtu.be')) {
    return null;
  }

  let url;
  try {
    // Make sure we have a full URL so URL() can parse it
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, ''); // strip "www."

  // ── music.youtube.com/watch?v=ID ──
  if (host === 'music.youtube.com') {
    const videoId = url.searchParams.get('v');
    if (videoId) return { videoId, source: 'youtubeMusic' };
    return null;
  }

  // ── youtube.com/watch?v=ID ──
  if (host === 'youtube.com' && url.pathname === '/watch') {
    const videoId = url.searchParams.get('v');
    if (videoId) return { videoId, source: 'youtube' };
    return null;
  }

  // ── youtube.com/shorts/ID ──
  if (host === 'youtube.com' && url.pathname.startsWith('/shorts/')) {
    const videoId = url.pathname.replace(/^\/shorts\//, '').split('?')[0];
    if (videoId) return { videoId, source: 'youtube', isShort: true };
    return null;
  }

  // ── youtu.be/ID ──
  if (host === 'youtu.be') {
    const videoId = url.pathname.replace(/^\//, '').split('?')[0];
    if (videoId) return { videoId, source: 'youtube' };
    return null;
  }

  return null;
}

/**
 * Fetches basic video metadata from the YouTube Data API.
 * Returns a song-shaped object ready for the player.
 *
 * @param {string} videoId
 * @param {string} apiKey
 * @param {'youtube'|'youtubeMusic'} source
 * @returns {Promise<object>} song object
 */
export async function fetchVideoMetadata(videoId, apiKey, source = 'youtube', isShort = false) {
  const resp = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`
  );

  if (!resp.ok) {
    throw new Error(`YouTube API error: ${resp.status}`);
  }

  const data = await resp.json();

  if (!data.items || data.items.length === 0) {
    throw new Error('Video not found');
  }

  const item = data.items[0];
  const snippet = item.snippet;

  // Parse ISO 8601 duration (PT4M33S → "4:33")
  const durationText = parseDuration(item.contentDetails?.duration || '');

  return {
    id: videoId,
    title: snippet.title,
    artistsText: snippet.channelTitle,
    channelId: snippet.channelId,
    thumbnailUrl:
      snippet.thumbnails?.maxres?.url ||
      snippet.thumbnails?.high?.url ||
      snippet.thumbnails?.medium?.url ||
      '',
    durationText,
    source,           // 'youtube' | 'youtubeMusic'
    isVideo: true,    // URL-pasted songs always get the video toggle
    isShort,          // Flag for 9:16 aspect ratio
  };
}

/**
 * Looks up durations for a batch of video IDs.
 *
 * The /search endpoint doesn't return duration at all — it only exists on
 * /videos under contentDetails — so search results have to be enriched with
 * a second call or they get saved with an empty durationText.
 *
 * @param {string[]} videoIds
 * @param {string} apiKey
 * @returns {Promise<Record<string, string>>} id → "4:33"
 */
export async function fetchDurations(videoIds, apiKey) {
  if (!videoIds?.length) return {};

  // /videos accepts up to 50 ids per request, so a page of results is one call.
  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const resp = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${chunk.join(',')}&key=${apiKey}`
        );
        if (!resp.ok) return [];
        const data = await resp.json();
        return (data.items || []).map((item) => [
          item.id,
          parseDuration(item.contentDetails?.duration || ''),
        ]);
      } catch {
        return []; // a failed lookup just means no duration, not a failed search
      }
    })
  );

  return Object.fromEntries(results.flat());
}

/**
 * Converts ISO 8601 duration string to "m:ss" format.
 * e.g. "PT4M33S" → "4:33",  "PT1H2M5S" → "1:02:05"
 */
function parseDuration(iso) {
  if (!iso) return '';
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';

  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
