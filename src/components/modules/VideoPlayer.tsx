'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent, PointerEvent, TouchEvent } from 'react';
import { mutate } from 'swr';
import { toast } from 'react-toastify';
import { ListVideo, Music2, Pause, Play } from 'lucide-react';

import type { WithoutNullableKeys } from '@/types/types';
import type { VideoInfo } from '@/types/video';

import { cn } from '@/lib/utils';
import { useVideoPlayerStore } from '@/store/videoPlayer';
import {
  createOfflineObjectUrl,
  getOfflineMedia,
  getOfflineMediaKey
} from '@/client/offlineMedia';
import { useMediaRangeCache } from '@/client/mediaRangeCache';
import { ResponsivePlayerLayout, TheaterPlayerLayout } from '@/components/modules/video-player/PlayerLayouts';
import { PlayerControls } from '@/components/modules/video-player/PlayerControls';
import { CompactPlayerBar, InfoMenu, MoreMenu, ShareMenu } from '@/components/modules/video-player/PlayerMenus';
import { MediaQueuePanel } from '@/components/modules/video-player/MediaQueuePanel';
import type {
  CloseAnimationDirection,
  LockableScreenOrientation,
  PlaybackFeedback,
  ShareTarget,
  SurfaceSwipeDirection,
  TapSide,
  TouchPoint,
  VideoPlayerFileVariant,
  VideoPlayerProps,
  VideoPlayerQueueItem,
  VideoPlayerVideoInfo
} from '@/components/modules/video-player/types';
import {
  clampSurfaceSwipeOffset,
  formatDuration,
  getCloseAnimationDistance,
  getFullscreenOrientation,
  getMediaArtwork,
  getMediaTitle,
  getNextRepeatMode,
  getShareLinks,
  getSurfaceFullscreenReleaseDistance,
  getSurfaceSwipeStyle,
  getTapSide,
  isAudioFile,
  isAutoplayBlockedError,
  isInteractivePlayerTarget,
  isLikelyMobileViewport,
  isWebkitFullscreenVideo,
  setMediaSessionActionHandler
} from '@/components/modules/video-player/utils';

export type {
  VideoPlayerFileVariant,
  VideoPlayerProps,
  VideoPlayerQueueItem,
  VideoPlayerVideoInfo
} from '@/components/modules/video-player/types';

const SINGLE_TAP_DELAY_MS = 520;
const CONTROLS_AUTO_HIDE_MS = 5000;

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
  const lastTapRef = useRef<{ time: number; side: TapSide; controlsVisible: boolean } | null>(null);
  const longPressTimeoutRef = useRef<number | null>(null);
  const controlsVisibleRef = useRef(false);
  const suppressControlsUntilRef = useRef(0);
  const suppressHoverControlsUntilRef = useRef(0);
  const suppressClickUntilRef = useRef(0);
  const longPressOriginalRateRef = useRef(1);
  const isLongPressActiveRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const shouldResumeAfterFullscreenRef = useRef(false);
  const fullscreenExitResumeUntilRef = useRef(0);
  const originalDocumentTitleRef = useRef<string | null>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [isMuted, setMuted] = useState(false);
  const [currentTime, setLocalCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(false);
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
  const [isResolvingOfflineMedia, setResolvingOfflineMedia] = useState(true);
  const isOfflinePlayback = Boolean(offlineMediaUrl);
  const playbackUrl = isResolvingOfflineMedia ? '' : offlineMediaUrl || videoFileUrl;
  const cachedRanges = useMediaRangeCache(videoFileUrl, !isOfflinePlayback && !isResolvingOfflineMedia);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    controlsVisibleRef.current = controlsVisible;
  }, [controlsVisible]);

  useEffect(() => {
    setControlsVisible(false);
    controlsVisibleRef.current = false;
    setControlsActivity(0);
    clearPendingSingleTap();
    lastTapRef.current = null;
    suppressHoverControlsUntilRef.current = Date.now() + 500;
    suppressClickUntilRef.current = Date.now() + 500;
  }, [videoInfo.uuid, videoInfo.playlistVideoUuid]);

  useEffect(() => {
    let objectUrl = '';
    let isCanceled = false;
    const key = videoInfo.offlineKey || getOfflineMediaKey(videoInfo.uuid, videoInfo.playlistVideoUuid);

    setOfflineMediaUrl('');
    setResolvingOfflineMedia(true);

    (async () => {
      try {
        const record = await getOfflineMedia(key).catch(() => null);
        if (!record || isCanceled) return;

        objectUrl = createOfflineObjectUrl(record);
        setOfflineMediaUrl(objectUrl);
      } finally {
        if (!isCanceled) {
          setResolvingOfflineMedia(false);
        }
      }
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
    if (!videoInfo || !videoEl || !playbackUrl) return;

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
        controlsVisibleRef.current = true;
        setControlsVisible(true);
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
    const handlePauseVideo = () => {
      const shouldResume = shouldResumeAfterFullscreenRef.current && Date.now() < fullscreenExitResumeUntilRef.current;
      if (shouldResume) {
        window.setTimeout(() => {
          const currentVideoEl = videoRef.current;
          if (currentVideoEl?.paused) {
            void currentVideoEl.play().catch(() => {});
          }
        }, 80);
        return;
      }

      setPlaying(false);
    };
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
  }, [videoInfo, repeatMode, playbackUrl]);

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
    }, CONTROLS_AUTO_HIDE_MS);

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
    if (typeof document === 'undefined') return;

    const handleFullscreenChange = () => {
      const isFullscreen = Boolean(document.fullscreenElement);
      const videoEl = videoRef.current;
      if (!videoEl) return;

      if (isFullscreen) {
        shouldResumeAfterFullscreenRef.current = !videoEl.paused;
        return;
      }

      if (shouldResumeAfterFullscreenRef.current && videoEl.paused) {
        void videoEl.play().catch(() => {});
      }
      fullscreenExitResumeUntilRef.current = Date.now() + 900;
      window.setTimeout(() => {
        if (shouldResumeAfterFullscreenRef.current && videoEl.paused) {
          void videoEl.play().catch(() => {});
        }
        shouldResumeAfterFullscreenRef.current = false;
      }, 160);
    };

    const handleWebkitEndFullscreen = () => {
      const videoEl = videoRef.current;
      fullscreenExitResumeUntilRef.current = Date.now() + 900;
      if (shouldResumeAfterFullscreenRef.current && videoEl?.paused) {
        void videoEl.play().catch(() => {});
      }
      window.setTimeout(() => {
        const currentVideoEl = videoRef.current;
        if (shouldResumeAfterFullscreenRef.current && currentVideoEl?.paused) {
          void currentVideoEl.play().catch(() => {});
        }
        shouldResumeAfterFullscreenRef.current = false;
      }, 160);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    const videoEl = videoRef.current;
    videoEl?.addEventListener?.('webkitendfullscreen', handleWebkitEndFullscreen);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      videoEl?.removeEventListener?.('webkitendfullscreen', handleWebkitEndFullscreen);
    };
  }, [playbackUrl]);

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
    if (lastTap && lastTap.side === side && now - lastTap.time < SINGLE_TAP_DELAY_MS) {
      clearPendingSingleTap();
      lastTapRef.current = null;
      suppressControlsUntilRef.current = now + 500;
      seekBy(side === 'left' ? -10 : 10);
      if (!lastTap.controlsVisible) {
        handleHideControls();
      }
      return;
    }

    lastTapRef.current = { time: now, side, controlsVisible: controlsVisibleRef.current };
    clearPendingSingleTap();
    clickTimeoutRef.current = window.setTimeout(async () => {
      clickTimeoutRef.current = null;
      lastTapRef.current = null;
      if (controlsVisibleRef.current) {
        handleHideControls();
      } else {
        handleShowControls();
      }
    }, SINGLE_TAP_DELAY_MS);
  };

  const handleClickVideo = async (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (Date.now() < suppressClickUntilRef.current) return;

    await handlePlayerTap(getTapSide(event));
  };

  const handleTapZoneClick = (side: TapSide) => async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (Date.now() < suppressClickUntilRef.current) return;

    await handlePlayerTap(side);
  };

  const handlePlayerPointerTap = async (side: TapSide) => {
    suppressClickUntilRef.current = Date.now() + 450;
    await handlePlayerTap(side);
  };

  const handleVideoPointerUp = async (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse') return;

    event.preventDefault();
    event.stopPropagation();
    restorePlaybackRate();
    await handlePlayerPointerTap(getTapSide(event));
  };

  const handleTapZonePointerUp = (side: TapSide) => async (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse') return;

    event.preventDefault();
    event.stopPropagation();
    restorePlaybackRate();
    await handlePlayerPointerTap(side);
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
      shouldResumeAfterFullscreenRef.current = !videoRef.current?.paused;
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
    if (Date.now() < suppressControlsUntilRef.current) return;

    controlsVisibleRef.current = true;
    setControlsVisible(true);
    setControlsActivity((value) => value + 1);
  };

  const handleHoverShowControls = () => {
    if (Date.now() < suppressHoverControlsUntilRef.current) return;

    handleShowControls();
  };

  const handleHideControls = () => {
    controlsVisibleRef.current = false;
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
        'relative aspect-video w-full shrink-0 touch-none select-none overflow-hidden rounded-lg bg-black shadow-sm will-change-transform',
        isAudioOnly && '[@media_(orientation:landscape)_and_(max-height:540px)]:h-full [@media_(orientation:landscape)_and_(max-height:540px)]:min-h-0 [@media_(orientation:landscape)_and_(max-height:540px)]:aspect-auto',
        isSurfaceSwipeReleasing
          ? 'transition-transform duration-200 ease-out'
          : surfaceSwipeOffset && 'transition-none'
      )}
      style={getSurfaceSwipeStyle(surfaceSwipeOffset)}
      onMouseEnter={handleHoverShowControls}
      onMouseMove={handleHoverShowControls}
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
          onPointerUp={handleVideoPointerUp}
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
            onPointerUp={handleTapZonePointerUp('left')}
            onClick={handleTapZoneClick('left')}
          />
          <button
            type='button'
            aria-label='Forward 10 seconds'
            data-player-tap-zone='true'
            className='pointer-events-auto h-full flex-1 cursor-default bg-transparent outline-none'
            onPointerUp={handleTapZonePointerUp('right')}
            onClick={handleTapZoneClick('right')}
          />
        </div>
      )}
      {isAudioOnly && (
        <div
          className='absolute inset-0 flex cursor-pointer items-center justify-center bg-black'
          onPointerUp={handleVideoPointerUp}
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
        onControlsBackgroundTap={handleHideControls}
        onVolume={handleVolumeChange}
        canPlayAdjacent={hasRepeatQueue}
        isOfflinePlayback={isOfflinePlayback}
        cachedRanges={cachedRanges}
      />
    </div>
  );

  const playerBar = (
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
  );

  const metaHeader = (
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
  );

  const queuePanel = (
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
  );

  if (isTheaterMode) {
    return (
      <TheaterPlayerLayout
        isWideScreen={isWideScreen}
        playerBar={playerBar}
        playerSurface={playerSurface}
      />
    );
  }

  return (
    <ResponsivePlayerLayout
      closeAnimationDirection={closeAnimationDirection}
      edgeSwipeOffset={edgeSwipeOffset}
      isAudioOnly={isAudioOnly}
      isEdgeSwipeClosing={isEdgeSwipeClosing}
      metaHeader={metaHeader}
      playerSurface={playerSurface}
      queuePanel={queuePanel}
      onTouchStart={handleEdgeTouchStart}
      onTouchMove={handleEdgeTouchMove}
      onTouchEnd={handleEdgeTouchEnd}
      onTouchCancel={() => {
        edgeTouchStartRef.current = null;
        setEdgeSwipeOffset(0);
      }}
    />
  );
}
