import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import {
  OrderStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
  ReviewSource,
  ReviewStatus,
  Role,
} from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const adminId = "seed-user-admin";
const customerId = "seed-user-customer";
const categoryIds = {
  apparel: "seed-category-apparel",
  accessories: "seed-category-accessories",
  tech: "seed-category-tech",
};

const productIds = {
  tee: "seed-product-active-tee",
  hoodie: "seed-product-everyday-hoodie",
  joggers: "seed-product-relaxed-joggers",
  dress: "seed-product-woven-midi-dress",
  tote: "seed-product-canvas-carryall",
  watch: "seed-product-smart-watch",
  earbuds: "seed-product-wireless-earbuds",
  charger: "seed-product-portable-charger",
  bottle: "seed-product-insulated-bottle",
  organizer: "seed-product-travel-organizer",
};

const daysAgo = (days: number, hour = 12) => {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
};

const picture = (seed: string, width = 1000, height = 1200) =>
  `https://picsum.photos/seed/${seed}/${width}/${height}`;

const productSeeds = [
  {
    id: productIds.tee,
    slug: "classic-active-tee",
    titleEn: "Classic Active Tee",
    titleAr: "تيشيرت رياضي كلاسيكي",
    descriptionEn:
      "A breathable everyday tee with a soft hand feel, clean seams, and an easy unisex fit.",
    descriptionAr:
      "تيشيرت يومي خفيف بخامة ناعمة ودرزات مرتبة وقصة مريحة تناسب الجميع.",
    priceUsd: 2499,
    compareAtUsd: 3299,
    costUsd: 820,
    images: [picture("active-tee-front"), picture("active-tee-detail")],
    tags: ["bestseller", "everyday", "unisex"],
    inStock: true,
    isFeatured: true,
    aliexpressUrl: "https://www.aliexpress.com/item/1005000000001.html",
    categoryId: categoryIds.apparel,
    viewsTotal: 2840,
    salesCount: 186,
    createdAt: daysAgo(110),
  },
  {
    id: productIds.hoodie,
    slug: "everyday-cloud-hoodie",
    titleEn: "Everyday Cloud Hoodie",
    titleAr: "هودي يومي ناعم",
    descriptionEn:
      "Midweight brushed fleece, a roomy hood, and a relaxed shape made for layering.",
    descriptionAr:
      "هودي متوسط السماكة ببطانة ناعمة وقبعة واسعة وقصة مريحة مناسبة للطبقات.",
    priceUsd: 5499,
    compareAtUsd: 6999,
    costUsd: 1920,
    images: [picture("cloud-hoodie-stone"), picture("cloud-hoodie-navy")],
    tags: ["cozy", "layering"],
    inStock: true,
    isFeatured: true,
    aliexpressUrl: "https://www.aliexpress.com/item/1005000000002.html",
    categoryId: categoryIds.apparel,
    viewsTotal: 2190,
    salesCount: 132,
    createdAt: daysAgo(91),
  },
  {
    id: productIds.joggers,
    slug: "relaxed-travel-joggers",
    titleEn: "Relaxed Travel Joggers",
    titleAr: "بنطال سفر مريح",
    descriptionEn:
      "Tapered stretch joggers with deep pockets and a smooth waistband for long days on the move.",
    descriptionAr:
      "بنطال مرن بقصة مدببة وجيوب عميقة وحزام خصر ناعم لأيام السفر الطويلة.",
    priceUsd: 4299,
    compareAtUsd: 5599,
    costUsd: 1475,
    images: [picture("travel-joggers-black"), picture("travel-joggers-oat")],
    tags: ["travel", "stretch"],
    inStock: true,
    isFeatured: false,
    aliexpressUrl: "https://www.aliexpress.com/item/1005000000003.html",
    categoryId: categoryIds.apparel,
    viewsTotal: 1675,
    salesCount: 94,
    createdAt: daysAgo(78),
  },
  {
    id: productIds.dress,
    slug: "woven-midi-dress",
    titleEn: "Woven Midi Dress",
    titleAr: "فستان ميدي منسوج",
    descriptionEn:
      "A softly structured midi dress with an adjustable waist and an elegant, easy drape.",
    descriptionAr:
      "فستان ميدي بقصة انسيابية أنيقة وخصر قابل للتعديل لراحة طوال اليوم.",
    priceUsd: 5999,
    compareAtUsd: 7999,
    costUsd: 2180,
    images: [picture("midi-dress-black"), picture("midi-dress-olive")],
    tags: ["occasion", "modest"],
    inStock: true,
    isFeatured: true,
    aliexpressUrl: "https://www.aliexpress.com/item/1005000000004.html",
    categoryId: categoryIds.apparel,
    viewsTotal: 2460,
    salesCount: 121,
    createdAt: daysAgo(64),
  },
  {
    id: productIds.tote,
    slug: "canvas-carryall-tote",
    titleEn: "Canvas Carryall Tote",
    titleAr: "حقيبة كانفس واسعة",
    descriptionEn:
      "A sturdy zip-top tote with organized inner pockets and comfortable shoulder straps.",
    descriptionAr:
      "حقيبة كانفس متينة بسحاب علوي وجيوب داخلية منظمة وأحزمة كتف مريحة.",
    priceUsd: 3999,
    compareAtUsd: 4999,
    costUsd: 1280,
    images: [picture("canvas-tote-sand"), picture("canvas-tote-inside")],
    tags: ["bag", "work", "travel"],
    inStock: true,
    isFeatured: false,
    aliexpressUrl: "https://www.aliexpress.com/item/1005000000005.html",
    categoryId: categoryIds.accessories,
    viewsTotal: 1330,
    salesCount: 77,
    createdAt: daysAgo(55),
  },
  {
    id: productIds.watch,
    slug: "pulse-smart-watch",
    titleEn: "Pulse Smart Watch",
    titleAr: "ساعة بالس الذكية",
    descriptionEn:
      "A bright touch display, activity and sleep tracking, call alerts, and up to seven days of battery life.",
    descriptionAr:
      "شاشة لمس واضحة وتتبع للنشاط والنوم وتنبيهات للمكالمات وبطارية تدوم حتى سبعة أيام.",
    priceUsd: 6999,
    compareAtUsd: 9999,
    costUsd: 2675,
    images: [picture("pulse-watch-face", 1200, 1200), picture("pulse-watch-wrist", 1200, 1200)],
    tags: ["smart", "fitness", "gift"],
    inStock: true,
    isFeatured: true,
    aliexpressUrl: "https://www.aliexpress.com/item/1005000000006.html",
    categoryId: categoryIds.tech,
    viewsTotal: 4210,
    salesCount: 243,
    createdAt: daysAgo(47),
  },
  {
    id: productIds.earbuds,
    slug: "pocket-wireless-earbuds",
    titleEn: "Pocket Wireless Earbuds",
    titleAr: "سماعات لاسلكية صغيرة",
    descriptionEn:
      "Comfortable low-profile earbuds with clear calls, touch controls, and a compact charging case.",
    descriptionAr:
      "سماعات مريحة بتصميم صغير ومكالمات واضحة وتحكم باللمس وعلبة شحن مدمجة.",
    priceUsd: 4999,
    compareAtUsd: 6499,
    costUsd: 1840,
    images: [picture("wireless-earbuds-case", 1200, 1200), picture("wireless-earbuds-detail", 1200, 1200)],
    tags: ["audio", "commute"],
    inStock: true,
    isFeatured: true,
    aliexpressUrl: "https://www.aliexpress.com/item/1005000000007.html",
    categoryId: categoryIds.tech,
    viewsTotal: 3065,
    salesCount: 169,
    createdAt: daysAgo(39),
  },
  {
    id: productIds.charger,
    slug: "compact-power-bank",
    titleEn: "Compact Power Bank",
    titleAr: "بطارية متنقلة مدمجة",
    descriptionEn:
      "Pocket-sized backup power with fast USB-C charging and a clear battery-level display.",
    descriptionAr:
      "بطارية احتياطية بحجم الجيب وشحن USB-C سريع وشاشة واضحة لمستوى الطاقة.",
    priceUsd: 3499,
    compareAtUsd: 4499,
    costUsd: 1125,
    images: [picture("power-bank-front", 1200, 1200), picture("power-bank-cable", 1200, 1200)],
    tags: ["charging", "travel"],
    inStock: false,
    isFeatured: false,
    aliexpressUrl: "https://www.aliexpress.com/item/1005000000008.html",
    categoryId: categoryIds.tech,
    viewsTotal: 1180,
    salesCount: 58,
    createdAt: daysAgo(31),
  },
  {
    id: productIds.bottle,
    slug: "insulated-day-bottle",
    titleEn: "Insulated Day Bottle",
    titleAr: "قارورة يومية عازلة",
    descriptionEn:
      "A leak-resistant stainless bottle that keeps drinks cold and fits standard cup holders.",
    descriptionAr:
      "قارورة ستانلس مقاومة للتسرب تحفظ المشروبات باردة وتناسب حاملات الأكواب.",
    priceUsd: 2499,
    compareAtUsd: 3199,
    costUsd: 760,
    images: [picture("day-bottle-sage", 1200, 1200), picture("day-bottle-lid", 1200, 1200)],
    tags: ["hydration", "outdoors"],
    inStock: true,
    isFeatured: true,
    aliexpressUrl: "https://www.aliexpress.com/item/1005000000009.html",
    categoryId: categoryIds.accessories,
    viewsTotal: 1870,
    salesCount: 143,
    createdAt: daysAgo(23),
  },
  {
    id: productIds.organizer,
    slug: "modular-travel-organizer",
    titleEn: "Modular Travel Organizer",
    titleAr: "منظم سفر متعدد الجيوب",
    descriptionEn:
      "A lightweight organizer with flexible compartments for cables, toiletries, or daily essentials.",
    descriptionAr:
      "منظم خفيف بمقصورات مرنة للكابلات أو مستلزمات العناية أو الأغراض اليومية.",
    priceUsd: 2299,
    compareAtUsd: 2999,
    costUsd: 690,
    images: [picture("travel-organizer-open"), picture("travel-organizer-closed")],
    tags: ["organization", "travel"],
    inStock: true,
    isFeatured: false,
    aliexpressUrl: "https://www.aliexpress.com/item/1005000000010.html",
    categoryId: categoryIds.accessories,
    viewsTotal: 920,
    salesCount: 46,
    createdAt: daysAgo(15),
  },
] satisfies Prisma.ProductUncheckedCreateInput[];

const variantSeeds = [
  [productIds.tee, "Red / M", "أحمر / M", { color: { en: "Red", ar: "أحمر" }, size: { en: "M", ar: "M" } }, null, true],
  [productIds.tee, "Red / L", "أحمر / L", { color: { en: "Red", ar: "أحمر" }, size: { en: "L", ar: "L" } }, null, true],
  [productIds.tee, "Black / M", "أسود / M", { color: { en: "Black", ar: "أسود" }, size: { en: "M", ar: "M" } }, null, true],
  [productIds.tee, "Black / L", "أسود / L", { color: { en: "Black", ar: "أسود" }, size: { en: "L", ar: "L" } }, null, false],
  [productIds.hoodie, "Stone / M", "حجري / M", { color: { en: "Stone", ar: "حجري" }, size: { en: "M", ar: "M" } }, null, true],
  [productIds.hoodie, "Stone / L", "حجري / L", { color: { en: "Stone", ar: "حجري" }, size: { en: "L", ar: "L" } }, null, true],
  [productIds.hoodie, "Navy / M", "كحلي / M", { color: { en: "Navy", ar: "كحلي" }, size: { en: "M", ar: "M" } }, 5699, true],
  [productIds.hoodie, "Navy / L", "كحلي / L", { color: { en: "Navy", ar: "كحلي" }, size: { en: "L", ar: "L" } }, 5699, true],
  [productIds.joggers, "Black / M", "أسود / M", { color: { en: "Black", ar: "أسود" }, size: { en: "M", ar: "M" } }, null, true],
  [productIds.joggers, "Black / L", "أسود / L", { color: { en: "Black", ar: "أسود" }, size: { en: "L", ar: "L" } }, null, true],
  [productIds.joggers, "Oat / M", "شوفاني / M", { color: { en: "Oat", ar: "شوفاني" }, size: { en: "M", ar: "M" } }, null, true],
  [productIds.joggers, "Oat / L", "شوفاني / L", { color: { en: "Oat", ar: "شوفاني" }, size: { en: "L", ar: "L" } }, null, true],
  [productIds.dress, "Black / S", "أسود / S", { color: { en: "Black", ar: "أسود" }, size: { en: "S", ar: "S" } }, null, true],
  [productIds.dress, "Black / M", "أسود / M", { color: { en: "Black", ar: "أسود" }, size: { en: "M", ar: "M" } }, null, true],
  [productIds.dress, "Black / L", "أسود / L", { color: { en: "Black", ar: "أسود" }, size: { en: "L", ar: "L" } }, null, true],
  [productIds.dress, "Olive / S", "زيتوني / S", { color: { en: "Olive", ar: "زيتوني" }, size: { en: "S", ar: "S" } }, null, false],
  [productIds.dress, "Olive / M", "زيتوني / M", { color: { en: "Olive", ar: "زيتوني" }, size: { en: "M", ar: "M" } }, null, true],
  [productIds.dress, "Olive / L", "زيتوني / L", { color: { en: "Olive", ar: "زيتوني" }, size: { en: "L", ar: "L" } }, null, true],
  [productIds.watch, "Standard", "قياسي", { style: { en: "Standard", ar: "قياسي" } }, null, true],
].map(([productId, titleEn, titleAr, options, priceUsd, inStock], index) => ({
  id: `seed-variant-${String(index + 1).padStart(2, "0")}`,
  productId: String(productId),
  titleEn: String(titleEn),
  titleAr: String(titleAr),
  options: options as Prisma.InputJsonValue,
  priceUsd: priceUsd === null ? null : Number(priceUsd),
  inStock: Boolean(inStock),
})) satisfies Prisma.VariantUncheckedCreateInput[];

const reviewSeeds = [
  [productIds.tee, customerId, "Maya", 5, "Soft, true to size, and still looks new after several washes.", [picture("review-tee-maya", 700, 700)], ReviewSource.STORE, ReviewStatus.APPROVED, 27],
  [productIds.tee, null, "Nora", 5, "The fabric feels much better than I expected for the price.", [picture("review-tee-nora", 700, 700)], ReviewSource.ALIEXPRESS, ReviewStatus.APPROVED, 43],
  [productIds.tee, null, "Lina", 4, "Nice relaxed cut and the color matches the photos.", [], ReviewSource.ALIEXPRESS, ReviewStatus.PENDING, 5],
  [productIds.hoodie, customerId, "Maya", 5, "Warm without being bulky. The stone color goes with everything.", [picture("review-hoodie-maya", 700, 700)], ReviewSource.STORE, ReviewStatus.APPROVED, 19],
  [productIds.hoodie, null, "Jamie", 4, "Very comfortable. I sized up for an oversized look.", [], ReviewSource.ALIEXPRESS, ReviewStatus.APPROVED, 31],
  [productIds.joggers, customerId, "Maya", 5, "Wore these on a long flight and loved the deep pockets.", [], ReviewSource.STORE, ReviewStatus.APPROVED, 14],
  [productIds.joggers, null, "Omar", 4, "Good stretch and a clean tapered shape.", [picture("review-joggers-omar", 700, 700)], ReviewSource.ALIEXPRESS, ReviewStatus.APPROVED, 38],
  [productIds.dress, customerId, "Maya", 5, "Beautiful drape and the adjustable waist is very flattering.", [picture("review-dress-maya", 700, 700)], ReviewSource.STORE, ReviewStatus.APPROVED, 11],
  [productIds.dress, null, "Sara", 5, "Elegant, comfortable, and not see-through.", [picture("review-dress-sara", 700, 700)], ReviewSource.ALIEXPRESS, ReviewStatus.APPROVED, 33],
  [productIds.tote, customerId, "Maya", 4, "Fits my laptop, bottle, and daily essentials without feeling huge.", [], ReviewSource.STORE, ReviewStatus.APPROVED, 8],
  [productIds.tote, null, "Aisha", 5, "The inner pockets make this much more useful than a basic tote.", [picture("review-tote-aisha", 700, 700)], ReviewSource.ALIEXPRESS, ReviewStatus.APPROVED, 24],
  [productIds.watch, customerId, "Maya", 5, "Setup was simple and the battery lasted almost a full week.", [picture("review-watch-maya", 700, 700)], ReviewSource.STORE, ReviewStatus.APPROVED, 4],
  [productIds.watch, null, "Daniel", 5, "Bright screen, useful notifications, and surprisingly accurate step tracking.", [picture("review-watch-daniel", 700, 700)], ReviewSource.ALIEXPRESS, ReviewStatus.APPROVED, 29],
  [productIds.watch, null, "Hessa", 4, "Great value. I would like more watch-face options.", [], ReviewSource.ALIEXPRESS, ReviewStatus.PENDING, 3],
  [productIds.earbuds, customerId, "Maya", 5, "They stay comfortable through my commute and calls sound clear.", [], ReviewSource.STORE, ReviewStatus.APPROVED, 6],
  [productIds.earbuds, null, "Alex", 4, "Tiny case and strong sound for the size.", [picture("review-earbuds-alex", 700, 700)], ReviewSource.ALIEXPRESS, ReviewStatus.APPROVED, 21],
  [productIds.earbuds, null, "Rana", 3, "Good sound, but the touch controls took a little practice.", [], ReviewSource.ALIEXPRESS, ReviewStatus.HIDDEN, 2],
  [productIds.charger, customerId, "Maya", 4, "Compact and charges my phone quickly.", [], ReviewSource.STORE, ReviewStatus.APPROVED, 7],
  [productIds.charger, null, "Yousef", 5, "Perfect size for a small travel bag.", [picture("review-charger-yousef", 700, 700)], ReviewSource.ALIEXPRESS, ReviewStatus.PENDING, 1],
  [productIds.bottle, customerId, "Maya", 5, "No leaks, and my water stayed cold all afternoon.", [picture("review-bottle-maya", 700, 700)], ReviewSource.STORE, ReviewStatus.APPROVED, 12],
  [productIds.bottle, null, "Priya", 5, "The lid is easy to clean and it fits my car cup holder.", [], ReviewSource.ALIEXPRESS, ReviewStatus.APPROVED, 20],
  [productIds.organizer, customerId, "Maya", 5, "Finally one place for all my cables and adapters.", [picture("review-organizer-maya", 700, 700)], ReviewSource.STORE, ReviewStatus.APPROVED, 3],
  [productIds.organizer, null, "Fahad", 4, "Lightweight but holds more than it looks like it should.", [], ReviewSource.ALIEXPRESS, ReviewStatus.APPROVED, 15],
  [productIds.organizer, null, "Emma", 5, "Useful compartments and neat stitching.", [picture("review-organizer-emma", 700, 700)], ReviewSource.ALIEXPRESS, ReviewStatus.PENDING, 1],
].map(([productId, userId, authorName, rating, comment, images, source, status, age], index) => ({
  id: `seed-review-${String(index + 1).padStart(2, "0")}`,
  productId: String(productId),
  userId: userId === null ? null : String(userId),
  authorName: String(authorName),
  rating: Number(rating),
  comment: String(comment),
  images: images as string[],
  source: source as ReviewSource,
  status: status as ReviewStatus,
  createdAt: daysAgo(Number(age), 15),
})) satisfies Prisma.ReviewUncheckedCreateInput[];

const shippingAddress = {
  fullName: "Maya Hassan",
  phone: "+966 55 123 4567",
  country: "Saudi Arabia",
  state: "Riyadh",
  city: "Riyadh",
  street: "King Fahd Road",
  apartment: "Building 18, Apartment 7",
  zip: "12271",
};

const orderSeeds = [
  {
    id: "seed-order-1001",
    orderNumber: "1001",
    userId: customerId,
    email: "maya@example.com",
    phone: shippingAddress.phone,
    status: OrderStatus.DELIVERED,
    currency: "USD",
    fxRate: "1",
    subtotal: 9498,
    shippingFee: 0,
    total: 9498,
    paymentMethod: PaymentMethod.STRIPE,
    paymentRef: "cs_test_seed_1001",
    shippingAddress,
    createdAt: daysAgo(28, 10),
    items: [
      [productIds.watch, "Pulse Smart Watch", picture("pulse-watch-face", 1200, 1200), { style: "Standard" }, 6999, 2675, 1],
      [productIds.bottle, "Insulated Day Bottle", picture("day-bottle-sage", 1200, 1200), null, 2499, 760, 1],
    ],
  },
  {
    id: "seed-order-1002",
    orderNumber: "1002",
    userId: customerId,
    email: "maya@example.com",
    phone: shippingAddress.phone,
    status: OrderStatus.DELIVERED,
    currency: "SAR",
    fxRate: "3.75",
    subtotal: 25492,
    shippingFee: 0,
    total: 25492,
    paymentMethod: PaymentMethod.MOYASAR,
    paymentRef: "moyasar_seed_1002",
    shippingAddress,
    createdAt: daysAgo(24, 14),
    items: [
      [productIds.tee, "Classic Active Tee", picture("active-tee-front"), { color: "Red", size: "M" }, 9371, 820, 1],
      [productIds.joggers, "Relaxed Travel Joggers", picture("travel-joggers-black"), { color: "Black", size: "M" }, 16121, 1475, 1],
    ],
  },
  {
    id: "seed-order-1003",
    orderNumber: "1003",
    userId: customerId,
    email: "maya@example.com",
    phone: shippingAddress.phone,
    status: OrderStatus.FULFILLED,
    currency: "AUD",
    fxRate: "1.55",
    subtotal: 7748,
    shippingFee: 773,
    total: 8521,
    paymentMethod: PaymentMethod.PAYPAL,
    paymentRef: "paypal_seed_1003",
    shippingAddress,
    createdAt: daysAgo(20, 9),
    items: [[productIds.earbuds, "Pocket Wireless Earbuds", picture("wireless-earbuds-case", 1200, 1200), null, 7748, 1840, 1]],
  },
  {
    id: "seed-order-1004",
    orderNumber: "1004",
    userId: customerId,
    email: "maya@example.com",
    phone: shippingAddress.phone,
    status: OrderStatus.DELIVERED,
    currency: "USD",
    fxRate: "1",
    subtotal: 5999,
    shippingFee: 0,
    total: 5999,
    paymentMethod: PaymentMethod.STRIPE,
    paymentRef: "cs_test_seed_1004",
    shippingAddress,
    createdAt: daysAgo(16, 16),
    items: [[productIds.dress, "Woven Midi Dress", picture("midi-dress-black"), { color: "Black", size: "M" }, 5999, 2180, 1]],
  },
  {
    id: "seed-order-1005",
    orderNumber: "1005",
    userId: customerId,
    email: "maya@example.com",
    phone: shippingAddress.phone,
    status: OrderStatus.PAID,
    currency: "SAR",
    fxRate: "3.75",
    subtotal: 13121,
    shippingFee: 1871,
    total: 14992,
    paymentMethod: PaymentMethod.MOYASAR,
    paymentRef: "moyasar_seed_1005",
    shippingAddress,
    createdAt: daysAgo(12, 11),
    items: [[productIds.charger, "Compact Power Bank", picture("power-bank-front", 1200, 1200), null, 13121, 1125, 1]],
  },
  {
    id: "seed-order-1006",
    orderNumber: "1006",
    userId: customerId,
    email: "maya@example.com",
    phone: shippingAddress.phone,
    status: OrderStatus.FULFILLED,
    currency: "USD",
    fxRate: "1",
    subtotal: 5499,
    shippingFee: 0,
    total: 5499,
    paymentMethod: PaymentMethod.STRIPE,
    paymentRef: "cs_test_seed_1006",
    shippingAddress,
    createdAt: daysAgo(8, 13),
    items: [[productIds.hoodie, "Everyday Cloud Hoodie", picture("cloud-hoodie-stone"), { color: "Stone", size: "L" }, 5499, 1920, 1]],
  },
  {
    id: "seed-order-1007",
    orderNumber: "1007",
    userId: customerId,
    email: "maya@example.com",
    phone: shippingAddress.phone,
    status: OrderStatus.PAID,
    currency: "AUD",
    fxRate: "1.55",
    subtotal: 9761,
    shippingFee: 0,
    total: 9761,
    paymentMethod: PaymentMethod.PAYPAL,
    paymentRef: "paypal_seed_1007",
    shippingAddress,
    createdAt: daysAgo(5, 17),
    items: [
      [productIds.tote, "Canvas Carryall Tote", picture("canvas-tote-sand"), null, 6198, 1280, 1],
      [productIds.organizer, "Modular Travel Organizer", picture("travel-organizer-open"), null, 3563, 690, 1],
    ],
  },
  {
    id: "seed-order-1008",
    orderNumber: "1008",
    userId: customerId,
    email: "maya@example.com",
    phone: shippingAddress.phone,
    status: OrderStatus.PAID,
    currency: "USD",
    fxRate: "1",
    subtotal: 4998,
    shippingFee: 499,
    total: 5497,
    paymentMethod: PaymentMethod.STRIPE,
    paymentRef: "cs_test_seed_1008",
    shippingAddress,
    createdAt: daysAgo(2, 12),
    items: [[productIds.tee, "Classic Active Tee", picture("active-tee-front"), { color: "Black", size: "M" }, 2499, 820, 2]],
  },
];

const searchSeeds = [
  ["smart watch", 184],
  ["hoodie", 143],
  ["wireless earbuds", 121],
  ["travel", 98],
  ["dress", 87],
  ["water bottle", 74],
  ["tote bag", 62],
  ["charger", 51],
] as const;

async function seedSettings() {
  await prisma.storeSetting.upsert({
    where: { id: "main" },
    update: {
      storeName: "Nook & Nova",
      announcementEn: "Free shipping on orders over $50",
      announcementAr: "شحن مجاني للطلبات فوق 50 دولاراً",
      announcementEnabled: true,
      heroTitleEn: "Useful finds, thoughtfully chosen",
      heroTitleAr: "اختيارات عملية، منتقاة بعناية",
      heroSubtitleEn: "Everyday essentials for wherever the day takes you.",
      heroSubtitleAr: "أساسيات يومية ترافقك أينما يأخذك يومك.",
      heroImage: picture("store-hero", 1800, 1000),
      heroCtaEn: "Shop Now",
      heroCtaAr: "تسوق الآن",
      valueProps: [
        { icon: "Truck", titleEn: "Fast shipping", titleAr: "شحن سريع", textEn: "Tracked delivery on every order", textAr: "تتبع متاح لكل طلب" },
        { icon: "ShieldCheck", titleEn: "Secure payment", titleAr: "دفع آمن", textEn: "Trusted, encrypted checkout", textAr: "دفع موثوق ومشفر" },
        { icon: "RefreshCcw", titleEn: "Easy returns", titleAr: "إرجاع سهل", textEn: "Simple 30-day returns", textAr: "إرجاع بسيط خلال 30 يوماً" },
        { icon: "MessagesSquare", titleEn: "Here to help", titleAr: "نحن هنا للمساعدة", textEn: "Friendly support, seven days a week", textAr: "دعم ودود طوال أيام الأسبوع" },
      ],
      shippingFlatUsd: 499,
      freeShippingMinUsd: 5000,
      deliveryEstimateEn: "Delivery in 7–15 business days",
      deliveryEstimateAr: "التوصيل خلال ٧–١٥ يوم عمل",
      sarPerUsd: "3.75",
      audPerUsd: "1.55",
      supportEmail: "hello@example.com",
      supportWhatsapp: "+966551234567",
      socialLinks: {
        instagram: "https://instagram.com",
        tiktok: "https://tiktok.com",
        facebook: "https://facebook.com",
      },
    },
    create: {
      id: "main",
      storeName: "Nook & Nova",
      announcementEn: "Free shipping on orders over $50",
      announcementAr: "شحن مجاني للطلبات فوق 50 دولاراً",
      announcementEnabled: true,
      heroTitleEn: "Useful finds, thoughtfully chosen",
      heroTitleAr: "اختيارات عملية، منتقاة بعناية",
      heroSubtitleEn: "Everyday essentials for wherever the day takes you.",
      heroSubtitleAr: "أساسيات يومية ترافقك أينما يأخذك يومك.",
      heroImage: picture("store-hero", 1800, 1000),
      heroCtaEn: "Shop Now",
      heroCtaAr: "تسوق الآن",
      valueProps: [
        { icon: "Truck", titleEn: "Fast shipping", titleAr: "شحن سريع", textEn: "Tracked delivery on every order", textAr: "تتبع متاح لكل طلب" },
        { icon: "ShieldCheck", titleEn: "Secure payment", titleAr: "دفع آمن", textEn: "Trusted, encrypted checkout", textAr: "دفع موثوق ومشفر" },
        { icon: "RefreshCcw", titleEn: "Easy returns", titleAr: "إرجاع سهل", textEn: "Simple 30-day returns", textAr: "إرجاع بسيط خلال 30 يوماً" },
        { icon: "MessagesSquare", titleEn: "Here to help", titleAr: "نحن هنا للمساعدة", textEn: "Friendly support, seven days a week", textAr: "دعم ودود طوال أيام الأسبوع" },
      ],
      shippingFlatUsd: 499,
      freeShippingMinUsd: 5000,
      deliveryEstimateEn: "Delivery in 7–15 business days",
      deliveryEstimateAr: "التوصيل خلال ٧–١٥ يوم عمل",
      sarPerUsd: "3.75",
      audPerUsd: "1.55",
      supportEmail: "hello@example.com",
      supportWhatsapp: "+966551234567",
      socialLinks: {
        instagram: "https://instagram.com",
        tiktok: "https://tiktok.com",
        facebook: "https://facebook.com",
      },
    },
  });
}

async function seedUsers() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "owner@example.com";
  const [adminPassword, customerPassword] = await Promise.all([
    hashPassword("Admin123!"),
    hashPassword("Demo123!"),
  ]);

  await prisma.user.upsert({
    where: { id: adminId },
    update: {
      email: adminEmail,
      emailVerified: true,
      name: "Store Owner",
      firstName: "Store",
      lastName: "Owner",
      role: Role.ADMIN,
    },
    create: {
      id: adminId,
      email: adminEmail,
      emailVerified: true,
      name: "Store Owner",
      firstName: "Store",
      lastName: "Owner",
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { id: customerId },
    update: {
      email: "maya@example.com",
      emailVerified: true,
      name: "Maya Hassan",
      firstName: "Maya",
      lastName: "Hassan",
      phone: shippingAddress.phone,
      role: Role.CUSTOMER,
    },
    create: {
      id: customerId,
      email: "maya@example.com",
      emailVerified: true,
      name: "Maya Hassan",
      firstName: "Maya",
      lastName: "Hassan",
      phone: shippingAddress.phone,
      role: Role.CUSTOMER,
    },
  });

  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: adminId } },
    update: { password: adminPassword, userId: adminId },
    create: {
      id: "seed-account-admin",
      providerId: "credential",
      accountId: adminId,
      userId: adminId,
      password: adminPassword,
    },
  });

  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: customerId } },
    update: { password: customerPassword, userId: customerId },
    create: {
      id: "seed-account-customer",
      providerId: "credential",
      accountId: customerId,
      userId: customerId,
      password: customerPassword,
    },
  });

  await prisma.address.upsert({
    where: { id: "seed-address-customer" },
    update: { ...shippingAddress, userId: customerId, isDefault: true },
    create: {
      id: "seed-address-customer",
      userId: customerId,
      ...shippingAddress,
      isDefault: true,
    },
  });
}

async function seedCatalog() {
  const categories = [
    { id: categoryIds.apparel, slug: "apparel", nameEn: "Apparel", nameAr: "ملابس", image: picture("category-apparel", 900, 700), sort: 1 },
    { id: categoryIds.accessories, slug: "accessories", nameEn: "Accessories", nameAr: "إكسسوارات", image: picture("category-accessories", 900, 700), sort: 2 },
    { id: categoryIds.tech, slug: "tech", nameEn: "Tech", nameAr: "تقنية", image: picture("category-tech", 900, 700), sort: 3 },
  ] satisfies Prisma.CategoryCreateInput[];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: category,
      create: category,
    });
  }

  for (const product of productSeeds) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: product,
      create: product,
    });
  }

  for (const variant of variantSeeds) {
    await prisma.variant.upsert({
      where: { id: variant.id },
      update: variant,
      create: variant,
    });
  }
}

async function seedOrders() {
  for (const seed of orderSeeds) {
    const items = seed.items.map((item, index) => ({
      id: `${seed.id}-item-${index + 1}`,
      productId: String(item[0]),
      titleEn: String(item[1]),
      titleAr: productSeeds.find((product) => product.id === String(item[0]))?.titleAr ?? String(item[1]),
      image: String(item[2]),
      variant:
        item[3] === null
          ? Prisma.JsonNull
          : (item[3] as Prisma.InputJsonValue),
      unitPrice: Number(item[4]),
      unitCostUsd: Number(item[5]),
      quantity: Number(item[6]),
    }));
    const order = {
      id: seed.id,
      orderNumber: seed.orderNumber,
      checkoutKey: `seed-checkout-${seed.id}`,
      receiptTokenHash: `seed-receipt-${seed.id}`,
      userId: seed.userId,
      email: seed.email,
      phone: seed.phone,
      status: seed.status,
      currency: seed.currency,
      fxRate: seed.fxRate,
      subtotal: seed.subtotal,
      shippingFee: seed.shippingFee,
      total: seed.total,
      paymentMethod: seed.paymentMethod,
      paymentRef: seed.paymentRef,
      paymentUrl: null,
      shippingAddress: seed.shippingAddress,
      createdAt: seed.createdAt,
    };

    await prisma.order.upsert({
      where: { id: seed.id },
      update: {
        ...order,
        items: { deleteMany: {}, create: items },
      },
      create: {
        ...order,
        items: { create: items },
      },
    });
  }
}

async function seedReviews() {
  for (const review of reviewSeeds) {
    await prisma.review.upsert({
      where: { id: review.id },
      update: review,
      create: review,
    });
  }
}

async function seedAnalytics() {
  const trackedProducts = Object.values(productIds);
  const ages = [0, 3, 7, 14, 21, 28];

  for (const [productIndex, productId] of trackedProducts.entries()) {
    for (const [ageIndex, age] of ages.entries()) {
      const date = daysAgo(age, 0);
      const count = Math.max(8, 118 - productIndex * 7 - ageIndex * 9);
      await prisma.productView.upsert({
        where: { productId_date: { productId, date } },
        update: { count },
        create: { productId, date, count },
      });
    }
  }

  for (const [term, count] of searchSeeds) {
    await prisma.searchLog.upsert({
      where: { term },
      update: { count, lastAt: daysAgo(0, 8) },
      create: { term, count, lastAt: daysAgo(0, 8) },
    });
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The demo seed is disabled in production because it uses documented development passwords");
  }
  await seedSettings();
  await seedUsers();
  await seedCatalog();
  await seedOrders();
  await seedReviews();
  await seedAnalytics();

  console.info("Seed complete: 2 users, 3 categories, 10 products, 24 reviews, 8 orders, and analytics.");
  console.info(`Admin: ${process.env.ADMIN_EMAIL ?? "owner@example.com"} / Admin123!`);
  console.info("Demo customer: maya@example.com / Demo123!");
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
