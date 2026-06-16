'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent, MouseEvent, PointerEvent, RefObject, TouchEvent } from 'react';
import { mutate } from 'swr';
import { toast } from 'react-toastify';
import {
  Camera,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Info,
  ListVideo,
  Maximize2,
  MoreVertical,
  Music2,
  Pause,
  Pin,
  PinOff,
  Play,
  Repeat,
  Share2,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import { TbViewportNarrow, TbViewportWide } from 'react-icons/tb';

import type { WithoutNullableKeys } from '@/types/types';
import type { VideoInfo } from '@/types/video';
import type { VideoPlayerStore, VideoRepeatMode } from '@/store/videoPlayer';

import { cn } from '@/lib/utils';
import { useVideoPlayerStore } from '@/store/videoPlayer';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  createOfflineObjectUrl,
  getOfflineMedia,
  getOfflineMediaKey
} from '@/client/offlineMedia';
import { type MediaCachedRange, useMediaRangeCache } from '@/client/mediaRangeCache';

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
  offlineKey?: string;
};

export type VideoPlayerProps = {
  videoInfo: VideoPlayerVideoInfo;
  allowGalleryActions?: boolean;
} & Pick<
  VideoPlayerStore,
  'isNotSupportedCodec' | 'isWideScreen' | 'isTopSticky' | 'repeatMode' | 'volume'
>;

type ShareTarget = 'player' | 'source' | 'download';
type TouchPoint = {
  x: number;
  y: number;
};
type CloseAnimationDirection = 'right' | 'down';
type SurfaceSwipeDirection = 'up' | 'down' | null;
type PlaybackFeedback = 'play' | 'pause' | 'rewind' | 'forward' | 'speed' | '';
type TapSide = 'left' | 'right';
type FullscreenOrientationLock = 'portrait' | 'landscape';
type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: FullscreenOrientationLock) => Promise<void>;
};

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

export function VideoPlayer({
  isNotSupportedCodec,
  isTopSticky: _isTopSticky,
  isWideScreen,
  repeatMode,
  videoInfo,
  volume
}: WithoutNullableKeys<VideoPlayerProps>) {
  const videoRef = useRef<HTMLMediaElement | null>(null);
  const playerSurfaceRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLInputElement>(null);
  const surfaceTouchStartRef = useRef<TouchPoint | null>(null);
  const surfaceSwipeDirectionRef = useRef<SurfaceSwipeDirection>(null);
  const surfaceSwipeMovedRef = useRef(false);
  const edgeTouchStartRef = useRef<TouchPoint | null>(null);
  const clickTimeoutRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ time: number; side: TapSide } | null>(null);
  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressOriginalRateRef = useRef(1);
  const isLongPressActiveRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const originalDocumentTitleRef = useRef<string | null>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [isMuted, setMuted] = useState(false);
  const [currentTime, setLocalCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [controlsActivity, setControlsActivity] = useState(0);
  const [isMounted, setMounted] = useState(false);
  const [copiedShareTarget, setCopiedShareTarget] = useState<ShareTarget | ''>('');
  const [isCapturingThumbnail, setCapturingThumbnail] = useState(false);
  const [isRemovingThumbnail, setRemovingThumbnail] = useState(false);
  const [playbackFeedback, setPlaybackFeedback] = useState<PlaybackFeedback>('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareWithStartTime, setShareWithStartTime] = useState(false);
  const [surfaceSwipeOffset, setSurfaceSwipeOffset] = useState(0);
  const [isSurfaceSwipeReleasing, setSurfaceSwipeReleasing] = useState(false);
  const [edgeSwipeOffset, setEdgeSwipeOffset] = useState(0);
  const [isEdgeSwipeClosing, setEdgeSwipeClosing] = useState(false);
  const [closeAnimationDirection, setCloseAnimationDirection] =
    useState<CloseAnimationDirection>('right');
  const isTopSticky = _isTopSticky && videoInfo.type === 'video';
  const isTheaterMode = isWideScreen || isTopSticky;
  const playlistItems = useMemo(
    () => (Array.isArray(videoInfo.playlist) ? videoInfo.playlist : []),
    [videoInfo.playlist]
  );
  const queueItems = useMemo(() => (Array.isArray(videoInfo.queue) ? videoInfo.queue : []), [videoInfo.queue]);
  const currentPlaylistIndex = useMemo(
    () => playlistItems.findIndex((item) => item?.uuid === videoInfo.playlistVideoUuid),
    [playlistItems, videoInfo.playlistVideoUuid]
  );
  const hasPlaylistRepeat = videoInfo.type === 'playlist' && playlistItems.length > 1;
  const hasQueueRepeat = videoInfo.type !== 'playlist' && queueItems.length > 1;
  const hasRepeatQueue = hasPlaylistRepeat || hasQueueRepeat;
  const effectiveRepeatMode = repeatMode === 'all' && !hasRepeatQueue ? 'none' : repeatMode;
  const videoFileUrl =
    videoInfo.type === 'playlist' && videoInfo.playlistVideoUuid
      ? `/api/playlist/file?uuid=${videoInfo.uuid}${
          videoInfo.playlistVideoUuid ? `&itemUuid=${videoInfo.playlistVideoUuid}` : ''
        }`
      : `/api/file?uuid=${videoInfo.uuid}`;
  const downloadUrl =
    videoInfo.type === 'playlist' && videoInfo.playlistVideoUuid
      ? `/api/playlist/file?uuid=${videoInfo.uuid}&itemUuid=${videoInfo.playlistVideoUuid}${
          currentPlaylistIndex >= 0 ? `&itemIndex=${currentPlaylistIndex}` : ''
        }&download=true`
      : `/api/file?uuid=${videoInfo.uuid}&download=true`;
  const shareLinks = getShareLinks(
    videoInfo,
    downloadUrl,
    isMounted,
    shareWithStartTime ? currentTime : 0
  );
  const variantItems = Array.isArray(videoInfo.variants) ? videoInfo.variants : [];
  const isAudioOnly = isAudioFile(videoInfo);
  const playerThumbnailUrl = `/api/thumbnail?uuid=${encodeURIComponent(videoInfo.uuid)}`;
  const [offlineMediaUrl, setOfflineMediaUrl] = useState('');
  const isOfflinePlayback = Boolean(offlineMediaUrl);
  const playbackUrl = offlineMediaUrl || videoFileUrl;
  const cachedRanges = useMediaRangeCache(videoFileUrl, !isOfflinePlayback);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let objectUrl = '';
    let isCanceled = false;
    const key = videoInfo.offlineKey || getOfflineMediaKey(videoInfo.uuid, videoInfo.playlistVideoUuid);

    setOfflineMediaUrl('');

    (async () => {
      const record = await getOfflineMedia(key).catch(() => null);
      if (!record || isCanceled) return;

      objectUrl = createOfflineObjectUrl(record);
      setOfflineMediaUrl(objectUrl);
    })();

    return () => {
      isCanceled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [videoInfo.offlineKey, videoInfo.playlistVideoUuid, videoInfo.uuid]);

  useEffect(() => {
    const handleMouseOut = (event: globalThis.MouseEvent) => {
      if (!event.relatedTarget) {
        setControlsVisible(false);
      }
    };

    window.addEventListener('mouseout', handleMouseOut);
    return () => window.removeEventListener('mouseout', handleMouseOut);
  }, []);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoInfo || !videoEl) return;

    (async function () {
      const { currentTime, volume, setNotSupportedCodec } = useVideoPlayerStore.getState();

      videoEl.volume = typeof volume === 'number' ? volume : 0.75;
      videoEl.currentTime = videoInfo.startTime ?? currentTime ?? 0;
      setMuted(videoEl.muted || videoEl.volume === 0);

      try {
        await videoEl.play();
        setPlaying(true);
        setNotSupportedCodec(false);
      } catch (e) {
        setPlaying(false);
        setNotSupportedCodec(!isAutoplayBlockedError(e));
      }
    })();

    const handlePlayingVideo = () => {
      setPlaying(true);
      setTimeout(() => {
        const { isNotSupportedCodec, setNotSupportedCodec } = useVideoPlayerStore.getState();
        if (isNotSupportedCodec) setNotSupportedCodec(false);
      }, 100);
    };
    const handlePauseVideo = () => setPlaying(false);
    const handleTimeUpdate = () => {
      setLocalCurrentTime(Number(videoEl.currentTime) || 0);
      setDuration(Number(videoEl.duration) || 0);
    };
    const handleLoadedMetadata = () => {
      setDuration(Number(videoEl.duration) || 0);
      setLocalCurrentTime(Number(videoEl.currentTime) || 0);
    };
    const handleEnded = () => {
      setPlaying(false);
      if (repeatMode === 'all') {
        playNextQueuedVideo();
      }
    };
    const handleKeyPress = async (event: globalThis.KeyboardEvent) => {
      switch (event.code) {
        case 'Escape':
          handleClose();
          break;
        case 'Space':
          if (document.activeElement === videoEl) break;
          event.preventDefault();
          await togglePlayback();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    videoEl.addEventListener('playing', handlePlayingVideo);
    videoEl.addEventListener('pause', handlePauseVideo);
    videoEl.addEventListener('timeupdate', handleTimeUpdate);
    videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoEl.addEventListener('ended', handleEnded);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (videoEl) {
        const { setCurrentTime } = useVideoPlayerStore.getState();
        const currentTime = Number(videoEl.currentTime) || 0;
        if (currentTime) setCurrentTime(currentTime);
        videoEl.removeEventListener('playing', handlePlayingVideo);
        videoEl.removeEventListener('pause', handlePauseVideo);
        videoEl.removeEventListener('timeupdate', handleTimeUpdate);
        videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
        videoEl.removeEventListener('ended', handleEnded);
      }
    };
    // Event listeners are intentionally rebound when the selected video or repeat mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoInfo, repeatMode]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.loop = effectiveRepeatMode === 'one';
    }
  }, [effectiveRepeatMode, videoInfo]);

  useEffect(() => {
    if (!controlsVisible) return;

    const timeout = window.setTimeout(() => {
      setControlsVisible(false);
    }, 2400);

    return () => window.clearTimeout(timeout);
  }, [controlsVisible, isPlaying, controlsActivity, videoInfo.uuid, videoInfo.playlistVideoUuid]);

  useEffect(() => {
    if (!isMounted || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    if (!originalDocumentTitleRef.current) {
      originalDocumentTitleRef.current = document.title;
    }

    const mediaTitle = getMediaTitle(videoInfo);
    document.title = mediaTitle;

    if (typeof MediaMetadata === 'function') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: mediaTitle,
        artist: videoInfo.playlistTitle || videoInfo.queueTitle || 'yt-dlp-web',
        album: videoInfo.playlistTitle || videoInfo.queueTitle || '',
        artwork: getMediaArtwork(videoInfo, window.location.origin)
      });
    }

    setMediaSessionActionHandler('play', async () => {
      const videoEl = videoRef.current;
      if (!videoEl) return;

      try {
        await videoEl.play();
        setPlaying(true);
      } catch (e) {}
    });
    setMediaSessionActionHandler('pause', () => {
      const videoEl = videoRef.current;
      if (!videoEl) return;

      videoEl.pause();
      setPlaying(false);
    });
    setMediaSessionActionHandler('seekbackward', (details) => {
      seekBy(-(details.seekOffset || 10));
    });
    setMediaSessionActionHandler('seekforward', (details) => {
      seekBy(details.seekOffset || 10);
    });
    setMediaSessionActionHandler('seekto', (details) => {
      const videoEl = videoRef.current;
      if (!videoEl || typeof details.seekTime !== 'number') return;

      const nextTime = Math.min(Math.max(details.seekTime, 0), Number(videoEl.duration) || duration || 0);
      videoEl.currentTime = nextTime;
      setLocalCurrentTime(nextTime);
      useVideoPlayerStore.getState().setCurrentTime(nextTime);
    });

    return () => {
      if (originalDocumentTitleRef.current) {
        document.title = originalDocumentTitleRef.current;
      }
      navigator.mediaSession.metadata = null;
      setMediaSessionActionHandler('play', null);
      setMediaSessionActionHandler('pause', null);
      setMediaSessionActionHandler('seekbackward', null);
      setMediaSessionActionHandler('seekforward', null);
      setMediaSessionActionHandler('seekto', null);
    };
    // Media session handlers read the current media element and duration at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, videoInfo]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    if (!duration || !Number.isFinite(duration)) return;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: Number(videoRef.current?.playbackRate) || 1,
        position: Math.min(currentTime, duration)
      });
    } catch (e) {}
  }, [currentTime, duration, isPlaying]);

  useEffect(() => {
    if (videoInfo.type !== 'video' || typeof window === 'undefined') return;

    const landscapeQuery = window.matchMedia('(orientation: landscape)');
    let fullscreenAttemptedForLandscape = false;
    const handleOrientationChange = () => {
      const isLandscape = landscapeQuery.matches;
      if (!isLandscape) {
        fullscreenAttemptedForLandscape = false;
        return;
      }

      if (
        fullscreenAttemptedForLandscape ||
        document.fullscreenElement ||
        !isLikelyMobileViewport() ||
        !playerSurfaceRef.current
      ) {
        return;
      }

      fullscreenAttemptedForLandscape = true;
      void enterFullscreenWithOrientation();
    };

    handleOrientationChange();
    landscapeQuery.addEventListener('change', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    return () => {
      landscapeQuery.removeEventListener('change', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
    // Fullscreen helpers read refs and current media metadata at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoInfo.type, videoInfo.uuid, videoInfo.playlistVideoUuid]);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        window.clearTimeout(clickTimeoutRef.current);
      }
      if (longPressTimeoutRef.current) {
        window.clearTimeout(longPressTimeoutRef.current);
      }
      const videoEl = videoRef.current;
      if (videoEl && isLongPressActiveRef.current) {
        videoEl.playbackRate = longPressOriginalRateRef.current || 1;
      }
    };
  }, []);

  const handleClose = () => {
    const close = useVideoPlayerStore.getState().close;
    const videoEl = videoRef.current;
    if (videoEl) {
      const { setVolume, setCurrentTime } = useVideoPlayerStore.getState();
      setVolume(typeof videoEl.volume === 'number' ? videoEl.volume : 0.75);
      const currentTime = Number(videoEl.currentTime) || 0;
      if (currentTime) setCurrentTime(currentTime);
    }

    close();
  };

  const handleAnimatedClose = (direction: CloseAnimationDirection = 'right') => {
    if (isEdgeSwipeClosing) return;

    setCloseAnimationDirection(direction);
    setEdgeSwipeClosing(true);
    setEdgeSwipeOffset(getCloseAnimationDistance(direction));
    window.setTimeout(() => {
      handleClose();
    }, 180);
  };

  const togglePlayback = async () => {
    const videoEl = videoRef.current;
    if (!videoEl) return '';

    if (videoEl.paused) {
      try {
        await videoEl.play();
        setPlaying(true);
        return 'play';
      } catch (e) {
        useVideoPlayerStore.getState().setNotSupportedCodec(!isAutoplayBlockedError(e));
      }
    } else {
      videoEl.pause();
      setPlaying(false);
      return 'pause';
    }

    return '';
  };

  const showPlaybackFeedback = (feedback: PlaybackFeedback) => {
    if (!feedback) return;

    setPlaybackFeedback(feedback);
    window.setTimeout(() => setPlaybackFeedback(''), 650);
  };

  const clearPendingSingleTap = () => {
    if (clickTimeoutRef.current) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
  };

  const clearLongPressTimer = () => {
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const restorePlaybackRate = () => {
    const videoEl = videoRef.current;
    clearLongPressTimer();
    if (videoEl && isLongPressActiveRef.current) {
      videoEl.playbackRate = longPressOriginalRateRef.current || 1;
    }
    isLongPressActiveRef.current = false;
  };

  const seekBy = (seconds: number) => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const current = Number(videoEl.currentTime) || 0;
    const maxTime = Number(videoEl.duration) || duration || current;
    const nextTime = Math.min(Math.max(current + seconds, 0), maxTime);
    videoEl.currentTime = nextTime;
    setLocalCurrentTime(nextTime);
    useVideoPlayerStore.getState().setCurrentTime(nextTime);
    showPlaybackFeedback(seconds < 0 ? 'rewind' : 'forward');
  };

  const handlePlayerTap = async (side: TapSide) => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (surfaceSwipeMovedRef.current || suppressNextClickRef.current) {
      surfaceSwipeMovedRef.current = false;
      suppressNextClickRef.current = false;
      return;
    }

    const now = Date.now();
    const lastTap = lastTapRef.current;
    if (lastTap && lastTap.side === side && now - lastTap.time < 280) {
      clearPendingSingleTap();
      lastTapRef.current = null;
      seekBy(side === 'left' ? -10 : 10);
      return;
    }

    lastTapRef.current = { time: now, side };
    clearPendingSingleTap();
    clickTimeoutRef.current = window.setTimeout(async () => {
      clickTimeoutRef.current = null;
      if (!controlsVisible) {
        handleShowControls();
        return;
      }

      videoEl.volume = typeof volume === 'number' ? volume : 0.75;
      await togglePlayback();
    }, 220);
  };

  const handleClickVideo = async (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    await handlePlayerTap(getTapSide(event));
  };

  const handleTapZoneClick = (side: TapSide) => async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    await handlePlayerTap(side);
  };

  const handlePlayerPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isInteractivePlayerTarget(event.target)) return;

    clearLongPressTimer();
    longPressTimeoutRef.current = window.setTimeout(async () => {
      const videoEl = videoRef.current;
      if (!videoEl) return;

      longPressOriginalRateRef.current = Number(videoEl.playbackRate) || 1;
      videoEl.playbackRate = 2;
      isLongPressActiveRef.current = true;
      suppressNextClickRef.current = true;
      showPlaybackFeedback('speed');
      try {
        if (videoEl.paused) {
          await videoEl.play();
          setPlaying(true);
        }
      } catch (e) {}
    }, 420);
  };

  const handlePlayerPointerUp = () => {
    restorePlaybackRate();
  };

  const handleClickExternalLink = () => {
    try {
      videoRef.current?.pause?.();
    } catch (e) {}
  };

  const handleClickWideButton = () => {
    const { setWideScreen, isWideScreen } = useVideoPlayerStore.getState();
    setWideScreen(!isWideScreen);
  };

  const handleClickFullScreenButton = async () => {
    await enterFullscreenWithOrientation();
  };

  const enterFullscreenWithOrientation = async () => {
    const targetEl = playerSurfaceRef.current || videoRef.current;
    if (!targetEl) return;

    try {
      if (targetEl.requestFullscreen) {
        await targetEl.requestFullscreen();
      } else if (isWebkitFullscreenVideo(videoRef.current)) {
        videoRef.current.webkitEnterFullscreen();
      }

      await lockFullscreenOrientation();
    } catch (e) {}
  };

  const lockFullscreenOrientation = async () => {
    const orientation = getFullscreenOrientation(videoRef.current, videoInfo);
    const screenOrientation = screen.orientation as LockableScreenOrientation | undefined;

    try {
      if (screenOrientation?.lock) {
        await screenOrientation.lock(orientation);
      }
    } catch (e) {}
  };

  const handleTopStickyButton = () => {
    const { setTopSticky, isTopSticky } = useVideoPlayerStore.getState();
    setTopSticky(!isTopSticky);
  };

  const handleClickRepeatButton = () => {
    const nextRepeatMode = getNextRepeatMode(repeatMode, hasRepeatQueue);
    useVideoPlayerStore.getState().setRepeatMode(nextRepeatMode);
  };

  const handleClickPlaylistVideo = (playlistVideo: VideoInfo['playlist'][number]) => () => {
    playPlaylistVideo(playlistVideo);
  };

  const handleOpenVariant = (variant: VideoPlayerFileVariant) => {
    useVideoPlayerStore.getState().open({
      uuid: variant.uuid,
      title: variant.title,
      type: 'video',
      url: variant.url,
      thumbnail: variant.thumbnail,
      localThumbnail: variant.localThumbnail,
      thumbnailSource: variant.thumbnailSource,
      updatedAt: variant.updatedAt,
      filename: variant.filename,
      size: variant.size,
      duration: variant.duration,
      width: variant.width,
      height: variant.height,
      rFrameRate: variant.rFrameRate,
      codecName: variant.codecName,
      colorPrimaries: variant.colorPrimaries,
      containerName: variant.containerName,
      variants: variantItems,
      queueTitle: videoInfo.queueTitle,
      queue: queueItems
    });
  };

  const playQueueVideo = (queueVideo?: VideoPlayerQueueItem) => {
    if (!queueVideo?.uuid) {
      return;
    }

    useVideoPlayerStore.getState().open({
      uuid: queueVideo.uuid,
      title: queueVideo.title,
      type: 'video',
      url: queueVideo.url,
      thumbnail: queueVideo.thumbnail,
      localThumbnail: queueVideo.localThumbnail,
      thumbnailSource: queueVideo.thumbnailSource,
      updatedAt: queueVideo.updatedAt,
      filename: queueVideo.filename,
      size: queueVideo.size,
      duration: queueVideo.duration,
      width: queueVideo.width,
      height: queueVideo.height,
      rFrameRate: queueVideo.rFrameRate,
      codecName: queueVideo.codecName,
      colorPrimaries: queueVideo.colorPrimaries,
      containerName: queueVideo.containerName,
      queueTitle: videoInfo.queueTitle,
      queue: queueItems
    });
  };

  const playPlaylistVideo = (playlistVideo?: VideoInfo['playlist'][number]) => {
    if (!playlistVideo?.uuid || playlistVideo.error || playlistVideo.isLive || !playlistVideo.path) {
      return;
    }

    useVideoPlayerStore.getState().open({
      uuid: videoInfo.uuid,
      size: playlistVideo.size,
      url: playlistVideo.url || videoInfo.url || '',
      playlistVideoUuid: playlistVideo.uuid,
      title: playlistVideo.name || '',
      filename: playlistVideo.name,
      type: videoInfo.type,
      playlistTitle: videoInfo.playlistTitle,
      playlist: videoInfo.playlist,
      duration: playlistVideo.duration,
      width: playlistVideo.width,
      height: playlistVideo.height,
      rFrameRate: playlistVideo.rFrameRate,
      codecName: playlistVideo.codecName,
      colorPrimaries: playlistVideo.colorPrimaries,
      containerName: playlistVideo.containerName
    });
  };

  const playNextPlaylistVideo = () => {
    if (!hasPlaylistRepeat) return;

    const playableItems = playlistItems.filter(
      (item) => item?.uuid && item.path && !item.error && !item.isLive
    );
    const currentIndex = playableItems.findIndex((item) => item.uuid === videoInfo.playlistVideoUuid);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % playableItems.length : 0;
    playPlaylistVideo(playableItems[nextIndex]);
  };

  const playPreviousPlaylistVideo = () => {
    if (!hasPlaylistRepeat) return;

    const playableItems = playlistItems.filter(
      (item) => item?.uuid && item.path && !item.error && !item.isLive
    );
    const currentIndex = playableItems.findIndex((item) => item.uuid === videoInfo.playlistVideoUuid);
    const previousIndex =
      currentIndex >= 0 ? (currentIndex - 1 + playableItems.length) % playableItems.length : 0;
    playPlaylistVideo(playableItems[previousIndex]);
  };

  const playNextQueueVideo = () => {
    if (!hasQueueRepeat) return;

    const currentIndex = queueItems.findIndex((item) => item.uuid === videoInfo.uuid);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % queueItems.length : 0;
    playQueueVideo(queueItems[nextIndex]);
  };

  const playPreviousQueueVideo = () => {
    if (!hasQueueRepeat) return;

    const currentIndex = queueItems.findIndex((item) => item.uuid === videoInfo.uuid);
    const previousIndex =
      currentIndex >= 0 ? (currentIndex - 1 + queueItems.length) % queueItems.length : 0;
    playQueueVideo(queueItems[previousIndex]);
  };

  const playNextQueuedVideo = () => {
    if (hasPlaylistRepeat) {
      playNextPlaylistVideo();
      return;
    }

    playNextQueueVideo();
  };

  const playPreviousQueuedVideo = () => {
    if (hasPlaylistRepeat) {
      playPreviousPlaylistVideo();
      return;
    }

    playPreviousQueueVideo();
  };

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextVolume = Number(event.target.value) / 100;
    const videoEl = videoRef.current;
    if (!videoEl) return;

    videoEl.volume = nextVolume;
    videoEl.muted = nextVolume === 0;
    setMuted(videoEl.muted);
    useVideoPlayerStore.getState().setVolume(nextVolume);
  };

  const handleClickMute = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    videoEl.muted = !videoEl.muted;
    setMuted(videoEl.muted);
  };

  const handleProgressChange = (event: ChangeEvent<HTMLInputElement>) => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const nextTime = Number(event.target.value);
    videoEl.currentTime = nextTime;
    setLocalCurrentTime(nextTime);
    useVideoPlayerStore.getState().setCurrentTime(nextTime);
  };

  const handleCopyShareLink = (target: ShareTarget) => async () => {
    const url = shareLinks[target];
    try {
      await navigator.clipboard.writeText(url);
      setCopiedShareTarget(target);
      window.setTimeout(() => setCopiedShareTarget(''), 1200);
    } catch (e) {
      window.prompt('Copy link', url);
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: videoInfo.title || 'Video',
        url: shareLinks.player
      });
    } catch (e) {}
  };

  const handleCaptureThumbnail = async () => {
    if (isCapturingThumbnail) return;

    const videoEl = videoRef.current as HTMLVideoElement | null;
    if (!videoEl) {
      toast.error('The current frame cannot be captured yet.');
      return;
    }

    setCapturingThumbnail(true);

    try {
      if (!videoEl.videoWidth || !videoEl.videoHeight) {
        await captureThumbnailOnServer(Number(videoEl.currentTime) || currentTime || 0);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas is not available.');
      }

      context.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        throw new Error('Failed to capture the current frame.');
      }

      const formData = new FormData();
      formData.append('file', new File([blob], `${videoInfo.uuid}-thumbnail.png`, { type: 'image/png' }));

      const response = await fetch(`/api/thumbnail?uuid=${encodeURIComponent(videoInfo.uuid)}`, {
        method: 'POST',
        body: formData
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success || result?.error) {
        await captureThumbnailOnServer(Number(videoEl.currentTime) || currentTime || 0);
        return;
      }

      toast.success('Updated thumbnail from the current frame.');
      mutate('/api/list');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update thumbnail.');
    } finally {
      setCapturingThumbnail(false);
    }
  };

  const captureThumbnailOnServer = async (time: number) => {
    const params = new URLSearchParams({
      uuid: videoInfo.uuid,
      action: 'frame',
      time: `${Math.max(0, time)}`
    });
    if (videoInfo.playlistVideoUuid) {
      params.set('itemUuid', videoInfo.playlistVideoUuid);
    }

    const response = await fetch(`/api/thumbnail?${params.toString()}`, {
      method: 'POST'
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success || result?.error) {
      throw new Error(result?.error || 'Failed to update thumbnail.');
    }

    toast.success('Updated thumbnail from the current frame.');
    mutate('/api/list');
  };

  const handleRemoveLocalThumbnail = async () => {
    if (isRemovingThumbnail) return;

    setRemovingThumbnail(true);
    try {
      const response = await fetch(
        `/api/thumbnail?uuid=${encodeURIComponent(videoInfo.uuid)}&action=remove`,
        {
          method: 'POST'
        }
      );
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success || result?.error) {
        throw new Error(result?.error || 'Failed to remove local thumbnail.');
      }

      toast.success('Removed local thumbnail.');
      mutate('/api/list');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove local thumbnail.');
    } finally {
      setRemovingThumbnail(false);
    }
  };

  const handleShowControls = () => {
    setControlsVisible(true);
    setControlsActivity((value) => value + 1);
  };

  const handleHideControls = () => {
    setControlsVisible(false);
  };

  const resetSurfaceSwipe = () => {
    surfaceTouchStartRef.current = null;
    surfaceSwipeDirectionRef.current = null;
    setSurfaceSwipeReleasing(true);
    setSurfaceSwipeOffset(0);
    window.setTimeout(() => setSurfaceSwipeReleasing(false), 180);
  };

  const handleSurfaceTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;

    setSurfaceSwipeReleasing(false);
    setSurfaceSwipeOffset(0);
    surfaceSwipeDirectionRef.current = null;
    surfaceSwipeMovedRef.current = false;
    surfaceTouchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY
    };
  };

  const handleSurfaceTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const start = surfaceTouchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch || isEdgeSwipeClosing) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (!surfaceSwipeDirectionRef.current) {
      if (absDeltaY < 12 || absDeltaY < absDeltaX * 1.15) return;
      surfaceSwipeDirectionRef.current = deltaY > 0 ? 'down' : 'up';
    }

    if (absDeltaY > 4) {
      surfaceSwipeMovedRef.current = true;
    }

    event.preventDefault();
    clearLongPressTimer();
    setControlsVisible(false);
    setSurfaceSwipeOffset(clampSurfaceSwipeOffset(deltaY));
  };

  const handleSurfaceTouchEnd = async (event: TouchEvent<HTMLDivElement>) => {
    const start = surfaceTouchStartRef.current;
    surfaceTouchStartRef.current = null;
    surfaceSwipeDirectionRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (deltaY > 80 && Math.abs(deltaX) < 80) {
      setSurfaceSwipeReleasing(true);
      handleAnimatedClose('down');
      return;
    }

    if (deltaY < -70 && Math.abs(deltaX) < 70) {
      setSurfaceSwipeReleasing(true);
      setSurfaceSwipeOffset(-getSurfaceFullscreenReleaseDistance());
      window.setTimeout(() => {
        setSurfaceSwipeOffset(0);
        setSurfaceSwipeReleasing(false);
      }, 180);
      await enterFullscreenWithOrientation();
      return;
    }

    resetSurfaceSwipe();
  };

  const handleEdgeTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (isEdgeSwipeClosing) return;
    if (!touch || touch.clientX > 28) {
      edgeTouchStartRef.current = null;
      return;
    }

    edgeTouchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY
    };
  };

  const handleEdgeTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const start = edgeTouchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch || isEdgeSwipeClosing) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (deltaX <= 0 || Math.abs(deltaY) > 90) {
      setEdgeSwipeOffset(0);
      return;
    }

    setEdgeSwipeOffset(Math.min(deltaX, window.innerWidth));
  };

  const handleEdgeTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = edgeTouchStartRef.current;
    edgeTouchStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (deltaX > 80 && Math.abs(deltaY) < 70) {
      handleAnimatedClose('right');
      return;
    }

    setEdgeSwipeOffset(0);
  };

  const playerSurface = (
    <div
      ref={playerSurfaceRef}
      className={cn(
        'relative aspect-video w-full touch-none select-none overflow-hidden rounded-lg bg-black shadow-sm will-change-transform',
        isSurfaceSwipeReleasing
          ? 'transition-transform duration-200 ease-out'
          : surfaceSwipeOffset && 'transition-none'
      )}
      style={getSurfaceSwipeStyle(surfaceSwipeOffset)}
      onMouseEnter={handleShowControls}
      onMouseMove={handleShowControls}
      onMouseLeave={handleHideControls}
      onPointerDown={handlePlayerPointerDown}
      onPointerUp={handlePlayerPointerUp}
      onPointerCancel={handlePlayerPointerUp}
      onPointerLeave={handlePlayerPointerUp}
      onTouchStart={handleSurfaceTouchStart}
      onTouchMove={handleSurfaceTouchMove}
      onTouchEnd={handleSurfaceTouchEnd}
      onTouchCancel={resetSurfaceSwipe}
    >
      {isAudioOnly ? (
        <audio
          ref={(element) => {
            videoRef.current = element;
          }}
          className='hidden'
          src={playbackUrl}
        />
      ) : (
        <video
          ref={(element) => {
            videoRef.current = element;
          }}
          className={cn(
            'h-full w-full object-contain outline-none',
            isTheaterMode && 'max-h-full max-w-full'
          )}
          src={playbackUrl}
          playsInline
          onClick={handleClickVideo}
        />
      )}
      {!isAudioOnly && (
        <div className='pointer-events-none absolute inset-0 z-10 flex'>
          <button
            type='button'
            aria-label='Back 10 seconds'
            data-player-tap-zone='true'
            className='pointer-events-auto h-full flex-1 cursor-default bg-transparent outline-none'
            onClick={handleTapZoneClick('left')}
          />
          <button
            type='button'
            aria-label='Forward 10 seconds'
            data-player-tap-zone='true'
            className='pointer-events-auto h-full flex-1 cursor-default bg-transparent outline-none'
            onClick={handleTapZoneClick('right')}
          />
        </div>
      )}
      {isAudioOnly && (
        <div
          className='absolute inset-0 flex cursor-pointer items-center justify-center bg-black'
          onClick={handleClickVideo}
        >
          <img
            src={playerThumbnailUrl}
            alt=''
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
            className='h-full w-full object-contain opacity-95'
            draggable={false}
          />
          <div className='absolute left-3 top-3 inline-flex items-center gap-x-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm'>
            <Music2 className='h-4 w-4' />
            Audio
          </div>
        </div>
      )}
      {playbackFeedback && (
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 z-20 flex select-none items-center',
            playbackFeedback === 'rewind'
              ? 'left-[12%]'
              : playbackFeedback === 'forward'
                ? 'right-[12%]'
                : 'left-1/2 -translate-x-1/2'
          )}
        >
          <div
            className={cn(
              'flex select-none items-center justify-center rounded-full bg-black/55 text-white shadow-lg animate-in fade-in zoom-in-95 duration-150',
              playbackFeedback === 'rewind' || playbackFeedback === 'forward'
                ? 'h-24 min-w-28 px-6 text-5xl font-black tabular-nums'
                : 'h-20 w-20'
            )}
          >
            {playbackFeedback === 'play' ? (
              <Play className='ml-1 h-10 w-10 fill-current' />
            ) : playbackFeedback === 'pause' ? (
              <Pause className='h-10 w-10 fill-current' />
            ) : playbackFeedback === 'rewind' ? (
              '-10'
            ) : playbackFeedback === 'forward' ? (
              '+10'
            ) : (
              <span className='select-none text-2xl font-bold'>2x</span>
            )}
          </div>
        </div>
      )}
      {isNotSupportedCodec && (
        <div className='absolute inset-0 flex items-center text-center pointer-events-none'>
          <div className='w-full bg-black/70 py-2 text-sm text-white md:text-base'>
            The file does not exist or cannot be played.
          </div>
        </div>
      )}
      <PlayerControls
        controlsVisible={controlsVisible}
        currentTime={currentTime}
        duration={duration}
        isMuted={isMuted}
        isPlaying={isPlaying}
        repeatMode={effectiveRepeatMode}
        volume={volume}
        progressRef={progressRef}
        onClose={handleClose}
        onFullscreen={handleClickFullScreenButton}
        onMute={handleClickMute}
        onNext={playNextQueuedVideo}
        onPlayPause={togglePlayback}
        onPrevious={playPreviousQueuedVideo}
        onProgress={handleProgressChange}
        onRepeat={handleClickRepeatButton}
        onVolume={handleVolumeChange}
        canPlayAdjacent={hasRepeatQueue}
        isOfflinePlayback={isOfflinePlayback}
        cachedRanges={cachedRanges}
      />
    </div>
  );

  if (isTheaterMode) {
    return (
      <div className='group relative flex h-full min-w-[var(--site-min-width)] flex-col items-center overflow-hidden bg-black text-white'>
        <CompactPlayerBar
          isTopSticky={isTopSticky}
          isWideScreen={isWideScreen}
          originalUrl={videoInfo.url}
          title={videoInfo.title}
          type={videoInfo.type}
          variants={variantItems}
          videoInfo={videoInfo}
          isCapturingThumbnail={isCapturingThumbnail}
          isRemovingThumbnail={isRemovingThumbnail}
          onCaptureThumbnail={handleCaptureThumbnail}
          onExternalLink={handleClickExternalLink}
          onFullscreen={handleClickFullScreenButton}
          onOpenVariant={handleOpenVariant}
          onRemoveLocalThumbnail={handleRemoveLocalThumbnail}
          onTopSticky={handleTopStickyButton}
          onWide={handleClickWideButton}
        />
        <div className='relative flex min-h-0 w-full flex-auto items-center justify-center overflow-hidden'>
          <div className={cn('w-full', isWideScreen ? 'h-full' : 'max-h-full')}>
            {playerSurface}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'h-full min-w-[var(--site-min-width)] overflow-y-auto bg-background text-foreground shadow-[-18px_0_40px_rgba(0,0,0,0.28)]',
        isEdgeSwipeClosing ? 'transition-transform duration-200 ease-out' : edgeSwipeOffset > 0 && 'transition-none'
      )}
      style={{
        transform: edgeSwipeOffset
          ? closeAnimationDirection === 'down'
            ? `translate3d(0, ${edgeSwipeOffset}px, 0)`
            : `translate3d(${edgeSwipeOffset}px, 0, 0)`
          : undefined
      }}
      onTouchStart={handleEdgeTouchStart}
      onTouchMove={handleEdgeTouchMove}
      onTouchEnd={handleEdgeTouchEnd}
      onTouchCancel={() => {
        edgeTouchStartRef.current = null;
        setEdgeSwipeOffset(0);
      }}
    >
      <div className='mx-auto flex min-h-full w-full max-w-[1280px] flex-col gap-4 px-3 py-3 md:grid md:h-auto md:px-5'>
        <main className='flex min-w-0 flex-col md:block'>
          {playerSurface}
          <section className='flex min-h-0 flex-1 flex-col overflow-visible pt-3 md:block'>
            <div className='flex items-start gap-x-3'>
              <div className='min-w-0 flex-1'>
                <h2
                  className='line-clamp-2 text-lg font-semibold leading-6 md:text-xl'
                  title={videoInfo.title || ''}
                >
                  {videoInfo.title || videoInfo.url}
                </h2>
                {videoInfo.playlistTitle && (
                  <div className='mt-1 flex items-center gap-x-1 text-sm text-muted-foreground'>
                    <ListVideo className='h-4 w-4 shrink-0' />
                    <span className='truncate'>{videoInfo.playlistTitle}</span>
                    {currentPlaylistIndex >= 0 && (
                      <span className='shrink-0'>
                        {currentPlaylistIndex + 1}/{playlistItems.length}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className='flex shrink-0 items-center gap-x-1'>
                <ShareMenu
                  currentTime={currentTime}
                  isMounted={isMounted}
                  open={shareDialogOpen}
                  setOpen={setShareDialogOpen}
                  copiedShareTarget={copiedShareTarget}
                  onCopy={handleCopyShareLink}
                  onNativeShare={handleNativeShare}
                  setShareWithStartTime={setShareWithStartTime}
                  shareLinks={shareLinks}
                  shareWithStartTime={shareWithStartTime}
                />
                <InfoMenu
                  currentUuid={videoInfo.uuid}
                  isAudioOnly={isAudioOnly}
                  variants={variantItems}
                  videoInfo={videoInfo}
                  onOpenVariant={handleOpenVariant}
                />
                <MoreMenu
                  downloadUrl={downloadUrl}
                  isAudioOnly={isAudioOnly}
                  isCapturingThumbnail={isCapturingThumbnail}
                  isRemovingThumbnail={isRemovingThumbnail}
                  originalUrl={videoInfo.url}
                  onCaptureThumbnail={handleCaptureThumbnail}
                  onExternalLink={handleClickExternalLink}
                  onRemoveLocalThumbnail={handleRemoveLocalThumbnail}
                />
              </div>
            </div>
            <MediaQueuePanel
              className='flex min-h-0 flex-1 flex-col md:min-h-0 md:flex-none'
              currentUuid={videoInfo.uuid}
              playlistItems={playlistItems}
              queueItems={queueItems}
              variants={variantItems}
              videoInfo={videoInfo}
              onOpenPlaylistVideo={playPlaylistVideo}
              onOpenQueueVideo={playQueueVideo}
              onOpenVariant={handleOpenVariant}
            />
          </section>
        </main>
      </div>
    </div>
  );
}

type PlayerControlsProps = {
  controlsVisible: boolean;
  currentTime: number;
  duration: number;
  isMuted: boolean;
  isPlaying: boolean;
  progressRef: RefObject<HTMLInputElement | null>;
  repeatMode: VideoRepeatMode;
  volume: number;
  canPlayAdjacent: boolean;
  isOfflinePlayback: boolean;
  cachedRanges: MediaCachedRange[];
  onClose: () => void;
  onFullscreen: () => void;
  onMute: () => void;
  onNext: () => void;
  onPlayPause: () => void;
  onPrevious: () => void;
  onProgress: (event: ChangeEvent<HTMLInputElement>) => void;
  onRepeat: () => void;
  onVolume: (event: ChangeEvent<HTMLInputElement>) => void;
};

function PlayerControls({
  controlsVisible,
  currentTime,
  duration,
  isMuted,
  isPlaying,
  progressRef,
  repeatMode,
  volume,
  canPlayAdjacent,
  isOfflinePlayback,
  cachedRanges,
  onClose,
  onFullscreen,
  onMute,
  onNext,
  onPlayPause,
  onPrevious,
  onProgress,
  onRepeat,
  onVolume
}: PlayerControlsProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-30 bg-gradient-to-t from-black/80 via-black/35 to-transparent text-white transition-opacity duration-150',
        controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
      )}
    >
      <div className='pointer-events-auto absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-x-5 sm:gap-x-7'>
        <Button
          variant='ghost'
          size='icon'
          className='h-12 w-12 rounded-full bg-black/35 text-white hover:bg-white/20 hover:text-white disabled:opacity-40 sm:h-14 sm:w-14'
          onClick={onPrevious}
          disabled={!canPlayAdjacent}
          title='Previous video'
        >
          <SkipBack className='h-7 w-7 fill-current sm:h-8 sm:w-8' />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='h-16 w-16 rounded-full bg-black/45 text-white hover:bg-white/20 hover:text-white sm:h-20 sm:w-20'
          onClick={onPlayPause}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className='h-8 w-8 fill-current sm:h-10 sm:w-10' />
          ) : (
            <Play className='ml-1 h-8 w-8 fill-current sm:h-10 sm:w-10' />
          )}
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='h-12 w-12 rounded-full bg-black/35 text-white hover:bg-white/20 hover:text-white disabled:opacity-40 sm:h-14 sm:w-14'
          onClick={onNext}
          disabled={!canPlayAdjacent}
          title='Next video'
        >
          <SkipForward className='h-7 w-7 fill-current sm:h-8 sm:w-8' />
        </Button>
      </div>

      <div className='pointer-events-auto absolute inset-x-0 bottom-0 px-3 pb-2 pt-10'>
        <div className='relative h-3'>
          {isOfflinePlayback && (
            <div className='pointer-events-none absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-emerald-400/80' />
          )}
          {!isOfflinePlayback &&
            cachedRanges.map((range) => {
              const total = range.total || duration || 0;
              if (!total || range.end <= range.start) return null;

              const left = Math.min(Math.max((range.start / total) * 100, 0), 100);
              const width = Math.min(Math.max(((range.end - range.start + 1) / total) * 100, 0), 100 - left);

              return (
                <div
                  key={`${range.start}-${range.end}`}
                  className='pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-sky-400/75'
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              );
            })}
          <input
            ref={progressRef}
            type='range'
            min={0}
            max={duration || 0}
            step='0.1'
            value={Math.min(currentTime, duration || currentTime)}
            onChange={onProgress}
            className='absolute inset-x-0 top-1/2 h-1 w-full -translate-y-1/2 cursor-pointer accent-red-600'
            aria-label='Seek'
          />
        </div>
        <div className='mt-2 flex min-h-9 items-center justify-between gap-x-2'>
          <div className='flex min-w-0 items-center gap-x-2'>
            <div className='w-[5.75rem] shrink-0 text-xs tabular-nums text-white/90 sm:w-auto'>
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </div>
            {(isOfflinePlayback || cachedRanges.length > 0) && (
              <span className='hidden rounded-full bg-emerald-500/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black sm:inline-flex'>
                {isOfflinePlayback ? 'Offline' : 'Cached'}
              </span>
            )}
          </div>
          <div className='flex shrink-0 items-center gap-x-1.5'>
            <Button
              variant='ghost'
              size='icon'
              className='relative h-9 w-9 rounded-full text-white hover:bg-white/15 hover:text-white'
              onClick={onRepeat}
              title={getRepeatTitle(repeatMode)}
            >
              <Repeat className='h-5 w-5' />
              {repeatMode !== 'none' && (
                <span className='absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-white px-0.5 text-[9px] font-bold leading-none text-black'>
                  {repeatMode === 'one' ? '1' : 'A'}
                </span>
              )}
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='h-9 w-9 rounded-full text-white hover:bg-white/15 hover:text-white'
              onClick={onMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className='h-5 w-5' /> : <Volume2 className='h-5 w-5' />}
            </Button>
            <input
              type='range'
              min={0}
              max={100}
              value={isMuted ? 0 : Math.round((volume || 0) * 100)}
              onChange={onVolume}
              className='hidden h-1 w-20 cursor-pointer accent-white sm:block'
              aria-label='Volume'
            />
            <Button
              variant='ghost'
              size='icon'
              className='h-9 w-9 rounded-full text-white hover:bg-white/15 hover:text-white'
              onClick={onFullscreen}
              title='Full screen'
            >
              <Maximize2 className='h-5 w-5' />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='h-9 w-9 rounded-full text-white hover:bg-white/15 hover:text-white'
              onClick={onClose}
              title='Close'
            >
              <X className='h-5 w-5' />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

type CompactPlayerBarProps = {
  isTopSticky: boolean;
  isWideScreen: boolean;
  isCapturingThumbnail: boolean;
  isRemovingThumbnail: boolean;
  originalUrl: string;
  title?: string | null;
  type: VideoInfo['type'];
  variants: VideoPlayerFileVariant[];
  videoInfo: VideoPlayerVideoInfo;
  onCaptureThumbnail: () => void;
  onExternalLink: () => void;
  onFullscreen: () => void;
  onOpenVariant: (variant: VideoPlayerFileVariant) => void;
  onRemoveLocalThumbnail: () => void;
  onTopSticky: () => void;
  onWide: () => void;
};

function CompactPlayerBar({
  isCapturingThumbnail,
  isRemovingThumbnail,
  isTopSticky,
  isWideScreen,
  originalUrl,
  title,
  type,
  variants,
  videoInfo,
  onCaptureThumbnail,
  onExternalLink,
  onFullscreen,
  onOpenVariant,
  onRemoveLocalThumbnail,
  onTopSticky,
  onWide
}: CompactPlayerBarProps) {
  const isAudioOnly = isAudioFile(videoInfo);

  return (
    <div
      className={cn(
        'absolute left-0 top-0 z-10 flex w-full min-h-14 items-center justify-between bg-black/35 p-2 text-white transition-opacity duration-500',
        isTopSticky && 'opacity-0 group-hover:opacity-100'
      )}
    >
      <div className='line-clamp-2 min-w-0 pl-2 font-bold' title={title || ''}>
        {title}
      </div>
      <div className='flex shrink-0 gap-x-1 whitespace-nowrap'>
        <InfoMenu
          currentUuid={videoInfo.uuid}
          isAudioOnly={isAudioOnly}
          variants={variants}
          videoInfo={videoInfo}
          onOpenVariant={onOpenVariant}
        />
        <MoreMenu
          isAudioOnly={isAudioOnly}
          isCapturingThumbnail={isCapturingThumbnail}
          isRemovingThumbnail={isRemovingThumbnail}
          originalUrl={originalUrl}
          onCaptureThumbnail={onCaptureThumbnail}
          onExternalLink={onExternalLink}
          onRemoveLocalThumbnail={onRemoveLocalThumbnail}
        />
        {type === 'video' && (
          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8 shrink-0 rounded-full text-white hover:bg-white/15 hover:text-white'
            onClick={onTopSticky}
            title={isTopSticky ? 'Not fixing on top' : 'Fixing on top'}
          >
            {isTopSticky ? <PinOff className='h-4 w-4' /> : <Pin className='h-4 w-4' />}
          </Button>
        )}
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8 shrink-0 rounded-full text-xl text-white hover:bg-white/15 hover:text-white'
          onClick={onWide}
          title={isWideScreen ? 'Exit wide view' : 'Wide view'}
        >
          {isWideScreen ? <TbViewportNarrow /> : <TbViewportWide />}
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8 shrink-0 rounded-full text-white hover:bg-white/15 hover:text-white'
          onClick={onFullscreen}
          title='Full screen'
        >
          <Maximize2 className='h-4 w-4' />
        </Button>
      </div>
    </div>
  );
}

type ShareMenuProps = {
  copiedShareTarget: ShareTarget | '';
  currentTime: number;
  isMounted: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  shareLinks: Record<ShareTarget, string>;
  onCopy: (target: ShareTarget) => () => void;
  onNativeShare: () => void;
  setShareWithStartTime: (checked: boolean) => void;
  shareWithStartTime: boolean;
};

function MediaQueuePanel({
  className,
  currentUuid,
  playlistItems,
  queueItems,
  variants,
  videoInfo,
  onOpenPlaylistVideo,
  onOpenQueueVideo,
  onOpenVariant
}: {
  currentUuid: string;
  playlistItems: VideoInfo['playlist'];
  queueItems: VideoPlayerQueueItem[];
  variants: VideoPlayerFileVariant[];
  videoInfo: VideoPlayerVideoInfo;
  onOpenPlaylistVideo: (playlistVideo?: VideoInfo['playlist'][number]) => void;
  onOpenQueueVideo: (queueVideo?: VideoPlayerQueueItem) => void;
  onOpenVariant: (variant: VideoPlayerFileVariant) => void;
  className?: string;
}) {
  if (queueItems.length > 0) {
    return (
      <section className={cn('mt-4 overflow-hidden rounded-lg border bg-card md:block', className)}>
        <div className='border-b p-3'>
          <div className='flex items-center gap-x-2 font-semibold'>
            <ListVideo className='h-4 w-4' />
            <span className='min-w-0 flex-1 truncate'>{videoInfo.queueTitle || 'Playlist'}</span>
          </div>
          <div className='mt-1 text-xs text-muted-foreground'>{queueItems.length} videos</div>
        </div>
        <div className='min-h-0 flex-1 divide-y overflow-y-auto md:block md:max-h-80'>
          {queueItems.map((item, index) => {
            const isCurrent = item.uuid === currentUuid;

            return (
              <button
                key={`${item.uuid}-${index}`}
                type='button'
                className={cn(
                  'flex w-full gap-x-3 p-3 text-left transition-colors',
                  isCurrent ? 'cursor-default bg-primary/10 text-primary' : 'hover:bg-accent'
                )}
                disabled={isCurrent}
                onClick={() => onOpenQueueVideo(item)}
              >
                <div className='relative aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-black/80'>
                  <QueueThumbnail item={item} />
                  {item.duration && (
                    <span className='absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-xs text-white'>
                      {formatDuration(item.duration)}
                    </span>
                  )}
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='line-clamp-2 font-medium'>{item.title || item.filename || 'Untitled'}</div>
                  <div className='mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground'>
                    <span>#{index + 1}</span>
                    <span>{formatQualityLabel(item) || 'Unknown quality'}</span>
                    {item.codecName && <span>{item.codecName}</span>}
                    {formatBytes(item.size) && <span>{formatBytes(item.size)}</span>}
                    {getFileExtension(item.filename || '') && (
                      <span>{getFileExtension(item.filename || '')}</span>
                    )}
                  </div>
                  {formatUploadDate(item.uploadDate) && (
                    <div className='mt-1 text-xs text-muted-foreground'>
                      {formatUploadDate(item.uploadDate)}
                    </div>
                  )}
                </div>
                {isCurrent && (
                  <span className='self-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary'>
                    Playing
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (playlistItems.length > 0) {
    return (
      <section className={cn('mt-4 overflow-hidden rounded-lg border bg-card md:block', className)}>
        <div className='border-b p-3'>
          <div className='flex items-center gap-x-2 font-semibold'>
            <ListVideo className='h-4 w-4' />
            <span className='min-w-0 flex-1 truncate'>{videoInfo.playlistTitle || 'Playlist'}</span>
          </div>
          <div className='mt-1 text-xs text-muted-foreground'>{playlistItems.length} videos</div>
        </div>
        <div className='min-h-0 flex-1 overflow-y-auto p-2 md:block md:max-h-80'>
          {playlistItems.map((item, index) => {
            const isCurrent = item?.uuid === videoInfo.playlistVideoUuid;
            const isPlayable = Boolean(item?.uuid && item.path && !item.error && !item.isLive);

            return (
              <button
                key={item?.uuid || index}
                className={cn(
                  'grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] gap-x-2 rounded-md p-2 text-left text-sm transition-colors',
                  isCurrent ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
                  !isPlayable && 'cursor-default opacity-60 hover:bg-transparent'
                )}
                disabled={!isPlayable}
                onClick={() => onOpenPlaylistVideo(item)}
                title={item?.name || item?.error || ''}
              >
                <span className='text-center text-xs font-semibold leading-5'>{index + 1}</span>
                <span className='min-w-0'>
                  <span className='line-clamp-2 font-medium leading-5'>
                    {item?.error || (item?.isLive ? 'Live has been excluded.' : item?.name || 'No Data')}
                  </span>
                </span>
                {item?.duration && (
                  <span className='text-xs text-muted-foreground'>{formatDuration(item.duration)}</span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  const displayedVariants = variants.length
    ? variants
    : [
        {
          uuid: videoInfo.uuid,
          title: videoInfo.title,
          url: videoInfo.url,
          filename: videoInfo.filename,
          size: videoInfo.size,
          duration: videoInfo.duration,
          thumbnail: videoInfo.thumbnail,
          localThumbnail: videoInfo.localThumbnail,
          thumbnailSource: videoInfo.thumbnailSource,
          updatedAt: videoInfo.updatedAt,
          width: videoInfo.width,
          height: videoInfo.height,
          rFrameRate: videoInfo.rFrameRate,
          codecName: videoInfo.codecName,
          colorPrimaries: videoInfo.colorPrimaries,
          containerName: videoInfo.containerName
        }
      ];

  return (
    <section className={cn('mt-4 overflow-hidden rounded-lg border bg-card md:block', className)}>
      <div className='border-b p-3'>
        <div className='font-semibold'>Files</div>
      </div>
      <div className='min-h-0 flex-1 divide-y overflow-y-auto md:block md:max-h-80'>
        {displayedVariants.map((variant, index) => {
          const isCurrent = variant.uuid === currentUuid;

          return (
            <button
              key={variant.uuid}
              type='button'
              className={cn(
                'flex w-full gap-x-3 p-3 text-left transition-colors',
                isCurrent ? 'cursor-default bg-primary/10 text-primary' : 'hover:bg-accent'
              )}
              disabled={isCurrent}
              onClick={() => onOpenVariant(variant)}
            >
              <div className='relative aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-black/80'>
                <QueueThumbnail item={variant} />
                {isAudioFile(variant) && (
                  <span className='absolute left-1 top-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white'>
                    Audio
                  </span>
                )}
                {variant.duration && (
                  <span className='absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-xs text-white'>
                    {formatDuration(variant.duration)}
                  </span>
                )}
              </div>
              <div className='min-w-0 flex-1'>
                <div className='line-clamp-2 font-medium'>{variant.title || variant.filename || 'Untitled'}</div>
                <div className='mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground'>
                  <span>#{index + 1}</span>
                  <span>{formatQualityLabel(variant) || (isAudioFile(variant) ? 'Audio' : 'Unknown quality')}</span>
                  {variant.codecName && <span>{variant.codecName}</span>}
                  {formatBytes(variant.size) && <span>{formatBytes(variant.size)}</span>}
                  {getFileExtension(variant.filename || '') && (
                    <span>{getFileExtension(variant.filename || '')}</span>
                  )}
                </div>
                {formatUploadDate(variant.uploadDate) && (
                  <div className='mt-1 text-xs text-muted-foreground'>
                    {formatUploadDate(variant.uploadDate)}
                  </div>
                )}
              </div>
              {isCurrent && (
                <span className='self-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary'>
                  Playing
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function QueueThumbnail({ item }: { item: Pick<VideoPlayerFileVariant, 'thumbnail' | 'updatedAt' | 'uuid'> }) {
  const sources = useMemo(() => {
    const localUrl = `/api/thumbnail?uuid=${encodeURIComponent(item.uuid)}${
      item.updatedAt ? `&v=${item.updatedAt}` : ''
    }`;
    const remoteUrl = item.thumbnail || '';
    const proxyUrl = remoteUrl ? `/api/image?url=${encodeURIComponent(remoteUrl)}` : '';

    return [localUrl, remoteUrl, proxyUrl].filter(Boolean);
  }, [item.thumbnail, item.updatedAt, item.uuid]);
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [sources]);

  const src = sources[sourceIndex] || '';

  if (!src) {
    return (
      <div className='flex h-full w-full items-center justify-center bg-black text-white/35'>
        <Music2 className='h-8 w-8' />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=''
      className='h-full w-full object-cover'
      loading='lazy'
      onError={() => setSourceIndex((index) => Math.min(index + 1, sources.length))}
    />
  );
}

function ShareMenu({
  copiedShareTarget,
  currentTime,
  isMounted,
  open,
  onCopy,
  onNativeShare,
  setOpen,
  setShareWithStartTime,
  shareLinks,
  shareWithStartTime
}: ShareMenuProps) {
  const canNativeShare = isMounted && Boolean(navigator.share);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant='secondary'
        size='icon'
        className='h-9 w-9 rounded-full'
        title='Share'
        onClick={() => setOpen(true)}
      >
        <Share2 className='h-4 w-4' />
      </Button>
      <DialogContent className='max-w-xl'>
        <DialogTitle>Share</DialogTitle>
        <div className='space-y-4'>
          <div className='flex gap-x-2'>
            <Input value={shareLinks.player} readOnly className='h-9 font-mono text-xs' />
            <Button className='h-9 shrink-0 gap-x-1.5' onClick={onCopy('player')}>
              {copiedShareTarget === 'player' ? (
                <Check className='h-4 w-4' />
              ) : (
                <Copy className='h-4 w-4' />
              )}
              {copiedShareTarget === 'player' ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <label className='flex cursor-pointer items-center gap-x-2 text-sm'>
            <Checkbox
              checked={shareWithStartTime}
              onCheckedChange={(checked) => setShareWithStartTime(checked === true)}
            />
            <span>Start at {formatDuration(currentTime)}</span>
          </label>
          <div className='grid gap-2 border-t pt-4 sm:grid-cols-3'>
            {canNativeShare && (
              <Button variant='secondary' className='gap-x-1.5' onClick={onNativeShare}>
                <Share2 className='h-4 w-4' />
                System
              </Button>
            )}
            <Button variant='secondary' className='gap-x-1.5' onClick={onCopy('source')}>
              {copiedShareTarget === 'source' ? (
                <Check className='h-4 w-4' />
              ) : (
                <ExternalLink className='h-4 w-4' />
              )}
              Source
            </Button>
            <Button variant='secondary' className='gap-x-1.5' onClick={onCopy('download')}>
              {copiedShareTarget === 'download' ? (
                <Check className='h-4 w-4' />
              ) : (
                <FileDown className='h-4 w-4' />
              )}
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoMenu({
  currentUuid,
  isAudioOnly,
  variants,
  videoInfo,
  onOpenVariant
}: {
  currentUuid: string;
  isAudioOnly: boolean;
  variants: VideoPlayerFileVariant[];
  videoInfo: VideoPlayerVideoInfo;
  onOpenVariant: (variant: VideoPlayerFileVariant) => void;
}) {
  const displayedVariants = variants.length
    ? variants
    : [
        {
          uuid: videoInfo.uuid,
          title: videoInfo.title,
          url: videoInfo.url,
          filename: videoInfo.filename,
          size: videoInfo.size,
          duration: videoInfo.duration,
          width: videoInfo.width,
          height: videoInfo.height,
          rFrameRate: videoInfo.rFrameRate,
          codecName: videoInfo.codecName,
          colorPrimaries: videoInfo.colorPrimaries,
          containerName: videoInfo.containerName
        }
      ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='secondary'
          size='icon'
          className='h-9 w-9 rounded-full'
          title={isAudioOnly ? 'Audio info' : 'Video info'}
        >
          <Info className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-80'>
        <DropdownMenuLabel>Now playing</DropdownMenuLabel>
        <div className='space-y-1 px-2 pb-2 text-sm'>
          <InfoRow label={isAudioOnly ? 'Type' : 'Quality'} value={formatQualityLabel(videoInfo) || 'Audio'} />
          <InfoRow label='Codec' value={videoInfo.codecName || ''} />
          <InfoRow label='Size' value={formatBytes(videoInfo.size)} />
          <InfoRow label='Ext' value={getFileExtension(videoInfo.filename || '')} />
        </div>
        {displayedVariants.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Same source files</DropdownMenuLabel>
            <div className='max-h-72 overflow-y-auto px-1 pb-1'>
              {displayedVariants.map((variant) => {
                const isCurrent = variant.uuid === currentUuid;

                return (
                  <div
                    key={variant.uuid}
                    className={cn(
                      'mb-1 rounded-md px-2 py-2 text-sm',
                      isCurrent ? 'bg-primary/10 text-primary' : 'bg-muted/40'
                    )}
                  >
                    <div className='line-clamp-1 font-medium' title={variant.filename || variant.title || ''}>
                      {variant.filename || variant.title || 'Untitled'}
                    </div>
                    <div className='mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground'>
                      <span>{formatQualityLabel(variant) || (isAudioFile(variant) ? 'Audio' : 'Unknown quality')}</span>
                      {variant.codecName && <span>{variant.codecName}</span>}
                      {formatBytes(variant.size) && <span>{formatBytes(variant.size)}</span>}
                      {getFileExtension(variant.filename || '') && (
                        <span>{getFileExtension(variant.filename || '')}</span>
                      )}
                    </div>
                    <div className='mt-2 flex justify-end'>
                      <Button
                        size='sm'
                        variant={isCurrent ? 'secondary' : 'default'}
                        className='h-7 rounded-full px-3'
                        disabled={isCurrent}
                        onClick={() => onOpenVariant(variant)}
                      >
                        {isCurrent ? 'Playing' : 'Open'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-center justify-between gap-x-3'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='truncate text-right font-medium'>{value || '-'}</span>
    </div>
  );
}

function MoreMenu({
  downloadUrl,
  isAudioOnly,
  isCapturingThumbnail,
  isRemovingThumbnail,
  originalUrl,
  onCaptureThumbnail,
  onExternalLink,
  onRemoveLocalThumbnail
}: {
  downloadUrl?: string;
  isAudioOnly: boolean;
  isCapturingThumbnail: boolean;
  isRemovingThumbnail: boolean;
  originalUrl: string;
  onCaptureThumbnail: () => void;
  onExternalLink: () => void;
  onRemoveLocalThumbnail: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='secondary' size='icon' className='h-9 w-9 rounded-full' title='More'>
          <MoreVertical className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-52'>
        {!isAudioOnly && (
          <DropdownMenuItem disabled={isCapturingThumbnail} onClick={onCaptureThumbnail}>
            <Camera className='mr-2 h-4 w-4' />
            {isCapturingThumbnail ? 'Saving thumbnail...' : 'Use current frame for thumbnail'}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem disabled={isRemovingThumbnail} onClick={onRemoveLocalThumbnail}>
          <X className='mr-2 h-4 w-4' />
          {isRemovingThumbnail ? 'Removing thumbnail...' : 'Remove local thumbnail'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={originalUrl || ''} rel='noopener noreferrer' target='_blank' onClick={onExternalLink}>
            <ExternalLink className='mr-2 h-4 w-4' />
            Open source
          </a>
        </DropdownMenuItem>
        {downloadUrl && (
          <DropdownMenuItem asChild>
            <a href={downloadUrl} rel='noopener noreferrer' target='_blank' download>
              <Download className='mr-2 h-4 w-4' />
              Download file
            </a>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function clampSurfaceSwipeOffset(deltaY: number) {
  const maxDown = typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.42, 320) : 240;
  const maxUp = typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.22, 170) : 140;

  return Math.min(Math.max(deltaY, -maxUp), maxDown);
}

function getSurfaceSwipeStyle(offset: number): CSSProperties | undefined {
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

function getCloseAnimationDistance(direction: CloseAnimationDirection) {
  if (typeof window === 'undefined') return 480;

  return direction === 'down' ? window.innerHeight : window.innerWidth;
}

function getSurfaceFullscreenReleaseDistance() {
  if (typeof window === 'undefined') return 160;

  return Math.min(window.innerHeight * 0.24, 190);
}

function getTapSide(event: MouseEvent<HTMLElement>): TapSide {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;

  return x < rect.width / 2 ? 'left' : 'right';
}

function isInteractivePlayerTarget(target: EventTarget) {
  if (!(target instanceof Element)) return false;
  if (target.closest('[data-player-tap-zone="true"]')) return false;

  return Boolean(target.closest('button, input, a, [role="button"]'));
}

function isLikelyMobileViewport() {
  if (typeof window === 'undefined') return false;

  const canHover = window.matchMedia('(hover: hover)').matches;
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const longSide = Math.max(window.innerWidth, window.innerHeight);

  return hasCoarsePointer && !canHover && shortSide <= 540 && longSide <= 1000;
}

function getMediaTitle(videoInfo: VideoPlayerVideoInfo) {
  return videoInfo.title || videoInfo.filename || videoInfo.url || 'yt-dlp-web';
}

function getMediaArtwork(videoInfo: VideoPlayerVideoInfo, origin: string): MediaImage[] {
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

function setMediaSessionActionHandler(
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null
) {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch (e) {}
}

function getShareLinks(
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

function getNextRepeatMode(currentMode: VideoRepeatMode, hasPlaylistRepeat: boolean): VideoRepeatMode {
  if (currentMode === 'none') return 'one';
  if (currentMode === 'one') return hasPlaylistRepeat ? 'all' : 'none';
  return 'none';
}

function getRepeatTitle(repeatMode: VideoRepeatMode) {
  if (repeatMode === 'one') return 'Repeat one';
  if (repeatMode === 'all') return 'Repeat playlist';
  return 'Repeat off';
}

function formatQualityLabel(video?: Partial<VideoPlayerVideoInfo | VideoPlayerFileVariant>) {
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

function isAudioFile(video?: Partial<VideoPlayerVideoInfo | VideoPlayerFileVariant>) {
  if (!video) return false;

  const extension = getFileExtension(video.filename || '').toLowerCase();
  if (['aac', 'aiff', 'alac', 'flac', 'm4a', 'mka', 'mp3', 'ogg', 'opus', 'wav', 'weba'].includes(extension)) {
    return true;
  }

  return typeof video.height !== 'number' || video.height <= 0;
}

function getFullscreenOrientation(
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

function isWebkitFullscreenVideo(
  videoEl: HTMLMediaElement | null
): videoEl is HTMLMediaElement & { webkitEnterFullscreen: () => void } {
  return Boolean(
    videoEl &&
      'webkitEnterFullscreen' in videoEl &&
      typeof (videoEl as { webkitEnterFullscreen?: unknown }).webkitEnterFullscreen === 'function'
  );
}

function isAutoplayBlockedError(error: unknown) {
  return error instanceof DOMException && error.name === 'NotAllowedError';
}

function formatBytes(size?: number) {
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

function getFileExtension(filename: string) {
  const basename = filename.split(/[\\/]/).pop() || '';
  const index = basename.lastIndexOf('.');
  if (index < 0 || index === basename.length - 1) return '';

  return basename.slice(index + 1).toUpperCase();
}

function formatUploadDate(uploadDate?: string | null) {
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

function formatDuration(duration?: string | number | null) {
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
