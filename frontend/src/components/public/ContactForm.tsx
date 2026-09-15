'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PhoneInput } from './PhoneInput';
import { isValidNationalNumber, parsePhoneValue } from '@/lib/countries';
import { isValidEmail } from '@/lib/validators';
import { screenTransition } from '@/lib/motion';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isValidEmail, { message: 'Enter a valid email address' }),
  phone: z.string().refine(
    (value) => {
      const { country, nationalDigits } = parsePhoneValue(value);
      return isValidNationalNumber(country, nationalDigits);
    },
    { message: 'Enter a valid mobile number for the selected country' },
  ),
});

export type ContactFormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<ContactFormData>;
  onSubmit: (data: ContactFormData) => void;
}

export function ContactForm({ defaultValues, onSubmit }: Props) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  return (
    <motion.div
      {...screenTransition}
      className="w-full max-w-sm mx-auto"
    >
      <div className="mb-7 px-1">
        <p className="text-caption uppercase text-muted-foreground mb-2.5" style={{ letterSpacing: '0.08em' }}>
          Automated AI inspection
        </p>
        <h1 className="text-display text-foreground">
          Let&apos;s verify<br />your AED.
        </h1>
        <p className="text-body text-muted-foreground mt-3">
          Point your camera at each part — AI checks it instantly. A signed report lands in your inbox the moment
          you finish.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="surface-group">
          <div className="surface-row px-4 pt-2.5 pb-3">
            <label htmlFor="name" className="block text-caption text-muted-foreground mb-0.5">
              Full name
            </label>
            <input
              {...register('name')}
              id="name"
              autoComplete="name"
              placeholder="Jane Doe"
              className="w-full bg-transparent text-body text-foreground placeholder:text-muted-foreground/45 focus:outline-none"
            />
          </div>

          <div className="surface-row px-4 pt-2.5 pb-3">
            <label htmlFor="email" className="block text-caption text-muted-foreground mb-0.5">
              Email address
            </label>
            <input
              {...register('email')}
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@organisation.com"
              className="w-full bg-transparent text-body text-foreground placeholder:text-muted-foreground/45 focus:outline-none"
            />
          </div>

          <div className="surface-row px-4 pt-2.5 pb-3">
            <label className="block text-caption text-muted-foreground mb-0.5">Mobile number</label>
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
          Your signed report is sent to this email address.
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
          Continue
          {!isSubmitting && <ArrowRight className="w-[18px] h-[18px]" strokeWidth={2.2} />}
        </button>
      </form>

      <div className="flex items-center justify-center gap-1.5 mt-5">
        <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" strokeWidth={1.8} />
        <span className="text-footnote text-muted-foreground/80">Verified by AI in seconds, reviewed on request</span>
      </div>
    </motion.div>
  );
}
