import { CACHE_PATH, CACHE_FILE_PREFIX } from '@/server/constants';
import { CacheHelper } from '@/server/helpers/CacheHelper';
import { FFmpegHelper } from '@/server/helpers/FFmpegHelper';
import type { VideoInfo } from '@/types/video';
import { promises as fs } from 'fs';
import { isAbsolute, join } from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const getUrlObject = new URL(request.url);
    const searchParams = getUrlObject.searchParams;
    const uuid = searchParams.get('uuid');

    try {
      if (typeof uuid !== 'string') {
        throw 'Param `uuid` is only string type';
      }
    } catch (e) {
      return new Response(e as string, {
        status: 404
      });
    }

    try {
      const data = await CacheHelper.get<VideoInfo>(uuid);
      if (!data) {
        throw 'Not Found';
      }

      const thumbnailPath = await getOrCreateThumbnailPath(uuid, data);

      const file = await fs.open(thumbnailPath, 'r');
      if (!file) {
        throw 'Not Found';
      }

      // File Get
      const videoStream = file.createReadStream();
      videoStream.on('finish', () => {
        try {
          videoStream?.close?.();
        } catch (e) {}
      });

      return new Response(videoStream as any, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable'
        },
        status: 200
      });
    } catch (e) {
      return new Response('Not Found', {
        status: 404
      });
    }
  } catch (error) {
    return new Response(error as string, {
      status: 400
    });
  }
}

async function getOrCreateThumbnailPath(uuid: string, videoInfo: VideoInfo) {
  const localThumbnail = videoInfo.localThumbnail;
  const thumbnailPath = localThumbnail
    ? isAbsolute(localThumbnail)
      ? localThumbnail
      : join(
          CACHE_PATH,
          'thumbnails',
          localThumbnail.startsWith(CACHE_FILE_PREFIX)
            ? localThumbnail
            : CACHE_FILE_PREFIX + localThumbnail
        )
    : join(CACHE_PATH, 'thumbnails', `${CACHE_FILE_PREFIX}${uuid}.png`);

  try {
    await fs.access(thumbnailPath);
    return thumbnailPath;
  } catch (e) {}

  const videoPath = videoInfo.files?.original?.path || videoInfo.file?.path;
  if (!videoPath) {
    throw 'Not Found';
  }

  const extractedThumbnailPath = join(CACHE_PATH, 'thumbnails', `${CACHE_FILE_PREFIX}${uuid}.png`);
  await new FFmpegHelper({ filePath: videoPath, fileUuid: uuid }).extractEmbeddedThumbnail(
    extractedThumbnailPath
  );

  if (videoInfo.localThumbnail !== `${uuid}.png`) {
    videoInfo.localThumbnail = `${uuid}.png`;
    videoInfo.updatedAt = Date.now();
    await CacheHelper.set(uuid, videoInfo);
  }

  return extractedThumbnailPath;
}
