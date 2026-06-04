import { CacheHelper } from '@/server/helpers/CacheHelper';
import { FFmpegHelper } from '@/server/helpers/FFmpegHelper';
import { VideoInfo } from '@/types/video';
import { spawn } from 'child_process';
import { VIDEO_LIST_FILE } from '@/server/constants';

export type VideoListOrderType = 'title' | 'age' | '';
export type VideoListOrderSort = 'asc' | 'desc';

export type OrderType = {
  type: VideoListOrderType;
  sort: VideoListOrderSort;
};

export type GetVideoList = {
  orders: string[];
  items: Record<string, VideoInfo>;
};

export async function getVideoList(_order?: OrderType): Promise<GetVideoList> {
  return new Promise(async (resolve) => {
    const { type: orderType, sort: orderSort } = (_order || {}) as OrderType;

    const uuids = (await CacheHelper.get<string[]>(VIDEO_LIST_FILE)) || [];

    const orders: GetVideoList['orders'] = [];
    const items: GetVideoList['items'] = {};

    if (!Array.isArray(uuids) || !uuids.length) {
      resolve({
        orders,
        items
      });
      return;
    }

    for await (const uuid of uuids) {
      try {
        let videoInfo = await CacheHelper.get<VideoInfo>(uuid);
        videoInfo = await fillMissingFileMetadata(videoInfo);
        if (videoInfo?.uuid) {
          orders.push(videoInfo.uuid);
          items[videoInfo.uuid] = videoInfo;
        }
      } catch (e) {}
    }

    resolve({
      orders,
      items
    });
  });
}

async function fillMissingFileMetadata(videoInfo?: VideoInfo) {
  if (
    !videoInfo?.uuid ||
    videoInfo.status !== 'completed' ||
    !videoInfo.file?.path ||
    videoInfo.file.duration
  ) {
    return videoInfo;
  }

  try {
    const streams = await new FFmpegHelper({ filePath: videoInfo.file.path }).getVideoStreams();
    if (!streams?.duration) {
      return videoInfo;
    }

    const nextVideoInfo = {
      ...videoInfo,
      file: {
        ...videoInfo.file,
        ...streams
      },
      files: {
        ...videoInfo.files,
        original: {
          ...videoInfo.file,
          ...streams,
          source: 'original' as const
        }
      }
    };
    await CacheHelper.set(videoInfo.uuid, nextVideoInfo);
    return nextVideoInfo;
  } catch (e) {
    return videoInfo;
  }
}

export function getYtDlpVersion(): Promise<string> {
  return new Promise((resolve) => {
    try {
      const ytdlp = spawn('yt-dlp', ['--version'], {
        shell: true
      });

      let stdoutChunks = [] as Array<any>;

      ytdlp.stdout.on('data', (data) => {
        stdoutChunks.push(data);
      });

      ytdlp.on('exit', () => {
        if (stdoutChunks.length) {
          const buffer = Buffer.concat(stdoutChunks);

          const version = buffer.toString().trim();

          resolve(version);
        } else {
          resolve('');
        }
      });
    } catch (e) {
      return resolve('');
    }
  });
}

export function getFfmpegVersion(): Promise<string> {
  return new Promise((resolve) => {
    try {
      const ytdlp = spawn('ffmpeg', ['-version'], {
        shell: true
      });
      let stdoutChunks = [] as Array<any>;

      ytdlp.stdout.on('data', (data) => {
        stdoutChunks.push(data);
      });

      ytdlp.on('exit', () => {
        if (stdoutChunks.length) {
          const buffer = Buffer.concat(stdoutChunks);

          const version = buffer.toString().trim();

          resolve(version);
        } else {
          resolve('');
        }
      });
    } catch (e) {
      return resolve('');
    }
  });
}
