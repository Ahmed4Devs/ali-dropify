import type { PrismaClient } from "@/generated/prisma/client";
import type { ReactNode } from "react";

export type Locale = "en" | "ar";

export type CurrencyCode = "USD" | "SAR" | "AUD";

export type CurrencyRates = Record<CurrencyCode, number>;

export type PaymentMethodCode =
  | "STRIPE"
  | "MOYASAR"
  | "PAYPAL"
  | "PADDLE"
  | "LEMONSQUEEZY";

export type OrderStatusCode =
  | "PENDING"
  | "PAID"
  | "FULFILLED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type GlobalWithPrisma = typeof globalThis & {
  prisma?: PrismaClient;
};

export type ShippingAddress = {
  fullName: string;
  phone?: string;
  country: string;
  state: string;
  city: string;
  street: string;
  apartment?: string;
  zip: string;
};

export type ValueProposition = {
  icon: string;
  titleEn: string;
  titleAr: string;
  textEn: string;
  textAr: string;
};

export type SocialLinks = {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  x?: string;
};

export type VariantOptions = Record<string, string>;

export type LocalizedVariantOptions = Record<
  string,
  string | { en: string; ar: string }
>;

export type PaymentLineItem = {
  productId: string | null;
  title: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
};

export type OrderForPayment = {
  id: string;
  orderNumber: string;
  email: string;
  phone: string | null;
  currency: CurrencyCode;
  shippingFee: number;
  total: number;
  locale: Locale;
  items: PaymentLineItem[];
};

export type PaymentRedirect = {
  redirectUrl: string;
  checkoutId?: string;
  expiresAt?: Date;
  paymentRef?: string;
  paidInDevelopment?: boolean;
};

export type PaymentAdapter = {
  createPayment: (order: OrderForPayment) => Promise<PaymentRedirect>;
};

export type CartLine = {
  id: string;
  productId: string;
  slug: string;
  title: string;
  image: string | null;
  variantId: string | null;
  variantTitle: string | null;
  unitPriceUsd: number;
  quantity: number;
  inStock: boolean;
};

export type CartSummary = {
  id: string;
  lines: CartLine[];
  itemCount: number;
  subtotalUsd: number;
};

export type AnalyticsEvent =
  | "view_item"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase";

export type AnalyticsPayload = {
  content_ids?: string[];
  value: number;
  currency: CurrencyCode;
  quantity?: number;
  num_items?: number;
  order_id?: string;
};

export type ProductSort = "newest" | "price-asc" | "price-desc";

export type DashboardRange = 7 | 30 | 90;

export type ReviewImportRow = {
  author: string;
  rating: number;
  comment: string;
  imageUrls: string[];
};

export type CategoryData = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  image: string | null;
  sort: number;
};

export type VariantData = {
  id: string;
  titleEn: string;
  titleAr: string;
  options: VariantOptions;
  priceUsd: number | null;
  sku: string | null;
  inStock: boolean;
  trackInventory: boolean;
  stockQuantity: number;
  reservedQuantity: number;
};

export type ReviewData = {
  id: string;
  productId: string;
  userId: string | null;
  authorName: string;
  rating: number;
  comment: string;
  commentAr?: string;
  images: string[];
  source: "STORE" | "ALIEXPRESS";
  status: "PENDING" | "APPROVED" | "HIDDEN";
  createdAt: Date | string;
};

export type ProductData = {
  id: string;
  slug: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  priceUsd: number;
  compareAtUsd: number | null;
  costUsd: number;
  sku: string | null;
  images: string[];
  tags: string[];
  inStock: boolean;
  trackInventory: boolean;
  stockQuantity: number;
  reservedQuantity: number;
  isFeatured: boolean;
  aliexpressUrl: string | null;
  categoryId: string | null;
  category: CategoryData | null;
  variants: VariantData[];
  reviews?: ReviewData[];
  viewsTotal: number;
  salesCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type StoreSettingsData = {
  id: string;
  storeName: string;
  logoUrl: string | null;
  announcementEn: string | null;
  announcementAr: string | null;
  announcementEnabled: boolean;
  heroTitleEn: string | null;
  heroTitleAr: string | null;
  heroSubtitleEn: string | null;
  heroSubtitleAr: string | null;
  heroImage: string | null;
  heroCtaEn: string | null;
  heroCtaAr: string | null;
  valueProps: ValueProposition[] | null;
  shippingFlatUsd: number;
  freeShippingMinUsd: number | null;
  deliveryEstimateEn: string | null;
  deliveryEstimateAr: string | null;
  sarPerUsd: number;
  audPerUsd: number;
  supportEmail: string | null;
  supportWhatsapp: string | null;
  socialLinks: SocialLinks | null;
};

export type StoreContextValue = {
  currency: CurrencyCode;
  rates: CurrencyRates;
  cart: CartSummary;
  cartOpen: boolean;
  pending: boolean;
  setCurrency: (currency: CurrencyCode) => Promise<void>;
  setCartOpen: (open: boolean) => void;
  addToCart: (
    productId: string,
    variantId?: string | null,
    quantity?: number,
  ) => Promise<boolean>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
};

export type StoreProviderProps = {
  children: ReactNode;
  locale: Locale;
  initialCurrency: CurrencyCode;
  rates: CurrencyRates;
  initialCart: CartSummary;
};

export type ProductCardProps = {
  product: ProductData;
  locale: Locale;
  currency: CurrencyCode;
};

export type ProductPurchaseProps = {
  product: ProductData;
  locale: Locale;
  currency: CurrencyCode;
  settings: StoreSettingsData;
};

export type StoreShellProps = {
  children: ReactNode;
  locale: Locale;
  settings: StoreSettingsData;
  initialCurrency: CurrencyCode;
  initialCart: CartSummary;
};

export type AuthFormProps = { locale: Locale };

export type ReviewFormProps = {
  locale: Locale;
  productId: string;
};

export type ProductViewTrackerProps = {
  productId: string;
  priceUsd: number;
  currency: CurrencyCode;
};

export type SavedAddressData = ShippingAddress & {
  id: string;
  isDefault: boolean;
};

export type CheckoutFormProps = {
  locale: Locale;
  settings: StoreSettingsData;
  initialEmail: string;
  savedAddresses: SavedAddressData[];
};

export type PurchaseTrackerProps = {
  orderId: string;
  contentIds: string[];
  value: number;
  currency: CurrencyCode;
};

export type AccountUserData = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  image: string | null;
};

export type AccountOrderData = {
  id: string;
  orderNumber: string;
  createdAt: Date | string;
  total: number;
  currency: string;
  status: OrderStatusCode;
  paymentMethod: PaymentMethodCode | null;
  paymentUrl: string | null;
  shippingAddress: ShippingAddress;
  items: Array<{
    id: string;
    titleEn: string;
    titleAr: string | null;
    image: string | null;
    quantity: number;
    unitPrice: number;
  }>;
};

export type AccountDashboardProps = {
  locale: Locale;
  user: AccountUserData;
  addresses: SavedAddressData[];
  orders: AccountOrderData[];
};

export type ProductListProps = {
  products: ProductData[];
  categories: CategoryData[];
};

export type CategoryDraft = {
  id: string | null;
  slug: string;
  nameEn: string;
  nameAr: string;
  image: string;
  sort: string;
};

export type ProductFormProps = {
  categories: CategoryData[];
  product?: ProductData;
};

export type OptionDraft = {
  id: string;
  nameEn: string;
  nameAr: string;
  valuesEn: string;
  valuesAr: string;
};

export type VariantDraft = {
  id: string;
  titleEn: string;
  titleAr: string;
  options: VariantOptions;
  priceUsd: string;
  sku: string;
  inStock: boolean;
  trackInventory: boolean;
  stockQuantity: string;
};

export type FieldProps = {
  id: string;
  label: string;
  children: ReactNode;
  hint?: string;
};

export type OptionChoice = {
  key: string;
  valueEn: string;
  valueAr: string;
};

export type AddressInput = ShippingAddress & {
  id?: string;
  isDefault: boolean;
  locale: Locale;
};

export type AnalyticsWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
  fbq?: (command: string, event: string, payload?: Record<string, unknown>) => void;
  ttq?: { track?: (event: string, payload?: Record<string, unknown>) => void };
};
