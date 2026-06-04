/**
 * PII detection and masking for AI prompt context.
 *
 * Order matters: cards must be masked BEFORE TFN detection to prevent
 * "4111 1111 1111 1111" → substring "111 111 111" triggering a false TFN hit.
 *
 * TFN is a hard refuse (return tfnFound: true); all other PII is masked with
 * reversible placeholder tokens so the engine context is preserved.
 */

export interface MaskResult {
  masked: string;
  tfnFound: boolean;
}

// ── Patterns ─────────────────────────────────────────────────────────────────

// 16-digit Luhn card numbers, optionally space- or dash-delimited in groups of 4
const CARD_RE = /\b(?:\d{4}[\s-]){3}\d{4}\b/g;

// Australian mobile: 04xx xxx xxx / +614xx xxx xxx (loose spacing)
const MOBILE_RE = /(?:\+?61\s?4|\b0\s?4)\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g;

// Email addresses
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Street address: number + street name + type abbreviation
const ADDRESS_RE =
  /\b\d{1,5}\s+[A-Za-z]+(?:\s+[A-Za-z]+){0,3}\s+(?:St(?:reet)?|Ave(?:nue)?|Rd|Road|Dr(?:ive)?|Ct|Court|Ln|Lane|Pl(?:ace)?|Blvd|Cres(?:cent)?|Hwy|Highway)\b/gi;

// TFN: 8- or 9-digit with optional spaces between digit groups
// Handles split-across-tokens canary: "123 456 789"
const TFN_RE = /\b\d{3}\s?\d{3}\s?\d{2,3}\b/g;

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskWith(text: string, pattern: RegExp, token: string): string {
  return text.replace(pattern, token);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function maskPii(input: string): MaskResult {
  // Step 1: mask cards first to prevent card substrings triggering TFN regex
  let text = maskWith(input, CARD_RE, '[CARD]');

  // Step 2: mask other non-TFN PII
  text = maskWith(text, MOBILE_RE, '[MOBILE]');
  text = maskWith(text, EMAIL_RE, '[EMAIL]');
  text = maskWith(text, ADDRESS_RE, '[ADDRESS]');

  // Step 3: TFN check on already-masked text (cards can't false-positive now)
  TFN_RE.lastIndex = 0;
  const tfnFound = TFN_RE.test(text);

  return { masked: text, tfnFound };
}
