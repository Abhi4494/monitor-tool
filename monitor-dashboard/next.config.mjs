import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // pin tracing root to this app (avoids the multi-lockfile root warning)
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
