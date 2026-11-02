import { CalendarDays, Heart, HelpCircle, Home, LayoutGrid, LineChart, MapPin, MessageCircle, Plane, ScanSearch, Shirt, Sparkles, UserRound, Wand2 } from 'lucide-react';

export const NAV = [
  { href: '/app', label: 'Today', icon: Home, tour: 'Three outfits picked for today’s weather and your plans.' },
  { href: '/app/wardrobe', label: 'Wardrobe', icon: LayoutGrid, tour: 'Everything you own, searchable and filterable.' },
  { href: '/app/stylist', label: 'AI Stylist', icon: Sparkles, tour: 'Pick an occasion and get three complete looks.' },
  { href: '/app/match', label: 'Match', icon: Shirt, tour: 'Choose one piece and see what goes with it.' },
  { href: '/app/own-it', label: 'Own It', icon: ScanSearch, tour: 'In a shop? Snap it to see if you already own something like it.' },
  { href: '/app/trips', label: 'Trip Planner', icon: Plane, tour: 'Day-by-day outfits and a packing list for a trip.' },
  { href: '/app/finder', label: 'Closet Finder', icon: MapPin, tour: 'Where every piece is kept — room, cupboard, shelf, box.' },
  { href: '/app/chat', label: 'Chat', icon: MessageCircle, tour: 'Ask your stylist anything about your wardrobe.' },
  { href: '/app/favourites', label: 'Favourites', icon: Heart, tour: 'Saved outfits and favourite pieces.' },
  { href: '/app/calendar', label: 'Calendar', icon: CalendarDays, tour: 'Plan outfits for upcoming days and see what you wore.' },
  { href: '/app/insights', label: 'Insights', icon: LineChart, tour: 'What you wear, what you don’t, and cost per wear.' },
  { href: '/app/profile', label: 'Profile', icon: UserRound, tour: 'Your plan, profiles, preferences and data.' },
  { href: '/app/help', label: 'Help', icon: HelpCircle, tour: 'Replay this tour and read the FAQ.' },
] as const;

export const MOBILE_TABS = ['/app', '/app/wardrobe', '/app/stylist', '/app/own-it'] as const;
export { Wand2 };
