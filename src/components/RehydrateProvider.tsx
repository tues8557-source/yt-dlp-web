'use client';

import { useEffect } from 'react';
import { useVideoPlayerStore } from '@/store/videoPlayer';
import { useDownloadFormStore } from '@/store/downloadForm';
import { registerMediaRangeCacheWorker } from '@/client/mediaRangeCache';

export function RehydrateProvider() {
  useEffect(() => {
    useDownloadFormStore.persist.rehydrate();
    useVideoPlayerStore.persist.rehydrate();
    void registerMediaRangeCacheWorker();
  }, []);

  return null;
}
