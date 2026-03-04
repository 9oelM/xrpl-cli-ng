import { describe, expect, it } from "vitest";
import { decryptKeystore, encryptKeystore } from "./keystore.js";

describe("keystore", () => {
  const seed = "sEdTVVsaK4ZHJf3fkzecMbhFDivmpeG";
  const password = "correct-horse-battery-staple";
  const keyType = "ed25519" as const;
  const address = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";

  it("round-trips: decrypt(encrypt(seed)) === seed", () => {
    const keystore = encryptKeystore(seed, password, keyType, address);
    const decrypted = decryptKeystore(keystore, password);
    expect(decrypted).toBe(seed);
  });

  it("throws on wrong password", () => {
    const keystore = encryptKeystore(seed, password, keyType, address);
    expect(() => decryptKeystore(keystore, "wrong-password")).toThrow();
  });

  it("produces different ciphertext on each call (random salt/iv)", () => {
    const ks1 = encryptKeystore(seed, password, keyType, address);
    const ks2 = encryptKeystore(seed, password, keyType, address);
    expect(ks1.ciphertext).not.toBe(ks2.ciphertext);
    expect(ks1.kdfparams.salt).not.toBe(ks2.kdfparams.salt);
  });
});
