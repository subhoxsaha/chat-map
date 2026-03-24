import GoogleProvider from "next-auth/providers/google";
import { connectDB } from "./mongodb";
import User from "@/models/User";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        
        try {
          await connectDB();
          const dbUser = await User.findOne({ googleId: token.sub }).lean();
          if (dbUser) {
            // AUTHORITATIVE DB OVERRIDE: 
            // Ensures Name and PFP are consistent across all server/client components instantly
            session.user.name = dbUser.displayName || dbUser.name || session.user.name;
            session.user.customAvatar = dbUser.customAvatar || null;
            // Never send the Google image to the client if we want full DB authority
            session.user.image = dbUser.customAvatar || null;
          }
        } catch (err) {
          console.error("NextAuth session callback DB error:", err);
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id; 
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
