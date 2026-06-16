'use client';

import { VideoPlayer } from '@/components/modules/VideoPlayer';
import type { VideoPlayerVideoInfo } from '@/components/modules/video-player/types';
import { useVideoPlayerStore } from '@/store/videoPlayer';

export function WatchVideoPlayer({ videoInfo }: { videoInfo: VideoPlayerVideoInfo }) {
  const { repeatMode, volume } = useVideoPlayerStore();

  return (
    <VideoPlayer
      allowGalleryActions={false}
      isNotSupportedCodec={false}
      isTopSticky={false}
      isWideScreen={false}
      repeatMode={repeatMode}
      volume={volume}
      videoInfo={videoInfo}
    />
  );
}
