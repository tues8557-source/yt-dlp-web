import path from 'path';
import { existsSync } from 'fs';

const getStoragePath = (rootPath: string, localFolderName: string) => {
  if (existsSync(rootPath)) {
    return rootPath;
  }

  return path.join(process.cwd(), localFolderName);
};

export const DOWNLOAD_PATH = getStoragePath(path.join('/', 'downloads'), 'downloads');
export const CACHE_PATH = getStoragePath(path.join('/', 'cache'), 'cache');

export const VIDEO_LIST_FILE = 'video-list';
export const USER_PLAYLISTS_FILE = 'user-playlists';
export const COOKIES_FILE = 'cookies';
export const WRITE_TEST_FILE = 'write-test';

export const CACHE_FILE_PREFIX = 'yt-dlp-cache-';
