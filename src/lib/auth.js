import GoogleProvider from "next-auth/providers/google";

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
          const { connectDB } = await import("./mongodb");
          const { default: User } = await import("@/models/User");
          
          await connectDB();
          const dbUser = await User.findOne({ googleId: token.sub }).lean();
          if (dbUser) {
            session.user.name = dbUser.displayName || dbUser.name || session.user.name;
            session.user.customAvatar = dbUser.customAvatar || null;
            session.user.image = dbUser.customAvatar || null;
          }
        } catch (err) {
          console.error("NextAuth session callback error:", err);
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
