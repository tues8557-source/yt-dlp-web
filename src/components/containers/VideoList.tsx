'use client';

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import useSWR from 'swr';
import { Card } from '@/components/ui/card';
import { VideoListHeader } from '@/components/video-list/VideoListHeader';
import { VideoListBody } from '@/components/video-list/VideoListBody';
import { GetVideoList } from '@/server/yt-dlp-web';
import type { UserPlaylists } from '@/types/userPlaylist';
import { useOfflineMedia } from '@/client/useOfflineMedia';
import type { OfflineMediaSummary } from '@/client/offlineMedia';
import type { VideoInfo } from '@/types/video';

const MAX_INTERVAL_TIME = 120 * 1000;
const MIN_INTERVAL_TIME = 3 * 1000;

export type VideoListProps = Partial<GetVideoList>;
export type VideoListViewMode = 'all' | 'video' | 'audio' | 'playlists';

export function VideoList() {
  const refreshIntervalTimeRef = useRef(MIN_INTERVAL_TIME);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<VideoListViewMode>('all');
  const [showPlaylistAddGuide, setShowPlaylistAddGuide] = useState(false);

  const { items: offlineItems } = useOfflineMedia();
  const { data, error, isValidating, isLoading, mutate } = useSWR<GetVideoList>(
    '/api/list',
    async () => {
      const data = await axios.get<GetVideoList>('/api/list').then((res) => res.data);

      if (!data) {
        return {
          orders: [],
          items: {}
        };
      }

      let nextIntervalTime = Math.min(
        Math.max(MIN_INTERVAL_TIME, refreshIntervalTimeRef.current * 2),
        MAX_INTERVAL_TIME
      );
      const { items } = data;
      const videos = Object.values(items);
      for (const video of videos) {
        if (
          video.download &&
          ['downloading', 'recording', 'merging', 'standby'].includes(video.status)
        ) {
          nextIntervalTime = 3 * 1000;
          break;
        }
      }
      refreshIntervalTimeRef.current = nextIntervalTime;
      return data;
    },
    {
      refreshInterval: refreshIntervalTimeRef.current,
      errorRetryCount: 1
    }
  );
  const { data: userPlaylists } = useSWR<UserPlaylists>(
    '/api/playlists',
    async () => axios.get<UserPlaylists>('/api/playlists').then((res) => res.data),
    {
      errorRetryCount: 1
    }
  );

  const handleClickReloadButton = mutate;
  const mergedData = mergeOfflineItems(data, offlineItems);

  useEffect(() => {
    const handlePlaylistAddGuide = () => {
      setShowPlaylistAddGuide(true);
      setViewMode('all');
      window.setTimeout(() => {
        document
          .getElementById('video-gallery-playlist-guide')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    };

    window.addEventListener('yt-dlp:playlist-add-guide', handlePlaylistAddGuide);
    return () => window.removeEventListener('yt-dlp:playlist-add-guide', handlePlaylistAddGuide);
  }, []);

  const searchedOrder =
    mergedData && search.trim()
      ? mergedData.orders.filter((uuid) => {
          const item = mergedData.items[uuid];
          if (!item) return false;
          const lowerCaseSearch = search.trim().toLowerCase();
          const title = item?.title?.toLowerCase();
          const filename = item?.file?.name?.toLowerCase();

          return title?.includes(lowerCaseSearch) || filename?.includes(lowerCaseSearch);
        })
      : mergedData?.orders;
  const filteredOrder =
    mergedData && searchedOrder
      ? searchedOrder.filter((uuid) => {
          const item = mergedData.items[uuid];
          if (!item || viewMode === 'all' || viewMode === 'playlists') return true;

          const isAudio = isAudioItem(item);
          return viewMode === 'audio' ? isAudio : !isAudio;
        })
      : searchedOrder;

  return (
    <Card
      id='video-gallery-playlist-guide'
      className='relative overflow-visible border-none p-4 shadow-md'
    >
      {showPlaylistAddGuide && (
        <div className='mb-4 flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <div className='font-semibold'>Add a file to a playlist</div>
            <div className='mt-1 text-muted-foreground'>
              Use the highlighted playlist button on a video card, then choose an existing playlist
              or create a new one.
            </div>
          </div>
          <button
            type='button'
            className='self-start rounded-full px-3 py-1.5 text-sm font-medium hover:bg-warning/20 sm:self-center'
            onClick={() => setShowPlaylistAddGuide(false)}
          >
            Got it
          </button>
        </div>
      )}
      <VideoListHeader
        items={mergedData?.items}
        orders={filteredOrder}
        isValidating={isValidating || Boolean(error)}
        search={search}
        setSearch={setSearch}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onClickReloadButton={handleClickReloadButton}
      />
      <VideoListBody
        orders={filteredOrder}
        items={mergedData?.items}
        userPlaylists={userPlaylists}
        viewMode={viewMode}
        isLoading={isLoading && !mergedData}
        highlightPlaylistButtons={showPlaylistAddGuide}
      />
    </Card>
  );
}

function mergeOfflineItems(data: GetVideoList | undefined, offlineItems: OfflineMediaSummary[]) {
  const next: GetVideoList = {
    orders: [...(data?.orders || [])],
    items: {
      ...(data?.items || {})
    }
  };

  for (const offlineItem of offlineItems) {
    const key = offlineItem.key;
    const existingItem = next.items[offlineItem.uuid];
    if (existingItem && offlineItem.kind === 'video') {
      next.items[offlineItem.uuid] = {
        ...existingItem,
        offlineKey: key
      };
      continue;
    }

    if (next.items[key]) continue;

    next.orders.push(key);
    next.items[key] = createOfflineVideoInfo(offlineItem);
  }

  return next.orders.length ? next : data;
}

function createOfflineVideoInfo(item: OfflineMediaSummary): VideoInfo {
  const now = item.updatedAt || item.savedAt;

  return {
    uuid: item.uuid,
    offlineKey: item.key,
    playlistVideoUuid: item.playlistVideoUuid,
    id: null,
    url: item.sourceUrl || '',
    title: item.title,
    description: null,
    thumbnail: item.thumbnail || null,
    uploadDate: null,
    localThumbnail: item.localThumbnail || null,
    thumbnailSource: item.thumbnailSource,
    status: 'completed',
    isLive: false,
    format: '',
    usingCookies: false,
    embedThumbnail: false,
    embedChapters: false,
    embedMetadata: false,
    embedVideoThumbnail: false,
    embedSubs: false,
    subLangs: [],
    enableProxy: false,
    enableLiveFromStart: false,
    proxyAddress: '',
    cutVideo: false,
    cutStartTime: '',
    cutEndTime: '',
    outputFilename: '',
    filenameLengthLimit: 0,
    selectQuality: 'best',
    enableForceKeyFramesAtCuts: false,
    file: {
      path: item.key,
      name: item.filename || item.title,
      size: item.size,
      duration: typeof item.duration === 'number' ? String(item.duration) : item.duration || undefined
    },
    playlist: [],
    download: {
      pid: null,
      progress: '1',
      speed: null
    },
    createdAt: item.savedAt,
    updatedAt: now,
    type: 'video'
  };
}

function isAudioItem(item: GetVideoList['items'][string]) {
  return item?.selectQuality === 'audio' || item?.format === 'ba';
}
