export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(14).max(200)
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a number")
    .regex(/[^A-Za-z0-9]/, "Password must include a symbol"),
  confirmPassword: z.string().min(1).max(200)
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "The new passwords do not match",
  path: ["confirmPassword"]
});

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return Response.json({ error: "Authentication required. Please sign in again." }, { status: 401 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message || "Check your password details" }, { status: 400 });
    }
    const { currentPassword, newPassword } = parsed.data;
    const result = await query<{ password_hash: string; active: boolean }>(
      "SELECT password_hash, active FROM public.campus_users WHERE id = $1 LIMIT 1", [user.id]
    );
    const record = result.rows[0];
    if (!record?.active) return Response.json({ error: "This account is inactive." }, { status: 403 });
    if (!(await bcrypt.compare(currentPassword, record.password_hash).catch(() => false))) {
      return Response.json({ error: "Current password is incorrect." }, { status: 400 });
    }
    if (await bcrypt.compare(newPassword, record.password_hash).catch(() => false)) {
      return Response.json({ error: "Choose a password different from your temporary password." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await query(
      `UPDATE public.campus_users
       SET password_hash = $1, must_change_password = false, password_changed_at = now()
       WHERE id = $2 AND active = true`,
      [passwordHash, user.id]
    );
    return Response.json({ ok: true, message: "Password changed successfully." });
  } catch (error) {
    console.error("Password change error", error);
    return Response.json({ error: "Unable to update password right now. Please try again." }, { status: 500 });
  }
}
