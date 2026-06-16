'use client';

import type { ChangeEvent, MouseEvent, PointerEvent, RefObject } from 'react';
import { Maximize2, Pause, Play, Repeat, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';

import type { MediaCachedRange } from '@/client/mediaRangeCache';
import type { VideoRepeatMode } from '@/store/videoPlayer';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatDuration, getRepeatTitle } from '@/components/modules/video-player/utils';

const controlButtonClass =
  'select-none text-white transition-[background-color,transform,box-shadow,opacity] duration-150 ease-out [-webkit-tap-highlight-color:transparent] active:scale-95 active:bg-white/25 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-0 disabled:active:scale-100';
const primaryControlButtonClass =
  'bg-black/45 shadow-sm hover:bg-white/20 active:bg-white/30';
const secondaryControlButtonClass =
  'bg-black/35 shadow-sm hover:bg-white/20 disabled:opacity-40';
const compactControlButtonClass =
  'hover:bg-white/15 active:bg-white/25';

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
  onControlsBackgroundPointerTap: (event: PointerEvent<HTMLDivElement>) => void;
  onControlsBackgroundTap: (event: MouseEvent<HTMLDivElement>) => void;
  onFullscreen: () => void;
  onMute: () => void;
  onNext: () => void;
  onPlayPause: () => void;
  onPrevious: () => void;
  onProgress: (event: ChangeEvent<HTMLInputElement>) => void;
  onRepeat: () => void;
  onVolume: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function PlayerControls({
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
  onControlsBackgroundPointerTap,
  onControlsBackgroundTap,
  onFullscreen,
  onMute,
  onNext,
  onPlayPause,
  onPrevious,
  onProgress,
  onRepeat,
  onVolume
}: PlayerControlsProps) {
  const handleControlsBackgroundClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('button, input, a, [role="button"]')) return;

    event.preventDefault();
    event.stopPropagation();
    onControlsBackgroundTap(event);
  };

  const handleControlsBackgroundPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return;
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('button, input, a, [role="button"]')) return;

    event.preventDefault();
    event.stopPropagation();
    onControlsBackgroundPointerTap(event);
  };

  return (
    <div
      className={cn(
        'absolute inset-0 z-30 bg-gradient-to-t from-black/80 via-black/35 to-transparent text-white opacity-0 transition-opacity duration-200 ease-out [-webkit-tap-highlight-color:transparent]',
        controlsVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      )}
      onClick={handleControlsBackgroundClick}
      onPointerUp={handleControlsBackgroundPointerUp}
    >
      <div
        className='pointer-events-auto absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-x-5 sm:gap-x-7'
      >
        <Button
          variant='ghost'
          size='icon'
          className={cn(
            'h-12 w-12 rounded-full sm:h-14 sm:w-14',
            controlButtonClass,
            secondaryControlButtonClass
          )}
          onClick={onPrevious}
          disabled={!canPlayAdjacent}
          title='Previous video'
        >
          <SkipBack className='h-7 w-7 fill-current sm:h-8 sm:w-8' />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className={cn(
            'h-16 w-16 rounded-full sm:h-20 sm:w-20',
            controlButtonClass,
            primaryControlButtonClass
          )}
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
          className={cn(
            'h-12 w-12 rounded-full sm:h-14 sm:w-14',
            controlButtonClass,
            secondaryControlButtonClass
          )}
          onClick={onNext}
          disabled={!canPlayAdjacent}
          title='Next video'
        >
          <SkipForward className='h-7 w-7 fill-current sm:h-8 sm:w-8' />
        </Button>
      </div>

      <div
        className='pointer-events-auto absolute inset-x-0 bottom-0 px-3 pb-2 pt-10'
      >
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
              className={cn('relative h-9 w-9 rounded-full', controlButtonClass, compactControlButtonClass)}
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
              className={cn('h-9 w-9 rounded-full', controlButtonClass, compactControlButtonClass)}
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
              className={cn('h-9 w-9 rounded-full', controlButtonClass, compactControlButtonClass)}
              onClick={onFullscreen}
              title='Full screen'
            >
              <Maximize2 className='h-5 w-5' />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className={cn('h-9 w-9 rounded-full', controlButtonClass, compactControlButtonClass)}
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
