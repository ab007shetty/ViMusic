// utils/thumbnails.js
//
// Two different thumbnail URL families reach this app and each asks for a
// bigger image its own way:
//
//   https://i.ytimg.com/vi/<id>/hqdefault.jpg        — YouTube Data API,
//     used by every song added through the website. Sizes are named files,
//     not parameters.
//   https://lh3.googleusercontent.com/...=w60-h60-l90-rj — YouTube Music,
//     used by songs synced from the Android app. Size lives in the params.
//
// Size is picked per context rather than always requesting the maximum. A
// grid card renders at roughly 204x224 CSS px — about 408x448 on a 2x
// display — so `sddefault` (640x480) and `w544` already exceed what the
// screen can show, while `maxresdefault` and `w1000` cost 2-4x the bytes
// for pixels that get thrown away. Only the maximized player, which draws
// artwork ~684px tall, actually benefits from the large versions.
//
//   card: lh3 105KB / ytimg 24KB      full: lh3 225KB / ytimg 54KB
//
// Everything except the maximized player deliberately requests the SAME
// 'card' url, so one cached image serves the grid, the queue, the mini
// player and playlist covers instead of downloading a variant per surface.

const YTIMG_RE = /^(https?:\/\/i\.ytimg\.com\/vi\/[^/]+\/)([a-zA-Z0-9_]+)(\.jpg.*)$/;

// Ordered best-to-worst; stepDown() walks forward from whichever is current.
// maxresdefault is 1280x720 but doesn't exist for every video; sddefault
// (640x480) and hqdefault (480x360) always do.
const YTIMG_SIZES = ['maxresdefault', 'sddefault', 'hqdefault'];

const VARIANTS = {
  card: { lh3: 'w544-h544', ytimg: 'sddefault' },
  full: { lh3: 'w1000-h1000', ytimg: 'maxresdefault' },
  // For places that can't recover from a miss — MediaSession lock-screen
  // artwork isn't an <img>, so it gets no load/error event to fall back from.
  safe: { lh3: 'w544-h544', ytimg: 'sddefault' },
};

export function thumbnailFor(url, variant = 'card') {
  if (!url) return '';

  const size = VARIANTS[variant] || VARIANTS.card;

  if (/w\d+-h\d+/.test(url)) return url.replace(/w\d+-h\d+/, size.lh3);

  const match = url.match(YTIMG_RE);
  if (match) return `${match[1]}${size.ytimg}${match[3]}`;

  return url; // local asset or unknown host — leave alone
}

// Returns true when it actually stepped down. There is deliberately no
// stock-image fallback: every song has real artwork, so an exhausted ladder
// means the image genuinely failed and the card shows its own background
// rather than a misleading placeholder photo.
function stepDown(img) {
  const match = img.src.match(YTIMG_RE);
  const next = match && YTIMG_SIZES[YTIMG_SIZES.indexOf(match[2]) + 1];

  if (!next) return false;

  img.src = `${match[1]}${next}${match[3]}`;
  return true;
}

// Both handlers return true when another size is being tried, so callers
// can tell "still resolving" apart from "this is the final image".
export function handleThumbnailError(event) {
  return stepDown(event.currentTarget);
}

// Videos missing a size fail in two different ways: some 404, but others
// return HTTP 200 with a 120x90 grey placeholder — which fires `load`, not
// `error`. The real sizes we request are all far larger than that, so
// anything coming back at 120x90 is the placeholder rather than artwork.
export function handleThumbnailLoad(event) {
  const img = event.currentTarget;
  if (img.naturalWidth <= 120 && img.naturalHeight <= 90 && YTIMG_RE.test(img.src)) {
    return stepDown(img);
  }
  return false;
}
