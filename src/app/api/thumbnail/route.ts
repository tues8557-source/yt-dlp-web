import { CACHE_PATH, CACHE_FILE_PREFIX } from '@/server/constants';
import { CacheHelper } from '@/server/helpers/CacheHelper';
import { FFmpegHelper } from '@/server/helpers/FFmpegHelper';
import type { VideoInfo } from '@/types/video';
import { promises as fs } from 'fs';
import { isAbsolute, join } from 'path';
import { lookup } from 'mime-types';

export const dynamic = 'force-dynamic';
const ALLOWED_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

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
          'Content-Type': lookup(thumbnailPath) || 'image/png',
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

export async function POST(request: Request) {
  try {
    const urlObject = new URL(request.url);
    const uuid = urlObject.searchParams.get('uuid');
    const action = urlObject.searchParams.get('action') || 'upload';

    if (typeof uuid !== 'string' || !uuid) {
      return NextJson({ error: 'Param `uuid` is only string type' }, 404);
    }

    const videoInfo = await CacheHelper.get<VideoInfo>(uuid);
    if (!videoInfo) {
      return NextJson({ error: 'Not Found' }, 404);
    }

    if (action === 'extract') {
      await extractThumbnailFromVideo(uuid, videoInfo, 'local');

      return NextJson({
        success: true,
        localThumbnail: videoInfo.localThumbnail,
        thumbnailSource: videoInfo.thumbnailSource
      });
    }

    if (action === 'remove') {
      await removeLocalThumbnail(videoInfo);
      videoInfo.localThumbnail = null;
      videoInfo.thumbnailSource = undefined;
      videoInfo.updatedAt = Date.now();
      await CacheHelper.set(uuid, videoInfo);

      return NextJson({
        success: true,
        localThumbnail: videoInfo.localThumbnail,
        thumbnailSource: videoInfo.thumbnailSource
      });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextJson({ error: 'Param `file` is required' }, 400);
    }

    if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
      return NextJson({ error: 'Only jpeg, png, webp, and gif images are supported.' }, 400);
    }

    const extension = EXTENSION_BY_CONTENT_TYPE[file.type] || '.png';
    const thumbnailFileName = `${uuid}${extension}`;
    const thumbnailPath = getThumbnailFilePath(thumbnailFileName);

    await fs.mkdir(join(CACHE_PATH, 'thumbnails'), { recursive: true });
    await fs.writeFile(thumbnailPath, Buffer.from(await file.arrayBuffer()));

    videoInfo.localThumbnail = thumbnailFileName;
    videoInfo.thumbnailSource = 'custom';
    videoInfo.updatedAt = Date.now();
    await CacheHelper.set(uuid, videoInfo);

    return NextJson({
      success: true,
      localThumbnail: videoInfo.localThumbnail,
      thumbnailSource: videoInfo.thumbnailSource
    });
  } catch (error) {
    return NextJson({ error }, 400);
  }
}

function NextJson(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function getThumbnailFilePath(localThumbnail: string) {
  return isAbsolute(localThumbnail)
    ? localThumbnail
    : join(
        CACHE_PATH,
        'thumbnails',
        localThumbnail.startsWith(CACHE_FILE_PREFIX)
          ? localThumbnail
          : CACHE_FILE_PREFIX + localThumbnail
      );
}

async function getOrCreateThumbnailPath(uuid: string, videoInfo: VideoInfo) {
  const localThumbnail = videoInfo.localThumbnail;
  const thumbnailPath = localThumbnail
    ? getThumbnailFilePath(localThumbnail)
    : getThumbnailFilePath(`${uuid}.png`);

  try {
    await fs.access(thumbnailPath);
    return thumbnailPath;
  } catch (e) {}

  return extractThumbnailFromVideo(uuid, videoInfo);
}

async function removeLocalThumbnail(videoInfo: VideoInfo) {
  const localThumbnail = videoInfo.localThumbnail;
  if (!localThumbnail) return;

  try {
    await fs.unlink(getThumbnailFilePath(localThumbnail));
  } catch (e) {}
}

async function extractThumbnailFromVideo(
  uuid: string,
  videoInfo: VideoInfo,
  thumbnailSource?: VideoInfo['thumbnailSource']
) {
  const videoPath = videoInfo.files?.original?.path || videoInfo.file?.path;
  if (!videoPath) {
    throw 'Not Found';
  }

  const extractedThumbnailPath = getThumbnailFilePath(`${uuid}.png`);
  await new FFmpegHelper({ filePath: videoPath, fileUuid: uuid }).extractEmbeddedThumbnail(
    extractedThumbnailPath
  );

  videoInfo.localThumbnail = `${uuid}.png`;
  if (thumbnailSource) {
    videoInfo.thumbnailSource = thumbnailSource;
  }
  videoInfo.updatedAt = Date.now();
  await CacheHelper.set(uuid, videoInfo);

  return extractedThumbnailPath;
}
