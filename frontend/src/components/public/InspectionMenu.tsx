'use client';

import { useEffect, useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { ArrowLeft, ChevronRight, Repeat, RotateCcw, Smartphone, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MenuView = 'menu' | 'phone';

interface Props {
  view: MenuView;
  onViewChange: (view: MenuView) => void;
  onClose: () => void;
  modelName: string;
  /** Required checks already done — what switching would throw away. */
  doneCount: number;
  onSwitchModel: () => void;
  onStartOver: () => void;
  /** A link that reopens this inspection, for the phone hand-off. Null
   *  where a phone hand-off makes no sense (already on a phone). */
  handoffUrl: string | null;
}

/**
 * The way out of an inspection that has started. There wasn't one: someone
 * who tapped the wrong model could only finish six checks on a device they
 * weren't holding, and someone on a laptop — where "Take the photo" opens a
 * file browser — had no route to their phone's camera.
 *
 * Loaded on first open; the dialog machinery isn't worth its weight on the
 * page for a menu most people never touch.
 */
export default function InspectionMenu({
  view,
  onViewChange,
  onClose,
  modelName,
  doneCount,
  onSwitchModel,
  onStartOver,
  handoffUrl,
}: Props) {
  return (
    <RadixDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm fade-in" />
        <RadixDialog.Content
          className={cn(
            'sheet-up fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-3xl bg-card shadow-2xl focus:outline-none',
            'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-border" aria-hidden />
          {view === 'menu' ? (
            <MenuView
              modelName={modelName}
              doneCount={doneCount}
              handoffUrl={handoffUrl}
              onPhone={() => onViewChange('phone')}
              onSwitchModel={onSwitchModel}
              onStartOver={onStartOver}
            />
          ) : (
            <PhoneView url={handoffUrl ?? ''} onBack={() => onViewChange('menu')} />
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

function Row({
  icon: Icon,
  title,
  detail,
  tone = 'default',
  onClick,
}: {
  icon: typeof Repeat;
  title: string;
  detail: string;
  tone?: 'default' | 'danger';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="surface-row flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-secondary/50"
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          tone === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-foreground/75',
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-callout font-semibold', tone === 'danger' ? 'text-destructive' : 'text-foreground')}>
          {title}
        </span>
        <span className="mt-0.5 block text-footnote text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" strokeWidth={2} />
    </button>
  );
}

function MenuView({
  modelName,
  doneCount,
  handoffUrl,
  onPhone,
  onSwitchModel,
  onStartOver,
}: {
  modelName: string;
  doneCount: number;
  handoffUrl: string | null;
  onPhone: () => void;
  onSwitchModel: () => void;
  onStartOver: () => void;
}) {
  const lost =
    doneCount > 0
      ? ` The ${doneCount === 1 ? 'check' : `${doneCount} checks`} done on this ${modelName} won’t be kept.`
      : '';
  return (
    <div className="px-4 pt-3">
      <div className="flex items-center justify-between px-1">
        <RadixDialog.Title className="text-headline text-foreground">Inspection options</RadixDialog.Title>
        <RadixDialog.Close
          aria-label="Close"
          className="-mr-1 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </RadixDialog.Close>
      </div>
      <RadixDialog.Description className="sr-only">
        Switch to another AED model, continue on your phone, or start over.
      </RadixDialog.Description>

      <div className="surface-group mt-2">
        {handoffUrl && (
          <Row
            icon={Smartphone}
            title="Continue on your phone"
            detail="Scan a code to carry on with your phone’s camera. Nothing is lost."
            onClick={onPhone}
          />
        )}
        <Row
          icon={Repeat}
          title="Switch AED model"
          detail={`Picked the wrong one? Start on another model with your details filled in.${lost}`}
          onClick={onSwitchModel}
        />
        <Row
          icon={RotateCcw}
          title="Start over"
          detail="Clear your details and begin again."
          tone="danger"
          onClick={onStartOver}
        />
      </div>

      <RadixDialog.Close className="pressable mt-3 h-12 w-full rounded-2xl bg-secondary text-callout font-semibold text-foreground transition-colors hover:bg-secondary/75">
        Keep inspecting
      </RadixDialog.Close>
    </div>
  );
}

/** The hand-off: a code the phone's camera opens straight into this inspection. */
function PhoneView({ url, onBack }: { url: string; onBack: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('qrcode')
      .then((QR) =>
        QR.toDataURL(url, {
          margin: 1,
          width: 480,
          errorCorrectionLevel: 'M',
          color: { dark: '#11131aff', light: '#ffffffff' },
        }),
      )
      .then((data) => !cancelled && setQr(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="px-5 pt-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to options"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <RadixDialog.Title className="text-headline text-foreground">Continue on your phone</RadixDialog.Title>
      </div>
      <RadixDialog.Description className="mt-1 text-footnote text-muted-foreground">
        Point your phone’s camera at the code. This inspection opens where you left off, with the camera ready.
      </RadixDialog.Description>

      <div className="mx-auto mt-4 flex aspect-square w-56 items-center justify-center rounded-2xl bg-white p-3 ring-1 ring-black/5">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR code that opens this inspection on a phone" className="h-full w-full" />
        ) : failed ? (
          <p className="text-center text-footnote text-muted-foreground">Couldn’t draw the code. Use the link below.</p>
        ) : (
          <span className="h-full w-full animate-pulse rounded-xl bg-secondary" />
        )}
      </div>

      <p className="mt-4 break-all text-center font-mono text-caption text-muted-foreground">{url}</p>

      <RadixDialog.Close className="pressable mt-4 h-12 w-full rounded-2xl bg-secondary text-callout font-semibold text-foreground transition-colors hover:bg-secondary/75">
        Done
      </RadixDialog.Close>
    </div>
  );
}
