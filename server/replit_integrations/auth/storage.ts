import { passwordResetTokens, sessions, users, type PasswordResetToken, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createPasswordResetToken(data: { userId: string; tokenHash: string; accountType: "owner" | "staff"; expiresAt: Date }): Promise<PasswordResetToken>;
  getValidPasswordResetToken(tokenHash: string): Promise<PasswordResetToken | undefined>;
  consumeValidPasswordResetToken(tokenHash: string, executor?: any): Promise<PasswordResetToken | undefined>;
  updatePassword(userId: string, passwordHash: string, executor?: any): Promise<void>;
  revokeUserSessions(userId: string, executor?: any): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createPasswordResetToken(data: { userId: string; tokenHash: string; accountType: "owner" | "staff"; expiresAt: Date }): Promise<PasswordResetToken> {
    const [token] = await db.insert(passwordResetTokens).values(data).returning();
    return token;
  }

  async getValidPasswordResetToken(tokenHash: string): Promise<PasswordResetToken | undefined> {
    const [token] = await db
      .select()
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      ))
      .limit(1);
    return token;
  }

  async consumeValidPasswordResetToken(tokenHash: string, executor: any = db): Promise<PasswordResetToken | undefined> {
    const [token] = await executor
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      ))
      .returning();
    return token;
  }

  async updatePassword(userId: string, passwordHash: string, executor: any = db): Promise<void> {
    await executor.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async revokeUserSessions(userId: string, executor: any = db): Promise<void> {
    await executor.delete(sessions).where(sql`${sessions.sess}->>'userId' = ${userId}`);
  }
}

export const authStorage = new AuthStorage();
