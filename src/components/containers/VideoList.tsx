'use client';

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import useSWR from 'swr';
import { Card } from '@/components/ui/card';
import { VideoListHeader } from '@/components/video-list/VideoListHeader';
import { VideoListBody } from '@/components/video-list/VideoListBody';
import { GetVideoList } from '@/server/yt-dlp-web';
import type { UserPlaylists } from '@/types/userPlaylist';

const MAX_INTERVAL_TIME = 120 * 1000;
const MIN_INTERVAL_TIME = 3 * 1000;

export type VideoListProps = Partial<GetVideoList>;
export type VideoListViewMode = 'all' | 'video' | 'audio' | 'playlists';

export function VideoList() {
  const refreshIntervalTimeRef = useRef(MIN_INTERVAL_TIME);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<VideoListViewMode>('all');
  const [showPlaylistAddGuide, setShowPlaylistAddGuide] = useState(false);

  const { data, isValidating, isLoading, mutate } = useSWR<GetVideoList>(
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
    data && search.trim()
      ? data.orders.filter((uuid) => {
          const item = data.items[uuid];
          if (!item) return false;
          const lowerCaseSearch = search.trim().toLowerCase();
          const title = item?.title?.toLowerCase();
          const filename = item?.file?.name?.toLowerCase();

          return title?.includes(lowerCaseSearch) || filename?.includes(lowerCaseSearch);
        })
      : data?.orders;
  const filteredOrder =
    data && searchedOrder
      ? searchedOrder.filter((uuid) => {
          const item = data.items[uuid];
          if (!item || viewMode === 'all' || viewMode === 'playlists') return true;

          const isAudio = isAudioItem(item);
          return viewMode === 'audio' ? isAudio : !isAudio;
        })
      : searchedOrder;

  return (
    <Card
      id='video-gallery-playlist-guide'
      className='relative p-4 overflow-hidden border-none shadow-md'
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
        items={data?.items}
        orders={filteredOrder}
        isValidating={isValidating}
        search={search}
        setSearch={setSearch}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onClickReloadButton={handleClickReloadButton}
      />
      <VideoListBody
        orders={filteredOrder}
        items={data?.items}
        userPlaylists={userPlaylists}
        viewMode={viewMode}
        isLoading={isLoading}
        highlightPlaylistButtons={showPlaylistAddGuide}
      />
    </Card>
  );
}

function isAudioItem(item: GetVideoList['items'][string]) {
  return item?.selectQuality === 'audio' || item?.format === 'ba';
}
