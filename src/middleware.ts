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

export async function middleware(request: NextRequest) {
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
      const apiPath = Array.isArray(fn?.params?.paths) ? fn.params.paths?.[0] : undefined;

      if (fn && apiPath && !publicApiPaths.has(apiPath)) {
        if ((await getSession()) || isValidApiTokenRequest(request, apiPath)) {
          return NextResponse.next();
        }

        return NextResponse.json({ code: 403, error: 'Forbidden' }, { status: 403 });
      }
    }
  }
  return NextResponse.next();
}
