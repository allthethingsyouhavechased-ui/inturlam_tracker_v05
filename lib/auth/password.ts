import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

const KEY_LENGTH = 64;
const FORMAT = "scrypt-v1";

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Şifre en fazla ${MAX_PASSWORD_LENGTH} karakter olabilir.`;
  }
  return null;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return `${FORMAT}$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [format, saltText, hashText, extra] = storedHash.split("$");
  if (format !== FORMAT || !saltText || !hashText || extra !== undefined) return false;

  try {
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(hashText, "base64url");
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
