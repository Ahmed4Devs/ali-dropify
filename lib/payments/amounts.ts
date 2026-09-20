export function decimalToMinorUnits(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const units = Number.parseInt(whole, 10) * 100 +
    Number.parseInt(fraction.padEnd(2, "0"), 10);
  return Number.isSafeInteger(units) ? units : null;
}
