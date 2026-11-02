# Drape — your wardrobe, styled

A personal wardrobe app that runs on your iPhone from the Home Screen. No App Store, no developer account and no server. It works offline.

- **Scan**: take one photo, a whole shelf, or pick 20 photos at once. Gemini finds every item in each photo (tops, jeans, shoes, socks, sunglasses, jewellery…), names it, and picks its category, colour and pattern. It writes a product-page **description** and a **tell-apart fingerprint** (wash, fades, rips, logos, buttons), which is how two pairs of jeans stay distinct.
- **Shop-style photos**: each piece gets a **clean cut-out**, made on the phone from Gemini's outline of the item. If your key can use a Gemini image model it also gets a **studio product photo**. The original photo is always kept, and you can switch between all three.
- **Build a fit**: pick any pieces (a shirt, shoes, both, or nothing), choose what you need (bottom, shoes, layer, socks, accessories), and type where you're going or the mood. Gemini reads every piece's description and builds 3 looks with the reason they work and a styling tip.
- **Places (the library)**: file each piece under Room › Storage › Spot (e.g. Bedroom › Wardrobe › Shelf 2, or Under-bed box › Blue pouch). Every outfit has a 📍 **Find** button that lists where to grab each piece.
- **Own it?**: snap something in a shop, or a screenshot. Gemini compares it with your pieces in that category, using photos and descriptions, and says whether you already own it, which piece is closest and where it's kept, and what it would go with.
- **Match**: instant, offline pairing scores for any piece you pick.
- **Today**: daily looks based on the weather, the occasion and what you wore recently. It learns from 👍/👎 and from what you mark as worn.
- **Chat**: ask anything about your closet.

## How the "backend" works

There is no server. Each phone's database *is* the backend:

```
iPhone (Home Screen app)
 ├─ IndexedDB "drape-<profile>"   ← one private database per profile
 │   items: photos (original / cut-out / studio), type, colours, pattern,
 │          formality, warmth, brand, size, price, place, AI description,
 │          tell-apart fingerprint, wear history
 ├─ Offline styling engine        ← colour harmony, formality, vibe, proven combos,
 │                                   pattern clash, weather, rotation, your feedback
 └─ Gemini (your own key) ───────► scan · describe · outline · studio photo ·
                                    build fits · compare when shopping · chat
GitHub Pages: hosts the code only; your data never goes there.
```

The Gemini key is entered **inside the app** (Me → Gemini AI, or on first launch). It is stored only in that profile on that phone, sent only to Google, and never included in backups.

## Where the data lives

Everything is stored in IndexedDB on the device that uses it. Each person who opens Drape gets their own private closet on their own phone. Even on the same phone, every profile has a separate database (`drape-<profile>`). Nothing is uploaded, except that:
- a rounded location goes to Open-Meteo, only if you tap *Use my location*;
- wardrobe text and photos go to Google's Gemini API, only when you use the Stylist with your own key.

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
| `js/ai.js` | Gemini: scan + describe + outline, studio photo, fit builder, shopping check, chat |
| `js/photo.js` | On-device photo work: resize, thumbnails, outline cut-out on a studio background |
| `sw.js` | Offline cache |

---

## Competitor teardown: Essembl and the field

| | **Essembl** | Indyx | Whering | Acloset | Stylebook | **Drape** |
|---|---|---|---|---|---|---|
| Core idea | AI stylist: chat, "Glow Up" photo feedback, Outfit Battles | Closet analytics + paid human stylists | Free digital closet, social | Closet + preloved marketplace | Manual cataloguing (iOS) | "What goes with this?" pairing + daily looks |
| Getting clothes in | Photos + AI | Photos, assisted | Photos, background removal | Photos, background removal | Manual photos | Photo + automatic colour, or AI auto-fill |
| Outfit suggestions | AI generated | Stylist / basic | Random "shuffle" | AI, weather | Manual / random | Explained rule engine + optional Gemini chat |
| Explains *why* | Partly, in chat | Stylist | No | No | No | **Every pairing has reasons** |
| Works offline / no account | No | No | No | No | Yes | **Yes** |
| Price | Subscription | Free / ~$19 AUD/mo | Free / ~$6/mo | Freemium + ads | ~$5 one-time | Free (Gemini uses your key) |

**What Essembl gets right:** Asking in plain language ("dinner tonight?") is easier than browsing a grid. Feedback on a photo of an outfit you're wearing is engaging. Its social features (Outfit Battles) help it grow.

**Where the whole category falls short:**
1. *Cataloguing takes too long.* Most people stop after about 20 items. Drape asks for one photo and one tap per item, and AI can fill in the rest.
2. *Black-box suggestions.* People trust a pairing more when they see why: "Grey lets the mustard stand out; hoodie + cargos is a proven combo."
3. *Clothes in the wash.* Most apps suggest things that are in the laundry. Drape has a laundry toggle.
4. *Cultural range.* Few apps know kurtas, Nehru jackets or juttis, or have a "festive" occasion. Drape includes them.
5. *Lock-in and privacy.* Most apps keep your closet on their servers. Drape is local-first, with a JSON backup you control.

**Worth building next:** background removal on photos, outfit-photo "glow up" feedback using Gemini vision, a calendar of planned outfits, and a packing-list mode.

Sources: [Essembl on the App Store](https://apps.apple.com/app/id6479642952) · [Essembl screens](https://screensdesign.com/showcase/essembl-ai-styling-assistant) · [Wardrobe app comparison 2026](https://getwardrobe.com/compare/) · [Closet app roundup](https://www.altadaily.com/blog/closet-apps-2026). Pricing figures come from vendor-written comparisons, so check them in the App Store.
