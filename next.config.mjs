/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["postgres"],
  // Keep production builds out of the dev server's .next directory. `next dev`
  // and `next build` share .next by default, and building while a dev server is
  // running corrupts the dev CSS/chunk manifest (pages render unstyled). When
  // NEXT_DIST_DIR is unset (dev, and Vercel's default `npm run build`) this is
  // exactly ".next"; the `build:local` script sets it to ".next-prod" so local
  // production builds never touch the running dev cache.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
