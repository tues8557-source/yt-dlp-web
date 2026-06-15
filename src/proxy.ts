import { NextResponse } from 'next/server';
import { match } from 'path-to-regexp';

import type { NextRequest } from 'next/server';

import { getSession } from '@/server/actions/auth';

const AUTH_SECRET = process.env.AUTH_SECRET;
const CREDENTIAL_USERNAME = process.env.CREDENTIAL_USERNAME;
const CREDENTIAL_PASSWORD = process.env.CREDENTIAL_PASSWORD;
const API_TOKEN = process.env.API_TOKEN;
const isRequiredAuthentication = Boolean(AUTH_SECRET && CREDENTIAL_USERNAME && CREDENTIAL_PASSWORD);
const apiTokenPaths = new Set(['d']);
const SHARE_SCOPE_COOKIE = 'yt-dlp-watch-scope';

function isValidApiTokenRequest(request: NextRequest, apiPath?: string) {
  if (!API_TOKEN || !apiPath || !apiTokenPaths.has(apiPath)) {
    return false;
  }

  const authorization = request.headers.get('authorization') || '';
  const [scheme, token] = authorization.split(/\s+/);

  return scheme?.toLowerCase() === 'bearer' && token === API_TOKEN;
}

const publicApiPaths = new Set([
  // 'cookies',
  // 'd',
  // 'file',
  // 'files',
  // 'image',
  // 'info',
  // 'list',
  'og',
  // 'playlist',
  // 'r',
  // 'recording',
  'stat',
  // 'subtitles',
  // 'sync-cache',
  // 'thumbnail',
  'v'
]);

function encodeShareScope(uuid: string, itemUuid?: string) {
  return `${encodeURIComponent(uuid)}:${encodeURIComponent(itemUuid || '')}`;
}

function decodeShareScope(value?: string) {
  if (!value) return null;

  const [uuid = '', itemUuid = ''] = value.split(':');

  try {
    const decodedUuid = decodeURIComponent(uuid);
    const decodedItemUuid = decodeURIComponent(itemUuid);

    if (!decodedUuid) return null;

    return {
      uuid: decodedUuid,
      itemUuid: decodedItemUuid
    };
  } catch (e) {
    return null;
  }
}

function getWatchUrl(request: NextRequest, scope: { uuid: string; itemUuid?: string }) {
  const watchUrl = new URL('/watch', request.url);
  watchUrl.searchParams.set('uuid', scope.uuid);
  if (scope.itemUuid) {
    watchUrl.searchParams.set('itemUuid', scope.itemUuid);
  }
  watchUrl.searchParams.set('share', '1');

  return watchUrl;
}

function isPublicAssetPath(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/favicon_') ||
    pathname === '/apple-touch-icon.png' ||
    pathname === '/apple-touch-icon-precomposed.png'
  );
}

function isAllowedScopedApiRequest(request: NextRequest, scope: { uuid: string; itemUuid?: string }) {
  const pathname = request.nextUrl.pathname;
  const uuid = request.nextUrl.searchParams.get('uuid') || '';
  const itemUuid = request.nextUrl.searchParams.get('itemUuid') || '';

  if (pathname === '/api/file') {
    return uuid === scope.uuid && !scope.itemUuid;
  }

  if (pathname === '/api/playlist/file') {
    return uuid === scope.uuid && itemUuid === scope.itemUuid;
  }

  return pathname === '/api/og' || pathname.startsWith('/api/v/');
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/watch' && request.nextUrl.searchParams.get('share') === '1') {
    const uuid = request.nextUrl.searchParams.get('uuid') || '';
    const itemUuid = request.nextUrl.searchParams.get('itemUuid') || '';
    const response = NextResponse.next();

    if (uuid) {
      response.cookies.set(SHARE_SCOPE_COOKIE, encodeShareScope(uuid, itemUuid), {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24
      });
    }

    return response;
  }

  const shareScope = decodeShareScope(request.cookies.get(SHARE_SCOPE_COOKIE)?.value);
  if (shareScope && !isPublicAssetPath(request.nextUrl.pathname)) {
    if (request.nextUrl.pathname === '/watch') {
      const uuid = request.nextUrl.searchParams.get('uuid') || '';
      const itemUuid = request.nextUrl.searchParams.get('itemUuid') || '';

      if (uuid === shareScope.uuid && itemUuid === shareScope.itemUuid) {
        return NextResponse.next();
      }

      return NextResponse.redirect(getWatchUrl(request, shareScope));
    }

    if (request.nextUrl.pathname.startsWith('/api')) {
      return isAllowedScopedApiRequest(request, shareScope)
        ? NextResponse.next()
        : NextResponse.json({ code: 403, error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.redirect(getWatchUrl(request, shareScope));
  }

  if (isRequiredAuthentication) {
    if (request.nextUrl.pathname === '/') {
      if (await getSession()) {
        return NextResponse.next();
      }
      let callback = '';
      try {
        callback = encodeURIComponent(`${request.nextUrl.pathname}${request.nextUrl.search}`);
      } catch (e) {}

      return NextResponse.redirect(
        new URL(`/signin${callback ? `?callback=${callback}` : ''}`, request.url)
      );
    } else if (request.nextUrl.pathname === '/signin') {
      return (await getSession())
        ? NextResponse.redirect(new URL('/', request.url))
        : NextResponse.next();
    }

    if (request.nextUrl.pathname.startsWith('/api')) {
      const fn = match('/api/*paths')(request.nextUrl.pathname);

      if (!fn) {
        return NextResponse.next();
      }

      const apiPath = Array.isArray(fn.params.paths) ? fn.params.paths?.[0] : undefined;

      if (apiPath && !publicApiPaths.has(apiPath)) {
        if ((await getSession()) || isValidApiTokenRequest(request, apiPath)) {
          return NextResponse.next();
        }

        return NextResponse.json({ code: 403, error: 'Forbidden' }, { status: 403 });
      }
    }
  }
  return NextResponse.next();
}
