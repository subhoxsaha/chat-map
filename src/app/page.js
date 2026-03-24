import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import MapChat from "@/components/MapChat";
import { redirect } from "next/navigation";

export default async function Home() {
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
