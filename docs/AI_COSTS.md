# AI costs

All calls are metered in `user_ai_usage` and shown in `/admin`. Prices are editable in Admin → AI settings (`model_pricing`, USD per 1M tokens; `image` = USD per generated image) with `fx.usd_inr` (default 94.6).

## Default models
| Role | Model | Price (Google list, Nov 2026) |
|---|---|---|
| Text, scanning, verification | `gemini-3.1-flash-lite` | $0.25 in / $1.50 out per 1M tokens (free tier available) |
| Reasoning fallback, trips | `gemini-3.6-flash` | $0.75 / $3.75 per 1M (promotional to 31 Dec 2026, then $1.50 / $7.50) |
| Studio image | `gemini-3.1-flash-lite-image` | $0.0336 per 1K image (paid tier only) |
| Studio fallback | `gemini-nano-banana-2.1` | $0.0336 per 1K image (paid tier only) |

Re-check https://ai.google.dev/pricing before launch; update `model_pricing` if it changed.

## Measured per-operation cost (local test, small wardrobe)
| Operation | Tokens | Cost |
|---|---|---|
| Scan one photo | ~670 in / ~350 out | ~$0.0007 (₹0.07) |
| Stylist, 3 looks (10 pieces) | ~620 in / ~490 out | ~$0.0009 (₹0.08) |

Estimates for larger requests (wardrobe text grows with items; retrieval caps it at ~80–90 pieces):
| Operation | Typical | Worst case |
|---|---|---|
| Studio photo | 1 image + 1 verification ≈ $0.035 (₹3.3) | retry: 2 images + 2 checks ≈ $0.07 (₹6.6) |
| Stylist / chat (200+ pieces) | ~$0.002–0.004 | — |
| Own It (photo + up to 8 thumbs) | ~$0.002 | — |
| Trip plan (reasoning model) | ~$0.01–0.02 | — |

## Plan margins (worst case, all allowance used)
| Plan | Price | Studio cost | Text features | Total AI | Gross margin before fees/tax |
|---|---|---|---|---|---|
| Free | ₹0 | 5 one-time × ₹6.6 = ₹33 once | ~₹3/month | ~₹3/mo after first month | — |
| Plus | ₹199/mo | 20 × ₹6.6 = ₹132 | ~₹15 | ~₹147 | ~₹52 |
| Pro | ₹349/mo | 50 × ₹6.6 = ₹330 | ~₹40 | ~₹370 | **negative in the worst case** |

Typical studio cost is about half the worst case (most photos pass first time), which brings Pro to roughly ₹165 + ₹40 → healthy. Watch the studio retry rate in Admin; if it is high, consider lowering Pro’s studio allowance or raising the pack price. Razorpay fees (~2%) and GST are not included.

## Controls
- Credits: hold → settle; failed generations refunded automatically.
- Per-user rate limit: 30 AI requests/minute; scan cap 150 per 24 h.
- Retrieval: only relevant pieces are sent for large wardrobes.
- Today, Match, Quick ideas and Insights run on-device with no AI cost.
