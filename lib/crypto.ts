/**
 * AES-256-CBC encryption/decryption for storing passwords in a reversible form.
 * Used ONLY for admin display — passwords are ALSO bcrypt-hashed for actual auth.
 * Same approach as the old app (sou9nkc).
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const SECRET = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "fallback-key-change-me-in-production";
// Derive a stable 32-byte key
const key = crypto.createHash("sha256").update(String(SECRET)).digest();

export function encrypt(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(text: string): string {
  if (!text) return text;
  try {
    const parts = text.split(":");
    const ivHex = parts.shift();
    if (!ivHex) return text;
    const iv = Buffer.from(ivHex, "hex");
    const encryptedText = Buffer.from(parts.join(":"), "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch {
    return "";
  }
}
