#!/usr/bin/env node
/**
 * Usage:  node scripts/hash-passphrase.js
 *
 * Interactive prompt — enter your chosen passphrase.
 * Outputs the PASSPHRASE_HASH line to paste into your .env file.
 * The hash is salted with scrypt (N=32768, r=8, p=1, dkLen=64).
 */
import { scrypt, randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise((resolve) => rl.question(q, resolve));

const passphrase = await question("Enter passphrase (min 12 chars): ");
rl.close();

if (!passphrase || passphrase.trim().length < 12) {
  console.error("\nError: passphrase must be at least 12 characters.");
  process.exit(1);
}

const salt   = randomBytes(16).toString("hex");
const key    = await scryptAsync(passphrase, salt, 64);
const hash   = `${salt}:${key.toString("hex")}`;

console.log("\nAdd this to your backend/.env file:");
console.log(`PASSPHRASE_HASH=${hash}`);
console.log("\nAlso generate a strong session secret (run this once):");
console.log(`SESSION_SECRET=${randomBytes(48).toString("base64url")}`);
