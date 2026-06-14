'use client';

import { VideoPlayer, type VideoPlayerVideoInfo } from '@/components/modules/VideoPlayer';
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
