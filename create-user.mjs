// One-time administrative utility: generate an Argon2id password hash.
// Create the account with a reviewed SQL statement on the intended branch.
// Do not place actual passwords or database URLs in source control.
import argon2 from "argon2";
const password = process.env.INITIAL_PASSWORD;
if (!password || password.length < 14) {
  console.error("Set INITIAL_PASSWORD to a strong temporary password (at least 14 characters).");
  process.exit(1);
}
console.log(await argon2.hash(password, { type: argon2.argon2id }));
