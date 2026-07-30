import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns YYYY-MM-DD in user's local timezone.
 * Avoids UTC mismatch bugs where new Date().toISOString().split('T')[0]
 * shifts the date after 21:00 BRT (or UTC 00:00).
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks whether a movement belongs to a target local YYYY-MM-DD date string.
 * Handles both m.date and converting m.timestamp to local YYYY-MM-DD.
 */
export function isSameLocalDate(movDate: string, movTimestamp?: string, targetDateStr?: string): boolean {
  const target = targetDateStr || getLocalDateString();
  if (movDate === target) return true;
  if (movTimestamp) {
    try {
      const d = new Date(movTimestamp);
      if (!isNaN(d.getTime())) {
        return getLocalDateString(d) === target;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

