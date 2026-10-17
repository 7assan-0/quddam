/** Consistent Latin numerals for display, including Arabic/Persian digit strings. */
const latinNumber = new Intl.NumberFormat("en-US");

export function formatNumber(value: number | bigint | string): string {
  const text = typeof value === "string" ? value : latinNumber.format(value);
  return text.replace(/[٠-٩۰-۹]/g, digit => {
    const code = digit.charCodeAt(0);
    return String(code - (code <= 0x0669 ? 0x0660 : 0x06f0));
  }).replace(/٬/g, ",").replace(/٫/g, ".");
}
