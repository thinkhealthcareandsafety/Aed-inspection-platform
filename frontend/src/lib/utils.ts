import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge only knows Tailwind's stock scale, so our custom type scale
 * (`text-headline`, `text-caption`, …) looks to it like a text *colour* —
 * and it would silently drop the real colour class sitting beside it
 * (`text-primary-foreground` on a filled button became black-on-indigo).
 * Registering the scale as font sizes keeps size and colour independent.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: ['caption', 'footnote', 'callout', 'body', 'headline', 'title', 'display', 'display-lg'],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
