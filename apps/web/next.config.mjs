import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {},
};

export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  sourcemaps: {
    // Source maps uploaded to Sentry only when auth token is present (CI/CD).
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
