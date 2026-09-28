'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Renders children at the end of <body> so fixed overlays are never clipped by filtered/masked ancestors. */
export function Portal({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host ? createPortal(children, host) : null;
}
