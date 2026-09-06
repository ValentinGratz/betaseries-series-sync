import type { Platform } from "../utils/types";

export function detectPlatform(hostname: string = location.hostname): Platform | null {
  if (/(^|\.)tf1\.fr$/.test(hostname)) return "tf1plus";
  if (/(^|\.)m6\.fr$/.test(hostname) || /(^|\.)6play\.fr$/.test(hostname)) return "m6plus";
  if (/(^|\.)france\.tv$/.test(hostname)) return "francetv";
  return null;
}
