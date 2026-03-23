/**
 * One-time script to backfill missing UserSubscription records
 * for users whose multi-subscription checkout only saved 1 of N records.
 *
 * Run with:  npx ts-node scripts/fix-multi-sub.ts <email>
 */
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" });

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx ts-node scripts/fix-multi-sub.ts <email>");
    process.exit(1);
  }

  // 1. Find the user
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) { console.error("User not found:", email); process.exit(1); }
  console.log("Found user:", user.id, user.email);

  // 2. Find their existing subscriptions to get the stripeSubscriptionId
  const existing = await prisma.userSubscription.findMany({
    where: { userId: user.id },
    include: { subscriptionPlan: true, channel: true },
  });
  console.log("Existing subscriptions:", existing.length);
  existing.forEach(s => console.log(" -", s.channel.name, s.subscriptionPlan.name, s.stripeSubscriptionId));

  if (!existing.length || !existing[0].stripeSubscriptionId) {
    console.error("No subscription with stripeSubscriptionId found");
    process.exit(1);
  }

  const stripeSubscriptionId = existing[0].stripeSubscriptionId;
  console.log("Stripe subscription ID:", stripeSubscriptionId);

  // 3. Fetch the Stripe subscription to get metadata with all items
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const meta = sub.metadata ?? {};
  console.log("Stripe metadata:", meta);

  if (meta.type !== "multi_subscription" || !meta.items) {
    console.error("Not a multi_subscription or missing items metadata");
    process.exit(1);
  }

  const items: Array<{ p: string; v: string; c: string }> = JSON.parse(meta.items);
  console.log("Items in Stripe metadata:", items.length);

  // 4. Create missing records
  let created = 0;
  for (const item of items) {
    const alreadyExists = await prisma.userSubscription.findFirst({
      where: { userId: user.id, subscriptionPlanId: item.p },
    });
    if (alreadyExists) {
      console.log("  Already exists for plan", item.p, "- skipping");
      continue;
    }

    const variant = await prisma.planPriceVariant.findUnique({
      where: { id: item.v },
      select: { stripePriceId: true },
    });

    await prisma.userSubscription.create({
      data: {
        userId: user.id,
        channelId: item.c,
        subscriptionPlanId: item.p,
        priceVariantId: item.v,
        stripeSubscriptionId,
        stripePriceId: variant?.stripePriceId ?? null,
        status: "ACTIVE",
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      },
    });
    console.log("  Created subscription for plan", item.p, "channel", item.c);
    created++;
  }

  console.log(`Done. Created ${created} missing subscription(s).`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
