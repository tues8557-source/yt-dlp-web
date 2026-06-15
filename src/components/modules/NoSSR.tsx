'use client';

import { useEffect, useState } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';

export interface NoSSRProps {
  defaultComponent?: ReactNode;
}

export function NoSSR({ defaultComponent, children }: PropsWithChildren<NoSSRProps>) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return defaultComponent ? defaultComponent : null;
  }

  return children;
}
