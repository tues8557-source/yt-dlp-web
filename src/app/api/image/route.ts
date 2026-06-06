export async function GET(request: Request) {
  try {
    const getUrlObject = new URL(request.url);
    const searchParams = getUrlObject.searchParams;
    const url = searchParams.get('url');
    if (typeof url !== 'string') {
      throw 'Param `url` is only string type';
    }

    const image = await fetch(url);

    if (!image.ok) {
      throw 'not found';
    }

    const contentType = image.headers.get('Content-Type');
    const contentLength = image.headers.get('Content-Length');

    const headers: HeadersInit = {
      'Content-Type': contentType || 'image/png',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
    };

    if (contentLength) {
      headers['Content-Length'] = contentLength;
    }

    return new Response(image.body, {
      headers,
      status: 200
    });
  } catch (error) {
    return new Response(error as string, {
      status: 400
    });
  }
}
