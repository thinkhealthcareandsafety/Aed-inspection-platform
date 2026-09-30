'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, ShieldCheck, Sparkles, Clock, FileCheck2, IndianRupee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PhoneInput } from './PhoneInput';
import { isValidNationalNumber, parsePhoneValue } from '@/lib/countries';
import { isValidEmail, suggestEmailFix } from '@/lib/validators';
import { screenTransition } from '@/lib/motion';
import { useI18n, type Messages } from '@/i18n';
import { preloadSampleReport } from '@/lib/sample-report';
import { track } from '@/lib/track';

const loadSampleReport = () => import('./SampleReport');
const SampleReport = dynamic(loadSampleReport, { ssr: false });

/** Fetched ahead of the tap, so the sheet opens straight away. */
function warmSampleReport() {
  void loadSampleReport();
  preloadSampleReport();
}

function contactSchema(errors: Messages['contact']['errors']) {
  return z.object({
    name: z.string().trim().min(2, errors.name),
    email: z.string().trim().toLowerCase().refine(isValidEmail, { message: errors.email }),
    phone: z.string().refine(
      (value) => {
        const { country, nationalDigits } = parsePhoneValue(value);
        return isValidNationalNumber(country, nationalDigits);
      },
      { message: errors.phone },
    ),
  });
}

export type ContactFormData = z.infer<ReturnType<typeof contactSchema>>;

const FACT_ICONS = [IndianRupee, Clock, FileCheck2];

interface Props {
  defaultValues?: Partial<ContactFormData>;
  onSubmit: (data: ContactFormData) => void;
}

export function ContactForm({ defaultValues, onSubmit }: Props) {
  const { lang, m } = useI18n();
  const t = m.contact;
  const schema = useMemo(() => contactSchema(m.contact.errors), [m]);
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
    setFocus,
    formState: { errors, isSubmitting, touchedFields, submitCount },
  } = useForm<ContactFormData>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  const [sampleOpen, setSampleOpen] = useState(false);

  // The sheet's code is tiny and off the critical path; fetch it once the
  // page has settled so the first tap never waits on the network.
  useEffect(() => {
    const id = window.setTimeout(() => void loadSampleReport(), 3000);
    return () => window.clearTimeout(id);
  }, []);

  // An error already on screen is re-said in the language just picked.
  const hasErrors = Object.keys(errors).length > 0;
  useEffect(() => {
    if (hasErrors || submitCount > 0) void trigger(Object.keys(touchedFields) as Array<keyof ContactFormData>);
    // Only on a language change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Offered once the field is left, never mid-typing ("gmail.c" isn't a typo
  // yet), because the report is emailed: a misspelt domain loses it silently.
  const emailFix = touchedFields.email ? suggestEmailFix(watch('email') ?? '') : null;

  return (
    <motion.div
      {...screenTransition}
      className="w-full max-w-sm mx-auto"
    >
      <div className="mb-6 px-1">
        <p
          className="inline-flex items-center gap-1.5 text-caption uppercase text-muted-foreground mb-2.5"
          style={{ letterSpacing: '0.08em' }}
        >
          <Sparkles className="w-3 h-3" strokeWidth={2.2} />
          {t.eyebrow}
        </p>
        <h1 className="text-display text-foreground">
          {t.title.map((line, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {line}
            </Fragment>
          ))}
        </h1>
        <p className="text-body text-muted-foreground mt-3">{t.intro}</p>
      </div>

      {/* Three facts that answer what a stranger is actually asking before
          they type their mobile number in: what does it cost, how long will
          it take, and what do I walk away with. */}
      <ul className="grid grid-cols-3 gap-2 mb-6 px-1">
        {t.facts.map((f, i) => {
          const Icon = FACT_ICONS[i];
          const content = (
            <>
              <Icon className="w-4 h-4 mx-auto text-muted-foreground" strokeWidth={1.9} />
              <p className="text-callout text-foreground mt-1.5 leading-none">{f.label}</p>
              <p className={cn('text-caption mt-1', i === 2 ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                {f.sub}
              </p>
            </>
          );
          return (
            <li key={i} className="surface-group text-center">
              {/* The report is the one fact that can be shown rather than
                  claimed: this tile opens a real sample of it. */}
              {i === 2 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSampleOpen(true);
                    track('sample_report_opened');
                  }}
                  onPointerEnter={warmSampleReport}
                  onTouchStart={warmSampleReport}
                  onFocus={warmSampleReport}
                  aria-haspopup="dialog"
                  className="pressable block h-full w-full px-3 py-3 transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary rounded-2xl"
                >
                  {content}
                </button>
              ) : (
                <div className="px-3 py-3">{content}</div>
              )}
            </li>
          );
        })}
      </ul>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="surface-group">
          <div className="surface-row px-4 pt-2.5 pb-3">
            <label htmlFor="name" className="block text-caption text-muted-foreground mb-0.5">
              {t.name}
            </label>
            <input
              {...register('name')}
              id="name"
              autoComplete="name"
              placeholder={t.namePlaceholder}
              className="w-full bg-transparent text-body text-foreground placeholder:text-muted-foreground/45 focus:outline-none"
            />
          </div>

          <div className="surface-row px-4 pt-2.5 pb-3">
            <label htmlFor="email" className="block text-caption text-muted-foreground mb-0.5">
              {t.email}
            </label>
            <input
              {...register('email')}
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t.emailPlaceholder}
              className="w-full bg-transparent text-body text-foreground placeholder:text-muted-foreground/45 focus:outline-none"
            />
            {emailFix && (
              <button
                type="button"
                onClick={() => setValue('email', emailFix, { shouldValidate: true, shouldDirty: true })}
                className="mt-1.5 -mx-1 flex min-h-9 items-center rounded-lg px-1 text-left text-footnote text-muted-foreground"
              >
                <span>{t.didYouMean(<span className="font-semibold text-primary">{emailFix}</span>)}</span>
              </button>
            )}
          </div>

          <div className="surface-row px-4 pt-2.5 pb-3">
            <label className="block text-caption text-muted-foreground mb-0.5">{t.phone}</label>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <PhoneInput value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} />
              )}
            />
          </div>
        </div>

        {(errors.name || errors.email || errors.phone) && (
          <p className="text-footnote text-destructive mt-2.5 px-1">
            {errors.name?.message ?? errors.email?.message ?? errors.phone?.message}
          </p>
        )}

        <p className="text-footnote text-muted-foreground mt-2.5 px-1">
          {t.privacy}
        </p>

        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'pressable w-full flex items-center justify-center gap-2 h-[52px] mt-6 rounded-2xl',
            'bg-primary text-primary-foreground text-headline',
            'hover:bg-primary/92 disabled:opacity-50 transition-colors',
          )}
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {t.submit}
          {!isSubmitting && <ArrowRight className="w-[18px] h-[18px]" strokeWidth={2.2} />}
        </button>
      </form>

      <div className="flex items-center justify-center gap-1.5 mt-5">
        <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" strokeWidth={1.8} />
        {/* Only claims that are actually true — invented social proof is the
            fastest way to lose a safety professional's trust. Who's behind
            the app is said once, in the footer below — repeating it here in
            a second, louder block (a full-colour logo, stacked facts) was
            redundant noise on an otherwise quiet screen. */}
        <span className="text-footnote text-muted-foreground/80">
          {t.photosPrivate}
        </span>
      </div>

      {sampleOpen && (
        <SampleReport
          onClose={() => setSampleOpen(false)}
          onStart={() => {
            setSampleOpen(false);
            requestAnimationFrame(() => setFocus('name'));
          }}
        />
      )}
    </motion.div>
  );
}
