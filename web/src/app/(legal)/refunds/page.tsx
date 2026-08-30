import type { Metadata } from "next";
import Link from "next/link";

import {
  H3,
  LegalPage,
  LegalSection,
  OwnerPlaceholder,
  P,
  UL,
  type TocEntry,
} from "@/components/legal";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Refund Policy · Atlas Weather",
  description:
    "Refunds within 14 days of a charge, no questions asked. How to ask, who processes it, and what happens to your access afterwards.",
  alternates: { canonical: canonical("/refunds") },
};

export const revalidate = 2592000;

const TOC: readonly TocEntry[] = [
  { id: "short", label: "The short version" },
  { id: "how", label: "How to request one" },
  { id: "what-happens", label: "What happens next" },
  { id: "renewals", label: "Renewals & cancellation" },
  { id: "agency", label: "Agency plans" },
  { id: "statutory", label: "Your statutory rights" },
  { id: "outside", label: "Outside the 14 days" },
];

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refund Policy"
      intro="A refund within 14 days of any charge, without having to justify it. Purchases are sold and refunded through Paddle, our merchant of record, which is why the mechanics below involve them as well as us."
      updated="16 August 2026"
      toc={TOC}
    >
      <LegalSection id="short" heading="The short version">
        <UL>
          <li>
            <strong className="text-text">
              14 days, no questions asked.
            </strong>{" "}
            Ask for a refund within 14 days of a charge — a first purchase or a
            renewal — and you get it back in full.
          </li>
          <li>
            <strong className="text-text">Cancel any time.</strong> Cancelling
            is separate from refunding: it stops the next charge and leaves you
            with access until the period you paid for runs out.
          </li>
          <li>
            <strong className="text-text">
              Paddle is the merchant of record.
            </strong>{" "}
            Paddle took the payment, issued your invoice and handles the
            return. You can ask either of us; it ends up in the same place.
          </li>
        </UL>
      </LegalSection>

      <LegalSection id="how" heading="How to request one">
        <P>Two routes, both fine:</P>
        <UL>
          <li>
            <strong className="text-text">Ask us</strong> at{" "}
            powerpioneer@pm.me — include the
            email address on the account. We do not ask why.
          </li>
          <li>
            <strong className="text-text">Ask Paddle</strong> directly, using
            the receipt they emailed you, or via{" "}
            <a
              href="https://paddle.net"
              className="text-text-link underline underline-offset-2"
              rel="noreferrer"
            >
              paddle.net
            </a>
            , where you can look up your purchase and manage your subscription.
          </li>
        </UL>
        <P>
          We do not need a reason, but if something about the product did not
          work we would genuinely like to know — it is usually fixable.
        </P>
      </LegalSection>

      <LegalSection id="what-happens" heading="What happens next">
        <UL>
          <li>
            Paddle returns the money to the payment method you used. How long
            it takes to appear is your bank&rsquo;s business, typically a few
            working days.
          </li>
          <li>
            The subscription ends and the account drops to the free tier.
            Nothing you saved is deleted: trips, favourites and alerts stay on
            the account, and premium-only views are simply locked again.
          </li>
          <li>
            VAT or sales tax charged at checkout is refunded with the payment —
            Paddle handles that as part of being merchant of record.
          </li>
        </UL>
      </LegalSection>

      <LegalSection id="renewals" heading="Renewals & cancellation">
        <P>
          Subscriptions renew automatically until you cancel. Cancel from the
          Paddle customer portal, linked from your account page — one click,
          effective immediately for future charges.
        </P>
        <P>
          A renewal you did not intend is covered by the same 14-day rule as a
          first purchase. If a renewal caught you out, ask; you do not have to
          argue it.
        </P>
      </LegalSection>

      <LegalSection id="agency" heading="Agency plans">
        <P>
          The same 14 days applies to agency subscriptions, refunded to the
          organisation&rsquo;s payer. Where seats were added mid-period,{" "}
          <OwnerPlaceholder>
            confirm the proration rule Paddle is configured with
          </OwnerPlaceholder>
          .
        </P>
      </LegalSection>

      <LegalSection id="statutory" heading="Your statutory rights">
        <P>
          If you are a consumer in the EU or the UK you normally have a 14-day
          right to withdraw from a distance contract. For digital content that
          you get immediate access to, that right can end once access begins,
          if you agreed to it starting straight away.
        </P>
        <P>
          <strong className="text-text">
            We offer the 14 days regardless.
          </strong>{" "}
          Whether or not the statutory right technically survives immediate
          access, this policy gives you the same window, and nothing in it
          reduces any right your local consumer law gives you.
        </P>
        <P>
          <OwnerPlaceholder>
            confirm this policy matches the refund terms configured in the
            Paddle dashboard, which is what buyers see at checkout
          </OwnerPlaceholder>
        </P>
      </LegalSection>

      <LegalSection id="outside" heading="Outside the 14 days">
        <P>
          After 14 days we do not refund the current period as a matter of
          course — cancel and you keep access until it ends, and you will not
          be charged again. If something went genuinely wrong, ask anyway:{" "}
          powerpioneer@pm.me. Cases where a
          charge was duplicated, a payment was taken after a cancellation, or
          the service was unusable for a sustained period are handled as
          corrections, not as favours.
        </P>
        <P>
          This policy forms part of our{" "}
          <Link href="/terms" className="text-text-link underline underline-offset-2">
            Terms of Service
          </Link>
          . Purchases are additionally subject to{" "}
          <a
            href="https://www.paddle.com/legal/checkout-buyer-terms"
            className="text-text-link underline underline-offset-2"
            rel="noreferrer"
          >
            Paddle&rsquo;s buyer terms
          </a>
          .
        </P>
        <H3>Chargebacks</H3>
        <P>
          Please ask before raising a chargeback with your bank. A refund is
          faster, and a chargeback on a subscription usually results in the
          account being locked while Paddle investigates.
        </P>
      </LegalSection>
    </LegalPage>
  );
}
