// One-time administrative utility: generate a bcrypt password hash.
// Create the account with a reviewed SQL statement on the intended branch.
// Do not place actual passwords or database URLs in source control.
import bcrypt from "bcryptjs";
const password = process.env.INITIAL_PASSWORD;
if (!password || password.length < 14) {
  console.error("Set INITIAL_PASSWORD to a strong temporary password (at least 14 characters).");
  process.exit(1);
}
console.log(await bcrypt.hash(password, 12));
