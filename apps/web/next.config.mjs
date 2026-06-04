import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {},
  webpack: (config) => {
    // Engine package exports its TypeScript source directly (exports["."] = "./src/index.ts")
    // and uses .js extensions in imports per TypeScript bundler-mode convention.
    // Next.js webpack needs extensionAlias to resolve .js → .ts at build time.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  sourcemaps: {
    // Source maps uploaded to Sentry only when auth token is present (CI/CD).
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
