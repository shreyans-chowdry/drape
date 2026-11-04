import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';
import { contactLine, Legal } from '@/components/legal';

export const metadata: Metadata = { title: 'Privacy policy', alternates: { canonical: '/privacy' } };

export default function Privacy() {
  return (
    <Legal title="Privacy policy">
      <p>{BRAND.name} is operated by {BRAND.operator}, an individual based in {BRAND.country} (“we”, “us”). This policy explains what we collect when you use {BRAND.name}, why, who we share it with, and the choices you have. You can reach us {contactLine}.</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account details:</b> your email address, name, and a password (stored only as a secure hash by our authentication provider). If you sign in with Google, we receive your name, email and profile picture from Google.</li>
        <li><b>Your wardrobe:</b> photos you upload, the details we extract from them (type, colour, pattern, brand text visible on the label, and similar), details you add (price, purchase date, where it is kept), outfits, calendar entries, wear history, trips, wishlist items and chat messages.</li>
        <li><b>Preferences:</b> your style answers, favourite colours and notification settings.</li>
        <li><b>Location:</b> a city you choose, or approximate coordinates if you allow your device location. Used only to fetch weather.</li>
        <li><b>Payments:</b> your plan, subscription status, and payment records (amount, date, status, Razorpay reference). Card, UPI and bank details are collected by Razorpay, not by us.</li>
        <li><b>Usage and technical data:</b> records of AI requests (feature used, model, tokens, cost, success or failure) to enforce plan limits and control costs, plus standard server logs (IP address, browser, time) kept for security.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run the service: catalogue your clothes, suggest outfits, find items, plan trips, and answer your questions.</li>
        <li>To enforce plan limits, process payments and send account emails (confirmation, password reset, receipts, plan changes).</li>
        <li>To keep the service secure and prevent abuse.</li>
        <li>To send product updates if you have left that setting on. You can turn it off in Profile.</li>
      </ul>
      <p>We do not sell your personal data, and we do not use your photos for advertising.</p>

      <h2>AI processing</h2>
      <p>When you scan clothes, create a studio photo, ask the stylist, use Own It, plan a trip or chat, the relevant photos and wardrobe details are sent to Google’s Gemini API to produce the result. This happens only when you use one of those features. Google processes this content under its Gemini API terms. On Google’s paid tier, Google states that it does not use prompts or responses to improve its products; we use paid access for production traffic. We send only what a request needs — for example the relevant part of your wardrobe, not your whole account.</p>

      <h2>Who we share it with</h2>
      <p>Only with service providers that run parts of {BRAND.name} for us:</p>
      <ul>
        <li><b>Supabase</b> — database, file storage and sign-in.</li>
        <li><b>Google (Gemini API)</b> — image and text analysis, as described above. <b>Google</b> also handles sign-in if you choose “Continue with Google”.</li>
        <li><b>Razorpay</b> — payments and subscriptions.</li>
        <li><b>Resend</b> — sending account and billing emails.</li>
        <li><b>Vercel</b> — hosting the website.</li>
        <li><b>Open-Meteo</b> — weather forecasts. It receives coordinates or a city name, not your identity.</li>
      </ul>
      <p>These providers may process data outside India. We may also disclose information if required by law.</p>

      <h2>How long we keep it</h2>
      <p>Your wardrobe data is kept while your account exists. Temporary uploads used during scanning are deleted after processing. When you delete your account, your photos and wardrobe data are deleted immediately from our live systems; backups held by our providers roll off on their own schedules. Payment records may be kept for as long as tax and accounting law requires, without your photos or wardrobe.</p>

      <h2>Security</h2>
      <p>Photos are stored in private storage and shown through short-lived links. Every database table is protected so each account can only read its own rows. Connections are encrypted. No system is perfectly secure, so please use a strong, unique password.</p>

      <h2>Your choices and rights</h2>
      <ul>
        <li><b>Access and portability:</b> download everything from Profile → Your data (ZIP with photos, JSON or CSV).</li>
        <li><b>Correction:</b> edit any item or profile detail in the app.</li>
        <li><b>Deletion:</b> delete your account from Profile → Your data. See <a href="/data-deletion">how deletion works</a>.</li>
        <li><b>Withdraw consent:</b> stop location access in your browser settings, turn off emails in Profile, or stop using AI features.</li>
        <li><b>Grievances:</b> contact us {contactLine}. We aim to respond within 30 days, in line with India’s Digital Personal Data Protection Act, 2023.</li>
      </ul>

      <h2>Children</h2>
      <p>{BRAND.name} is not intended for children under 18. If you believe a child has created an account, contact us and we will delete it.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we will tell you in the app or by email before it takes effect.</p>
    </Legal>
  );
}
