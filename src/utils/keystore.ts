import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "crypto";

export interface KeystoreFile {
  version: 1;
  address: string;
  keyType: "ed25519" | "secp256k1";
  kdf: "pbkdf2";
  kdfparams: {
    iterations: 600000;
    keylen: 32;
    digest: "sha256";
    salt: string; // hex
  };
  cipher: "aes-256-gcm";
  cipherparams: {
    iv: string; // hex
    tag: string; // hex
  };
  ciphertext: string; // hex
}

export function encryptKeystore(
  seed: string,
  password: string,
  keyType: "ed25519" | "secp256k1",
  address: string
): KeystoreFile {
  const salt = randomBytes(32);
  const iv = randomBytes(12);

  const key = pbkdf2Sync(password, salt, 600000, 32, "sha256");

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintextBuf = Buffer.from(seed, "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintextBuf), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    address,
    keyType,
    kdf: "pbkdf2",
    kdfparams: {
      iterations: 600000,
      keylen: 32,
      digest: "sha256",
      salt: salt.toString("hex"),
    },
    cipher: "aes-256-gcm",
    cipherparams: {
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
    },
    ciphertext: ciphertext.toString("hex"),
  };
}

export function decryptKeystore(file: KeystoreFile, password: string): string {
  const salt = Buffer.from(file.kdfparams.salt, "hex");
  const iv = Buffer.from(file.cipherparams.iv, "hex");
  const tag = Buffer.from(file.cipherparams.tag, "hex");
  const ciphertext = Buffer.from(file.ciphertext, "hex");

  const key = pbkdf2Sync(
    password,
    salt,
    file.kdfparams.iterations,
    file.kdfparams.keylen,
    file.kdfparams.digest
  );

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    throw new Error("wrong password or corrupt keystore");
  }
}
