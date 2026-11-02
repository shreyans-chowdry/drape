// One place for the product's name and voice. Rename the product here.
export const BRAND = {
  name: 'Drape',
  tagline: 'Your entire wardrobe. One intelligent stylist.',
  description:
    'Drape catalogues your clothes from a photo, styles outfits from what you actually own, and tells you if you already have something before you buy it.',
  promises: ['Know what you own.', 'Discover what to wear.', 'Plan outfits effortlessly.', 'Shop more intelligently.', 'Make better use of your wardrobe.'],
  // The real support contact. Change it to a domain address once one is set up.
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'chowdryshreyans20@gmail.com',
  operator: 'Shreyans Chowdry',
  country: 'India',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  themeColor: '#f6f3ee',
} as const;
