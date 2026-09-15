'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .min(7, 'Enter a valid mobile number')
    .regex(/^[+()\-.\s\d]+$/, 'Digits only, please'),
});

export type ContactFormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<ContactFormData>;
  onSubmit: (data: ContactFormData) => void;
}

export function ContactForm({ defaultValues, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({ resolver: zodResolver(schema), defaultValues });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="w-full max-w-sm mx-auto"
    >
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">AED Inspection</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Enter your details to start an AI-guided inspection.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Full name</label>
          <input
            {...register('name')}
            autoComplete="name"
            placeholder="Jane Doe"
            className={cn(
              'w-full px-3 py-2.5 rounded-lg bg-secondary border text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary transition-colors',
              errors.name ? 'border-destructive' : 'border-border/50',
            )}
          />
          {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email address</label>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="you@organisation.com"
            className={cn(
              'w-full px-3 py-2.5 rounded-lg bg-secondary border text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary transition-colors',
              errors.email ? 'border-destructive' : 'border-border/50',
            )}
          />
          {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
          <p className="text-[11px] text-muted-foreground mt-1">Your inspection report will be emailed here.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mobile number</label>
          <input
            {...register('phone')}
            type="tel"
            autoComplete="tel"
            placeholder="+1 555 123 4567"
            className={cn(
              'w-full px-3 py-2.5 rounded-lg bg-secondary border text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary transition-colors',
              errors.phone ? 'border-destructive' : 'border-border/50',
            )}
          />
          {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all disabled:opacity-60 shadow-md shadow-primary/20"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Continue
          {!isSubmitting && <ArrowRight className="w-4 h-4" />}
        </button>
      </form>
    </motion.div>
  );
}
