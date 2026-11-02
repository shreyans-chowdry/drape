// Shared by onboarding and the profile page.
export const STYLE_OPTIONS = {
  clothing: [{ id: 'menswear', label: 'Menswear' }, { id: 'womenswear', label: 'Womenswear' }, { id: 'both', label: 'A mix of both' }],
  styles: [
    { id: 'minimal', label: 'Minimal' }, { id: 'classic', label: 'Classic' }, { id: 'street', label: 'Streetwear' }, { id: 'smart', label: 'Smart casual' },
    { id: 'ethnic', label: 'Ethnic / Indian' }, { id: 'sporty', label: 'Sporty' }, { id: 'boho', label: 'Boho' }, { id: 'bold', label: 'Bold & colourful' },
  ],
  occasions: [
    { id: 'work', label: 'Office' }, { id: 'casual', label: 'Everyday' }, { id: 'college', label: 'College' }, { id: 'party', label: 'Going out' },
    { id: 'festive', label: 'Festive & weddings' }, { id: 'gym', label: 'Gym' }, { id: 'travel', label: 'Travel' },
  ],
};
export type Preferences = { clothing?: string; styles?: string[]; occasions?: string[]; colours?: string[]; avoid?: string };
