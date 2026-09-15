/**
 * One motion vocabulary for the whole app.
 *
 * Every transition should come from here — screens, sheets, progress and
 * presses previously each invented their own spring or duration, which is
 * what makes an interface feel assembled rather than designed.
 */

/** iOS-style ease-out: quick to leave, gentle to settle. */
export const EASE_OUT = [0.32, 0.72, 0, 1] as const;

/** Screen-to-screen and sheet transitions — decisive, no float. */
export const springSnappy = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.8,
} as const;

/** Values settling into place: progress bars, indicators, layout shifts. */
export const springSoft = {
  type: 'spring',
  stiffness: 300,
  damping: 32,
  mass: 0.9,
} as const;

/** Simple fades/tints where a spring would be overkill. */
export const tween = { duration: 0.22, ease: EASE_OUT } as const;

/** Standard enter/exit for a step in the wizard. */
export const screenTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: springSnappy,
} as const;
