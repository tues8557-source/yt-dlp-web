# yt-dlp-web

Self-hosted [yt-dlp](https://github.com/yt-dlp/yt-dlp) with a web UI for downloading, browsing, streaming, and managing videos on a remote server.

This fork publishes Docker images to GitHub Container Registry:

```text
ghcr.io/tues8557-source/yt-dlp-web:latest
```

## Preview

| Mobile | Desktop |
| --- | --- |
| ![Mobile preview](public/preview-mobile.svg) | ![Desktop preview](public/preview-desktop.svg) |

## Features

- Download videos, audio, playlists, and livestreams through a web UI.
- Browse downloaded items in responsive gallery, list, audio, and playlist-focused views.
- Organize downloaded files into custom playlists from the gallery.
- Embed thumbnail, chapter markers, and metadata by default.
- Store local thumbnails in `/cache/thumbnails` and use embedded video thumbnails as a fallback.
- Use a mobile-friendly player with tap controls, double-tap 10-second seeking, swipe gestures, and automatic landscape fullscreen for videos.
- Reuse partially streamed media ranges through the browser cache when supported.
- Set output filename templates with yt-dlp variables.

## Quick Start

Create a `docker-compose.yml` file:

```yaml
services:
  yt-dlp-web:
    image: ghcr.io/tues8557-source/yt-dlp-web:latest
    pull_policy: always
    container_name: yt-dlp
    user: 1026:100 # User Id, Group Id Setting
    environment:
    #   If you need to protect the site, set AUTH_SECRET, CREDENTIAL_USERNAME, CREDENTIAL_PASSWORD.
    #   ex)
       AUTH_SECRET: "use random API Key generator"
       CREDENTIAL_USERNAME: "your id"
       CREDENTIAL_PASSWORD: "your password"
       API_TOKEN: "use random API Key generator"
    volumes:
      - /volume1/docker/yt/downloads:/downloads # Downloads folder, this is example (downloaded media files)
      - /volume1/docker/yt/cache:/cache         # Cache folder, this is example (app cache, download list, cookies, local thumbnails)
    ports:
      - 3000:3000 # Web Page Port Mapping
    restart: unless-stopped
```

Start it:

```bash
docker compose up -d
```

Open:

```text
http://localhost:3000
```

The container needs write access to both mounted folders:

- `/downloads`: downloaded media files
- `/cache`: app cache, download list, cookies, local thumbnails

## Using The Web UI

### Downloading

1. Paste a supported media URL into the input at the top of the page.
2. Choose whether to download immediately, search first, or adjust options such as quality, output filename, subtitles, cookies, proxy, livestream handling, or cutting.
3. Click **Download**. Active downloads appear in the gallery with progress, speed, and status.

For audio-only downloads, set the quality selector to **Audio**. For exact format control, search first and choose the video/audio formats shown in the result.

### Gallery And Playlists

Downloaded items are shown in the gallery after they complete. Use the view buttons to switch between all files, videos, audio files, and playlists.

Each completed item can be played, downloaded, shared, edited, deleted, added to a custom playlist, or saved for offline playback. Playlist downloads can be opened to browse and play individual playlist items.

Custom playlists are stored by the app in `/cache`. They do not move the underlying media files; they only organize existing downloaded items.

### Browser Player

The player supports video, audio, playlist items, and multiple downloaded variants from the same source.

Controls:

| Action | Result |
| --- | --- |
| Single tap/click | Show controls, then play/pause if controls are already visible |
| Double tap left/right | Seek backward/forward 10 seconds |
| Swipe up on the player surface | Enter fullscreen when supported |
| Swipe down on the player surface | Close the player |
| Swipe from the left edge | Close the player |
| Rotate a phone to landscape while playing video | Attempt fullscreen automatically |

On portrait phones, the media surface stays visible while the lower playlist/file list scrolls. On landscape phones, audio playback uses a side-by-side layout with the thumbnail on the left and the playlist or file list on the right.

The player also supports:

- Previous/next playback for playlists and gallery queues.
- Repeat one or repeat playlist/queue.
- Share links to the player, source URL, or downloadable file.
- Capturing the current video frame as a local thumbnail.
- Opening alternate downloaded variants from the info menu.

### Offline Playback And Cache

Completed videos, audio files, and playlist items can be saved for offline playback from the gallery or playlist item menu. Offline copies are stored in the browser's IndexedDB for the current browser profile and device.

When an offline copy exists, playback uses the browser-stored file even if the server-side file is unavailable. Removing an offline copy only deletes the browser copy; it does not delete the server file.

The player can also cache streamed byte ranges through a service worker. This partial cache is separate from the full offline copy:

- **Cached** means the browser has reused one or more streamed ranges.
- **Offline** means the full file was saved to browser storage.

Offline playback and range caching require browser support for IndexedDB, Cache Storage, and service workers. Some private browsing modes or locked-down mobile browsers may limit these features.

## Authentication

Authentication is disabled unless all three credential variables are set.

```yaml
environment:
  AUTH_SECRET: "Random_string_40_or_more_characters_recommended"
  CREDENTIAL_USERNAME: "username"
  CREDENTIAL_PASSWORD: "password"
```

When authentication is enabled, the web UI requires sign-in.

## Automation Download API

Set `API_TOKEN` to let trusted tools start downloads without opening the browser UI. This token currently applies to `/api/d`.

```yaml
environment:
  AUTH_SECRET: "Random_string_40_or_more_characters_recommended"
  CREDENTIAL_USERNAME: "username"
  CREDENTIAL_PASSWORD: "password"
  API_TOKEN: "Random_string_for_automation_download_api"
```

Example:

```bash
curl \
  -H "Authorization: Bearer $API_TOKEN" \
  "https://your-domain.example/api/d?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DVIDEO_ID"
```

For direct API downloads, these options default to enabled:

- `embedThumbnail=true`
- `embedChapters=true`
- `embedMetadata=true`

You can explicitly disable them:

```text
/api/d?url=...&embedThumbnail=false&embedChapters=false&embedMetadata=false
```

Useful query parameters:

| Parameter | Example | Description |
| --- | --- | --- |
| `url` | `https://www.youtube.com/watch?v=...` | Required media URL |
| `selectQuality` | `best`, `1080p`, `audio` | Quality preset when explicit formats are not selected |
| `outputFilename` | `%(title)s (%(id)s).%(ext)s` | yt-dlp output filename template |
| `embedSubs` | `true` | Embed subtitles |
| `subLangs` | `en,ko` | Subtitle languages |
| `usingCookies` | `true` | Use the server-side cookies file |
| `enableProxy` | `true` | Enable proxy |
| `proxyAddress` | `http://host:port` | Proxy address |
| `enableLiveFromStart` | `true` | Download livestreams from the start |
| `cutVideo` | `true` | Download a section only |
| `cutStartTime` | `00:01:00` | Section start |
| `cutEndTime` | `00:02:00` | Section end |

`outputFilename` must not end with `.desktop`, `.url`, or `.webloc`; yt-dlp 2026.06.09 blocks those dangerous output file types unless using its write-link feature.

## iOS Shortcut

You can use an iOS Shortcut to send shared URLs directly to the automation API without opening the web UI. Configure the shortcut with your deployed domain and, if authentication is enabled, your `API_TOKEN`.

Existing shortcut link:

```text
https://www.icloud.com/shortcuts/8b038411c518474bbfe566f9fbe1e046
```

## Updating yt-dlp

The container downloads a fresh yt-dlp binary at startup. You can override the download URL:

```yaml
environment:
  YT_DLP_DOWNLOAD_URL: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
```

You can also update manually inside a running container:

```bash
docker exec -u 0 -it yt-dlp-web /tmp/yt-dlp-bin/yt-dlp --update-to nightly
docker exec -u 0 -it yt-dlp-web /tmp/yt-dlp-bin/yt-dlp --update-to stable@2024.08.06
```

## Development

Use Node.js 22 or newer. yt-dlp 2026.06.09 raised the minimum supported Node runtime to v22.

Install dependencies and run the Next.js dev server:

```bash
npm install
npm run dev
```

Build and lint:

```bash
npm run build
npm run lint
```

The app expects `/downloads` and `/cache` paths at runtime. Docker is the recommended development target when testing real downloads.

For local development without Docker, set `DOWNLOAD_PATH` and `CACHE_PATH` to writable folders before running the app.

## Stack

- yt-dlp
- ffmpeg
- Node.js 22+
- Next.js 16
- React 19
- TypeScript
- shadcn/ui
- Docker

## Notes

This project is a fork of `sooros5132/yt-dlp-web`. This README documents this fork's current Docker image, authentication/API behavior, local thumbnail handling, gallery/player workflow, offline playback, and mobile playback behavior.
