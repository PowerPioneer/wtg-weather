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
  title: "Terms of Service · Atlas Weather",
  description:
    "The terms you agree to when you use Where to Go for Great Weather: accounts, subscriptions sold through Paddle, acceptable use, data attribution, and the limits of what climate averages can tell you.",
  alternates: { canonical: canonical("/terms") },
};

export const revalidate = 2592000;

const TOC: readonly TocEntry[] = [
  { id: "agreement", label: "This agreement" },
  { id: "service", label: "What the service is" },
  { id: "not-advice", label: "What it is not" },
  { id: "accounts", label: "Accounts" },
  { id: "plans", label: "Plans, prices & billing" },
  { id: "refunds", label: "Cancellation & refunds" },
  { id: "agency", label: "Agency accounts" },
  { id: "acceptable-use", label: "Acceptable use" },
  { id: "ip", label: "Our content and yours" },
  { id: "data", label: "Data sources & attribution" },
  { id: "availability", label: "Availability & changes" },
  { id: "liability", label: "Warranties & liability" },
  { id: "termination", label: "Suspension & termination" },
  { id: "law", label: "Governing law" },
  { id: "contact", label: "Contact" },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="The agreement between you and the operator of Where to Go for Great Weather. It covers what the service does, what it deliberately does not do, and how subscriptions are sold, cancelled and refunded."
      updated="16 August 2026"
      toc={TOC}
    >
      <LegalSection id="agreement" heading="This agreement">
        <P>
          These terms are between you and{" "}
          Power Pioneer, a sole proprietorship (eenmanszaak) established in the Netherlands of{" "}
          Van Diemenstraat 138, 2518 VG Den Haag, Netherlands
          {" "}(&ldquo;we&rdquo;, &ldquo;us&rdquo;), the operator of
          wheretogoforgreatweather.com and its subdomains. By using the site or
          creating an account you accept them. If you do not accept them, do
          not use the service.
        </P>
        <P>
          They work alongside our{" "}
          <Link href="/privacy" className="text-text-link underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/refunds" className="text-text-link underline underline-offset-2">
            Refund Policy
          </Link>
          , both of which form part of this agreement. Purchases are additionally
          subject to the buyer terms of Paddle, our reseller — see{" "}
          <a href="#plans" className="text-text-link underline underline-offset-2">
            Plans, prices &amp; billing
          </a>
          .
        </P>
      </LegalSection>

      <LegalSection id="service" heading="What the service is">
        <P>
          The service is a travel-climate reference. It shows how well each
          country, region and district matches weather preferences you set, for
          a chosen month, from ten years of ERA5 reanalysis data, and it
          overlays the published travel advisories of six governments.
        </P>
        <P>
          The free tier covers country-level climate and the combined advisory
          view. The paid tier adds deeper zoom, further climate variables,
          percentile bands, the per-government advisory breakdown, saved trips,
          email alerts and export. What each tier includes is described on the{" "}
          <Link href="/pricing" className="text-text-link underline underline-offset-2">
            pricing page
          </Link>{" "}
          and may change as the product develops; we will not remove a material
          feature from a tier you are paying for during a billing period you
          have already paid.
        </P>
      </LegalSection>

      <LegalSection id="not-advice" heading="What it is not">
        <P>
          <strong className="text-text">
            It is not a forecast, and it is not safety advice.
          </strong>{" "}
          Please read this section; it is the one that matters most.
        </P>
        <UL>
          <li>
            The climate figures are <em>ten-year monthly averages and
            percentiles</em>. They describe what a month has typically been
            like, not what the weather will be on a date you travel. A place
            with an excellent average can still be washed out for the week you
            are there.
          </li>
          <li>
            Averages hide variation. A national figure for a large or
            mountainous country can be true of nowhere in it, which is why the
            service refuses to paint a single colour over a handful of very
            large countries and shows their regions instead.
          </li>
          <li>
            Travel advisories are reproduced from government sources on a
            weekly refresh, and each record carries the date it was fetched.
            They can be out of date, we can misread a source, and a
            government can change a level between refreshes.{" "}
            <strong className="text-text">
              Always check the issuing government&rsquo;s own advisory, and
              your own government&rsquo;s, before you travel or buy anything.
            </strong>{" "}
            We are not affiliated with any of the governments whose advisories
            we display, and displaying an advisory is not an endorsement of it.
          </li>
          <li>
            Nothing here is medical, security, insurance, visa or financial
            advice. Decisions about whether it is safe or sensible to travel
            somewhere are yours.
          </li>
        </UL>
      </LegalSection>

      <LegalSection id="accounts" heading="Accounts">
        <P>
          An account is created by signing in with a link mailed to your
          address, or with Google. Keep control of that mailbox: anyone who can
          read it can sign in as you. Tell us promptly if you think someone
          else has access.
        </P>
        <P>
          You must be at least{" "}
          16 to hold an
          account, and you agree the information you give us is accurate. One
          person, one account; do not share credentials.
        </P>
      </LegalSection>

      <LegalSection id="plans" heading="Plans, prices & billing">
        <H3>Paddle is the seller</H3>
        <P>
          Our order process is conducted by our online reseller{" "}
          <a
            href="https://www.paddle.com/legal/checkout-buyer-terms"
            className="text-text-link underline underline-offset-2"
            rel="noreferrer"
          >
            Paddle.com
          </a>
          . Paddle is the Merchant of Record for all our orders. Paddle
          provides all customer service enquiries and handles returns. When you
          buy a subscription, your contract of sale is with Paddle, and
          Paddle&rsquo;s buyer terms apply to that sale in addition to these
          terms.
        </P>
        <P>
          This has practical consequences worth stating plainly: Paddle takes
          the payment, calculates and remits VAT or sales tax for your country,
          issues the invoice, and processes refunds. We never see or store your
          card details.
        </P>
        <H3>Prices and renewal</H3>
        <UL>
          <li>
            Prices are shown on the pricing page, in your local currency where
            Paddle supports it, and tax is handled at checkout according to
            where you are.
          </li>
          <li>
            Subscriptions renew automatically for the same period until
            cancelled — monthly plans monthly, yearly plans yearly.
          </li>
          <li>
            You can cancel at any time from the Paddle customer portal, linked
            from your account page. Cancelling stops the next renewal; access
            continues to the end of the period you have paid for.
          </li>
          <li>
            We may change prices for future billing periods. Existing
            subscribers will be told before a change affects them, with at
            least 30 days{" "}
            notice, and may cancel rather than accept it.
          </li>
        </UL>
      </LegalSection>

      <LegalSection id="refunds" heading="Cancellation & refunds">
        <P>
          Refunds are set out in full in our{" "}
          <Link href="/refunds" className="text-text-link underline underline-offset-2">
            Refund Policy
          </Link>
          , which forms part of these terms. In short: a refund within 14 days
          of a charge, no questions asked, requested from us or from Paddle
          directly.
        </P>
      </LegalSection>

      <LegalSection id="agency" heading="Agency accounts">
        <P>
          Agency plans let an organisation buy a number of seats and invite
          colleagues into them, and let those colleagues record clients and
          assign trips to them.
        </P>
        <UL>
          <li>
            The person who creates the organisation is its owner and is
            responsible for what the organisation&rsquo;s members do with it,
            including who is invited and how many seats are bought.
          </li>
          <li>
            You may not invite more members than your seat cap; the service
            will refuse, and the answer is a larger plan.
          </li>
          <li>
            Client records you enter are personal data about people who are not
            our users. You are the controller for them and confirm you have a
            lawful basis to hold them; we process them on your behalf.
          </li>
          <li>
            An owner can remove a member at any time. Removing a member does
            not delete the work they did in the organisation.
          </li>
        </UL>
      </LegalSection>

      <LegalSection id="acceptable-use" heading="Acceptable use">
        <P>You agree not to:</P>
        <UL>
          <li>
            scrape, bulk-download or systematically extract the climate data,
            the tiles or the pages, or attempt to reconstruct the underlying
            dataset — the sources are public and you are welcome to go to them
            directly;
          </li>
          <li>
            share, resell or circumvent access to paid features, including by
            reusing or redistributing the signed tile URLs the service issues;
          </li>
          <li>
            probe, overload or interfere with the service, or bypass the rate
            limits;
          </li>
          <li>
            use the service to break the law, to infringe someone&rsquo;s
            rights, or to store personal data about others without a basis for
            it;
          </li>
          <li>
            misrepresent the data as a forecast or as official government
            advice when you pass it on.
          </li>
        </UL>
        <P>
          Reasonable, attributed use of individual figures in your own work —
          an itinerary for a client, a blog post, a report — is fine and always
          has been.
        </P>
      </LegalSection>

      <LegalSection id="ip" heading="Our content and yours">
        <P>
          The site, its design, its software and the derived scores, summaries
          and map tiles are ours or our licensors&rsquo;, and are protected by
          copyright. These terms give you a personal, non-exclusive,
          non-transferable right to use them through the service, and nothing
          more.
        </P>
        <P>
          What you create — trip names, preferences, notes, client records —
          stays yours. You grant us only the permission we need to host,
          process and display it back to you and to the people you share it
          with. If you make a trip public with a share link, you are choosing
          to publish it to anyone who has that link.
        </P>
      </LegalSection>

      <LegalSection id="data" heading="Data sources & attribution">
        <P>
          The service is built on public data, and it says so everywhere it
          shows a number.
        </P>
        <UL>
          <li>
            <strong className="text-text">ERA5</strong>, generated by the
            Copernicus Climate Change Service and distributed through the
            Copernicus Climate Data Store. Neither ECMWF nor the European
            Commission is responsible for any use of it here, and the figures
            on this site are our computation from it — averages and percentiles
            — not ERA5 itself.
          </li>
          <li>
            <strong className="text-text">Natural Earth</strong>, public
            domain, for country and first-level administrative boundaries and
            for capital cities.
          </li>
          <li>
            <strong className="text-text">geoBoundaries</strong> (CC BY 4.0)
            for second-level administrative boundaries.
          </li>
          <li>
            <strong className="text-text">Government travel advisories</strong>{" "}
            published by the United States, the United Kingdom, Canada,
            Australia, Germany and the Netherlands, reproduced with a link to
            the source and the date fetched. Their contents are their
            authors&rsquo;; the consolidation is ours.
          </li>
        </UL>
        <P>
          <OwnerPlaceholder>
            confirm each source licence permits commercial redistribution in
            this form
          </OwnerPlaceholder>
        </P>
      </LegalSection>

      <LegalSection id="availability" heading="Availability & changes">
        <P>
          We aim to keep the service up but do not promise uninterrupted
          availability. Maintenance, upstream outages and the annual data
          rebuild can all interrupt it. We may change, add or withdraw features;
          where a change materially reduces what a paid plan provides, we will
          tell subscribers in advance and you may cancel.
        </P>
      </LegalSection>

      <LegalSection id="liability" heading="Warranties & liability">
        <P>
          The service is provided &ldquo;as is&rdquo;. To the extent the law
          allows, we exclude implied warranties of merchantability, fitness for
          a particular purpose, and accuracy or completeness of the data.
        </P>
        <P>
          We are not liable for indirect or consequential loss, or for lost
          profits, lost bookings, wasted travel expenditure, or any decision to
          travel or not to travel made on the strength of what this service
          showed you. Our total liability to you in any twelve-month period is
          limited to the amount you paid us in that period.{" "}
          <OwnerPlaceholder>
            confirm liability cap and exclusions with counsel
          </OwnerPlaceholder>
        </P>
        <P>
          Nothing here limits liability that cannot lawfully be limited —
          including for death or personal injury caused by negligence, or for
          fraud. If you are a consumer, you keep every right your local
          consumer law gives you, and nothing in these terms takes those away.
        </P>
      </LegalSection>

      <LegalSection id="termination" heading="Suspension & termination">
        <P>
          You may stop using the service at any time and close your account by
          writing to us. We may suspend or close an account that breaches these
          terms, that is being used to attack or overload the service, or where
          we are required to by law — with notice where it is reasonable to
          give it, and immediately where it is not.
        </P>
        <P>
          If we close a paying account other than for a breach by you, we will
          refund the unused part of the period you have paid for.
        </P>
      </LegalSection>

      <LegalSection id="law" heading="Governing law">
        <P>
          These terms are governed by the law of{" "}
          the laws of the Netherlands, and
          the courts of{" "}
          the courts of The Hague, Netherlands have
          jurisdiction. If you are a consumer resident in the EU, this does not
          deprive you of the protection of the mandatory law of your own
          country, and you may bring proceedings there.
        </P>
        <P>
          If any provision of these terms is held unenforceable, the rest
          continues to apply.
        </P>
      </LegalSection>

      <LegalSection id="contact" heading="Contact">
        <P>
          Questions about these terms go to{" "}
          powerpioneer@pm.me, or through the{" "}
          <Link href="/contact" className="text-text-link underline underline-offset-2">
            contact page
          </Link>
          . Billing questions can also go straight to Paddle, who handle
          customer service for every order.
        </P>
      </LegalSection>
    </LegalPage>
  );
}
