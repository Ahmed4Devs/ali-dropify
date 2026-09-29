/** Initial sales area until destination-specific shipping prices are configured. */
export const SAUDI_SHIPPING_COUNTRY = "Saudi Arabia";

export function isSupportedShippingCountry(value: string) {
  return ["sa", "saudi arabia", "kingdom of saudi arabia", "السعودية", "المملكة العربية السعودية"]
    .includes(value.trim().toLocaleLowerCase());
}
