import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/profile  — return current user's profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { connectDB } = await import("@/lib/mongodb");
    const { default: User } = await import("@/models/User");
    
    await connectDB();
    let user = await User.findOne({ googleId: session.user.id }).lean();
    if (!user) {
      user = { displayName: session.user.name, customAvatar: session.user.image };
    }
    return NextResponse.json({ user });
  } catch (err) {
    console.error("GET /api/profile error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/profile  — update displayName and/or customAvatar
export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { displayName, customAvatar } = await req.json();
    
    const { connectDB } = await import("@/lib/mongodb");
    const { default: User } = await import("@/models/User");
    
    const update = {};
    if (displayName !== undefined) update.displayName = displayName.trim().slice(0, 40);
    if (customAvatar !== undefined) update.customAvatar = customAvatar;
    
    await connectDB();
    const user = await User.findOneAndUpdate(
      { googleId: session.user.id },
      { 
        $set: update,
        $setOnInsert: { 
          name: session.user.name || "User", 
          email: session.user.email || `${session.user.id}@example.com`, 
          image: session.user.image || "" 
        } 
      },
      { upsert: true, returnDocument: 'after' }
    ).lean();

    // Denormalization: Update senderName/senderImage on all existing messages
    const Message = (await import("@/models/Message")).default;
    const msgUpdate = {};
    if (update.displayName) msgUpdate.senderName = update.displayName;
    if (update.customAvatar !== undefined) msgUpdate.senderImage = update.customAvatar;
    
    if (Object.keys(msgUpdate).length > 0) {
      await Message.updateMany(
        { senderId: session.user.id },
        { $set: msgUpdate }
      );
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error("PATCH /api/profile error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
