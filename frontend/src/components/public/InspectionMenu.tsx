'use client';

import { useEffect, useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { ArrowLeft, ChevronRight, Languages, Repeat, RotateCcw, Smartphone, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { track } from '@/lib/track';
import { useI18n, type Lang } from '@/i18n';
import { useBackToClose } from '@/lib/use-back-to-close';

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
  useBackToClose(onClose);
  return (
    <RadixDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <RadixDialog.Portal>
        {/* A sheet from the bottom edge on a phone, under the thumb; a dialog
            in the middle of a computer screen. On a tall desktop display a
            bottom sheet opened far below the ⋯ button that summoned it, and
            read as the button doing nothing. */}
        <RadixDialog.Overlay className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-6">
          <RadixDialog.Content
            className={cn(
              'sheet-adaptive relative w-full max-w-md bg-card shadow-2xl focus:outline-none',
              'rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-5',
            )}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-border sm:hidden" aria-hidden />
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
        </RadixDialog.Overlay>
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

/** Both languages side by side, each named in itself, so the one needed can
 *  be found without reading the other. */
function LanguageRow() {
  const { lang, setLang, m } = useI18n();
  const options: { id: Lang; name: string }[] = [
    { id: 'en', name: 'English' },
    { id: 'hi', name: 'हिन्दी' },
  ];
  return (
    <div className="surface-row flex items-center gap-3.5 px-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground/75">
        <Languages className="h-5 w-5" strokeWidth={1.9} />
      </span>
      <span id="menu-language" className="min-w-0 flex-1 text-callout font-semibold text-foreground">
        {m.menu.language}
      </span>
      <div role="radiogroup" aria-labelledby="menu-language" className="inline-flex shrink-0 rounded-xl bg-secondary p-0.5">
        {options.map((o) => {
          const selected = lang === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              lang={o.id}
              onClick={() => {
                if (selected) return;
                setLang(o.id);
                track('language_changed', { outcome: o.id });
              }}
              className={cn(
                'h-11 rounded-[10px] px-3 text-callout font-medium transition-colors',
                selected ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {o.name}
            </button>
          );
        })}
      </div>
    </div>
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
  const { m } = useI18n();
  return (
    <div className="px-4 pt-3">
      <div className="flex items-center justify-between px-1">
        <RadixDialog.Title className="text-headline text-foreground">{m.menu.title}</RadixDialog.Title>
        <RadixDialog.Close
          aria-label={m.common.close}
          className="tap-target -mr-1 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </RadixDialog.Close>
      </div>
      <RadixDialog.Description className="sr-only">
        {m.menu.description}
      </RadixDialog.Description>

      <div className="surface-group mt-2">
        {handoffUrl && (
          <Row
            icon={Smartphone}
            title={m.menu.phoneTitle}
            detail={m.menu.phoneDetail}
            onClick={onPhone}
          />
        )}
        <Row
          icon={Repeat}
          title={m.menu.switchTitle}
          detail={m.menu.switchDetail(doneCount, modelName)}
          onClick={onSwitchModel}
        />
        <Row
          icon={RotateCcw}
          title={m.menu.startOverTitle}
          detail={m.menu.startOverDetail}
          tone="danger"
          onClick={onStartOver}
        />
      </div>

      <div className="surface-group mt-3">
        <LanguageRow />
      </div>

      <RadixDialog.Close className="pressable mt-3 h-12 w-full rounded-2xl bg-secondary text-callout font-semibold text-foreground transition-colors hover:bg-secondary/75">
        {m.menu.keepInspecting}
      </RadixDialog.Close>
    </div>
  );
}

/** The hand-off: a code the phone's camera opens straight into this inspection. */
function PhoneView({ url, onBack }: { url: string; onBack: () => void }) {
  const { m } = useI18n();
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
          aria-label={m.menu.backToOptions}
          className="tap-target -ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <RadixDialog.Title className="text-headline text-foreground">{m.menu.phoneTitle}</RadixDialog.Title>
      </div>
      <RadixDialog.Description className="mt-1 text-footnote text-muted-foreground">
        {m.menu.phoneIntro}
      </RadixDialog.Description>

      <div className="mx-auto mt-4 flex aspect-square w-56 items-center justify-center rounded-2xl bg-white p-3 ring-1 ring-black/5">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={m.menu.qrAlt} className="h-full w-full" />
        ) : failed ? (
          <p className="text-center text-footnote text-muted-foreground">{m.menu.qrFailed}</p>
        ) : (
          <span className="h-full w-full animate-pulse rounded-xl bg-secondary" />
        )}
      </div>

      <p className="mt-4 break-all text-center font-mono text-caption text-muted-foreground">{url}</p>

      <RadixDialog.Close className="pressable mt-4 h-12 w-full rounded-2xl bg-secondary text-callout font-semibold text-foreground transition-colors hover:bg-secondary/75">
        {m.menu.done}
      </RadixDialog.Close>
    </div>
  );
}
