You are a senior full-stack web developer, design the system and write a prompt for a website that uses a Next.js 16 and PostgreSQL with Prisma ORM.

# Keep it easy and simple, don't make it Technically complicated, reduce pages and make it ease to use for me (the store owner and the customers).

## The Main Idea
The website is about a Drop shipping from AliExpress.com

## Tech Stack and Technical Requirements:
* Next.JS 16.3.0 Latest version
* React 19.2 latest version
* ShadCN UI with Radix-UI
* TypeScript - IMPORTANT THAT YOU HAVE TO USE TYPES NOT INTERFACES (make Types folder in the root of the project and make index.ts file inside it and put all types there).
* Tailwind CSS V4 latest version
* Zod for Validation
* Better-Auth for Authentication - (User can use Email and Password Credentials and for sign-in can use Email and pass code send on his email).
* PostgreSQL With **Prisma version 7**
* Payments: use Stripe, [Moyasar](www.moyasar.com) and PayPal for payment (use dummy credentials I will change it with real ones later).
* **Analytics:** Google Tag Manager, Meta Pixel and TikTok Pixel.
* **i18n & Multi-Currency**: Support both English and Arabic Languages, USD, SAR and AUD Currencies

## The System Requirements
1- Me as an Admin (owner of the website) choose one or many products from AliExpress and show it on the website, make it a generic website because I will use it one for sport men/women clothing and other for women dresses and also one for a specific product like watch or Electronics (Like Smart watches or phones or headsets ...etc)
* I have a full Dashboard show everything in details ( Products, salles, how much money the customers buys for product ), full analytics (like what the most product customers watch and search for)
* I can create a product.
* I can delete a product.
* I can update a product.
* I can edit a product like change the cost and name.
* I can upload an image for a product (Also I can take it from AliExpress API Product Image).

2- The User (Customers who gonna use my website to buy a product/products) will see the product on the storefront
* He can make an account.
* In his account he can put his name (First name, Second Name), phone number and his address (Country, State, City, Streat, Apartment/Building number, Zip Code)
* He can upload an avatar and if there is no avatar put his first letter from his first name
* He can choose one or more products in his Cart
* He can leave a comment (review) on a product he purchased.
* He can also rate the product from one to five stars.

3- The Product has name, images, price, slug, tags, label (in stock /out of stock).
* Product has Categories

## Sections & Structure
#### Home Page
* Announcement Bar: To advertise offers such as "Free shipping on orders over X" or "10% off for a limited time"
* Hero Banner: A high-quality image or video showcasing the best product or store visual identity with a clear call to action button such as "Shop Now".
* Featured Categories: Product categorization for easy browsing.
* Best Sellers / Featured Products: Showcase the most popular products.
* Value Propositions: Icons that highlight your advantages (e.g., fast shipping, secure payment, 24/7 support).
* Social Proof / Testimonials: Reviews and photos of products from previous customers (reviews can be imported from AliExpress and filtered).
#### Product Page
##### This is the most important page in a Dropshipping store because most advertising campaigns direct visitors directly to it:
* **Clear and concise title:** Unlike keyword-filled titles on AliExpress.
* **High-quality photos and videos:** Free from Chinese supplier seals and logos.
* **Professional product description (copywriting):** Focuses on the benefits and solutions that the product offers to the buyer, not just the technical specifications.
* **Specifications for Variants:** Clearly define colors, sizes, and types.
* **Shipping Information:** Shows the expected shipping time and shipping policy.
* **Clear call to purchase:** Prominent "Add to Cart" or "Buy Now" button.

#### Cart & Checkout
- **Secure and Easy Payment:** Reduces the number of steps required to complete your purchase.
- **Trust Badges:** Displays icons for available payment methods to enhance security.

#### Branding & Marketing
* **Logo & Visual Identity:** Harmonious colors and a simple, eye-friendly design (Minimalist).