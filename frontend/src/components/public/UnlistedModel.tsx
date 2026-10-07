'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { OTHER_AED_BRANDS } from '@/lib/aed-models';
import { formatPhone } from '@/lib/countries';
import { springSnappy } from '@/lib/motion';
import { useI18n } from '@/i18n';

interface Contact {
  name: string;
  email: string;
  phone: string;
}

/**
 * The way out of the model picker for everyone whose AED isn't one of the
 * three cards. It used to be a "coming soon" footnote — a polite dead end
 * for a person who had just handed over their name, email and phone. Now
 * one tap on their brand keeps them as a lead the sales team can call.
 */
export function UnlistedModel({ contact, disabled }: { contact: Contact; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState<string | null>(null);
  const [model, setModel] = useState('');
  const [sending, setSending] = useState(false);
  const { m } = useI18n();
  const t = m.unlisted;
  /** What was asked about — null when all we know is "an AED". */
  const [sentFor, setSentFor] = useState<{ unit: string | null } | null>(null);
  const firstName = contact.name.trim().split(/\s+/)[0];
  const phone = formatPhone(contact.phone);

  async function send() {
    if (!brand || sending) return;
    setSending(true);
    try {
      await api.public.requestModel({
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        brand,
        model: model.trim() || undefined,
      });
      setSentFor({ unit: [brand === 'Other' ? '' : brand, model.trim()].filter(Boolean).join(' ') || null });
    } catch {
      // The API client already shows the error; the form stays filled in.
    } finally {
      setSending(false);
    }
  }

  if (sentFor) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSnappy}
        role="status"
        className="surface-tile flex items-start gap-3 p-4"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
        <div className="min-w-0">
          <p className="text-callout font-semibold text-foreground">{t.thanks(firstName || undefined)}</p>
          <p className="mt-0.5 text-footnote text-muted-foreground">{t.notCovered(sentFor.unit, phone || undefined)}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-2xl transition-colors',
        open ? 'surface-tile' : 'border-[1.5px] border-dashed border-border',
        disabled && 'opacity-40',
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-3.5 pr-4 text-left"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          <Plus className="h-6 w-6" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-headline text-foreground">{t.title}</span>
          <span className="mt-0.5 block text-footnote text-muted-foreground">{t.subtitle}</span>
        </span>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-muted-foreground/60 transition-transform', open && 'rotate-180')}
          strokeWidth={2}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springSnappy}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <p id="brand-label" className="text-caption uppercase tracking-[0.06em] text-muted-foreground">
                {t.brandLabel}
              </p>
              <div role="radiogroup" aria-labelledby="brand-label" className="mt-2 flex flex-wrap gap-2">
                {OTHER_AED_BRANDS.map((b) => {
                  const selected = brand === b;
                  return (
                    <button
                      key={b}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setBrand(b)}
                      className={cn(
                        'pressable h-11 rounded-xl px-3.5 text-callout font-medium transition-colors',
                        selected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-foreground hover:bg-secondary/75',
                      )}
                    >
                      {b === 'Other' ? t.other : b}
                    </button>
                  );
                })}
              </div>

              <label htmlFor="unlisted-model" className="mt-4 block text-caption uppercase tracking-[0.06em] text-muted-foreground">
                {t.modelLabel} <span className="normal-case tracking-normal">{t.modelOptional}</span>
              </label>
              <input
                id="unlisted-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                maxLength={80}
                placeholder={t.modelPlaceholder}
                className="mt-2 h-11 w-full rounded-xl bg-secondary px-3.5 text-body text-foreground placeholder:text-muted-foreground/55 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />

              <button
                type="button"
                disabled={!brand || sending}
                onClick={() => void send()}
                className="pressable mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-headline text-primary-foreground transition-colors hover:bg-primary/92 disabled:opacity-50"
              >
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                {sending ? t.sending : brand ? t.ask(brand === 'Other' ? null : brand) : t.chooseBrand}
              </button>
              {phone && (
                <p className="mt-2 text-center text-caption text-muted-foreground">
                  {t.contactOn(phone)}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
