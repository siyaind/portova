import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@polkadot/api",
    "@polkadot/extension-dapp",
    "@polkadot/util",
    "@polkadot/util-crypto",
    "@polkadot/wasm-crypto",
  ],
  webpack: (config) => {
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      http: false,
      https: false,
      zlib: false,
      path: false,
    };
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};

export default nextConfig;
