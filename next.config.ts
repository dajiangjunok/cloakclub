import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  turbopack: {
    root: process.cwd()
  },
  transpilePackages: [
    "@provablehq/aleo-wallet-adaptor-core",
    "@provablehq/aleo-wallet-adaptor-leo",
    "@provablehq/aleo-wallet-adaptor-react",
    "@provablehq/aleo-wallet-adaptor-react-ui"
  ]
};

export default nextConfig;
