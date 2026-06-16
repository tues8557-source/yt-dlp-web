'use client';

import type { VideoInfo } from '@/types/video';

export type OfflineMediaKind = 'video' | 'playlist-item';

export type OfflineMediaRecord = {
  key: string;
  kind: OfflineMediaKind;
  uuid: string;
  playlistVideoUuid?: string;
  title: string;
  filename?: string | null;
  mimeType: string;
  size: number;
  duration?: string | number | null;
  thumbnail?: string | null;
  localThumbnail?: string | null;
  thumbnailSource?: VideoInfo['thumbnailSource'];
  updatedAt?: number;
  sourceUrl?: string | null;
  savedAt: number;
  videoInfo: VideoInfo;
  blob: Blob;
};

export type OfflineMediaSummary = Omit<OfflineMediaRecord, 'blob'>;

export type OfflineDownloadProgress = {
  key: string;
  loaded: number;
  total: number;
  progress: number;
};

const DB_NAME = 'yt-dlp-web-offline-media';
const DB_VERSION = 1;
const STORE_NAME = 'media';
const EVENT_CHANGED = 'yt-dlp:offline-media-changed';
const EVENT_PROGRESS = 'yt-dlp:offline-media-progress';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Offline storage is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open offline storage.'));
  });

  return dbPromise;
}

async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = run(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Offline storage request failed.'));
    tx.onerror = () => reject(tx.error || new Error('Offline storage transaction failed.'));
  });
}

export function getOfflineMediaKey(uuid: string, playlistVideoUuid?: string | null) {
  return playlistVideoUuid ? `${uuid}::${playlistVideoUuid}` : uuid;
}

export function isOfflineMediaAvailable() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

export async function getOfflineMedia(key: string) {
  return transaction<OfflineMediaRecord | undefined>('readonly', (store) => store.get(key));
}

export async function listOfflineMedia() {
  const records = await transaction<OfflineMediaRecord[]>('readonly', (store) => store.getAll());
  return records.map(toSummary).sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteOfflineMedia(key: string) {
  await transaction<undefined>('readwrite', (store) => store.delete(key));
  notifyOfflineMediaChanged();
}

export async function saveOfflineVideo(video: VideoInfo, playlistItem?: NonNullable<VideoInfo['playlist']>[number]) {
  const uuid = video.uuid;
  const playlistVideoUuid = playlistItem?.uuid;
  const key = getOfflineMediaKey(uuid, playlistVideoUuid);
  const isPlaylistItem = Boolean(playlistItem);
  const url = isPlaylistItem
    ? `/api/playlist/file?uuid=${encodeURIComponent(uuid)}&itemUuid=${encodeURIComponent(
        playlistVideoUuid || ''
      )}&download=true`
    : `/api/file?uuid=${encodeURIComponent(uuid)}&download=true`;
  const expectedSize = Number(playlistItem?.size || video.file?.size || 0);
  const response = await fetch(url);

  if (!response.ok || !response.body) {
    throw new Error('Failed to download media for offline use.');
  }

  const total = Number(response.headers.get('content-length')) || expectedSize || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    chunks.push(value);
    loaded += value.byteLength;
    notifyOfflineMediaProgress({
      key,
      loaded,
      total,
      progress: total > 0 ? loaded / total : 0
    });
  }

  const mimeType = response.headers.get('content-type') || 'application/octet-stream';
  const blob = new Blob(chunks, { type: mimeType });
  const record: OfflineMediaRecord = {
    key,
    kind: isPlaylistItem ? 'playlist-item' : 'video',
    uuid,
    playlistVideoUuid,
    title: playlistItem?.name || video.title || video.file?.name || video.url || 'Untitled',
    filename: playlistItem?.name || video.file?.name,
    mimeType,
    size: blob.size || total || expectedSize,
    duration: playlistItem?.duration || video.file?.duration,
    thumbnail: video.thumbnail,
    localThumbnail: video.localThumbnail,
    thumbnailSource: video.thumbnailSource,
    updatedAt: video.updatedAt,
    sourceUrl: playlistItem?.url || video.url,
    savedAt: Date.now(),
    videoInfo: video,
    blob
  };

  await transaction<IDBValidKey>('readwrite', (store) => store.put(record));
  notifyOfflineMediaProgress({ key, loaded: record.size, total: record.size, progress: 1 });
  notifyOfflineMediaChanged();

  return toSummary(record);
}

export function createOfflineObjectUrl(record: OfflineMediaRecord) {
  return URL.createObjectURL(record.blob);
}

export function addOfflineMediaChangeListener(listener: () => void) {
  window.addEventListener(EVENT_CHANGED, listener);
  return () => window.removeEventListener(EVENT_CHANGED, listener);
}

export function addOfflineMediaProgressListener(listener: (progress: OfflineDownloadProgress) => void) {
  const handleProgress = (event: Event) => {
    listener((event as CustomEvent<OfflineDownloadProgress>).detail);
  };

  window.addEventListener(EVENT_PROGRESS, handleProgress);
  return () => window.removeEventListener(EVENT_PROGRESS, handleProgress);
}

function toSummary(record: OfflineMediaRecord): OfflineMediaSummary {
  const { blob: _blob, ...summary } = record;
  return summary;
}

function notifyOfflineMediaChanged() {
  window.dispatchEvent(new CustomEvent(EVENT_CHANGED));
}

function notifyOfflineMediaProgress(progress: OfflineDownloadProgress) {
  window.dispatchEvent(new CustomEvent(EVENT_PROGRESS, { detail: progress }));
}
