# Drape — your wardrobe, styled

A personal wardrobe app that runs on your iPhone from the Home Screen. No App Store, no developer account and no server. It works offline.

- **Closet**: photograph each piece. Drape detects the colour, and you pick the type (shirt, hoodie, kurta, chinos…).
- **Match**: pick what you want to wear (say, a hoodie) and get ranked bottoms, shoes and layers, each with a % score and the reason it works. It also builds complete looks around that piece.
- **Today**: three outfits a day based on the weather (Open-Meteo), the occasion (casual, work, date, gym, festive…) and what you've worn recently. Tap *Wear this* to log it.
- **Learns from you**: *Wear this*, 👍 and 👎 change how pairings are ranked later.
- **Stylist (optional)**: chat with Claude about your real closet ("dinner date tonight?", "pack for 3 days"). It can also auto-fill a new item from its photo. Uses your own Anthropic API key.
- **Me**: wear stats, cost per wear, forgotten pieces, saved outfits, history, backups, and **separate profiles** (each has its own database).

## Where the data lives

Everything is stored in IndexedDB on the device that uses it. Each person who opens Drape gets their own private closet on their own phone. Even on the same phone, every profile has a separate database (`drape-<profile>`). Nothing is uploaded, except that:
- a rounded location goes to Open-Meteo, only if you tap *Use my location*;
- wardrobe text and photos go to Anthropic, only when you use the Stylist with your own key.

Use **Me → Back up closet** now and then. It exports a JSON file with your photos that you can save to Files or iCloud Drive, and **Restore** reads it back.

## Run locally

```bash
python3 -m http.server 5178 --directory ~/Desktop/Ventures/drape
```

Then open http://localhost:5178.

## Put it on your iPhone

The iPhone needs to load the app once over **HTTPS**. Any free static host works, for example GitHub Pages, Netlify Drop or Cloudflare Pages. Once it's hosted:

1. Open the URL in **Safari**.
2. Tap Share, then **Add to Home Screen**, then Add.
3. Launch it from the icon. It runs full-screen and keeps working offline.

Hosting only serves the app's code. Each person's closet stays on their own device.

### Why not a native app?
A free Apple ID can install your own Xcode build on your phone, but the signature **expires every 7 days**, so you would have to reinstall it from your Mac each week. Avoiding that costs $99 a year. The Home Screen web app avoids both.

## Code map

| File | What it does |
|---|---|
| `js/engine.js` | Offline styling engine: colour harmony, formality and vibe match, known good and bad combos, pattern clash, weather, rotation, your feedback |
| `js/app.js` | UI: Today, Closet, Match, Stylist, Me, plus sheets for adding and editing items |
| `js/db.js` | One IndexedDB database per profile, plus backup export and import |
| `js/ai.js` | Optional Claude stylist chat and photo auto-tagging (Anthropic SDK, run in the browser) |
| `sw.js` | Offline cache |

---

## Competitor teardown: Essembl and the field

| | **Essembl** | Indyx | Whering | Acloset | Stylebook | **Drape** |
|---|---|---|---|---|---|---|
| Core idea | AI stylist: chat, "Glow Up" photo feedback, Outfit Battles | Closet analytics + paid human stylists | Free digital closet, social | Closet + preloved marketplace | Manual cataloguing (iOS) | "What goes with this?" pairing + daily looks |
| Getting clothes in | Photos + AI | Photos, assisted | Photos, background removal | Photos, background removal | Manual photos | Photo + automatic colour, or AI auto-fill |
| Outfit suggestions | AI generated | Stylist / basic | Random "shuffle" | AI, weather | Manual / random | Explained rule engine + optional AI chat |
| Explains *why* | Partly, in chat | Stylist | No | No | No | **Every pairing has reasons** |
| Works offline / no account | No | No | No | No | Yes | **Yes** |
| Price | Subscription | Free / ~$19 AUD/mo | Free / ~$6/mo | Freemium + ads | ~$5 one-time | Free (AI uses your key) |

**What Essembl gets right:** Asking in plain language ("dinner tonight?") is easier than browsing a grid. Feedback on a photo of an outfit you're wearing is engaging. Its social features (Outfit Battles) help it grow.

**Where the whole category falls short:**
1. *Cataloguing takes too long.* Most people stop after about 20 items. Drape asks for one photo and one tap per item, and AI can fill in the rest.
2. *Black-box suggestions.* People trust a pairing more when they see why: "Grey lets the mustard stand out; hoodie + cargos is a proven combo."
3. *Clothes in the wash.* Most apps suggest things that are in the laundry. Drape has a laundry toggle.
4. *Cultural range.* Few apps know kurtas, Nehru jackets or juttis, or have a "festive" occasion. Drape includes them.
5. *Lock-in and privacy.* Most apps keep your closet on their servers. Drape is local-first, with a JSON backup you control.

**Worth building next:** background removal on photos, outfit-photo "glow up" feedback using Claude vision, a calendar of planned outfits, and a packing-list mode.

Sources: [Essembl on the App Store](https://apps.apple.com/app/id6479642952) · [Essembl screens](https://screensdesign.com/showcase/essembl-ai-styling-assistant) · [Wardrobe app comparison 2026](https://getwardrobe.com/compare/) · [Closet app roundup](https://www.altadaily.com/blog/closet-apps-2026). Pricing figures come from vendor-written comparisons, so check them in the App Store.
