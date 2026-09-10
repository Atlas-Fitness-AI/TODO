import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow phones/other devices on the local network to use the dev server —
  // without this, Next 16 blocks cross-origin dev access and pages never hydrate.
  // Tailnet access (tailscale serve proxy on :8443) needs the FULL host —
  // Next's wildcard only spans one label, so "*.ts.net" does not match.
  allowedDevOrigins: ["192.168.1.*", "*.local", "brandons-macbook-pro-2.tailc37731.ts.net"],
  // The repo root carries the real CLAUDE.md and AGENTS.md; don't generate copies here.
  agentRules: false,
};

export default nextConfig;
