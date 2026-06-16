const RANGE_CACHE_NAME = 'yt-dlp-web-range-cache-v1';
const RANGE_CACHE_PATH = '/__yt_dlp_range_cache__';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!['/api/file', '/api/playlist/file'].includes(url.pathname)) return;
  if (url.searchParams.get('download') === 'true') return;

  const rangeHeader = request.headers.get('range');
  if (!rangeHeader) return;

  event.respondWith(handleRangeRequest(request, url, rangeHeader));
});

async function handleRangeRequest(request, url, rangeHeader) {
  const requestedRange = parseRangeHeader(rangeHeader);
  const source = getRangeSourceKey(url);
  if (requestedRange) {
    const cachedResponse = await getCachedRangeResponse(source, requestedRange.start, requestedRange.end);
    if (cachedResponse) {
      notifyClients({
        type: 'range-cache-hit',
        source,
        start: cachedResponse.start,
        end: cachedResponse.end,
        total: cachedResponse.total
      });
      return cachedResponse.response;
    }
  }

  const response = await fetch(request);
  if (response.status !== 206) {
    return response;
  }

  const contentRange = parseContentRange(response.headers.get('content-range'));
  if (!contentRange) {
    return response;
  }

  const responseForBrowser = response.clone();
  await cacheRangeResponse(source, contentRange, response).catch(() => {});
  notifyClients({
    type: 'range-cache-updated',
    source,
    start: contentRange.start,
    end: contentRange.end,
    total: contentRange.total
  });

  return responseForBrowser;
}

async function getCachedRangeResponse(source, requestedStart, requestedEnd) {
  const cache = await caches.open(RANGE_CACHE_NAME);
  const requests = await cache.keys();

  for (const request of requests) {
    const meta = parseRangeCacheRequest(request);
    if (!meta || meta.source !== source) continue;
    if (requestedStart < meta.start || requestedStart > meta.end) continue;
    if (typeof requestedEnd === 'number' && requestedEnd > meta.end) continue;

    const cached = await cache.match(request);
    if (!cached) continue;

    const blob = await cached.blob();
    const sliceStart = requestedStart - meta.start;
    const sliceEnd = typeof requestedEnd === 'number' ? requestedEnd - meta.start + 1 : blob.size;
    const slicedBlob = blob.slice(sliceStart, sliceEnd, cached.headers.get('content-type') || undefined);
    const actualEnd = requestedStart + slicedBlob.size - 1;

    return {
      start: requestedStart,
      end: actualEnd,
      total: meta.total,
      response: new Response(slicedBlob, {
        status: 206,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Length': String(slicedBlob.size),
          'Content-Range': `bytes ${requestedStart}-${actualEnd}/${meta.total}`,
          'Content-Type': cached.headers.get('content-type') || 'application/octet-stream',
          'X-YTDLP-Range-Cache': 'hit'
        }
      })
    };
  }

  return null;
}

async function cacheRangeResponse(source, range, response) {
  const cache = await caches.open(RANGE_CACHE_NAME);
  const blob = await response.blob();
  if (!blob.size) return;

  const cacheUrl = new URL(RANGE_CACHE_PATH, self.location.origin);
  cacheUrl.searchParams.set('source', source);
  cacheUrl.searchParams.set('start', String(range.start));
  cacheUrl.searchParams.set('end', String(range.end));
  cacheUrl.searchParams.set('total', String(range.total));

  await cache.put(
    new Request(cacheUrl.toString()),
    new Response(blob, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream'
      }
    })
  );
}

function parseRangeHeader(value) {
  const match = /^bytes=(\d+)-(\d*)$/i.exec(value || '');
  if (!match) return null;

  return {
    start: Number(match[1]),
    end: match[2] ? Number(match[2]) : undefined
  };
}

function parseContentRange(value) {
  const match = /^bytes\s+(\d+)-(\d+)\/(\d+)$/i.exec(value || '');
  if (!match) return null;

  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: Number(match[3])
  };
}

function parseRangeCacheRequest(request) {
  try {
    const url = new URL(request.url);
    if (url.pathname !== RANGE_CACHE_PATH) return null;

    return {
      source: url.searchParams.get('source') || '',
      start: Number(url.searchParams.get('start')),
      end: Number(url.searchParams.get('end')),
      total: Number(url.searchParams.get('total'))
    };
  } catch (e) {
    return null;
  }
}

function getRangeSourceKey(url) {
  const params = new URLSearchParams();
  for (const key of ['uuid', 'itemUuid', 'variant']) {
    const value = url.searchParams.get(key);
    if (value) params.set(key, value);
  }

  return `${url.pathname}?${params.toString()}`;
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  clients.forEach((client) => client.postMessage(message));
}
