/**
 * SkyHomesAI — parse natural-language property questions and search listings.
 */

export type ChatProperty = {
  property_id: number | string;
  title?: string;
  property_type?: string;
  listing_type?: string;
  address?: string;
  location?: string;
  monthly_rent?: number | string;
  sale_price?: number | string;
  deposit_amount?: number | string;
  images?: unknown;
  description?: string;
  latitude?: number | string;
  longitude?: number | string;
};

export type SkyHomesAIReply = {
  text: string;
  houses?: ChatProperty[];
};

type ParsedQuery = {
  isSearch: boolean;
  locations: string[];
  nearTerms: string[];
  maxPrice?: number;
  minPrice?: number;
  listingType: "rent" | "sale" | "any";
  propertyType?: string;
  freeText: string;
};

const IMAGE_BASE = "https://bombadir.pythonanywhere.com/static/images/";

const AREA_HINTS = [
  "kilimani", "westlands", "kileleshwa", "lavington", "parklands", "karen",
  "rongai", "ruaka", "ruiru", "thika", "kiambu", "ngong", "athi river",
  "mombasa", "nakuru", "kisumu", "eldoret", "nairobi", "langata", "south b",
  "south c", "embakasi", "kasarani", "donholm", "buruburu", "umoja", "ruaraka",
  "wood avenue", "garden city", "upper hill", "hurlingham", "yaya", "madaraka",
  "ngong road", "thika road", "waiyaki way", "mombasa road", "outer ring",
  "juja", "thika town", "syokimau", "kitengela", "machakos",
];

const PROPERTY_TYPES: Record<string, string[]> = {
  apartment: ["apartment", "flat"],
  house: ["house", "bungalow", "maisonette", "villa"],
  bedsitter: ["bedsitter", "bedsitters", "studio"],
  duplex: ["duplex"],
  townhouse: ["townhouse", "town house"],
};

const NEAR_ALIASES: Record<string, string[]> = {
  school: ["school", "university", "college", "academy"],
  road: ["road", "highway", "avenue", "street", "main road", "tarmac"],
  mall: ["mall", "shopping", "supermarket"],
  hospital: ["hospital", "clinic", "medical"],
  airport: ["airport", "jkia"],
  gym: ["gym", "fitness"],
};

export function parseAmount(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const str = String(value).trim().toLowerCase().replace(/,/g, "");
  if (!str) return 0;

  const shorthand = str.match(/^([\d.]+)\s*([mkb])$/);
  if (shorthand) {
    const num = parseFloat(shorthand[1]);
    const suffix = shorthand[2];
    if (suffix === "k") return num * 1_000;
    if (suffix === "m") return num * 1_000_000;
    if (suffix === "b") return num * 1_000_000_000;
  }

  const cleaned = str.replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Normalize `listing_type` from /api/getproperties (e.g. "sale", "for sale", "rent", "for rent"). */
export function normalizeListingType(value: unknown): "sale" | "rent" | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;

  const compact = raw.replace(/[\s_-]+/g, "");
  if (
    compact === "sale" ||
    compact === "forsale" ||
    compact.includes("sell") ||
    /\bfor\s*sale\b/.test(raw) ||
    /\bon\s*sale\b/.test(raw) ||
    (raw.includes("sale") && !raw.includes("rent"))
  ) {
    return "sale";
  }
  if (
    compact === "rent" ||
    compact === "forrent" ||
    raw.includes("lease") ||
    /\bfor\s*rent\b/.test(raw) ||
    /\bto\s*let\b/.test(raw) ||
    (raw.includes("rent") && !raw.includes("sale"))
  ) {
    return "rent";
  }
  return null;
}

/**
 * Rent vs sale — driven by API `listing_type`.
 * Price fields are used as fallback when `listing_type` is missing or unrecognized.
 *
 * Fallback priority:
 *   1. sale_price only        → sale
 *   2. monthly_rent only      → rent
 *   3. both present           → sale wins (sale listings sometimes carry both fields)
 *   4. neither present        → rent (safe default)
 */
export function resolveListingKind(
  property: Pick<ChatProperty, "listing_type" | "sale_price" | "monthly_rent">
): "sale" | "rent" {
  // 1. Trust listing_type from the API first
  const fromApi = normalizeListingType(property?.listing_type);
  if (fromApi) return fromApi;

  // 2. Infer from price fields
  const salePrice = parseAmount(property?.sale_price);
  const rentPrice = parseAmount(property?.monthly_rent);

  if (salePrice > 0 && rentPrice <= 0) return "sale";
  if (rentPrice > 0 && salePrice <= 0) return "rent";

  // 3. Both present: sale_price wins
  if (salePrice > 0 && rentPrice > 0) return "sale";

  // 4. Neither present: default to rent
  return "rent";
}

export type ListingPriceFields = Pick<
  ChatProperty,
  "listing_type" | "sale_price" | "monthly_rent"
>;

export function isSaleListing(h: ListingPriceFields): boolean {
  return resolveListingKind(h) === "sale";
}

export function formatKesPrice(amount: number, emptyLabel = "Contact agent for price"): string {
  return amount > 0 ? `KES ${amount.toLocaleString()}` : emptyLabel;
}

export function getDisplayPrice(h: ChatProperty): { amount: number; label: string } {
  const sale = isSaleListing(h);
  const amount = sale ? parseAmount(h.sale_price) : parseAmount(h.monthly_rent);
  return { amount, label: sale ? "For Sale" : "/mo" };
}

export function getPropertyImage(images: unknown): string {
  if (!images) return "";
  const pick = (raw: string) => {
    const v = raw.trim();
    if (!v) return "";
    return v.startsWith("http") ? v : `${IMAGE_BASE}${v}`;
  };
  if (Array.isArray(images) && images.length > 0) return pick(String(images[0]));
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed) && parsed.length > 0) return pick(String(parsed[0]));
    } catch {
      const first = images.split(",")[0]?.trim();
      if (first) return pick(first);
    }
  }
  return "";
}

function parseBudget(text: string): { min?: number; max?: number } {
  const t = text.toLowerCase();
  const out: { min?: number; max?: number } = {};

  const parseNum = (raw: string) => {
    const n = raw.replace(/,/g, "").trim();
    if (n.endsWith("k")) return Number(n.slice(0, -1)) * 1000;
    if (n.endsWith("m")) return Number(n.slice(0, -1)) * 1_000_000;
    return Number(n);
  };

  const under = t.match(
    /(?:under|below|less than|max|maximum|upto|up to|budget of|budget)\s*(?:kes|ksh)?\s*([\d,.]+[km]?)/i
  );
  if (under) out.max = parseNum(under[1]);

  const over = t.match(
    /(?:above|over|more than|min|minimum|from)\s*(?:kes|ksh)?\s*([\d,.]+[km]?)/i
  );
  if (over) out.min = parseNum(over[1]);

  const between = t.match(
    /between\s*(?:kes|ksh)?\s*([\d,.]+[km]?)\s*(?:and|-)\s*(?:kes|ksh)?\s*([\d,.]+[km]?)/i
  );
  if (between) {
    out.min = parseNum(between[1]);
    out.max = parseNum(between[2]);
  }

  const plain = t.match(/(?:kes|ksh)\s*([\d,.]+[km]?)/i);
  if (plain && out.max === undefined && out.min === undefined) {
    out.max = parseNum(plain[1]);
  }

  return out;
}

function parseListingType(text: string): "rent" | "sale" | "any" {
  const t = text.toLowerCase();
  if (/\b(buy|purchase|for sale|on sale|sale|selling)\b/.test(t)) return "sale";
  if (/\b(rent|rental|lease|to let|for rent)\b/.test(t)) return "rent";
  return "any";
}

function parsePropertyType(text: string): string | undefined {
  const t = text.toLowerCase();
  for (const [key, words] of Object.entries(PROPERTY_TYPES)) {
    if (words.some((w) => t.includes(w))) return key;
  }
  return undefined;
}

function parseNearTerms(text: string): string[] {
  const t = text.toLowerCase();
  const found: string[] = [];
  for (const [key, words] of Object.entries(NEAR_ALIASES)) {
    if (words.some((w) => t.includes(w)) || t.includes(`near ${key}`) || t.includes(`close to ${key}`)) {
      found.push(key);
    }
  }
  if (/\bnear\b|\bclose to\b|\baround\b|\bnext to\b/.test(t) && found.length === 0) {
    const m = t.match(/(?:near|close to|around|next to)\s+(?:a\s+|the\s+)?([a-z0-9\s'-]{3,40})/i);
    if (m?.[1]) found.push(m[1].trim());
  }
  return found;
}

function parseLocations(text: string): string[] {
  const t = text.toLowerCase();
  const found = new Set<string>();

  for (const area of AREA_HINTS) {
    if (t.includes(area)) found.add(area);
  }

  const patterns = [
    /(?:in|at|around|within|located in)\s+([a-z0-9\s'-]{2,40})/gi,
    /(?:near|close to|next to)\s+([a-z0-9\s'-]{2,40})/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const chunk = m[1]
        .replace(/\b(rent|sale|house|apartment|property|properties|homes?|budget|under|below)\b/gi, "")
        .trim();
      if (chunk.length >= 3 && chunk.length <= 40) found.add(chunk);
    }
  }

  return [...found];
}

function parseQuery(text: string): ParsedQuery {
  const t = text.toLowerCase().trim();
  const budget = parseBudget(t);
  const searchVerbs =
    /\b(find|search|show|look|list|get|any|available|recommend|suggest|houses?|homes?|properties|apartments?)\b/;
  const locationCue =
    /\b(in|at|near|around|close to|location|area|kilimani|westlands|nairobi|mombasa|road|school|juja)\b/;
  const priceCue = /\b(price|rent|budget|under|below|kes|ksh|cheap|affordable)\b/;

  const isSearch = Boolean(
    (searchVerbs.test(t) &&
      (locationCue.test(t) || priceCue.test(t) || parsePropertyType(t) !== undefined)) ||
      (locationCue.test(t) && /\b(house|home|apartment|property|rent|buy)\b/.test(t)) ||
      priceCue.test(t)
  );

  return {
    isSearch,
    locations: parseLocations(t),
    nearTerms: parseNearTerms(t),
    maxPrice: budget.max,
    minPrice: budget.min,
    listingType: parseListingType(t),
    propertyType: parsePropertyType(t),
    freeText: t,
  };
}

function haystack(h: ChatProperty): string {
  return [
    h.title,
    h.address,
    h.location,
    h.property_type,
    h.description,
    h.listing_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scoreProperty(h: ChatProperty, q: ParsedQuery): number {
  const text = haystack(h);
  let score = 0;

  for (const loc of q.locations) {
    if (text.includes(loc)) score += 5;
  }

  for (const near of q.nearTerms) {
    const aliases = NEAR_ALIASES[near] || [near];
    if (aliases.some((a) => text.includes(a))) score += 3;
  }

  if (q.propertyType) {
    const types = PROPERTY_TYPES[q.propertyType] || [q.propertyType];
    if (types.some((t) => text.includes(t))) score += 4;
  }

  const { amount } = getDisplayPrice(h);
  if (q.maxPrice !== undefined && q.maxPrice > 0) {
    if (amount > 0 && amount <= q.maxPrice) score += 4;
    else if (amount > q.maxPrice) score -= 6;
  }
  if (q.minPrice !== undefined && q.minPrice > 0) {
    if (amount >= q.minPrice) score += 2;
    else if (amount > 0 && amount < q.minPrice) score -= 4;
  }

  if (q.listingType === "rent" && !isSaleListing(h)) score += 2;
  if (q.listingType === "sale" && isSaleListing(h)) score += 2;

  if (q.isSearch && score === 0 && q.locations.length === 0 && q.nearTerms.length === 0) {
    score = 1;
  }

  return score;
}

export function searchProperties(
  properties: ChatProperty[],
  userText: string,
  limit = 6
): { matches: ChatProperty[]; query: ParsedQuery } {
  const query = parseQuery(userText);

  if (!query.isSearch) {
    return { matches: [], query };
  }

  const scored = properties
    .map((h) => ({ h, score: scoreProperty(h, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const minScore = query.locations.length > 0 || query.nearTerms.length > 0 ? 3 : 1;
  const matches = scored.filter((x) => x.score >= minScore).map((x) => x.h).slice(0, limit);

  return { matches, query };
}

function formatLocationLabel(loc: string): string {
  return loc
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildSearchSummary(matches: ChatProperty[], q: ParsedQuery, total: number): string {
  if (matches.length === 0) {
    if (q.locations.length > 0) {
      const place = formatLocationLabel(q.locations[0]);
      return `We don't have any listings in ${place} on SkyHomes right now. Try another area or browse all homes on the Explore tab.`;
    }

    const parts: string[] = [];
    if (q.maxPrice) parts.push(`under KES ${q.maxPrice.toLocaleString()}`);
    if (q.listingType !== "any") parts.push(q.listingType === "sale" ? "for sale" : "for rent");
    const hint = parts.length ? ` ${parts.join(" ")}` : "";
    return `I couldn't find listings${hint} right now. Try another area, a higher budget, or browse Explore on the map tab.`;
  }

  const bits: string[] = [];
  if (q.locations.length) bits.push(q.locations.join(", "));
  if (q.nearTerms.length) bits.push(`near ${q.nearTerms.join(", ")}`);
  if (q.maxPrice) bits.push(`under KES ${q.maxPrice.toLocaleString()}`);
  if (q.listingType === "rent") bits.push("for rent");
  if (q.listingType === "sale") bits.push("for sale");
  if (q.propertyType) bits.push(q.propertyType);

  const where = bits.length ? ` (${bits.join(" · ")})` : "";
  const more = total > matches.length ? ` Showing top ${matches.length} of ${total} matches.` : "";
  return `Here ${matches.length === 1 ? "is" : "are"} ${matches.length} ${matches.length === 1 ? "home" : "homes"} I found${where}. Tap a card for full details and map location.${more}`;
}

export function processSkyHomesAIMessage(
  userText: string,
  properties: ChatProperty[]
): SkyHomesAIReply {
  const t = userText.toLowerCase().trim();

  if (/^(hi|hello|hey|mambo|habari)\b/.test(t)) {
    return {
      text:
        "Hi! I'm SkyHomesAI. Ask me things like:\n• Houses in Kilimani under 40k\n• Apartments near a school in Westlands\n• Homes for sale in Ngong Road\n• Cheap rentals in South B",
    };
  }

  if (/help|what can you|how do i|assist/.test(t)) {
    return {
      text:
        "I can search SkyHomes listings by:\n• Location (area, estate, road)\n• Budget / monthly rent or sale price\n• Rent vs buy\n• Property type (apartment, bedsitter, duplex…)\n• Near schools, roads, malls, hospitals\n\nExample: \"Show me apartments in Kilimani under 35000 near main road\"",
    };
  }

  if (/apply|application|how to apply/.test(t)) {
    return {
      text:
        "Open any house, tap View Details, then Apply for this House (or Express Interest for sale listings). You need to be signed in.",
    };
  }

  if (/save|saved|favourite|favorite/.test(t)) {
    return {
      text: "Tap the heart on a listing to save it. View saved homes from the Saved tab when you're logged in.",
    };
  }

  if (/map|location|where is|coordinates/.test(t) && !parseQuery(t).isSearch) {
    return {
      text:
        'Each property\'s detail page has a map you can open. Try Explore tab for the full map view, or ask me: "houses in Westlands" and I\'ll list matches here.',
    };
  }

  const { matches, query } = searchProperties(properties, userText);

  if (query.isSearch) {
    const allScored = properties.filter((h) => scoreProperty(h, query) > 0);
    return {
      text: buildSearchSummary(matches, query, allScored.length),
      houses: matches,
    };
  }

  if (/rent|buy|sale|house|home|property/.test(t)) {
    return {
      text: 'Tell me what you need — e.g. "2 bedroom in Ruaka under 25k" or "houses for sale near Thika Road".',
    };
  }

  return {
    text: "I can search homes by area, price, rent/sale, and what's nearby (schools, roads, malls). What are you looking for?",
  };
}

export const SKYHOMESAI_QUICK_PROMPTS: string[] = [
  "Houses in Kilimani under 40k",
  "Apartments near school in Westlands",
  "Homes for sale on Ngong Road",
  "Cheap rent in South B",
];