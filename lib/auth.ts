import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "./db";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            if (!user.email) return false;

            // Store user in database
            const existingUser = await db.getUserByEmail(user.email);
            if (!existingUser) {
                await db.createUser({
                    email: user.email,
                    name: user.name || "",
                    image: user.image || "",
                });
            }

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
    secret: process.env.NEXTAUTH_SECRET,
};
