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

## `generate_lead` — a lead reaches lead-intake

Fired on successful lead-intake POSTs (contact, sample box, specifier kit); see
`contact.js` and the kit pages' inline script. Since WB-08 (2026-10) every lead
also carries the session's attribution, collected by `shared.js`
(`slAttribution()`, sessionStorage key `sl_attr`) and sent in the lead payload,
in the Formspree copy (hidden inputs) and in this event:

| Param | Example | Meaning |
|---|---|---|
| `form_type` | `project` / `sample` | contact page forms only |
| `source` | `contact-tr` | the form's hidden `source` |
| `lead_magnet` / `firm` | `specifier-kit` | kit pages only (unchanged) |
| `service_line` | `Özel Üretim` | one of `Özel Üretim` · `Atölye Tasarımları` · `Dosya talebi` · `Diğer` (same value on TR and EN). A `?service_line=ozel-uretim\|atolye\|dosya\|diger` key on any URL wins (QR, DM and PDF links); else the last door page seen (Systems pages → Atölye Tasarımları; surec / process / Tufetto → Özel Üretim); else Diğer. Kit requests are always Dosya talebi. |
| `landing_path` | `/sistemler.htm` | first page of the session, no query |
| `referrer` | `https://www.linkedin.com/feed/` | external referrer of that first page, origin + path only; empty for direct / internal |
| `utm_source` … `utm_term` | `linkedin` | the last campaign URL seen in the session (a new utm set replaces the old one whole) |

lead-intake stores `utm_source`…`utm_content` in their own columns; it has no
column for `service_line`, `landing_path`, `referrer` or `utm_term`, so the first
three are appended to the lead's message as one `[service_line: … · landing_path: … · referrer: …]` line.

## `contact_click` — a visitor taps a phone, mail or WhatsApp link

| Param | Example | Meaning |
|---|---|---|
| `contact_method` | `tel` / `mail` / `whatsapp` | `tel:`, `mailto:`, `wa.me` / `api.whatsapp.com` link |
| `link_location` | `footer` / `nav` / `body` | where the link sits |

Fired from every page (delegated listener in `shared.js`).

## GA4 Admin (one-off, manual)

Custom params do not appear in standard reports until registered. In GA4 Admin →
Custom definitions → Create custom dimension (scope **Event**), one per param:
`content_type`, `design_id`, `design_name`, `design_code`, `collection`, `style`,
`view_method`, `filter_type`, `filter_value`, `filter_state`, `service_line`, `landing_path`,
`referrer`, `contact_method`, `link_location`; and `result_count`
as a custom **metric** (unit: Standard). Data is collected from deploy onward;
registration is not retroactive for reports, so register at deploy.
