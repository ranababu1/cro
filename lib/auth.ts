import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "./db";
import { cleanText, splitName } from "./profile";
import { bumpMetric, METRICS, touchUserActivity, recordProductEvent } from "./telemetry";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
    ],
    callbacks: {
        async signIn({ user, profile }) {
            if (!user.email) return false;

            // Store user in database and make sure they have an org, project and environments
            const existingUser = await db.getUserByEmail(user.email);
            const isSignup = !existingUser;
            // New accounts are prefilled from Google and see onboarding before the dashboard.
            const g = (profile ?? {}) as { given_name?: string; family_name?: string };
            const split = splitName(user.name);
            const dbUser = existingUser ?? await db.createUser({
                email: user.email,
                name: user.name || "",
                image: user.image || "",
                first_name: cleanText(g.given_name ?? '') || split.first || null,
                last_name: cleanText(g.family_name ?? '') || split.last || null,
                onboarding_pending: true,
            });
            const ws = await db.ensureWorkspace(dbUser);
            if (isSignup) {
                await bumpMetric(METRICS.signups, { userId: dbUser.id, orgId: ws.orgId });
                await recordProductEvent({ action: 'auth.signup', userId: dbUser.id, orgId: ws.orgId });
            }
            await touchUserActivity(dbUser.id, 'login');
            await recordProductEvent({ action: 'auth.login', userId: dbUser.id, orgId: ws.orgId });

            return true;
        },
        async jwt({ token, user }) {
            // Add user ID to token when user signs in
            if (user && user.email) {
                const dbUser = await db.getUserByEmail(user.email);
                if (dbUser) {
                    token.userId = dbUser.id;
                }
            }
            return token;
        },
        async session({ session, token }) {
            // Add user ID from token to session
            if (session.user && token.userId) {
                session.user.id = token.userId as string;
            }
            return session;
        },
    },
    pages: { signIn: '/signin' },
    secret: process.env.NEXTAUTH_SECRET,
};
