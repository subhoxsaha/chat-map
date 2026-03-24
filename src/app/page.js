import MapChat from "@/components/MapChat";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { getServerSession } = await import("next-auth/next");
  const { authOptions } = await import("@/lib/auth");
  
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="h-screen w-full flex bg-[#0d1d1b] relative overflow-hidden">
      <MapChat sessionUser={session.user} />
    </main>
  );
}
