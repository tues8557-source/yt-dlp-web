import { NextResponse } from 'next/server';
import { UserPlaylistHelper } from '@/server/helpers/UserPlaylistHelper';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await UserPlaylistHelper.getAll());
  } catch (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json(
      await UserPlaylistHelper.create(String(body.name || ''), String(body.uuid || ''))
    );
  } catch (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const uuid = String(body.uuid || '');
    const playlistIds = Array.isArray(body.playlistIds) ? body.playlistIds.map(String) : [];
    return NextResponse.json(await UserPlaylistHelper.setItemPlaylists(uuid, playlistIds));
  } catch (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const urlObject = new URL(request.url);
    const playlistId = String(urlObject.searchParams.get('id') || '');
    return NextResponse.json(await UserPlaylistHelper.delete(playlistId));
  } catch (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
}
