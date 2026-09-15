/**
 * Hand-drawn icon set for the AED checklist and brand mark — replaces the
 * emoji glyphs previously used per checklist item (🏷️⚡🔋🔌🟢🔑🗄️🩹📞),
 * which read as unpolished for a safety-inspection tool. Stroke-based,
 * consistent 24px grid, matching the rest of the lucide-react icons already
 * used throughout the app.
 */
import type { SVGProps } from 'react';

export type IconName =
  | 'tag'
  | 'bolt'
  | 'battery'
  | 'plug'
  | 'pulse-dot'
  | 'key'
  | 'archive'
  | 'kit'
  | 'contact';

function base(props: SVGProps<SVGSVGElement>) {
  return {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}

export function TagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12.6 3.6a2 2 0 0 0-1.42-.6H5a2 2 0 0 0-2 2v6.17a2 2 0 0 0 .6 1.42l8.83 8.83a2 2 0 0 0 2.82 0l7.18-7.18a2 2 0 0 0 0-2.82Z" />
      <circle cx="8" cy="8" r="1.4" />
    </svg>
  );
}

export function BoltIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M13.5 2 4 13h6.5L10 22l9.5-11H13z" />
    </svg>
  );
}

export function BatteryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="7" width="16" height="10" rx="2" />
      <path d="M22 10v4" />
    </svg>
  );
}

export function PlugIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M9 3v5M15 3v5" />
      <path d="M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0z" />
      <path d="M12 15.5V21" />
    </svg>
  );
}

export function PulseDotIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="9" strokeDasharray="2.2 2.6" />
    </svg>
  );
}

export function KeyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.8 12.2 20 3M16 7l3 3M13 10l2.5 2.5" />
    </svg>
  );
}

export function ArchiveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="2" width="16" height="20" rx="2.5" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

export function KitIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="6.5" width="19" height="14" rx="2.5" />
      <path d="M8 6.5V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5" />
      <path d="M12 11v5M9.5 13.5h5" />
    </svg>
  );
}

export function ContactIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 7 10-7" />
    </svg>
  );
}

const REGISTRY: Record<IconName, (props: SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  tag: TagIcon,
  bolt: BoltIcon,
  battery: BatteryIcon,
  plug: PlugIcon,
  'pulse-dot': PulseDotIcon,
  key: KeyIcon,
  archive: ArchiveIcon,
  kit: KitIcon,
  contact: ContactIcon,
};

export function ChecklistIcon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const Cmp = REGISTRY[name];
  return <Cmp {...props} />;
}

/** Brand mark — a stylised pulse/ECG line, used in place of a generic heart glyph. */
export function PulseLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base({ strokeWidth: 2, ...props })}>
      <path d="M2 13h4.5l1.8-5 3.6 11 2.7-11 1.6 5H22" />
    </svg>
  );
}
