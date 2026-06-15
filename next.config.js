/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname
  }
};

module.exports = nextConfig;
