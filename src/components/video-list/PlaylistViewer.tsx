import { memo } from 'react';
import numeral from 'numeral';
import { CheckCircle2, HardDriveDownload, LinkIcon, Trash2 } from 'lucide-react';
import { AiOutlineCloudDownload } from 'react-icons/ai';
import { FaPlay } from 'react-icons/fa6';
import { toast } from 'react-toastify';

import type { VideoInfo } from '@/types/video';

import { cn, isPropsEquals } from '@/lib/utils';
import { useVideoPlayerStore } from '@/store/videoPlayer';
import { Divider } from '@/components/Divider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useOfflineMedia } from '@/client/useOfflineMedia';

export type PlaylistViewerProps = { open: boolean; video: VideoInfo; onClose: () => void };

export const PlaylistViewer = memo(({ open, video, onClose }: PlaylistViewerProps) => {
  const {
    deleteOffline,
    getKey: getOfflineKey,
    isAvailable: isOfflineAvailable,
    itemMap: offlineItemMap,
    progressMap: offlineProgressMap,
    saveOffline
  } = useOfflineMedia();
  const handleEventStopPropagation = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const handleChangeOpen = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const handleClickPlayVideo = (playlistVideo: VideoInfo['playlist'][number]) => () => {
    const offlineKey = getOfflineKey(video.uuid, playlistVideo.uuid);
    useVideoPlayerStore.getState().open({
      uuid: video.uuid,
      size: playlistVideo.size,
      url: playlistVideo.url || '',
      thumbnail: video.thumbnail,
      localThumbnail: video.localThumbnail,
      thumbnailSource: video.thumbnailSource,
      updatedAt: video.updatedAt,
      playlistVideoUuid: playlistVideo.uuid,
      title: playlistVideo.name || '',
      filename: playlistVideo.name,
      type: video.type,
      playlistTitle: video.title,
      playlist: video.playlist,
      duration: playlistVideo.duration,
      width: playlistVideo.width,
      height: playlistVideo.height,
      rFrameRate: playlistVideo.rFrameRate,
      codecName: playlistVideo.codecName,
      colorPrimaries: playlistVideo.colorPrimaries,
      containerName: playlistVideo.containerName,
      offlineKey: offlineItemMap[offlineKey] ? offlineKey : undefined
    });
  };

  const handleClickSaveOffline =
    (playlistVideo: VideoInfo['playlist'][number]) => async (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!playlistVideo?.uuid) return;

      try {
        await saveOffline(video, playlistVideo);
        toast.success('Saved for offline playback.');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save offline.');
      }
    };

  const handleClickDeleteOffline = (key: string) => async (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      await deleteOffline(key);
      toast.success('Removed offline copy.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove offline copy.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleChangeOpen}>
      <DialogContent className='max-w-3xl max-h-full flex flex-col'>
        <div className='flex flex-col overflow-hidden' onClick={handleEventStopPropagation}>
          <DialogTitle className='flex-auto pl-2 py-1 text-xl'>
            <a
              className='inline-flex gap-x-1 items-center hover:underline'
              href={video.url || ''}
              rel='noopener noreferrer'
              target='_blank'
              title='Open Original Link'
            >
              <LinkIcon className='inline shrink-0 text-base' size='1em' />
              <span className='font-bold line-clamp-2'>{video.title || video.url} </span>
              <span className='text-sm shrink-0'>
                {video.download.playlist?.count && `(${video.download.playlist?.count})`}
              </span>
            </a>
          </DialogTitle>
          <Divider className='shrink-0 mt-0 mb-2' />
          <div className='flex flex-col flex-auto gap-y-1 overflow-y-auto'>
            {video.playlist.map((item, i) => {
              const offlineKey = item?.uuid ? getOfflineKey(video.uuid, item.uuid) : '';
              const offlineItem = offlineKey ? offlineItemMap[offlineKey] : null;
              const offlineProgress = offlineKey ? offlineProgressMap[offlineKey] : null;
              const isOfflineSaved = Boolean(offlineItem);
              const isOfflineSaving = Boolean(offlineProgress && offlineProgress.progress < 1);

              if (!item) {
                return (
                  <div
                    key={i}
                    className='flex gap-x-1 p-1 hover:bg-foreground/10 rounded-md text-muted-foreground'
                  >
                    <div className='min-w-[2em] shrink-0 text-center font-bold'>{i + 1}</div>
                    <div>No Data</div>
                  </div>
                );
              }

              return (
                <div
                  key={item?.uuid ?? i}
                  className='flex gap-x-1 p-1 hover:bg-foreground/10 rounded-md'
                >
                  <div
                    className={cn(
                      'min-w-[2em] shrink-0 text-center font-bold',
                      item.error && 'text-error-foreground',
                      !item.error && item.isLive && 'text-muted-foreground line-through'
                    )}
                  >
                    {i + 1}
                  </div>
                  <div className='flex items-center justify-between gap-x-1 flex-auto'>
                    <div className='line-clamp-3 shrink'>
                      {item.error ? (
                        <span className='text-error-foreground' title={item.error}>
                          {item.error}
                        </span>
                      ) : item.isLive ? (
                        <span className='text-muted-foreground'>Live has been excluded.</span>
                      ) : (
                        <span
                          className='inline-flex cursor-pointer items-center gap-x-1 hover:underline'
                          title={item.name || ''}
                          onClick={handleClickPlayVideo(item)}
                        >
                          {isOfflineSaved && <CheckCircle2 className='h-3.5 w-3.5 shrink-0 text-emerald-500' />}
                          {item.name}
                          {isOfflineSaving && (
                            <span className='text-xs text-muted-foreground'>
                              {Math.round((offlineProgress?.progress || 0) * 100)}%
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <span className='shrink-0'>
                      {item.size && numeral(item.size).format('0.0b')}
                    </span>
                  </div>
                  <div className='flex items-center shrink-0 leading-4'>
                    <Button
                      size='sm'
                      className='px-3 h-[1.5em] text-lg bg-warning hover:bg-warning/90 rounded-xl rounded-r-none'
                      onClick={handleClickPlayVideo(item)}
                    >
                      <FaPlay className='text-sm' />
                    </Button>
                    <Button
                      size='sm'
                      className='p-0 h-[1.5em] text-lg bg-info hover:bg-info/90 rounded-none'
                    >
                      <a
                        href={item.url || ''}
                        className={cn(
                          'flex items-center w-full h-full px-3',
                          !item.url && 'pointer-events-none'
                        )}
                        rel='noopener noreferrer'
                        target='_blank'
                        title='Open Item Link'
                      >
                        <LinkIcon className='text-base' size='1em' />
                      </a>
                    </Button>
                    <Button
                      size='sm'
                      className='p-0 h-[1.5em] text-lg rounded-none'
                      disabled={Boolean(
                        item?.error || !item.uuid || !item.path || !item.size || item.isLive
                      )}
                    >
                      <a
                        className={cn(
                          'flex items-center w-full h-full px-3',
                          (item?.error || !item.uuid || !item.path || !item.size || item.isLive) &&
                            'pointer-events-none'
                        )}
                        href={`/api/playlist/file?uuid=${video.uuid}&itemUuid=${item.uuid}&itemIndex=${i}&download=true`}
                        rel='noopener noreferrer'
                        target='_blank'
                        download={item.name}
                        title='Download Video'
                      >
                        <AiOutlineCloudDownload />
                      </a>
                    </Button>
                    <Button
                      size='sm'
                      className={cn(
                        'h-[1.5em] rounded-xl rounded-l-none px-3 text-lg',
                        isOfflineSaved
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      )}
                      disabled={Boolean(
                        !isOfflineAvailable ||
                          isOfflineSaving ||
                          item?.error ||
                          !item.uuid ||
                          !item.path ||
                          !item.size ||
                          item.isLive
                      )}
                      onClick={
                        isOfflineSaved ? handleClickDeleteOffline(offlineKey) : handleClickSaveOffline(item)
                      }
                      title={isOfflineSaved ? 'Remove offline copy' : 'Save offline'}
                    >
                      {isOfflineSaved ? (
                        <Trash2 className='h-3.5 w-3.5' />
                      ) : (
                        <HardDriveDownload className='h-3.5 w-3.5' />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}, isPropsEquals);

PlaylistViewer.displayName = 'PlaylistViewer';
