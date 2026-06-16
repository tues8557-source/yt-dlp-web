'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addOfflineMediaChangeListener,
  addOfflineMediaProgressListener,
  deleteOfflineMedia,
  getOfflineMediaKey,
  isOfflineMediaAvailable,
  listOfflineMedia,
  saveOfflineVideo,
  type OfflineDownloadProgress,
  type OfflineMediaSummary
} from '@/client/offlineMedia';
import type { VideoInfo } from '@/types/video';

export function useOfflineMedia() {
  const [items, setItems] = useState<OfflineMediaSummary[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, OfflineDownloadProgress>>({});
  const [isLoading, setLoading] = useState(true);

  const refresh = async () => {
    if (!isOfflineMediaAvailable()) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setItems(await listOfflineMedia());
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const removeChangeListener = addOfflineMediaChangeListener(() => void refresh());
    const removeProgressListener = addOfflineMediaProgressListener((progress) => {
      setProgressMap((prev) => ({
        ...prev,
        [progress.key]: progress
      }));
      if (progress.progress >= 1) {
        window.setTimeout(() => {
          setProgressMap((prev) => {
            const next = { ...prev };
            delete next[progress.key];
            return next;
          });
        }, 1200);
      }
    });

    return () => {
      removeChangeListener();
      removeProgressListener();
    };
  }, []);

  const itemMap = useMemo(
    () =>
      items.reduce<Record<string, OfflineMediaSummary>>((map, item) => {
        map[item.key] = item;
        return map;
      }, {}),
    [items]
  );

  return {
    isAvailable: isOfflineMediaAvailable(),
    isLoading,
    itemMap,
    items,
    progressMap,
    deleteOffline: deleteOfflineMedia,
    getKey: getOfflineMediaKey,
    refresh,
    saveOffline: saveOfflineVideo
  };
}

export function toOfflineVideoInfo(summary: OfflineMediaSummary) {
  return {
    uuid: summary.uuid,
    title: summary.title,
    url: summary.sourceUrl || '',
    thumbnail: summary.thumbnail,
    localThumbnail: summary.localThumbnail,
    thumbnailSource: summary.thumbnailSource,
    updatedAt: summary.updatedAt,
    playlistVideoUuid: summary.playlistVideoUuid,
    filename: summary.filename,
    size: summary.size,
    type: summary.kind === 'playlist-item' ? ('playlist' as const) : ('video' as const),
    duration: summary.duration,
    offlineKey: summary.key
  };
}

export function getOfflineSummaryForVideo(
  itemMap: Record<string, OfflineMediaSummary>,
  video: Pick<VideoInfo, 'uuid'>,
  playlistVideoUuid?: string | null
) {
  return itemMap[getOfflineMediaKey(video.uuid, playlistVideoUuid)];
}
