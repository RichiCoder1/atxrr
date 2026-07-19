import { type ClassValue, clsx } from "clsx"
import type { MediaValue } from "emdash"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Size a CMS image to `width`, deriving height from its aspect ratio. Passing
 * width alone makes EmDash's <Image> keep the original height, which returns a
 * genuinely squashed file (600x3000 from a 3000x3000 logo).
 */
export function fitWidth(image: MediaValue | undefined | null, width: number) {
  if (!image?.width || !image?.height) return { width }
  return { width, height: Math.round((width * image.height) / image.width) }
}

/** As {@link fitWidth}, but driven by height — for images clamped by max-h-*. */
export function fitHeight(image: MediaValue | undefined | null, height: number) {
  if (!image?.width || !image?.height) return { height }
  return { width: Math.round((height * image.width) / image.height), height }
}
