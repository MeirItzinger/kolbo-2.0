import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { ApiError } from "../../utils/apiError";

export async function assertAdvertiserHasChargeableCard(
  advertiserId: string
): Promise<void> {
  const adv = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: { stripeCustomerId: true },
  });

  if (!adv?.stripeCustomerId) {
    throw ApiError.badRequest(
      "Billing is not set up for this account. Please add a payment method."
    );
  }

  const list = await stripe.paymentMethods.list({
    customer: adv.stripeCustomerId,
    type: "card",
    limit: 1,
  });

  if (list.data.length === 0) {
    throw ApiError.badRequest(
      "Add a credit card before creating a campaign."
    );
  }
}
