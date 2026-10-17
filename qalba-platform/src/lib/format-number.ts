/** Consistent Latin numerals for display, including Arabic/Persian digit strings. */
const latinNumber = new Intl.NumberFormat("en-US");

export function formatNumber(value: number | bigint | string, options?: Intl.NumberFormatOptions): string {
  const text = typeof value === "string" ? value : options ? new Intl.NumberFormat("en-US", options).format(value) : latinNumber.format(value);
  return text.replace(/[٠-٩۰-۹]/g, digit => {
    const code = digit.charCodeAt(0);
    return String(code - (code <= 0x0669 ? 0x0660 : 0x06f0));
  }).replace(/٬/g, ",").replace(/٫/g, ".");
}
