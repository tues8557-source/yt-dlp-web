'use client';

import { useEffect, useMemo, useState } from 'react';

export type MediaCachedRange = {
  start: number;
  end: number;
  total: number;
};

type MediaCachedRangeWithSource = MediaCachedRange & {
  source: string;
};

const RANGE_CACHE_NAME = 'yt-dlp-web-range-cache-v1';
const RANGE_CACHE_PATH = '/__yt_dlp_range_cache__';
const RANGE_CACHE_INDEX_TTL = 2000;
const LEGACY_OFFLINE_MEDIA_CACHE_NAME = 'yt-dlp-web-offline-media-v1';
const LEGACY_OFFLINE_MEDIA_DB_NAME = 'yt-dlp-web-offline-media';

let rangeIndex: MediaCachedRangeWithSource[] = [];
let rangeIndexLoadedAt = 0;
let rangeIndexPromise: Promise<MediaCachedRangeWithSource[]> | null = null;

export async function registerMediaRangeCacheWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register('/offline-media-sw.js');
  } catch (e) {}

  await cleanupLegacyOfflineMediaStorage();
}

export function getRangeCacheSource(pathOrUrl: string) {
  if (!pathOrUrl || pathOrUrl.startsWith('blob:')) return '';

  try {
    const url = new URL(pathOrUrl, window.location.origin);
    const params = new URLSearchParams();
    for (const key of ['uuid', 'itemUuid', 'variant']) {
      const value = url.searchParams.get(key);
      if (value) params.set(key, value);
    }

    return `${url.pathname}?${params.toString()}`;
  } catch (e) {
    return '';
  }
}

export function useMediaRangeCache(sourceUrl: string, enabled = true) {
  const source = useMemo(() => getRangeCacheSource(sourceUrl), [sourceUrl]);
  const [ranges, setRanges] = useState<MediaCachedRange[]>([]);

  useEffect(() => {
    if (!enabled || !source) {
      setRanges([]);
      return;
    }

    let isMounted = true;
    const refresh = async () => {
      const nextRanges = await listCachedRanges(source).catch(() => []);
      if (isMounted) setRanges(nextRanges);
    };
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== source) return;
      if (data.type !== 'range-cache-updated' && data.type !== 'range-cache-hit') return;

      rangeIndexLoadedAt = 0;
      void refresh();
    };

    void refresh();
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    const interval = window.setInterval(refresh, 30000);

    return () => {
      isMounted = false;
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
      window.clearInterval(interval);
    };
  }, [enabled, source]);

  return ranges;
}

async function listCachedRanges(source: string) {
  const ranges = await listAllCachedRanges();

  return mergeRanges(ranges.filter((range) => range.source === source));
}

async function listAllCachedRanges() {
  if (typeof caches === 'undefined') return [];

  const now = Date.now();
  if (rangeIndexPromise) return rangeIndexPromise;
  if (now - rangeIndexLoadedAt < RANGE_CACHE_INDEX_TTL) return rangeIndex;

  rangeIndexPromise = (async () => {
    const cache = await caches.open(RANGE_CACHE_NAME);
    const requests = await cache.keys();
    rangeIndex = requests
      .map(parseRangeCacheRequest)
      .filter((range): range is MediaCachedRangeWithSource => Boolean(range));
    rangeIndexLoadedAt = Date.now();
    rangeIndexPromise = null;

    return rangeIndex;
  })().catch((error) => {
    rangeIndexPromise = null;
    throw error;
  });

  return rangeIndexPromise;
}

function parseRangeCacheRequest(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.pathname !== RANGE_CACHE_PATH) return null;

    const source = url.searchParams.get('source') || '';
    const start = Number(url.searchParams.get('start'));
    const end = Number(url.searchParams.get('end'));
    const total = Number(url.searchParams.get('total'));
    if (![start, end, total].every(Number.isFinite)) return null;

    return { source, start, end, total };
  } catch (e) {
    return null;
  }
}

function mergeRanges(ranges: MediaCachedRange[]) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: MediaCachedRange[] = [];

  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end + 1) {
      merged.push({ ...range });
      continue;
    }

    previous.end = Math.max(previous.end, range.end);
    previous.total = Math.max(previous.total, range.total);
  }

  return merged;
}

async function cleanupLegacyOfflineMediaStorage() {
  try {
    if (typeof caches !== 'undefined') {
      await caches.delete(LEGACY_OFFLINE_MEDIA_CACHE_NAME);
    }
  } catch (e) {}

  try {
    if (typeof indexedDB !== 'undefined') {
      indexedDB.deleteDatabase(LEGACY_OFFLINE_MEDIA_DB_NAME);
    }
  } catch (e) {}
}
