# Organization `sameAs` / entity-graph plan

Companion to the AI-search (GEO/AEO) work. Tracks the brand-entity links that help
AI answer engines (ChatGPT, Perplexity, Claude, Google AI Overviews) confirm they are
describing the *right* "Studio Luminant."

## Current state (after the entity-graph fix)

The Studio Luminant brand entity is single-sourced as one node, `@id`
`https://studioluminant.com.tr/#organization`. It is described in **4 files**, now all
carrying that same `@id` and the apex `url` so engines see **one** entity, not several:

| File | Node type | Role |
|---|---|---|
| `Studio Luminant — Özel Mimari Elemanlar.htm` | `Organization` | canonical brand node (TR home) |
| `en/Studio Luminant — Bespoke Architectural Elements.htm` | `Organization` | same entity (EN home) |
| `iletisim.htm` | `LocalBusiness` | enriches entity with NAP / areaServed (TR) |
| `en/contact.htm` | `LocalBusiness` | enriches entity with NAP / areaServed (EN) |

Author/publisher references on article pages are intentionally lightweight and carry
**no** `sameAs` — that is correct; do not add links there.

**`sameAs` currently listed (verified, live, link back to the site):**
- `https://www.instagram.com/studio_luminant`
- `https://www.linkedin.com/company/studioluminant`

## The rule for adding any link

Only add a URL to `sameAs` when **all three** hold:
1. Studio Luminant controls the profile and keeps it active.
2. The profile **links back** to `https://studioluminant.com.tr` (bidirectional — otherwise
   engines discount the signal).
3. The profile is a stable, canonical URL (not a search/result page).

## Priority: create a Wikidata item (highest AEO leverage)

LLMs reference Wikidata/Wikipedia heavily for entity identity, so a single well-referenced
Wikidata item does more for "does the AI know who Studio Luminant is" than any social
profile. Draft item to create at <https://www.wikidata.org/wiki/Special:NewItem>:

- **Label (en):** Studio Luminant
- **Description (en):** Turkish studio that designs and casts bespoke architectural relief panels
- **Description (tr):** Özel mimari rölyef panelleri tasarlayıp döken Türk stüdyo
- **Aliases:** Studio Luminant (design studio)

**Statements** (fill the bracketed items during creation):
| Property | Value |
|---|---|
| `P31` instance of | business (`Q4830453`) — optionally also manufacturer (`Q13235160`) |
| `P17` country | Turkey (`Q43`) |
| `P159` headquarters location | Sapanca [pick the Sapanca item] |
| `P131` located in the administrative territorial entity | Sakarya Province |
| `P856` official website | `https://studioluminant.com.tr` |
| `P452` industry | interior design / building materials [pick nearest] |
| `P571` inception | [founding year — confirm before adding] |
| `P154` logo image | [optional; needs a Wikimedia Commons upload] |

**References:** attach the official website (and any independent source — trade press,
Archello/ArchDaily listing, directory entry) as a reference on the key statements. An item
with independent references is far less likely to be challenged for notability.

Once the item exists, its URL is `https://www.wikidata.org/wiki/Q########` → add to `sameAs`.

## Candidate links backlog (add each once live + backlinking)

Ranked by value for this audience (architects, specifiers, hospitality/interior design):

1. **Wikidata item** — see above (create first).
2. **Google Business Profile** — the Maps place URL; anchors the local entity in Sapanca.
3. **Houzz** professional profile — high audience match.
4. **Pinterest** business profile — relief/surface visual discovery.
5. **Archello / ArchDaily / Architizer** studio profile — design-press credibility.
6. **Behance** — portfolio.
7. **Facebook Page**, **YouTube** — only if active with real content.

*(No Pinterest / Houzz / Facebook / YouTube confirmed live as of this plan — leave out until
they exist and link back.)*

## Wiring step (when a URL is ready)

Add the new URL to the `sameAs` array in **all 4 files above**, keeping the array identical.
Nothing else changes — `sameAs` is not present on any other page. Verify afterwards:

```
grep -rl '"sameAs"' --include=*.htm .        # must list exactly those 4 files
```

These edits only add URLs, so the pre-push content gate is not a concern here.
