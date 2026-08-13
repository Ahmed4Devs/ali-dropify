import type { CurrencyCode, Locale } from "@/types";

const currencyRates: Record<CurrencyCode, number> = {
  USD: 1,
  SAR: 3.75,
  AUD: 1.55,
};

export function convertFromUsd(
  cents: number,
  currency: CurrencyCode,
  rates?: Partial<Record<CurrencyCode, number>>,
) {
  return Math.round(cents * (rates?.[currency] ?? currencyRates[currency]));
}

export function formatMoney(
  minorUnits: number,
  currency: CurrencyCode,
  locale: Locale,
) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minorUnits / 100);
}

export function formatUsdPrice(
  usdCents: number,
  currency: CurrencyCode,
  locale: Locale,
  rates?: Partial<Record<CurrencyCode, number>>,
) {
  return formatMoney(convertFromUsd(usdCents, currency, rates), currency, locale);
}

export function getCurrencyRate(currency: CurrencyCode, sar = 3.75, aud = 1.55) {
  if (currency === "SAR") return sar;
  if (currency === "AUD") return aud;
  return 1;
}
