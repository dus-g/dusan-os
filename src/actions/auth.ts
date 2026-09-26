"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { bootstrapUser } from "@/lib/bootstrap";
import { requireUserId } from "@/lib/session";
import { str, date, type FormState } from "@/lib/form";

const password = z.string().min(10, "Use at least 10 characters.").max(200);

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  try {
    await signIn("credentials", { email: str(fd, "email"), password: str(fd, "password"), redirectTo: "/dashboard" });
  } catch (e) {
    if (e instanceof AuthError) return { error: "That email and password don't match an account." };
    throw e; // NEXT_REDIRECT
  }
}

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const schema = z.object({ name: z.string().min(1, "Enter your name.").max(80), email: z.string().email("Enter a valid email."), password });
  const parsed = schema.safeParse({ name: str(fd, "name"), email: str(fd, "email").toLowerCase(), password: str(fd, "password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const exists = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return { error: "An account with that email already exists. Sign in instead." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name: parsed.data.name, email: parsed.data.email, passwordHash } });
    await bootstrapUser(tx, user.id, { dateOfBirth: date(fd, "dateOfBirth") ?? undefined });
  }, { timeout: 20_000 });

  try {
    await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirectTo: "/dashboard" });
  } catch (e) {
    if (e instanceof AuthError) redirect("/login");
    throw e;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function requestPasswordReset(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await db.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    const link = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
    await sendResetEmail(email, link);
  }
  // Same response either way so emails can't be enumerated.
  return { success: "If that email has an account, a reset link is on its way. It expires in 1 hour." };
}

async function sendResetEmail(to: string, link: string) {
  if (!process.env.RESEND_API_KEY) {
    console.info(`[password reset] ${to}: ${link}`);
    return;
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Dusan OS <onboarding@resend.dev>",
      to,
      subject: "Reset your Dusan OS password",
      text: `Reset your password using this link (valid for 1 hour):\n\n${link}\n\nIf you didn't ask for this, ignore this email.`,
    }),
  });
}

export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  const token = str(fd, "token");
  const parsed = password.safeParse(str(fd, "password"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.expiresAt < new Date()) return { error: "This reset link has expired. Request a new one." };
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash: await bcrypt.hash(parsed.data, 12) } }),
    db.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);
  redirect("/login?reset=1");
}

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  if (!name) return { error: "Enter your name." };
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email." };
  const clash = await db.user.findFirst({ where: { email, NOT: { id: userId } } });
  if (clash) return { error: "That email is used by another account." };
  const dob = date(fd, "dateOfBirth");
  await db.user.update({ where: { id: userId }, data: { name, email } });
  if (dob) await db.settings.update({ where: { userId }, data: { dateOfBirth: dob } });
  revalidatePath("/", "layout");
  return { success: "Profile saved." };
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await bcrypt.compare(str(fd, "current"), user.passwordHash))) return { error: "Your current password is incorrect." };
  const parsed = password.safeParse(str(fd, "next"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(parsed.data, 12) } });
  return { success: "Password changed." };
}

export async function deleteAccount(_: FormState, fd: FormData): Promise<FormState> {
  const userId = await requireUserId();
  if (str(fd, "confirm") !== "DELETE") return { error: "Type DELETE to confirm." };
  await db.user.delete({ where: { id: userId } });
  await signOut({ redirectTo: "/register" });
}
