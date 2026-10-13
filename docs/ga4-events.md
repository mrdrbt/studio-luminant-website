# GA4 custom events — studioluminant.com

Property `G-PZ0SGLKLH0`. Added 2026-10-13 so GA4 can rank demand by design and
style (before this, every design view on the collection / gallery pages collapsed
into one `page_view`). Source: `VAULT/01 — Strategy & Analysis/2026-10-13_2040_Line_Research/S17_owned_signals_ga4_instagram.md`.

All events go through the page's existing `gtag` and are no-ops when it is absent
(internal traffic, localhost, blocked script). Pages that load `shared.js` call
`slTrack(name, params)`; `en/lookbook.htm` does not load `shared.js` and calls
`gtag('event', …)` directly behind the same `typeof gtag` guard.

**Keep names stable.** Renaming an event or param splits its history in GA4.
Values are language-neutral (data keys, not TR/EN labels) so TR and EN traffic
aggregate; split by language with GA4's built-in `language` / page path.

## `view_design` — a visitor opens / enlarges one design

| Param | Example | Meaning |
|---|---|---|
| `content_type` | `pattern` / `scene` | `pattern` = a Supabase pattern (collection lightbox); `scene` = a lookbook image |
| `design_id` | `compass-star` | pattern `id`; for `scene`, the image file stem minus `studio-luminant-` |
| `design_name` | `Compass Star` | EN name on both languages (pattern); caption text (scene) |
| `design_code` | `SIG-CMP` | pattern `code` (pattern only) |
| `collection` | `SIG` | pattern `collection` (pattern only) |
| `style` | `heritage` | pattern `style`; lookbook `data-cat` for scenes |
| `view_method` | `card` / `lightbox_nav` / `enlarge` | grid card click/Enter · prev/next arrows inside the lightbox · lookbook image enlarge |

Fired from: `koleksiyon.htm`, `en/collection.htm` (lightbox open + prev/next),
`en/lookbook.htm` (image enlarge).

Colour / finish: not sent — no page shows a per-item colour or finish choice yet,
and the pattern data carries none. Add a `finish` param here first if one appears.

## `filter_select` — a visitor changes a listing filter

| Param | Example | Meaning |
|---|---|---|
| `filter_type` | `style` / `application` / `category` | collection style pill · collection application tag · gallery/lookbook category button |
| `filter_value` | `geometric`, `wall-panel`, `all` | the button's `data-*` key |
| `filter_state` | `on` / `off` | `off` only when an application tag is toggled off |
| `result_count` | `7` | items visible after the filter applied |

Fired from: `koleksiyon.htm`, `en/collection.htm`, `galeri.htm`, `en/gallery.htm`,
`en/lookbook.htm`. Note: the gallery `data-filter` keys do not match their EN
labels (`geometric` is labelled "Lounge & Bar" on `en/gallery.htm`) — report on the key.

## `generate_lead` — unchanged

Fired on successful lead-intake POSTs (contact, sample box, specifier kit, BIM
pack); see `apply-lead-event.py`. Not touched by this change.

## GA4 Admin (one-off, manual)

Custom params do not appear in standard reports until registered. In GA4 Admin →
Custom definitions → Create custom dimension (scope **Event**), one per param:
`content_type`, `design_id`, `design_name`, `design_code`, `collection`, `style`,
`view_method`, `filter_type`, `filter_value`, `filter_state`; and `result_count`
as a custom **metric** (unit: Standard). Data is collected from deploy onward;
registration is not retroactive for reports, so register at deploy.
