import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
const KEY_LENGTH = 64;
const N = 1 << 15;
const R = 8;
const P = 1;

function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, options, (error, derivedKey) =>
      error ? reject(error) : resolve(derivedKey),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const result = await scrypt(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${result.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const [algorithm, n, r, p, saltText, hashText] = encoded.split("$");
    if (algorithm !== "scrypt" || !n || !r || !p || !saltText || !hashText) return false;
    // Only verify hashes produced by our configured cost parameters. Besides
    // keeping the representation unambiguous, this prevents a database value
    // from selecting attacker-controlled scrypt costs during login.
    if (n !== String(N) || r !== String(R) || p !== String(P)) return false;
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(hashText, "base64url");
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = await scrypt(password, salt, KEY_LENGTH, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
