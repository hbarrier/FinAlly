import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@libsql/client'],
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
