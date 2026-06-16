import { createWithEqualityFn } from 'zustand/traditional';
import { createJSONStorage, persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import type { VideoPlayerVideoInfo } from '@/components/modules/video-player/types';

export type VideoRepeatMode = 'none' | 'one' | 'all';

interface VideoPlayerState {
  openVideoPlayer: boolean;
  isNotSupportedCodec: boolean;
  isWideScreen: boolean;
  isTopSticky: boolean;
  repeatMode: VideoRepeatMode;
  videoUuid: string;
  playlistVideoUuid: string;
  video: VideoPlayerVideoInfo | null;
  currentTime: number;
  volume: number;
}

export interface VideoPlayerStore extends VideoPlayerState {
  open: (video: VideoPlayerVideoInfo | null) => void;
  close: () => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (currentTime: number) => void;
  setNotSupportedCodec: (isNotSupportedCodec: boolean) => void;
  setWideScreen: (isWideScreen: boolean) => void;
  setTopSticky: (isTopSticky: boolean) => void;
  setRepeatMode: (repeatMode: VideoRepeatMode) => void;
}

const initialState: VideoPlayerState = {
  openVideoPlayer: false,
  isNotSupportedCodec: false,
  isWideScreen: false,
  isTopSticky: false,
  repeatMode: 'none',
  video: null,
  videoUuid: '',
  playlistVideoUuid: '',
  currentTime: 0,
  volume: 0.75
};

export const useVideoPlayerStore = createWithEqualityFn(
  persist<VideoPlayerStore>(
    (set) => ({
      ...initialState,
      open(video) {
        set((prev) => {
          const nextCurrentTime =
            video &&
            prev?.videoUuid === video?.uuid &&
            (!video?.playlistVideoUuid || prev?.playlistVideoUuid === video?.playlistVideoUuid)
              ? prev.currentTime
              : 0;

          return {
            openVideoPlayer: true,
            isNotSupportedCodec: false,
            video,
            videoUuid: video?.uuid || '',
            playlistVideoUuid: video?.playlistVideoUuid || '',
            currentTime: nextCurrentTime
          };
        });
      },
      close() {
        set({
          openVideoPlayer: false,
          isNotSupportedCodec: false,
          video: null
        });
      },
      setVolume(volume) {
        set({ volume });
      },
      setCurrentTime(currentTime) {
        set({ currentTime });
      },
      setNotSupportedCodec(isNotSupportedCodec) {
        set({ isNotSupportedCodec });
      },
      setWideScreen(isWideScreen) {
        set({ isWideScreen });
      },
      setTopSticky(isTopSticky) {
        set({ isTopSticky });
      },
      setRepeatMode(repeatMode) {
        set({ repeatMode });
      }
    }),
    {
      name: 'videoPlayer',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) => !['openVideoPlayer', 'isNotSupportedCodec'].includes(key)
          )
        ) as VideoPlayerStore,
      migrate: (persistedState) => {
        const state = persistedState as Partial<VideoPlayerStore> & { isLoopVideo?: boolean };
        if (!state.repeatMode && state.isLoopVideo) {
          return {
            ...state,
            repeatMode: 'one'
          } as VideoPlayerStore;
        }

        return state as VideoPlayerStore;
      },
      version: 0.1,
      skipHydration: true
    }
  ),
  shallow
);
