import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import  prisma  from "@/lib/prisma"; // ✅ Make sure you're importing the named export

export async function POST(req: Request) {
  console.log("🔔 Webhook received at:", new Date().toISOString());

  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("❌ CLERK_WEBHOOK_SECRET is not set in environment variables");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error("❌ Missing required svix headers");
    return new Response("Missing svix headers", { status: 400 });
  }

  // Get body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verify webhook
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
    console.log("✅ Webhook signature verified successfully");
  } catch (err) {
    console.error("❌ Webhook verification failed:", err);
    return new Response("Webhook verification failed", { status: 400 });
  }

  const eventType = evt.type;
  console.log("🎯 Event Type:", eventType);

  try {
    if (eventType === "user.created") {
      const { 
        id, 
        email_addresses = [], 
        first_name, 
        last_name, 
        image_url,
        username // ✅ Extract username
      } = evt.data;

      // Skip test events (Clerk sends empty test pings)
      if (email_addresses.length === 0) {
        console.log("⚠️ Test event detected - skipping");
        return new Response(
          JSON.stringify({ success: true, message: "Test event ignored" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Find primary email (safe, no `any`)
      const primaryEmail = email_addresses.find(
        (email) => email.id === evt.data.primary_email_address_id
      ) || email_addresses[0];

      if (!primaryEmail) {
        console.error("❌ No email found");
        return new Response("No email address found", { status: 400 });
      }

      const userData = {
        clerkId: id,
        email: primaryEmail.email_address,
        username: username || null, // ✅ Save username (can be null)
        firstName: first_name || null,
        lastName: last_name || null,
        imageUrl: image_url || null,
      };

      console.log("📝 Creating user:", userData);
      const newUser = await prisma.user.create({ data: userData });

      console.log("✅ User created:", newUser.id);
      return new Response(
        JSON.stringify({ success: true, userId: newUser.id }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (eventType === "user.updated") {
      const { 
        id, 
        email_addresses = [], 
        first_name, 
        last_name, 
        image_url,
        username // ✅ Extract username
      } = evt.data;

      const primaryEmail = email_addresses.find(
        (email) => email.id === evt.data.primary_email_address_id
      ) || email_addresses[0];

      if (!primaryEmail) {
        console.error("❌ No email found");
        return new Response("No email address found", { status: 400 });
      }

      const userData = {
        email: primaryEmail.email_address,
        username: username || null, // ✅ Update username
        firstName: first_name || null,
        lastName: last_name || null,
        imageUrl: image_url || null,
      };

      console.log("📝 Updating user clerkId:", id);
      const updatedUser = await prisma.user.update({
        where: { clerkId: id },
        data: userData,
      });

      console.log("✅ User updated:", updatedUser.id);
      return new Response(
        JSON.stringify({ success: true, userId: updatedUser.id }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (eventType === "user.deleted") {
      const { id } = evt.data;
      console.log("🗑️ Deleting user:", id);
      await prisma.user.delete({ where: { clerkId: id } });
      console.log("✅ User deleted");
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("ℹ️ Unhandled event:", eventType);
    return new Response(
      JSON.stringify({ success: true, message: "Unhandled event" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error processing webhook:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}