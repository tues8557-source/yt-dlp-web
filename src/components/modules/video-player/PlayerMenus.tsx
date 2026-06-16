'use client';

import { useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Info,
  Maximize2,
  MoreVertical,
  Pin,
  PinOff,
  Share2,
  X
} from 'lucide-react';
import { TbViewportNarrow, TbViewportWide } from 'react-icons/tb';

import type { VideoInfo } from '@/types/video';
import type {
  ShareTarget,
  VideoPlayerFileVariant,
  VideoPlayerVideoInfo
} from '@/components/modules/video-player/types';

import { cn } from '@/lib/utils';
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
  formatBytes,
  formatDuration,
  formatQualityLabel,
  getFileExtension,
  isAudioFile
} from '@/components/modules/video-player/utils';

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

export function CompactPlayerBar({
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

export function ShareMenu({
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

export function InfoMenu({
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

export function MoreMenu({
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-center justify-between gap-x-3'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='truncate text-right font-medium'>{value || '-'}</span>
    </div>
  );
}
