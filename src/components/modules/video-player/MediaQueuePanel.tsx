'use client';

import { useEffect, useMemo, useState } from 'react';
import { ListVideo, Music2 } from 'lucide-react';

import type { VideoInfo } from '@/types/video';
import type {
  VideoPlayerFileVariant,
  VideoPlayerQueueItem,
  VideoPlayerVideoInfo
} from '@/components/modules/video-player/types';

import { cn } from '@/lib/utils';
import {
  formatBytes,
  formatDuration,
  formatQualityLabel,
  formatUploadDate,
  getFileExtension,
  isAudioFile
} from '@/components/modules/video-player/utils';

export function MediaQueuePanel({
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
