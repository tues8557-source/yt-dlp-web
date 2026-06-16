'use client';

import type { ReactNode, TouchEvent } from 'react';

import type { CloseAnimationDirection } from '@/components/modules/video-player/types';

import { cn } from '@/lib/utils';

type TheaterPlayerLayoutProps = {
  isWideScreen: boolean;
  playerBar: ReactNode;
  playerSurface: ReactNode;
};

type ResponsivePlayerLayoutProps = {
  closeAnimationDirection: CloseAnimationDirection;
  edgeSwipeOffset: number;
  isAudioOnly: boolean;
  isEdgeSwipeClosing: boolean;
  isSurfaceSwipeDismissing: boolean;
  metaHeader: ReactNode;
  playerSurface: ReactNode;
  queuePanel: ReactNode;
  onTouchCancel: () => void;
  onTouchEnd: (event: TouchEvent<HTMLDivElement>) => void;
  onTouchMove: (event: TouchEvent<HTMLDivElement>) => void;
  onTouchStart: (event: TouchEvent<HTMLDivElement>) => void;
};

export function TheaterPlayerLayout({
  isWideScreen,
  playerBar,
  playerSurface
}: TheaterPlayerLayoutProps) {
  return (
    <div className='group relative flex h-full min-w-[var(--site-min-width)] flex-col items-center overflow-hidden bg-black text-white'>
      {playerBar}
      <div className='relative flex min-h-0 w-full flex-auto items-center justify-center overflow-hidden'>
        <div className={cn('w-full', isWideScreen ? 'h-full' : 'max-h-full')}>{playerSurface}</div>
      </div>
    </div>
  );
}

export function ResponsivePlayerLayout({
  closeAnimationDirection,
  edgeSwipeOffset,
  isAudioOnly,
  isEdgeSwipeClosing,
  isSurfaceSwipeDismissing,
  metaHeader,
  playerSurface,
  queuePanel,
  onTouchCancel,
  onTouchEnd,
  onTouchMove,
  onTouchStart
}: ResponsivePlayerLayoutProps) {
  return (
    <div
      className={cn(
        'flex h-full min-w-[var(--site-min-width)] overflow-hidden text-foreground opacity-100 shadow-[-18px_0_40px_rgba(0,0,0,0.28)] transition-[background-color,transform] duration-150 md:block md:overflow-y-auto',
        isSurfaceSwipeDismissing ? 'bg-transparent shadow-none' : 'bg-background',
        isEdgeSwipeClosing && closeAnimationDirection === 'down'
          ? 'pointer-events-none opacity-0 transition-opacity duration-200 ease-out'
          : isEdgeSwipeClosing
            ? 'transition-transform duration-200 ease-out'
            : edgeSwipeOffset > 0 && 'transition-none'
      )}
      style={{
        transform: edgeSwipeOffset
          ? closeAnimationDirection === 'down'
            ? `translate3d(0, ${edgeSwipeOffset}px, 0)`
            : `translate3d(${edgeSwipeOffset}px, 0, 0)`
          : undefined
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <div
        className={cn(
          'mx-auto flex h-full min-h-0 w-full max-w-[1280px] flex-col gap-3 px-3 py-3 md:grid md:h-auto md:min-h-full md:gap-4 md:px-5',
          isAudioOnly && '[@media_(orientation:landscape)_and_(max-height:540px)]:max-w-none [@media_(orientation:landscape)_and_(max-height:540px)]:p-2'
        )}
      >
        <main
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col md:block',
            isAudioOnly && '[@media_(orientation:landscape)_and_(max-height:540px)]:grid [@media_(orientation:landscape)_and_(max-height:540px)]:grid-cols-[minmax(0,45vw)_minmax(0,1fr)] [@media_(orientation:landscape)_and_(max-height:540px)]:gap-3'
          )}
        >
          {playerSurface}
          <section
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-hidden pt-3 transition-opacity duration-150 md:block md:overflow-visible [@media_(orientation:landscape)_and_(max-height:540px)]:pt-0',
              isSurfaceSwipeDismissing && 'pointer-events-none opacity-0'
            )}
          >
            {metaHeader}
            {queuePanel}
          </section>
        </main>
      </div>
    </div>
  );
}
