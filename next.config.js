/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',        // service worker & workbox files go here
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // SW off in dev
});

module.exports = withPWA({
  experimental: {
    serverActions: { allowedOrigins: ['*'] }
  }
});
