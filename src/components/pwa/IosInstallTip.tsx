'use client';

import { currentDevice } from '@/lib/utils/device';

/** iPhone or iPad, opened in the browser instead of from the home screen. */
export function isIosNotInstalled(): boolean {
  const device = currentDevice();
  return device.platform === 'ios' && !device.standalone;
}

export const IOS_INSTALL_TIP =
  'iPhone only sends notifications to apps on your home screen. In Safari, tap Share, then Add to Home Screen. Open Sweep from there and turn on phone notifications in Settings. Needs iOS 16.4 or newer.';
