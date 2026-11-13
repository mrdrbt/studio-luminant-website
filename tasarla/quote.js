// quote.js -- the quote request: an architect writes a wall's size and their contact, and asks for its price. Pure, no DOM; app.js wires it.
// No price ever reaches this page (#121): the request carries the wall to the CRM, and the price goes back by email as a PDF offer.

export const BUYER_TYPES = ["firm", "person"];
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX = { name: 120, company: 160, email: 160, phone: 40, note: 1000 };
const PHONE_MIN_DIGITS = 7;   // shortest real number with its area code; fewer is a typo, not a phone
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"];

// Which face the page opens with. A visitor with no code gets the quote screen; a code (a sheet link, a saved wall) opens the whole composer, and
// the client view never sees the form. mode= says it outright. The inline script in index.html repeats this rule so the page does not flash: change both.
export function isQuoteMode(search) {
  const p = new URLSearchParams(search);
  if (p.get("view") === "client") return false;
  const mode = p.get("mode");
  if (mode === "quote") return true;
  if (mode === "full") return false;
  return !p.get("c");
}

// ?d=hocket or ?d=HOC: the design a page or reel links to. Null when it names nothing on offer.
export function designFromSearch(search, config, kits) {
  const raw = (new URLSearchParams(search).get("d") ?? "").trim();
  if (!raw) return null;
  const code = config.slugs?.[raw.toLowerCase()] ?? raw.toUpperCase();
  return kits[code] ? code : null;
}

// Control characters out and spaces collapsed; a note keeps its line breaks.
export const cleanField = (value, max) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const cleanNote = (value) => String(value ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").replace(/[ ]+/g, " ").trim().slice(0, MAX.note);

export function cleanQuote(f) {
  return {
    name: cleanField(f.name, MAX.name), company: cleanField(f.company, MAX.company), email: cleanField(f.email, MAX.email),
    phone: cleanField(f.phone, MAX.phone), note: cleanNote(f.note), buyer: f.buyer ?? "", consent: f.consent === true, honeypot: f.honeypot ?? "",
  };
}

// {field: strings key} for what stops the request; empty = it can go. Name, email, phone and who it is for are required,
// and the office or firm when it is sent for a firm (Burak 2026-11-13); only the note stays optional.
export function checkQuote(fields) {
  const f = cleanQuote(fields), errors = {};
  if (!f.name) errors.name = "quote_err_name";
  if (!EMAIL_RE.test(f.email)) errors.email = "quote_err_email";
  if (!BUYER_TYPES.includes(f.buyer)) errors.buyer = "quote_err_buyer";
  if (f.buyer === "firm" && !f.company) errors.company = "quote_err_company";
  if (f.phone.replace(/\D/g, "").length < PHONE_MIN_DIGITS) errors.phone = "quote_err_phone";
  return errors;
}

// The CRM task's text, for Burak to price from. lead-intake has no column for the wall or the consent, so they travel here, as the website's forms do.
// wall = {design, code, link, locale, wall_text, wall_m2, supply_m2, modules, cut, moq, below_min, per_block}; all figures already formatted.
export function quoteMessage(f, wall, consentVersion, now) {
  const size = wall.per_block
    ? ["Size: priced per block; the opening size is in the note"]
    : [`Wall: ${wall.wall_text} = ${wall.wall_m2} m2`, `Supply: ${wall.supply_m2} m2, ${wall.modules} modules, ${wall.cut} cut`,
       wall.moq === null ? "Minimum: not set" : wall.below_min ? `Minimum: BELOW ${wall.moq} m2, reply by hand as Bespoke (#122)` : `Minimum: met (${wall.moq} m2)`];
  return [
    "Composer price request", `Design: ${wall.design}`, ...(wall.finish ? [`Finish: ${wall.finish}`] : []), ...size, `Code: ${wall.code}`, `Link: ${wall.link}`, `Language: ${wall.locale}`,
    `Buyer: ${f.buyer}`,
    f.consent ? `Marketing consent: YES, unticked box ticked, consent text of ${consentVersion}, ${now.toISOString()}` : "Marketing consent: no",
    ...(f.note ? [`Note: ${f.note}`] : []),
  ].join("\n");
}

// The body lead-intake reads. It drops anything carrying url or website as a bot, so the link stays inside the message.
export function quotePayload(fields, wall, { consentVersion, search = "", now = new Date() }) {
  const f = cleanQuote(fields), params = new URLSearchParams(search);
  const utm = Object.fromEntries(UTM_KEYS.filter((k) => params.get(k)).map((k) => [k, params.get(k)]));
  return {
    name: f.name, email: f.email, ...(f.company ? { company: f.company } : {}), ...(f.phone ? { phone: f.phone } : {}),
    project_type: "Studio Designs quote", source: `composer-quote:${wall.design_code}`,
    message: quoteMessage(f, wall, consentVersion, now), _gotcha: f.honeypot, ...utm,
  };
}

// Posts to the CRM and, never awaited, to the email backup. {ok, reason}; it never throws, so the form can always say what happened.
export async function sendQuote(fetchFn, cfg, payload) {
  if (!cfg?.endpoint) return { ok: false, reason: "no_endpoint" };
  if (cfg.backup) {
    const body = new FormData();
    for (const [k, v] of Object.entries(payload)) body.append(k, v);
    Promise.resolve(fetchFn(cfg.backup, { method: "POST", headers: { Accept: "application/json" }, body })).catch(() => {});
  }
  try {
    const res = await fetchFn(cfg.endpoint, { method: "POST", headers: { "Content-Type": "application/json", "x-sl-key": cfg.key }, body: JSON.stringify(payload) });
    return { ok: res.ok, reason: res.ok ? null : `http_${res.status}` };
  } catch (e) {
    return { ok: false, reason: "network" };
  }
}
