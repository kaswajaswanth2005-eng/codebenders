import { isValidISODate } from "@/lib/financial/dates";

export type ParsedInvoiceCommand =
  | { amountPaise: number; customerQuery: string; dueDate?: string }
  | { error: string };

export type PendingInvoiceReply =
  | { kind: "confirm" }
  | { kind: "cancel" }
  | { kind: "due-date-required" }
  | { kind: "set-due-date"; dueDate: string }
  | { kind: "invalid-due-date" }
  | { kind: "none" };

export type CustomerCandidate = { id: string; name: string; companyName: string | null };

export type MatchResult =
  | { kind: "match"; customer: CustomerCandidate }
  | { kind: "choose"; options: CustomerCandidate[] }
  | { kind: "none" };

const STOP_WORDS = new Set(["ltd", "limited", "pvt", "private", "inc", "co", "company", "llc"]);

// Optional "rs." or "₹" prefix, then digits with optional comma groups and optional .xx decimals.
const AMOUNT_RE = /(?:rs\.?\s*|₹\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i;

// Separator words that introduce the customer name after the amount.
const CUSTOMER_SPLIT_RE = /\s(?:in|for|to)\s+/i;

const DUE_DATE_CLAUSE_RE =
  /\b(?:due(?:\s+date)?(?:\s+(?:is|on))?|with\s+(?:a\s+)?due\s+date)\s*:?\s*(\d{4}-\d{2}-\d{2})\b/i;

// ASCII punctuation (ranges: ! to /, : to @, [ to backtick, { to ~).
const PUNCT_RE = /[!-\/:-@\[-`{-~]/g;

export function parseInvoiceCommand(text: string): ParsedInvoiceCommand {
  const lower = text.toLowerCase();
  if (!lower.includes("invoice") && !lower.includes("bill")) {
    return { error: "I can create invoices. Try: add invoice of 5000 in ABC" };
  }

  // Do not let the unsigned amount matcher silently turn a negative value into a positive one,
  // or truncate a value that has more precision than paise can represent.
  const amountText = text.replace(DUE_DATE_CLAUSE_RE, " ");
  if (
    /(?:rs\.?\s*|â‚¹\s*)?-\s*\d/i.test(amountText) ||
    /\d[\d,]*\.\d{3,}/.test(amountText)
  ) {
    return { error: "The amount must be more than 0 and use no more than 2 decimal places" };
  }

  const amountMatch = AMOUNT_RE.exec(text);
  if (!amountMatch) {
    return { error: "Tell me the amount, for example 5000" };
  }

  const rupees = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (!(rupees > 0 && rupees <= 10000000)) {
    return { error: "The amount must be more than 0 and no more than 1,00,00,000 rupees" };
  }
  const amountPaise = Math.round(rupees * 100);

  // Customer query: words after " in ", " for " or " to " that follow the amount.
  const dueDateMatch = DUE_DATE_CLAUSE_RE.exec(text);
  const dueDate = dueDateMatch?.[1];
  if (dueDate !== undefined && !isValidISODate(dueDate)) {
    return { error: "Due date must be a real date in YYYY-MM-DD format" };
  }

  const afterAmount = text.slice(amountMatch.index + amountMatch[0].length);
  const split = CUSTOMER_SPLIT_RE.exec(afterAmount);
  let raw: string;
  if (split) {
    raw = afterAmount.slice(split.index + split[0].length);
  } else {
    // Fallback: words after the "invoice" (or "bill") keyword, with the amount removed.
    const keyword = /invoice|bill/i.exec(text);
    raw = keyword ? text.slice(keyword.index + keyword[0].length).replace(AMOUNT_RE, " ") : "";
  }

  const customerQuery = raw
    .replace(DUE_DATE_CLAUSE_RE, " ")
    .replace(/^\s*(?:of|in|for|to)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s.,;:!?'"\-]+$/, "")
    .slice(0, 80)
    .replace(/[\s.,;:!?'"\-]+$/, "")
    .trim();

  if (!customerQuery) {
    return { error: "Tell me the customer name, for example 'in ABC'" };
  }

  return {
    amountPaise,
    customerQuery,
    ...(dueDate === undefined ? {} : { dueDate }),
  };
}

/** Parses short conversational replies while an invoice proposal is still open. */
export function parsePendingInvoiceReply(text: string): PendingInvoiceReply {
  const normalized = text.toLocaleLowerCase("en-IN").trim().replace(/[.!]+$/g, "");

  if (
    /\b(?:no|without|remove)\s+(?:a\s+|the\s+)?due\s*date\b/i.test(normalized) ||
    /\b(?:don['’]?t|do\s+not)\s+(?:add|set|use)\s+(?:a\s+|the\s+)?due\s*date\b/i.test(normalized)
  ) {
    return { kind: "due-date-required" };
  }

  const dueDateMatch = DUE_DATE_CLAUSE_RE.exec(normalized);
  if (dueDateMatch) {
    return isValidISODate(dueDateMatch[1])
      ? { kind: "set-due-date", dueDate: dueDateMatch[1] }
      : { kind: "invalid-due-date" };
  }

  if (/\bdue(?:\s*date)?\b/i.test(normalized)) {
    return { kind: "invalid-due-date" };
  }

  if (/^(?:yes|yep|yeah|confirm|confirm\s+it|save|save\s+it|go\s+ahead|create\s+it|looks\s+good|ok|okay)$/i.test(normalized)) {
    return { kind: "confirm" };
  }

  if (/^(?:no|cancel|stop|never\s*mind|don['’]?t\s+save|do\s+not\s+save)$/i.test(normalized)) {
    return { kind: "cancel" };
  }

  return { kind: "none" };
}

export function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(PUNCT_RE, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t))
    .join(" ");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev: number[] = [];
  for (let j = 0; j <= b.length; j++) prev.push(j);

  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

// q and n are already normalised. Returns 0 when there is no reasonable match.
function scoreName(q: string, n: string): number {
  if (!q || !n) return 0;
  if (q === n) return 100;

  const qTokens = q.split(" ");
  const nTokens = n.split(" ");

  if (qTokens.every((t) => nTokens.includes(t))) return 80;

  if (n.startsWith(q) || qTokens[0] === nTokens[0]) return 60;

  const dist = levenshtein(q, n);
  const threshold = Math.max(q.length, n.length) >= 10 ? 3 : 2;
  if (dist <= threshold) return 40;

  return 0;
}

export function matchCustomers(query: string, customers: CustomerCandidate[]): MatchResult {
  const q = normaliseName(query);
  if (!q) return { kind: "none" };

  const scored: { customer: CustomerCandidate; score: number }[] = [];
  for (const customer of customers) {
    const names = [customer.name, customer.companyName].filter(
      (x): x is string => typeof x === "string",
    );
    let best = 0;
    for (const name of names) {
      best = Math.max(best, scoreName(q, normaliseName(name)));
    }
    if (best >= 40) scored.push({ customer, score: best });
  }

  if (scored.length === 0) return { kind: "none" };

  scored.sort(
    (a, b) => b.score - a.score || a.customer.name.localeCompare(b.customer.name),
  );

  // Exactly one strong candidate (score >= 60) is a clear match; otherwise let the user choose.
  // scored is sorted by score descending, so the single strong candidate is scored[0].
  const strongCount = scored.filter((s) => s.score >= 60).length;
  if (strongCount === 1) {
    return { kind: "match", customer: scored[0].customer };
  }

  return { kind: "choose", options: scored.slice(0, 5).map((s) => s.customer) };
}
