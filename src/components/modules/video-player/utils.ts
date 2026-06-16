import type { CSSProperties, MouseEvent } from 'react';

import type {
  FullscreenOrientationLock,
  TapSide,
  VideoPlayerFileVariant,
  VideoPlayerVideoInfo
} from '@/components/modules/video-player/types';
import type { VideoRepeatMode } from '@/store/videoPlayer';

export function clampSurfaceSwipeOffset(deltaY: number) {
  const maxDown = typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.42, 320) : 240;
  const maxUp = typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.22, 170) : 140;

  return Math.min(Math.max(deltaY, -maxUp), maxDown);
}

export function getSurfaceSwipeStyle(offset: number): CSSProperties | undefined {
  if (!offset) return undefined;

  if (offset > 0) {
    const progress = Math.min(offset / 220, 1);
    const scale = 1 - progress * 0.14;

    return {
      transform: `translate3d(0, ${offset}px, 0) scale(${scale})`,
      transformOrigin: 'center top',
      zIndex: 30
    };
  }

  const pull = Math.abs(offset);
  const progress = Math.min(pull / 150, 1);
  const scale = 1 + progress * 0.08;
  const translateY = -Math.min(pull * 0.42, 72);

  return {
    transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
    transformOrigin: 'center top',
    zIndex: 30
  };
}

export function getCloseAnimationDistance(direction: 'right' | 'down') {
  if (typeof window === 'undefined') return 480;

  return direction === 'down' ? window.innerHeight : window.innerWidth;
}

export function getSurfaceFullscreenReleaseDistance() {
  if (typeof window === 'undefined') return 160;

  return Math.min(window.innerHeight * 0.24, 190);
}

export function getTapSide(event: MouseEvent<HTMLElement>): TapSide {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;

  return x < rect.width / 2 ? 'left' : 'right';
}

export function isInteractivePlayerTarget(target: EventTarget) {
  if (!(target instanceof Element)) return false;
  if (target.closest('[data-player-tap-zone="true"]')) return false;

  return Boolean(target.closest('button, input, a, [role="button"]'));
}

export function isLikelyMobileViewport() {
  if (typeof window === 'undefined') return false;

  const canHover = window.matchMedia('(hover: hover)').matches;
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const longSide = Math.max(window.innerWidth, window.innerHeight);

  return hasCoarsePointer && !canHover && shortSide <= 540 && longSide <= 1000;
}

export function getMediaTitle(videoInfo: VideoPlayerVideoInfo) {
  return videoInfo.title || videoInfo.filename || videoInfo.url || 'yt-dlp-web';
}

export function getMediaArtwork(videoInfo: VideoPlayerVideoInfo, origin: string): MediaImage[] {
  const localThumbnailUrl = toAbsoluteUrl(
    `/api/thumbnail?uuid=${encodeURIComponent(videoInfo.uuid)}${
      videoInfo.updatedAt ? `&v=${videoInfo.updatedAt}` : ''
    }`,
    origin
  );
  const remoteThumbnailUrl = toAbsoluteUrl(videoInfo.thumbnail || '', origin);
  const proxiedRemoteThumbnailUrl = videoInfo.thumbnail
    ? toAbsoluteUrl(`/api/image?url=${encodeURIComponent(videoInfo.thumbnail)}`, origin)
    : '';

  return [
    createMediaImage(localThumbnailUrl),
    createMediaImage(remoteThumbnailUrl),
    createMediaImage(proxiedRemoteThumbnailUrl)
  ].filter(Boolean) as MediaImage[];
}

export function setMediaSessionActionHandler(
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null
) {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch (e) {}
}

export function getShareLinks(
  videoInfo: VideoPlayerVideoInfo,
  downloadUrl: string,
  isMounted: boolean,
  startTime: number
) {
  const origin = isMounted && typeof window !== 'undefined' ? window.location.origin : '';
  const watchUrl = new URL('/watch', origin || 'http://localhost');
  watchUrl.searchParams.set('uuid', videoInfo.uuid);
  if (videoInfo.playlistVideoUuid) {
    watchUrl.searchParams.set('itemUuid', videoInfo.playlistVideoUuid);
  }
  watchUrl.searchParams.set('share', '1');
  if (startTime > 0) {
    watchUrl.searchParams.set('t', `${Math.floor(startTime)}`);
  }

  return {
    player: origin ? watchUrl.toString() : `/watch?${watchUrl.searchParams.toString()}`,
    source: videoInfo.url || '',
    download: `${origin}${downloadUrl}`
  };
}

export function getNextRepeatMode(currentMode: VideoRepeatMode, hasPlaylistRepeat: boolean): VideoRepeatMode {
  if (currentMode === 'none') return 'one';
  if (currentMode === 'one') return hasPlaylistRepeat ? 'all' : 'none';
  return 'none';
}

export function getRepeatTitle(repeatMode: VideoRepeatMode) {
  if (repeatMode === 'one') return 'Repeat one';
  if (repeatMode === 'all') return 'Repeat playlist';
  return 'Repeat off';
}

export function formatQualityLabel(video?: Partial<VideoPlayerVideoInfo | VideoPlayerFileVariant>) {
  if (!video) return '';

  const parts: string[] = [];
  if (typeof video.height === 'number' && video.height > 0) {
    const fps =
      typeof video.rFrameRate === 'number' && video.rFrameRate > 0
        ? `${Math.round(video.rFrameRate)}`
        : '';
    parts.push(`${video.height}p${fps}`);
  }
  if (video.colorPrimaries === 'bt2020') {
    parts.push('HDR');
  }

  return parts.join(' ');
}

export function isAudioFile(video?: Partial<VideoPlayerVideoInfo | VideoPlayerFileVariant>) {
  if (!video) return false;

  const extension = getFileExtension(video.filename || '').toLowerCase();
  if (['aac', 'aiff', 'alac', 'flac', 'm4a', 'mka', 'mp3', 'ogg', 'opus', 'wav', 'weba'].includes(extension)) {
    return true;
  }

  return typeof video.height !== 'number' || video.height <= 0;
}

export function getFullscreenOrientation(
  videoEl: HTMLMediaElement | null,
  videoInfo: VideoPlayerVideoInfo
): FullscreenOrientationLock {
  if (videoEl instanceof HTMLVideoElement && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
    return videoEl.videoHeight > videoEl.videoWidth ? 'portrait' : 'landscape';
  }

  if (
    typeof videoInfo.width === 'number' &&
    videoInfo.width > 0 &&
    typeof videoInfo.height === 'number' &&
    videoInfo.height > 0
  ) {
    return videoInfo.height > videoInfo.width ? 'portrait' : 'landscape';
  }

  return isAudioFile(videoInfo) ? 'portrait' : 'landscape';
}

export function isWebkitFullscreenVideo(
  videoEl: HTMLMediaElement | null
): videoEl is HTMLMediaElement & { webkitEnterFullscreen: () => void } {
  return Boolean(
    videoEl &&
      'webkitEnterFullscreen' in videoEl &&
      typeof (videoEl as { webkitEnterFullscreen?: unknown }).webkitEnterFullscreen === 'function'
  );
}

export function isAutoplayBlockedError(error: unknown) {
  return error instanceof DOMException && error.name === 'NotAllowedError';
}

export function formatBytes(size?: number) {
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) return '';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function getFileExtension(filename: string) {
  const basename = filename.split(/[\\/]/).pop() || '';
  const index = basename.lastIndexOf('.');
  if (index < 0 || index === basename.length - 1) return '';

  return basename.slice(index + 1).toUpperCase();
}

export function formatUploadDate(uploadDate?: string | null) {
  if (!uploadDate) return '';

  if (/^\d{8}$/.test(uploadDate)) {
    return `${uploadDate.slice(0, 4)}.${uploadDate.slice(4, 6)}.${uploadDate.slice(6, 8)}`;
  }

  const parsedDate = new Date(uploadDate);
  if (Number.isNaN(parsedDate.getTime())) return '';

  return [
    parsedDate.getFullYear(),
    String(parsedDate.getMonth() + 1).padStart(2, '0'),
    String(parsedDate.getDate()).padStart(2, '0')
  ].join('.');
}

export function formatDuration(duration?: string | number | null) {
  const seconds = Number(duration);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '00:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const restSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return [hours, minutes, restSeconds].map((value) => String(value).padStart(2, '0')).join(':');
  }

  return [minutes, restSeconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function createMediaImage(src: string): MediaImage | null {
  if (!src) return null;

  return {
    src,
    sizes: '512x512'
  };
}

function toAbsoluteUrl(url: string, origin: string) {
  if (!url) return '';

  try {
    return new URL(url, origin).toString();
  } catch (e) {
    return '';
  }
}
