/**
 * Converts a rupee amount to integer paise. Rejects non-finite input.
 */
export function rupeesToPaise(input: number): number {
  if (!Number.isFinite(input)) {
    throw new RangeError("Rupee amount must be a finite number");
  }
  return Math.round(input * 100);
}

/**
 * Formats integer paise as Indian-grouped rupees, e.g. 1000000 -> "₹10,000".
 * Whole rupees are shown without decimals; otherwise two decimals are shown.
 */
export function formatINR(paise: number): string {
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError("Paise amount must be a safe integer");
  }
  const negative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainder = absPaise % 100;
  const grouped = groupIndian(rupees.toString());
  const body =
    remainder === 0 ? grouped : `${grouped}.${remainder.toString().padStart(2, "0")}`;
  return `${negative ? "-" : ""}₹${body}`;
}

function groupIndian(digits: string): string {
  if (digits.length <= 3) {
    return digits;
  }
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const restGrouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${restGrouped},${last3}`;
}
