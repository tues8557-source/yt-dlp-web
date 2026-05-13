import { spawn } from 'child_process';
import { parse } from 'path';
import type { FFmpegStreamsJson, Streams } from '@/types/video';

export class FFmpegHelper {
  public readonly filePath;
  public readonly fileUuid;

  constructor(params: { filePath: string; fileUuid?: string }) {
    this.filePath = params.filePath;
    this.fileUuid = params.fileUuid;
  }

  async getVideoStreams() {
    if (!this.filePath) {
      return;
    }

    const ffprobe = spawn('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=width,height,color_primaries,r_frame_rate,codec_name,codec_type,duration:format=format_name',
      '-of',
      'json',
      this.filePath
    ]);

    let stdoutChunks = '';

    ffprobe.stdout.setEncoding('utf-8');
    ffprobe.stdout.on('data', (data) => {
      const text = data?.trim?.();
      if (text) stdoutChunks += text;
    });

    return new Promise((resolve: (streams: Streams) => void, reject: (message: string) => void) => {
      ffprobe.stderr.setEncoding('utf-8');
      ffprobe.stderr.on('data', (data) => {
        return reject(data?.trim?.() || '');
      });
      ffprobe.on('exit', () => {
        try {
          if (!stdoutChunks) {
            throw 'streams not found';
          }
          const json = JSON.parse(stdoutChunks) as FFmpegStreamsJson;
          const streams = json?.streams?.find((stream) => stream.codec_type === 'video');
          const audioStream = json?.streams?.find((stream) => stream.codec_type === 'audio');

          if (!streams) {
            throw 'streams not found';
          }

          const [total, duration] = streams?.r_frame_rate?.split?.('/') || [];
          resolve({
            codecName: streams.codec_name,
            audioCodecName: audioStream?.codec_name,
            containerName: json.format?.format_name,
            width: streams.width,
            height: streams.height,
            colorPrimaries: streams.color_primaries,
            rFrameRate:
              total && duration ? Number(total) / Number(duration) || undefined : undefined,
            duration: streams.duration
          });
        } catch (e) {
          reject('streams not found');
        }
      });
    });
  }

  async transcodeForSafari(outputPath?: string) {
    const parsedPath = parse(this.filePath);
    const nextOutputPath = outputPath || `${parsedPath.dir}/${parsedPath.name} [Safari].mp4`;

    return new Promise((resolve: (filePath: string) => void, reject: (message: string) => void) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-loglevel',
        'repeat+info',
        '-i',
        this.filePath,
        '-map',
        '0:v:0',
        '-map',
        '0:a?',
        '-dn',
        '-ignore_unknown',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '20',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        '-movflags',
        '+faststart',
        nextOutputPath
      ]);

      let stderr = '';
      ffmpeg.stderr.setEncoding('utf-8');
      ffmpeg.stderr.on('data', (data) => {
        stderr += data?.trim?.() || '';
      });
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(nextOutputPath);
          return;
        }
        reject(stderr || 'Failed to transcode video for Safari');
      });
    });
  }

  async repair() {
    return new Promise((resolve) => {
      // const repairShellScriptFile = join(__dirname, 'src', 'server', 'ffmpeg-repair.sh');

      const ffmpeg = spawn(
        'ffmpeg',
        // [`${repairShellScriptFile}`]
        [
          '-y',
          '-loglevel',
          'repeat+info',
          '-i',
          `'file:${this.filePath}'`,
          '-map',
          '0',
          '-dn',
          '-ignore_unknown',
          '-c',
          'copy',
          '-f',
          'mp4',
          '-bsf:a',
          'aac_adtstoasc',
          '-movflags',
          '+faststart',
          `'file:${this.filePath}.temp'`,
          '&&',
          'rm',
          `'${this.filePath}'`,
          '&&',
          'mv',
          `'${this.filePath}.temp'`,
          `'${this.filePath}'`
        ],
        {
          shell: true
        }
      );

      ffmpeg.on('close', () => {
        resolve(undefined);
      });

      const interval = setInterval(() => {
        if (!ffmpeg.connected) {
          clearInterval(interval);
          resolve(undefined);
        }
      }, 30 * 1000);
    });
  }
}
