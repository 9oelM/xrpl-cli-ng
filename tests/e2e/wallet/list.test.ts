import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { resolve } from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const CLI = resolve(process.cwd(), "src/index.ts");
const TSX = resolve(process.cwd(), "node_modules/.bin/tsx");

function runCLI(args: string[], extraEnv?: Record<string, string>) {
  return spawnSync(TSX, [CLI, ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: `/home/vscode/.fnm/node-versions/v22.22.0/installation/bin:${process.env.PATH ?? ""}`,
      ...extraEnv,
    },
  });
}

describe("wallet list", () => {
  it("prints (empty) when keystore directory does not exist", () => {
    const nonExistentDir = join(tmpdir(), `xrpl-nonexistent-${Date.now()}`);
    const result = runCLI(["wallet", "list", "--keystore", nonExistentDir]);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("(empty)");
  });

  it("prints (empty) when keystore directory is empty", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "xrpl-test-"));
    try {
      const result = runCLI(["wallet", "list", "--keystore", tmpDir]);
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe("(empty)");
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it("lists two imported wallets", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "xrpl-test-"));
    try {
      const wallet1 = runCLI(["wallet", "new", "--json"]);
      const wallet2 = runCLI(["wallet", "new", "--json"]);
      const { seed: seed1, address: address1 } = JSON.parse(wallet1.stdout) as { seed: string; address: string };
      const { seed: seed2, address: address2 } = JSON.parse(wallet2.stdout) as { seed: string; address: string };

      runCLI(["wallet", "import", seed1, "--password", "testpassword", "--keystore", tmpDir]);
      runCLI(["wallet", "import", seed2, "--password", "testpassword", "--keystore", tmpDir]);

      const result = runCLI(["wallet", "list", "--keystore", tmpDir]);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(address1);
      expect(result.stdout).toContain(address2);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it("--json outputs a JSON array of addresses", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "xrpl-test-"));
    try {
      const wallet1 = runCLI(["wallet", "new", "--json"]);
      const wallet2 = runCLI(["wallet", "new", "--json"]);
      const { seed: seed1, address: address1 } = JSON.parse(wallet1.stdout) as { seed: string; address: string };
      const { seed: seed2, address: address2 } = JSON.parse(wallet2.stdout) as { seed: string; address: string };

      runCLI(["wallet", "import", seed1, "--password", "testpassword", "--keystore", tmpDir]);
      runCLI(["wallet", "import", seed2, "--password", "testpassword", "--keystore", tmpDir]);

      const result = runCLI(["wallet", "list", "--keystore", tmpDir, "--json"]);
      expect(result.status).toBe(0);
      const addresses = JSON.parse(result.stdout) as string[];
      expect(Array.isArray(addresses)).toBe(true);
      expect(addresses).toContain(address1);
      expect(addresses).toContain(address2);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it("--json outputs empty array when no keystores exist", () => {
    const nonExistentDir = join(tmpdir(), `xrpl-nonexistent-${Date.now()}`);
    const result = runCLI(["wallet", "list", "--keystore", nonExistentDir, "--json"]);
    expect(result.status).toBe(0);
    const addresses = JSON.parse(result.stdout) as string[];
    expect(addresses).toEqual([]);
  });

  it("alias 'ls' works", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "xrpl-test-"));
    try {
      const result = runCLI(["wallet", "ls", "--keystore", tmpDir]);
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe("(empty)");
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it("respects XRPL_KEYSTORE env var", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "xrpl-test-"));
    try {
      const wallet1 = runCLI(["wallet", "new", "--json"]);
      const { seed, address } = JSON.parse(wallet1.stdout) as { seed: string; address: string };

      runCLI(["wallet", "import", seed, "--password", "testpassword"], { XRPL_KEYSTORE: tmpDir });

      const result = runCLI(["wallet", "list"], { XRPL_KEYSTORE: tmpDir });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(address);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});
