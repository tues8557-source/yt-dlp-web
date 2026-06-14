import { CacheHelper } from '@/server/helpers/CacheHelper';
import type { VideoPlayerVideoInfo } from '@/components/modules/VideoPlayer';
import { WatchVideoPlayer } from '@/components/containers/WatchVideoPlayer';
import type { VideoInfo } from '@/types/video';

export const dynamic = 'force-dynamic';

type WatchPageProps = {
  searchParams: {
    uuid?: string;
    itemUuid?: string;
    t?: string;
  };
};

export default async function WatchPage({ searchParams }: WatchPageProps) {
  const video = searchParams.uuid ? await CacheHelper.get<VideoInfo>(searchParams.uuid) : null;
  const startTime = Number(searchParams.t);
  const videoInfo = video
    ? getVideoPlayerInfo(
        video,
        searchParams.itemUuid,
        Number.isFinite(startTime) && startTime > 0 ? startTime : undefined
      )
    : null;

  if (!videoInfo) {
    return (
      <main className='flex min-h-screen items-center justify-center bg-background p-6 text-center text-foreground'>
        <div>
          <h1 className='text-xl font-semibold'>Video not found</h1>
          <p className='mt-2 text-sm text-muted-foreground'>
            This watch link points to a video that is no longer available.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className='min-h-screen bg-background'>
      <WatchVideoPlayer videoInfo={videoInfo} />
    </main>
  );
}

function getVideoPlayerInfo(
  video: VideoInfo,
  itemUuid?: string,
  startTime?: number
): VideoPlayerVideoInfo | null {
  if (video.type === 'playlist') {
    const item = itemUuid ? video.playlist.find((playlistItem) => playlistItem.uuid === itemUuid) : null;
    if (!item?.uuid || item.error || item.isLive || !item.path) {
      return null;
    }

    return {
      uuid: video.uuid,
      size: item.size,
      url: item.url || video.url || '',
      playlistVideoUuid: item.uuid,
      title: item.name || '',
      filename: item.name,
      startTime,
      type: video.type,
      playlistTitle: video.title,
      duration: item.duration,
      width: item.width,
      height: item.height,
      rFrameRate: item.rFrameRate,
      codecName: item.codecName,
      colorPrimaries: item.colorPrimaries,
      containerName: item.containerName
    };
  }

  return {
    title: video.title,
    type: video.type || 'video',
    url: video.url,
    uuid: video.uuid,
    filename: video.file?.name,
    startTime,
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
