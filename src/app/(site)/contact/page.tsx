import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';
import { ContactForm } from './form';

export const metadata: Metadata = { title: 'Contact', alternates: { canonical: '/contact' } };

export default function Contact() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <h1 className="font-serif text-4xl sm:text-5xl">Contact us</h1>
      <p className="mt-3 text-ink-2">Questions, feedback, a billing issue or a data request — write to us and we’ll reply by email.{BRAND.supportEmail && <> You can also email <a className="text-accent" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.</>}</p>
      <ContactForm />
    </div>
  );
}
