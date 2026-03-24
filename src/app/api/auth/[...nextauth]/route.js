import NextAuth from "next-auth";

export const dynamic = "force-dynamic";

async function handler(req, res) {
  const { authOptions } = await import("@/lib/auth");
  return await NextAuth(req, res, authOptions);
}

export { handler as GET, handler as POST };
