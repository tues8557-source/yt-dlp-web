import { forwardRef, memo, type HTMLAttributes } from 'react';
import { VirtuosoGrid } from 'react-virtuoso';
import { VideoGridItem } from '@/components/video-list/VideoGridItem';
import { useVideoListStore } from '@/store/videoList';
import { Skeleton } from '@/components/ui/skeleton';
import { type VideoListProps, type VideoListViewMode } from '@/components/containers/VideoList';
import { isPropsEquals } from '@/lib/utils';
import type { UserPlaylists } from '@/types/userPlaylist';
import type { VideoPlayerQueueItem } from '@/components/modules/VideoPlayer';

const getUserPlaylistSectionId = (playlistId: string) => `user-playlist-${playlistId}`;
const GRID_CLASS_NAME =
  'grid gap-x-3 gap-y-6 sm:gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3';
const VIRTUOSO_INCREASE_VIEWPORT_BY = { top: 700, bottom: 1400 };

const virtuosoGridComponents = {
  List: forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ children, className, ...props }, ref) => (
      <div ref={ref} className={GRID_CLASS_NAME} {...props}>
        {children}
      </div>
    )
  ),
  Item: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  )
};

virtuosoGridComponents.List.displayName = 'VirtuosoVideoGridList';

type VideoListBodyProps = {
  highlightPlaylistButtons?: boolean;
  isLoading: boolean;
  userPlaylists?: UserPlaylists;
  viewMode: VideoListViewMode;
} & VideoListProps;

export const VideoListBody = ({
  items,
  orders,
  userPlaylists,
  viewMode,
  isLoading,
  highlightPlaylistButtons
}: VideoListBodyProps) => {
  const { layoutMode } = useVideoListStore();

  switch (layoutMode) {
    // case 'table': {
    //   return (
    //     <div className='space-y-2'>
    //       {videos.map((video) => (
    //         <VideoTableItem key={video.uuid} video={video} />
    //       ))}
    //     </div>
    //   );
    // }
    case 'grid': {
      return viewMode === 'playlists' ? (
        <UserPlaylistGridViewer
          items={items}
          orders={orders}
          userPlaylists={userPlaylists}
          viewMode={viewMode}
          isLoading={isLoading}
          highlightPlaylistButtons={highlightPlaylistButtons}
        />
      ) : (
        <VideoGridViewer
          items={items}
          orders={orders}
          userPlaylists={userPlaylists}
          viewMode={viewMode}
          isLoading={isLoading}
          highlightPlaylistButtons={highlightPlaylistButtons}
        />
      );
    }
    default: {
      return <div>Not Supported</div>;
    }
  }
};

function UserPlaylistGridViewer({
  items,
  orders,
  userPlaylists,
  isLoading,
  highlightPlaylistButtons
}: VideoListBodyProps) {
  const visibleUuids = new Set(orders || []);

  if (isLoading || !items || !orders || !userPlaylists) {
    return (
      <VideoGridViewer
        items={items}
        orders={orders}
        userPlaylists={userPlaylists}
        viewMode='all'
        isLoading={isLoading}
        highlightPlaylistButtons={highlightPlaylistButtons}
      />
    );
  }

  const visiblePlaylistIds = userPlaylists.orders.filter((playlistId) => {
    const playlist = userPlaylists.items[playlistId];
    return playlist?.uuids.some((uuid) => visibleUuids.has(uuid) && items[uuid]);
  });

  if (visiblePlaylistIds.length === 0) {
    return (
      <div className='flex min-h-[40vh] w-full items-center justify-center py-10'>
        <span className='select-none text-3xl text-muted-foreground opacity-50'>No playlists</span>
      </div>
    );
  }

  return (
    <div className='space-y-10'>
      <nav
        className='flex gap-2 overflow-x-auto pb-1 scrollbar-hidden'
        aria-label='Playlist shortcuts'
      >
        {visiblePlaylistIds.map((playlistId) => {
          const playlist = userPlaylists.items[playlistId];
          return (
            <button
              key={playlistId}
              type='button'
              className='shrink-0 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/20'
              onClick={() => {
                document
                  .getElementById(getUserPlaylistSectionId(playlistId))
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              {playlist.name}
            </button>
          );
        })}
      </nav>
      {visiblePlaylistIds.map((playlistId) => {
        const playlist = userPlaylists.items[playlistId];
        const playlistUuids = playlist.uuids.filter((uuid) => visibleUuids.has(uuid) && items[uuid]);
        const playlistQueue = playlistUuids
          .map((uuid) => items[uuid])
          .filter((item) => item?.status === 'completed' && item.type !== 'playlist' && item.file?.path)
          .map(toVideoPlayerQueueItem);

        return (
          <section
            key={playlistId}
            id={getUserPlaylistSectionId(playlistId)}
            className='scroll-mt-4 space-y-4'
          >
            <div className='flex items-baseline gap-x-2'>
              <h2 className='text-lg font-bold'>{playlist.name}</h2>
              <span className='text-sm text-muted-foreground'>({playlistUuids.length})</span>
            </div>
            <VideoGrid
              items={items}
              orders={playlistUuids}
              keyPrefix={playlistId}
              highlightPlaylistButtons={highlightPlaylistButtons}
              queueTitle={playlist.name}
              queue={playlistQueue}
            />
          </section>
        );
      })}
    </div>
  );
}

function VideoGridViewer({
  items,
  orders,
  isLoading,
  highlightPlaylistButtons
}: VideoListBodyProps) {
  return !isLoading && items && orders ? (
    <>
      {orders.length === 0 && (
        <div className='flex items-center justify-center w-full min-h-[40vh] col-start-1 col-end-4 py-10'>
          <span className='text-3xl text-muted-foreground opacity-50 select-none'>Empty</span>
        </div>
      )}
      <VideoGrid
        items={items}
        orders={orders}
        highlightPlaylistButtons={highlightPlaylistButtons}
      />
    </>
  ) : (
    <div className={GRID_CLASS_NAME}>
      <div className='space-y-2'>
        <Skeleton className='aspect-video bg-card-nested' />
        <Skeleton className='h-3.5 bg-card-nested' />
        <Skeleton className='h-3.5 bg-card-nested' />
      </div>
      <div className='space-y-2'>
        <Skeleton className='aspect-video bg-card-nested' />
        <Skeleton className='h-3.5 bg-card-nested' />
        <Skeleton className='h-3.5 bg-card-nested' />
      </div>
      <div className='space-y-2'>
        <Skeleton className='aspect-video bg-card-nested' />
        <Skeleton className='h-3.5 bg-card-nested' />
        <Skeleton className='h-3.5 bg-card-nested' />
      </div>
      <div className='space-y-2'>
        <Skeleton className='aspect-video bg-card-nested' />
        <Skeleton className='h-3.5 bg-card-nested' />
        <Skeleton className='h-3.5 bg-card-nested' />
      </div>
    </div>
  );
}

function VideoGrid({
  items,
  orders,
  highlightPlaylistButtons,
  keyPrefix,
  queueTitle,
  queue
}: {
  items: NonNullable<VideoListProps['items']>;
  orders: string[];
  highlightPlaylistButtons?: boolean;
  keyPrefix?: string;
  queueTitle?: string | null;
  queue?: VideoPlayerQueueItem[];
}) {
  return (
    <VirtuosoGrid
      useWindowScroll
      components={virtuosoGridComponents}
      data={orders}
      computeItemKey={(_, uuid) => (keyPrefix ? `${keyPrefix}-${uuid}` : uuid)}
      increaseViewportBy={VIRTUOSO_INCREASE_VIEWPORT_BY}
      itemContent={(_, uuid) => (
        <VideoGridItemWithMemo
          video={items[uuid]}
          items={items}
          highlightPlaylistButton={highlightPlaylistButtons}
          queueTitle={queueTitle}
          queue={queue}
        />
      )}
    />
  );
}

const VideoGridItemWithMemo = memo(VideoGridItem, isPropsEquals);

function toVideoPlayerQueueItem(video: NonNullable<VideoListProps['items']>[string]): VideoPlayerQueueItem {
  return {
    uuid: video.uuid,
    title: video.title,
    url: video.url,
    thumbnail: video.thumbnail,
    localThumbnail: video.localThumbnail,
    thumbnailSource: video.thumbnailSource,
    updatedAt: video.updatedAt,
    uploadDate: video.uploadDate,
    filename: video.file?.name,
    size: video.file?.size,
    duration: video.file?.duration,
    width: video.file?.width,
    height: video.file?.height,
    rFrameRate: video.file?.rFrameRate,
    codecName: video.file?.codecName,
    colorPrimaries: video.file?.colorPrimaries,
    containerName: video.file?.containerName
  };
}
