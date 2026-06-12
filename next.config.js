const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "192.168.18.40",
  ],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

module.exports = nextConfig;
