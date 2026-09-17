/**
 * Line drawings of the three supported defibrillators.
 *
 * Drawn rather than photographed on purpose: the only whole-device photos in
 * the repo are rear views carrying red annotation boxes (they belong in the
 * reference dialog, where the box is the point), and manufacturer product
 * shots aren't ours to ship. A distinct silhouette per model does the real
 * job anyway — telling someone holding a bright green clamshell that they are
 * not looking at either of the blue Philips units.
 */

interface Props {
  model: string;
  className?: string;
}

export function AedGlyph({ model, className }: Props) {
  const common = {
    viewBox: '0 0 40 40',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };

  // Philips HeartStart FRx — landscape body, carry slot on the top edge,
  // moulded grip panel down the right.
  if (model === 'Philips FRx') {
    return (
      <svg {...common}>
        <rect x="4" y="11" width="32" height="19" rx="3.5" />
        <path d="M15 11V9.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 25 9.5V11" />
        <path d="M28 11v19" />
        <circle cx="32" cy="20.5" r="1.6" />
      </svg>
    );
  }

  // Philips HeartStart HS1 — deeper, more upright body with the fabric carry
  // strap looping off the right-hand side.
  if (model === 'Philips HS1') {
    return (
      <svg {...common}>
        <rect x="7" y="7" width="20" height="26" rx="3.5" />
        <path d="M27 13c4 1.2 5.5 3.6 5.5 7s-1.5 5.8-5.5 7" />
        <path d="M11.5 12.5h8" />
        <path d="M11.5 16.5h5" />
      </svg>
    );
  }

  // Zoll AED Plus — wide clamshell with the handle cut straight into the top.
  return (
    <svg {...common}>
      <path d="M6 17c0-3 1.5-4.5 4.5-5L15 11h10l4.5 1c3 .5 4.5 2 4.5 5v12.5c0 2-1.2 3.5-3.5 3.5h-21C7.2 33 6 31.5 6 29.5Z" />
      <path d="M15 11.2c1-2.4 2.6-3.2 5-3.2s4 .8 5 3.2" />
      <path d="M13 24h14" />
    </svg>
  );
}
