// Which device and browser Sweep is running in, and what that means for
// installing the app and getting reminders. Pure, so it can be tested.

export type Platform = 'android' | 'ios' | 'windows' | 'mac' | 'other';
export type Browser = 'chrome' | 'edge' | 'samsung' | 'firefox' | 'safari' | 'other';
export type InAppBrowser = 'instagram' | 'facebook' | 'whatsapp' | null;

export interface DeviceInfo {
  platform: Platform;
  browser: Browser;
  /** Opened as the installed app (home screen, dock, app window) */
  standalone: boolean;
  inApp: InAppBrowser;
}

export function detectDevice(
  ua: string,
  env: { standalone?: boolean; navPlatform?: string; maxTouchPoints?: number } = {}
): DeviceInfo {
  // iPadOS reports itself as a Mac; touch gives it away
  const ipad = env.navPlatform === 'MacIntel' && (env.maxTouchPoints || 0) > 1;
  const platform: Platform = /iPhone|iPad|iPod/.test(ua) || ipad
    ? 'ios'
    : /Android/.test(ua)
    ? 'android'
    : /Windows/.test(ua)
    ? 'windows'
    : /Macintosh|Mac OS X/.test(ua)
    ? 'mac'
    : 'other';

  const browser: Browser = /Edg(e|A|iOS)?\//.test(ua)
    ? 'edge'
    : /SamsungBrowser\//.test(ua)
    ? 'samsung'
    : /Firefox\/|FxiOS\//.test(ua)
    ? 'firefox'
    : /Chrome\/|CriOS\//.test(ua)
    ? 'chrome'
    : /Safari\//.test(ua)
    ? 'safari'
    : 'other';

  const inApp: InAppBrowser = /Instagram/.test(ua)
    ? 'instagram'
    : /FBAN|FBAV|FB_IAB|FBIOS/.test(ua)
    ? 'facebook'
    : /WhatsApp/.test(ua)
    ? 'whatsapp'
    : null;

  return { platform, browser, standalone: Boolean(env.standalone), inApp };
}

/** The current browser, read once on the client. */
export function currentDevice(): DeviceInfo {
  if (typeof window === 'undefined') return { platform: 'other', browser: 'other', standalone: false, inApp: null };
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  return detectDevice(navigator.userAgent, {
    standalone,
    navPlatform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

// ---------------------------------------------------------------------------
// Install card
// ---------------------------------------------------------------------------

export const INSTALL_SNOOZE_KEY = 'sweep_install_card_snoozed_until';
export const INSTALL_SNOOZE_DAYS = 14;

/**
 * prompt: one-tap Install (browser offered beforeinstallprompt)
 * ios / mac-safari: written steps
 * in-app: open in a real browser first
 */
export type InstallCardMode = 'prompt' | 'ios' | 'mac-safari' | 'in-app' | null;

export function installCardMode(
  device: DeviceInfo,
  state: { canPrompt: boolean; snoozedUntil: number | null; now: number; hasSubscriptions: boolean; modalOpen: boolean }
): InstallCardMode {
  if (device.standalone) return null;
  if (!state.hasSubscriptions || state.modalOpen) return null;
  if (state.snoozedUntil && state.snoozedUntil > state.now) return null;
  if (device.inApp) return 'in-app';
  if (device.platform === 'ios') return 'ios';
  if (device.platform === 'mac' && device.browser === 'safari') return 'mac-safari';
  if (state.canPrompt) return 'prompt';
  return null;
}

// ---------------------------------------------------------------------------
// "Make sure reminders arrive" guide
// ---------------------------------------------------------------------------

export interface ReminderGuide {
  heading: string;
  steps: string[];
  /** Installing would help: running in a browser tab */
  suggestInstall: boolean;
}

export function reminderGuide(device: DeviceInfo): ReminderGuide {
  const tab = !device.standalone;

  switch (device.platform) {
    case 'android':
      return {
        heading: 'On your Android phone',
        suggestInstall: tab,
        steps: [
          ...(tab ? ['Install Sweep so reminders come from Sweep, not your browser.'] : []),
          'Allow notifications: long-press the Sweep icon › App info › Notifications › on.',
          'Battery: App info › Battery › Unrestricted (or "No restrictions").',
          'On Xiaomi, Redmi, POCO, Oppo, Vivo, Realme or OnePlus, also turn on Autostart for Sweep (App info › Autostart).',
          'Do Not Disturb hides reminders while it is on.',
        ],
      };
    case 'ios':
      return {
        heading: 'On your iPhone or iPad',
        suggestInstall: tab,
        steps: [
          ...(tab ? ['Add Sweep to your Home Screen first: Share › Add to Home Screen, then open it from there.'] : []),
          'Settings › Notifications › Sweep › Allow Notifications on.',
          'Turn on Lock Screen, and set Banner Style to Persistent.',
          'A Focus mode (Sleep, Work, Do Not Disturb) hides reminders while it is on.',
        ],
      };
    case 'windows': {
      const edge = device.browser === 'edge';
      return {
        heading: 'On your Windows PC',
        suggestInstall: tab,
        steps: [
          edge
            ? 'Keep Edge running in the background: Edge › Settings › System and performance › "Continue running background extensions and apps when Microsoft Edge is closed" on.'
            : 'Keep Chrome running in the background: Chrome › Settings › System › "Continue running background apps when Google Chrome is closed" on.',
          `Start › Settings › System › Notifications › allow ${edge ? 'Microsoft Edge' : 'Google Chrome'}${tab ? '' : ' and Sweep'}.`,
          'Do not disturb hides reminders while it is on.',
        ],
      };
    }
    case 'mac': {
      const safari = device.browser === 'safari';
      return {
        heading: 'On your Mac',
        suggestInstall: tab,
        steps: safari
          ? [
              ...(tab ? ['Add Sweep to your Dock: File › Add to Dock, then open it from the Dock.'] : []),
              'System Settings › Notifications › Sweep › Alert Style Persistent, and Show in Notification Centre on.',
              'In System Settings › Notifications, set "When mirroring or sharing the display" to on, or reminders hide during calls and screen sharing.',
              'A Focus mode hides reminders while it is on.',
            ]
          : [
              `Reminders only arrive while ${device.browser === 'edge' ? 'Edge' : 'Chrome'} is running, so keep it open (closing the window is fine; quitting is not).`,
              `System Settings › Notifications › ${device.browser === 'edge' ? 'Microsoft Edge' : 'Google Chrome'} › Alert Style Persistent.`,
              'A Focus mode hides reminders while it is on.',
            ],
      };
    }
    default:
      return {
        heading: 'On this device',
        suggestInstall: tab,
        steps: [
          'Allow notifications for this site in your browser settings.',
          'Keep the browser running in the background, or reminders wait until you open it.',
        ],
      };
  }
}
