import { Fragment, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { VscRefresh } from 'react-icons/vsc';
import {
  MdOutlineKeyboardReturn,
  MdOutlineVideocamOff,
  MdPlaylistRemove,
  MdStop
} from 'react-icons/md';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { BiDotsVerticalRounded } from 'react-icons/bi';
import { LayoutMode, useVideoListStore } from '@/store/videoList';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { RiListCheck3 } from 'react-icons/ri';
import { TbPlaylistX } from 'react-icons/tb';
import { cn } from '@/lib/utils';
import { VideoListProps, type VideoListViewMode } from '@/components/containers/VideoList';
import { Input } from '@/components/ui/input';
import { IoClose } from 'react-icons/io5';
import { AiOutlineSearch } from 'react-icons/ai';

export type VideoListHeaderProps = {
  items: VideoListProps['items'];
  orders: VideoListProps['orders'];
  isValidating: boolean;
  search: string;
  viewMode: VideoListViewMode;
  onClickReloadButton: () => void;
  setSearch: (search: string) => void;
  setViewMode: (viewMode: VideoListViewMode) => void;
};

export const VideoListHeader: React.FC<VideoListHeaderProps> = ({
  items,
  orders,
  isValidating,
  search,
  viewMode,
  setSearch,
  setViewMode,
  onClickReloadButton
}) => {
  const {
    layoutMode,
    setLayoutMode,
    isSelectMode,
    selectedUuids,
    setSelectMode,
    reaplceUuids,
    clearUuids
  } = useVideoListStore();
  const [openDeleteList, setOpenDeleteList] = useState(false);
  const [openDeleteFile, setOpenDeleteFile] = useState(false);
  const [openDeleteAllList, setOpenDeleteAllList] = useState(false);
  const [openDeleteAllFile, setOpenDeleteAllFile] = useState(false);
  const [isMobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const itemLength = orders?.length || 0;
  const isAllSelected = itemLength && selectedUuids.size === itemLength;
  const isSearchExpanded = isMobileSearchOpen || Boolean(search);

  useEffect(() => {
    if (!isMobileSearchOpen) return;

    searchInputRef.current?.focus();
  }, [isMobileSearchOpen]);

  const handleCloseDeleteList = () => {
    setOpenDeleteList(false);
  };

  const handleChangeDeleteList = (open: boolean) => {
    setOpenDeleteList(open);
  };

  const handleCloseDeleteFile = () => {
    setOpenDeleteFile(false);
  };

  const handleChangeDeleteFile = (open: boolean) => {
    setOpenDeleteFile(open);
  };

  const handleCloseDeleteAllList = () => {
    setOpenDeleteAllList(false);
  };

  const handleChangeDeleteAllList = (open: boolean) => {
    setOpenDeleteAllList(open);
  };

  const handleCloseDeleteAllFile = () => {
    setOpenDeleteAllFile(false);
  };

  const handleChangeDeleteAllFile = (open: boolean) => {
    setOpenDeleteAllFile(open);
  };

  const handleClickReloadButton = async () => {
    onClickReloadButton();
  };

  const handleClickChangeLayoutButton = (mode: LayoutMode) => () => {
    setLayoutMode(mode);
  };

  const handleClickSelectMode = () => {
    const nextSelectMode = !isSelectMode;

    if (nextSelectMode && orders) {
      const newUuids = [...selectedUuids].filter((uuid) => orders.includes(uuid));
      reaplceUuids(newUuids);
    }
    setSelectMode(nextSelectMode);
  };

  const handleClickLeaveSelectMode = () => {
    setSelectMode(false);
  };

  const handleClickSelectAll = () => {
    if (!itemLength || !orders) {
      return;
    }
    const newUuids = [...orders, ...selectedUuids];
    reaplceUuids(newUuids);
  };
  const handleClickClearAll = () => {
    clearUuids();
  };

  const handleClickDelete =
    (deleteType: 'deleteFile' | 'deleteList' | 'deleteAllFile' | 'deleteAllList') => async () => {
      if (!deleteType || !orders) {
        return;
      }
      const { clearUuids, selectedUuids } = useVideoListStore.getState();
      const isDeleteAll = ['deleteAllFile', 'deleteAllList'].includes(deleteType);

      const deleteFile = ['deleteFile', 'deleteAllFile'].includes(deleteType);
      const uuids = isDeleteAll ? [...orders] : Array.from(selectedUuids);

      if (!uuids.length) {
        clearUuids();
        return;
      }

      switch (deleteType) {
        case 'deleteAllFile':
        case 'deleteAllList':
        case 'deleteList':
        case 'deleteFile': {
          const result = await axios
            .delete('/api/files', {
              data: {
                uuids,
                deleteFile
              }
            })
            .then((res) => res.data)
            .catch((res) => res.response.data);

          if (result?.success) {
            clearUuids();
            handleClickLeaveSelectMode();
            toast.success('Selected video has been deleted.');
            setTimeout(() => {
              onClickReloadButton();
            }, 100);

            switch (deleteType) {
              case 'deleteAllFile': {
                handleCloseDeleteAllFile();
                break;
              }
              case 'deleteAllList': {
                handleCloseDeleteAllList();
                break;
              }
              case 'deleteList': {
                handleCloseDeleteList();
                break;
              }
              case 'deleteFile': {
                handleCloseDeleteFile();
                break;
              }
            }
          } else {
            toast.error(result.error || 'Failed to delete.');
          }

          break;
        }
      }
    };
  const handleChangeSearchValue = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const newSearch = evt.target.value;
    setSearch(newSearch);
  };

  const handleClickClearSearchButton = () => {
    setSearch('');
    setMobileSearchOpen(false);
  };

  const handleClickSearchButton = () => {
    setMobileSearchOpen(true);
  };

  return (
    <div
      className={cn(
        'sticky top-0 z-40 -mx-4 mb-4 flex min-h-8 flex-nowrap items-center justify-between gap-2 bg-card/95 px-4 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:relative lg:top-auto lg:z-auto lg:mx-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none',
        isSelectMode && 'flex-wrap'
      )}
    >
      <div className='w-full flex items-center gap-2'>
        {!isSelectMode && (
          <div
            className={cn(
              'shrink-0 overflow-hidden rounded-full border bg-background text-xs font-medium',
              isSearchExpanded ? 'hidden lg:flex' : 'flex'
            )}
          >
            <Button
              type='button'
              variant={viewMode === 'all' ? 'default' : 'ghost'}
              className='h-8 rounded-none px-3'
              onClick={() => setViewMode('all')}
            >
              All
            </Button>
            <Button
              type='button'
              variant={viewMode === 'video' ? 'default' : 'ghost'}
              className='h-8 rounded-none px-3'
              onClick={() => setViewMode('video')}
            >
              Video
            </Button>
            <Button
              type='button'
              variant={viewMode === 'audio' ? 'default' : 'ghost'}
              className='h-8 rounded-none px-3'
              onClick={() => setViewMode('audio')}
            >
              Audio
            </Button>
            <Button
              type='button'
              variant={viewMode === 'playlists' ? 'default' : 'ghost'}
              className='h-8 rounded-none px-3'
              onClick={() => setViewMode('playlists')}
            >
              Playlists
            </Button>
          </div>
        )}
        {isSelectMode ? (
          <h1 className='text-center text-lg font-bold whitespace-nowrap'>Select Mode</h1>
        ) : null}
        <div
          className={cn(
            'ml-auto flex shrink-0 items-center justify-end overflow-hidden rounded-full bg-background shadow-sm transition-[width,height] duration-200 ease-out lg:h-8 lg:min-w-0 lg:flex-1 lg:px-0',
            isSearchExpanded
              ? 'h-10 min-w-0 flex-1 border lg:h-8 lg:border-0'
              : 'h-8 w-8 lg:w-auto'
          )}
        >
          <Input
            ref={searchInputRef}
            type='text'
            className={cn(
              'h-full min-w-0 flex-1 shrink rounded-none border-none bg-transparent p-1 pl-3 transition-opacity duration-150',
              isSearchExpanded ? 'opacity-100' : 'pointer-events-none w-0 flex-none opacity-0 lg:pointer-events-auto lg:w-auto lg:flex-1 lg:opacity-100'
            )}
            value={search}
            placeholder='Search title, filename'
            onChange={handleChangeSearchValue}
          />
          {isSearchExpanded ? (
            <Button
              key={'clear-search'}
              type='button'
              variant='outline'
              size='icon'
              className='h-full w-10 shrink-0 rounded-none border-none px-1 text-xl text-muted-foreground hover:text-muted-foreground lg:w-8'
              onClick={handleClickClearSearchButton}
            >
              <IoClose />
            </Button>
          ) : (
            <Button
              key={'search'}
              type='button'
              variant='outline'
              size='icon'
              className={cn(
                'h-full shrink-0 p-0 text-xl text-muted-foreground hover:text-muted-foreground lg:w-8',
                isSearchExpanded ? 'w-10 rounded-none border-none' : 'w-8 rounded-full border-none lg:rounded-none'
              )}
              onClick={handleClickSearchButton}
            >
              <AiOutlineSearch />
            </Button>
          )}
        </div>
        {/* {isDevelopment && !isSelectMode && (
          <div className='flex items-center border-join'>
            <Button
              variant='ghost'
              size='icon'
              className={cn(
                'h-auto py-2 text-lg',
                layoutMode === 'table' &&
                  'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
              )}
              onClick={handleClickChangeLayoutButton('table')}
            >
              <LayoutList size='1em' />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className={cn(
                'h-auto py-2 text-lg',
                layoutMode === 'grid' &&
                  'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
              )}
              onClick={handleClickChangeLayoutButton('grid')}
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                width='1em'
                height='1em'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
                className='lucide lucide-grid-2x2'
              >
                <rect width='18' height='18' x='3' y='3' rx='2' />
                <path d='M3 12h18' />
                <path d='M12 3v18' />
              </svg>
            </Button>
          </div>
        )} */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className={cn(
                'shrink-0 text-2xl rounded-full',
                isSearchExpanded ? 'hidden lg:inline-flex' : 'inline-flex'
              )}
            >
              <BiDotsVerticalRounded />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-64'>
            <DropdownMenuItem className='gap-x-2 cursor-pointer' onClick={handleClickSelectMode}>
              {isSelectMode ? (
                <>
                  <MdOutlineKeyboardReturn className='text-[1.3em]' />
                  <span>Leave Select Mode</span>
                </>
              ) : (
                <>
                  <RiListCheck3 className='text-[1.3em]' />
                  Switch Select Mode
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              className='gap-x-2 cursor-pointer'
              onClick={handleClickReloadButton}
              disabled={isValidating}
            >
              <VscRefresh className={cn('text-[1.3em]', isValidating && 'animate-spin')} />
              <span>Refresh</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>
              <span>Danger Zone!!</span>
            </DropdownMenuLabel>
            <DropdownMenuItem
              className='cursor-pointer'
              onClick={() => handleChangeDeleteAllList(true)}
            >
              <span className='flex items-center gap-x-2 text-warning-foreground hover:text-warning-foreground/90'>
                <MdPlaylistRemove className='text-[1.3em]' />
                Delete All Item ({itemLength})
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className='cursor-pointer'
              onClick={() => handleChangeDeleteAllFile(true)}
            >
              <span className='flex items-center gap-x-2 text-error-foreground hover:text-error-foreground/90'>
                <MdOutlineVideocamOff className='text-[1.3em]' />
                Delete All Item and File ({itemLength})
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isSelectMode && (
        <div className='basis-full flex items-center justify-end flex-wrap gap-1'>
          <Button
            variant='outline'
            size='sm'
            className='text-base'
            onClick={handleClickLeaveSelectMode}
          >
            Cancel
          </Button>
          <Button
            variant='outline'
            size='sm'
            className='text-base text-blue-400 hover:text-blue-400/90'
            onClick={handleClickClearAll}
          >
            Unselect All
          </Button>
          <Button
            variant='outline'
            size='sm'
            className='text-base text-blue-400 hover:text-blue-400/90'
            onClick={handleClickSelectAll}
            disabled={!itemLength}
          >
            Select All ({itemLength})
          </Button>
          <Dialog open={openDeleteFile} onOpenChange={handleChangeDeleteFile}>
            <DialogTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                className='text-lg text-error-foreground hover:text-error-foreground/90'
                disabled={!Boolean(selectedUuids.size)}
              >
                <MdOutlineVideocamOff />
                <span className='text-sm'>({selectedUuids.size})</span>
              </Button>
            </DialogTrigger>
            <DialogContent className='max-h-screen overflow-y-auto'>
              <DialogHeader>
                <DialogTitle>Remove selected videos from storage and list</DialogTitle>
              </DialogHeader>
              <details>
                <summary>View selected videos ({selectedUuids.size})</summary>
                <div className='flex-auto text-sm text-zinc-600 dark:text-zinc-400 overflow-y-auto space-y-1'>
                  {items &&
                    selectedUuids &&
                    [...selectedUuids].map((uuid, i) => {
                      const item = items[uuid];

                      if (!item) return <Fragment key={i} />;

                      return (
                        <div key={i} className='break-all'>
                          {i + 1}. {item?.file?.name || item.title}
                        </div>
                      );
                    })}
                </div>
              </details>
              <DialogFooter className='flex flex-row shrink-0 justify-end space-x-2'>
                <Button variant='outline' size='sm' onClick={handleCloseDeleteFile}>
                  Cancel
                </Button>
                <Button
                  size='sm'
                  className='bg-error hover:bg-error/90 text-foreground'
                  onClick={handleClickDelete('deleteFile')}
                >
                  Remove {selectedUuids.size} videos
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={openDeleteList} onOpenChange={handleChangeDeleteList}>
            <DialogTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                className='text-lg text-warning-foreground hover:text-warning-foreground/90'
                disabled={!Boolean(selectedUuids.size)}
              >
                <TbPlaylistX />
                <span className='text-sm'>({selectedUuids.size})</span>
              </Button>
            </DialogTrigger>
            <DialogContent className='max-h-screen overflow-y-auto'>
              <DialogHeader>
                <DialogTitle>Remove selected videos from list</DialogTitle>
              </DialogHeader>
              <details>
                <summary>View selected videos ({selectedUuids.size})</summary>
                <div className='flex-auto text-sm text-zinc-600 dark:text-zinc-400 overflow-y-auto space-y-1'>
                  {items &&
                    selectedUuids &&
                    [...selectedUuids].map((uuid, i) => {
                      const item = items[uuid];

                      if (!item) return <Fragment key={i} />;

                      return (
                        <div key={i} className='break-all'>
                          {i + 1}. {item?.file?.name || item.title}
                        </div>
                      );
                    })}
                </div>
              </details>
              <DialogFooter className='flex flex-row justify-end space-x-2'>
                <Button variant='outline' size='sm' onClick={handleCloseDeleteList}>
                  Cancel
                </Button>
                <Button
                  size='sm'
                  className='bg-warning hover:bg-warning/90'
                  onClick={handleClickDelete('deleteList')}
                >
                  Remove {selectedUuids.size} videos
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
      <Dialog open={openDeleteAllFile} onOpenChange={handleChangeDeleteAllFile}>
        <DialogContent className='max-h-screen overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Do you want to delete the All video and file?</DialogTitle>
          </DialogHeader>
          <details>
            <summary>View selected videos {itemLength}</summary>
            <div className='flex-auto text-sm text-zinc-600 dark:text-zinc-400 overflow-y-auto space-y-1'>
              {items &&
                orders &&
                orders.map((uuid, i) => {
                  const item = items[uuid];

                  if (!item) return <Fragment key={i} />;

                  return (
                    <div key={i} className='break-all'>
                      {i + 1}. {item?.file?.name || item.title}
                    </div>
                  );
                })}
            </div>
          </details>
          <DialogFooter className='flex flex-row justify-end space-x-2'>
            <Button variant='outline' size='sm' onClick={handleCloseDeleteAllFile}>
              Cancel
            </Button>
            <Button
              size='sm'
              className='bg-error hover:bg-error/90 text-foreground'
              onClick={handleClickDelete('deleteAllFile')}
            >
              Yes, Delete All({itemLength})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={openDeleteAllList} onOpenChange={handleChangeDeleteAllList}>
        <DialogContent className='max-h-screen overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Do you want to delete the All video?</DialogTitle>
          </DialogHeader>
          <details>
            <summary>View selected videos {itemLength}</summary>
            <div className='flex-auto text-sm text-zinc-600 dark:text-zinc-400 overflow-y-auto space-y-1'>
              {items &&
                orders &&
                orders.map((uuid, i) => {
                  const item = items[uuid];

                  if (!item) return <Fragment key={i} />;

                  return (
                    <div key={i} className='break-all'>
                      {i + 1}. {item?.file?.name || item.title}
                    </div>
                  );
                })}
            </div>
          </details>
          <DialogFooter className='flex flex-row justify-end space-x-2'>
            <Button variant='outline' size='sm' onClick={handleCloseDeleteAllList}>
              Cancel
            </Button>
            <Button
              size='sm'
              className='bg-warning hover:bg-warning/90'
              onClick={handleClickDelete('deleteAllList')}
            >
              Yes, Delete All({itemLength})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
