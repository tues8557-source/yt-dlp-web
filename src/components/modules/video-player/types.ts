import type { VideoInfo } from '@/types/video';
import type { VideoPlayerStore } from '@/store/videoPlayer';

export type VideoPlayerFileVariant = {
  uuid: string;
  title?: string | null;
  url: string;
  thumbnail?: string | null;
  localThumbnail?: string | null;
  thumbnailSource?: VideoInfo['thumbnailSource'];
  updatedAt?: number;
  uploadDate?: string | null;
  filename?: string | null;
  size?: number;
  duration?: string | number | null;
  width?: number;
  height?: number;
  rFrameRate?: number;
  codecName?: string;
  colorPrimaries?: string;
  containerName?: string;
};

export type VideoPlayerQueueItem = VideoPlayerFileVariant;

export type VideoPlayerVideoInfo = {
  uuid: string;
  title?: string | null;
  url: string;
  thumbnail?: string | null;
  localThumbnail?: string | null;
  thumbnailSource?: VideoInfo['thumbnailSource'];
  updatedAt?: number;
  uploadDate?: string | null;
  filename?: string | null;
  startTime?: number;
  playlistVideoUuid?: string;
  size?: number;
  type: VideoInfo['type'];
  playlistTitle?: string | null;
  playlist?: VideoInfo['playlist'];
  duration?: string | number | null;
  width?: number;
  height?: number;
  rFrameRate?: number;
  codecName?: string;
  colorPrimaries?: string;
  containerName?: string;
  variants?: VideoPlayerFileVariant[];
  queueTitle?: string | null;
  queue?: VideoPlayerQueueItem[];
};

export type VideoPlayerProps = {
  videoInfo: VideoPlayerVideoInfo;
  allowGalleryActions?: boolean;
} & Pick<
  VideoPlayerStore,
  'isNotSupportedCodec' | 'isWideScreen' | 'isTopSticky' | 'repeatMode' | 'volume'
>;

export type ShareTarget = 'player' | 'source' | 'download';
export type TouchPoint = {
  x: number;
  y: number;
};
export type CloseAnimationDirection = 'right' | 'down';
export type SurfaceSwipeDirection = 'up' | 'down' | null;
export type PlaybackFeedback = 'play' | 'pause' | 'rewind' | 'forward' | 'speed' | '';
export type TapSide = 'left' | 'right';
export type FullscreenOrientationLock = 'portrait' | 'landscape';
export type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: FullscreenOrientationLock) => Promise<void>;
};
