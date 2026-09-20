export const defaultSettings = {
  id: "main",
  storeName: "Dropify",
  logoUrl: null,
  announcementEnabled: true,
  announcementEn: "Free shipping on orders over $50",
  announcementAr: "شحن مجاني للطلبات التي تزيد عن ٥٠ دولارًا",
  heroTitleEn: "Everyday finds, chosen with care.",
  heroTitleAr: "اختيارات يومية، انتقيناها بعناية.",
  heroSubtitleEn:
    "Thoughtful essentials, honest prices, and secure checkout—all in one easy place.",
  heroSubtitleAr:
    "أساسيات مختارة بعناية، وأسعار واضحة، ودفع آمن — كل ذلك في مكان واحد.",
  heroImage: "https://picsum.photos/seed/dropify-hero/1600/1000",
  heroCtaEn: "Shop the collection",
  heroCtaAr: "تسوق المجموعة",
  shippingFlatUsd: 499,
  freeShippingMinUsd: 5000,
  deliveryEstimateEn: "Delivery in 7–15 business days",
  deliveryEstimateAr: "التوصيل خلال ٧–١٥ يوم عمل",
  sarPerUsd: 3.75,
  audPerUsd: 1.55,
  supportEmail: "hello@dropify.store",
  supportWhatsapp: "+966 50 000 0000",
  valueProps: [
    {
      icon: "Truck",
      titleEn: "Tracked delivery",
      titleAr: "توصيل متتبع",
      textEn: "Updates from checkout to your door",
      textAr: "تحديثات من الدفع حتى باب منزلك",
    },
    {
      icon: "ShieldCheck",
      titleEn: "Secure checkout",
      titleAr: "دفع آمن",
      textEn: "Trusted, encrypted payment partners",
      textAr: "شركاء دفع موثوقون ومشفرون",
    },
    {
      icon: "RefreshCcw",
      titleEn: "Easy returns",
      titleAr: "إرجاع سهل",
      textEn: "Simple support when plans change",
      textAr: "دعم بسيط عندما تتغير خططك",
    },
    {
      icon: "MessageCircle",
      titleEn: "Here to help",
      titleAr: "نحن هنا للمساعدة",
      textEn: "Friendly support whenever you need it",
      textAr: "دعم ودود متى احتجت إليه",
    },
  ],
  socialLinks: { instagram: "#", tiktok: "#", facebook: "#" },
};

export const demoCategories = [
  {
    id: "cat-lifestyle",
    slug: "lifestyle",
    nameEn: "Lifestyle",
    nameAr: "نمط الحياة",
    image: "https://picsum.photos/seed/lifestyle/900/1100",
    sort: 1,
  },
  {
    id: "cat-active",
    slug: "active",
    nameEn: "Active",
    nameAr: "النشاط",
    image: "https://picsum.photos/seed/active/900/1100",
    sort: 2,
  },
  {
    id: "cat-tech",
    slug: "smart-tech",
    nameEn: "Smart tech",
    nameAr: "تقنية ذكية",
    image: "https://picsum.photos/seed/tech/900/1100",
    sort: 3,
  },
];

const catalog = [
  ["cloud-knit-set", "Cloud Knit Set", "طقم كلاود المحبوك", 4599, 6999, 1680, "cat-lifestyle", "cloud-knit", 182, true],
  ["everyday-carry-tote", "Everyday Carry Tote", "حقيبة حمل يومية", 2899, 3999, 920, "cat-lifestyle", "carry-tote", 148, true],
  ["halo-table-lamp", "Halo Table Lamp", "مصباح هالو للطاولة", 3499, 4999, 1250, "cat-lifestyle", "halo-lamp", 107, false],
  ["motion-training-set", "Motion Training Set", "طقم موشن للتدريب", 4299, 6299, 1540, "cat-active", "motion-set", 171, true],
  ["flow-insulated-bottle", "Flow Insulated Bottle", "قارورة فلو العازلة", 2199, 2999, 710, "cat-active", "flow-bottle", 134, false],
  ["stride-cloud-sneaker", "Stride Cloud Sneaker", "حذاء سترايد كلاود", 5499, 7499, 2040, "cat-active", "stride-shoe", 119, true],
  ["pulse-smart-watch", "Pulse Smart Watch", "ساعة بالس الذكية", 6999, 9999, 2780, "cat-tech", "pulse-watch", 206, true],
  ["orbit-wireless-speaker", "Orbit Wireless Speaker", "مكبر أوربت اللاسلكي", 3899, 5499, 1490, "cat-tech", "orbit-speaker", 96, false],
  ["snap-pocket-printer", "Snap Pocket Printer", "طابعة سناب المحمولة", 5999, 7999, 2340, "cat-tech", "snap-printer", 83, false],
  ["arc-magnetic-stand", "Arc Magnetic Stand", "حامل آرك المغناطيسي", 2499, 3499, 780, "cat-tech", "arc-stand", 72, false],
] as const;

export const demoProducts = catalog.map((item, index) => {
  const category = demoCategories.find((entry) => entry.id === item[6]) ?? null;
  const hasOptions = index === 0 || index === 3 || index === 5;
  return {
    id: `product-${index + 1}`,
    slug: item[0],
    titleEn: item[1],
    titleAr: item[2],
    descriptionEn:
      "Designed to make the everyday feel considered. Premium details, practical performance, and an easy fit for real life.",
    descriptionAr:
      "صُمم ليجعل تفاصيل يومك أكثر تميزًا. خامات عالية الجودة، وأداء عملي، وتصميم يناسب الحياة اليومية.",
    priceUsd: item[3],
    compareAtUsd: item[4],
    costUsd: item[5],
    sku: `DEMO-${String(index + 1).padStart(3, "0")}`,
    images: [
      `https://picsum.photos/seed/${item[7]}-1/1000/1200`,
      `https://picsum.photos/seed/${item[7]}-2/1000/1200`,
      `https://picsum.photos/seed/${item[7]}-3/1000/1200`,
    ],
    tags: index % 2 ? ["essential", "gift"] : ["bestseller", "new"],
    inStock: index !== 8,
    trackInventory: !hasOptions,
    stockQuantity: index === 8 ? 0 : 50,
    reservedQuantity: 0,
    isFeatured: item[9],
    aliexpressUrl: "https://www.aliexpress.com/",
    categoryId: item[6],
    category,
    viewsTotal: 840 - index * 47,
    salesCount: item[8],
    createdAt: new Date(Date.now() - index * 86_400_000).toISOString(),
    updatedAt: new Date().toISOString(),
    variants: hasOptions
      ? [
          { id: `variant-${index}-1`, titleEn: "Sand / S", titleAr: "رملي / S", options: { color: "Sand", size: "S" }, priceUsd: null, sku: `DEMO-${index}-SAND-S`, inStock: true, trackInventory: true, stockQuantity: 20, reservedQuantity: 0 },
          { id: `variant-${index}-2`, titleEn: "Sand / M", titleAr: "رملي / M", options: { color: "Sand", size: "M" }, priceUsd: null, sku: `DEMO-${index}-SAND-M`, inStock: true, trackInventory: true, stockQuantity: 20, reservedQuantity: 0 },
          { id: `variant-${index}-3`, titleEn: "Black / M", titleAr: "أسود / M", options: { color: "Black", size: "M" }, priceUsd: item[3] + 200, sku: `DEMO-${index}-BLACK-M`, inStock: true, trackInventory: true, stockQuantity: 20, reservedQuantity: 0 },
          { id: `variant-${index}-4`, titleEn: "Black / L", titleAr: "أسود / L", options: { color: "Black", size: "L" }, priceUsd: item[3] + 200, sku: `DEMO-${index}-BLACK-L`, inStock: false, trackInventory: true, stockQuantity: 0, reservedQuantity: 0 },
        ]
      : [],
  };
});

const reviewCopy = [
  ["Maya R.", "Exactly as pictured and the quality surprised me. It arrived carefully packed.", "مطابق للصور تمامًا والجودة فاجأتني. وصل بتغليف ممتاز."],
  ["Lina A.", "Simple, useful, and really well finished. I use it almost every day.", "بسيط وعملي وتشطيبه جميل جدًا. أستخدمه يوميًا تقريبًا."],
  ["Noah K.", "Great value and the delivery updates were clear from start to finish.", "قيمة ممتازة وتحديثات التوصيل كانت واضحة من البداية للنهاية."],
  ["Sara M.", "Bought it as a gift, then came back to order one for myself.", "اشتريته كهدية ثم عدت لأطلب واحدًا لنفسي."],
] as const;

export const demoReviews = Array.from({ length: 24 }, (_, index) => ({
  id: `review-${index + 1}`,
  productId: demoProducts[index % demoProducts.length].id,
  userId: index % 3 === 0 ? "demo-customer" : null,
  authorName: reviewCopy[index % reviewCopy.length][0],
  rating: index % 7 === 0 ? 4 : 5,
  comment: reviewCopy[index % reviewCopy.length][1],
  commentAr: reviewCopy[index % reviewCopy.length][2],
  images: index < 8 ? [`https://picsum.photos/seed/reviewer-${index}/300/300`] : [],
  source: index % 3 === 0 ? "STORE" : "ALIEXPRESS",
  status: index > 20 ? "PENDING" : "APPROVED",
  createdAt: new Date(Date.now() - index * 172_800_000).toISOString(),
}));

export const demoOrders = Array.from({ length: 8 }, (_, index) => {
  const product = demoProducts[index % demoProducts.length];
  const quantity = index % 3 === 0 ? 2 : 1;
  const total = product.priceUsd * quantity;
  return {
    id: `order-${index + 1}`,
    orderNumber: `${1012 - index}`,
    email: index === 0 ? "customer@example.com" : `customer${index + 1}@example.com`,
    phone: "+966 50 123 4567",
    status: index < 2 ? "FULFILLED" : "PAID",
    currency: "USD",
    fxRate: 1,
    subtotal: total,
    shippingFee: total >= 5000 ? 0 : 499,
    total: total + (total >= 5000 ? 0 : 499),
    paymentMethod: index % 3 === 0 ? "PAYPAL" : "STRIPE",
    paymentRef: `demo-payment-${index + 1}`,
    shippingAddress: {
      fullName: index === 0 ? "Demo Customer" : `Customer ${index + 1}`,
      phone: "+966 50 123 4567",
      street: "King Fahd Road",
      apartment: "Building 12",
      city: "Riyadh",
      state: "Riyadh",
      zip: "12345",
      country: "Saudi Arabia",
    },
    createdAt: new Date(Date.now() - (index * 4 + 1) * 86_400_000).toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: `order-item-${index + 1}`,
        productId: product.id,
        titleEn: product.titleEn,
        image: product.images[0],
        variant: null,
        unitPrice: product.priceUsd,
        unitCostUsd: product.costUsd,
        quantity,
        product,
      },
    ],
  };
});

export const demoSearches = [
  { term: "smart watch", count: 142 },
  { term: "gift", count: 97 },
  { term: "training set", count: 81 },
  { term: "speaker", count: 64 },
  { term: "bag", count: 49 },
];
