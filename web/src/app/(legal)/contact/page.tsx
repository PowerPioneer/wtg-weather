import type { Metadata } from "next";
import Link from "next/link";

import {
  LegalPage,
  LegalSection,
  LegalTable,
  OwnerPlaceholder,
  P,
  UL,
  type TocEntry,
} from "@/components/legal";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact & Support · Atlas Weather",
  description:
    "How to reach us: support, billing through Paddle, privacy requests, security reports, and how to tell us a country's climate or advisory data looks wrong.",
  alternates: { canonical: canonical("/contact") },
};

export const revalidate = 2592000;

const TOC: readonly TocEntry[] = [
  { id: "support", label: "Support" },
  { id: "where", label: "Where to send what" },
  { id: "billing", label: "Billing & invoices" },
  { id: "data-problem", label: "The data looks wrong" },
  { id: "self-serve", label: "Answers without waiting" },
];

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact & Support"
      intro="One inbox for everything, and a short list of the things that reach an answer faster somewhere else. There is no phone line and no chat widget — email is read by the person who builds the thing."
      updated="16 August 2026"
      toc={TOC}
    >
      <LegalSection id="support" heading="Support">
        <P>
          Email powerpioneer@pm.me. Include the
          address your account uses and, if it is about a specific place, the
          country and month you were looking at — a link to the page is ideal.
        </P>
        <P>
          We aim to reply within{" "}
          two working days
          . Support is in English:{" "}
          <OwnerPlaceholder>
            list any other supported languages, or delete
          </OwnerPlaceholder>
          .
        </P>
      </LegalSection>

      <LegalSection id="where" heading="Where to send what">
        <LegalTable
          caption="Contact addresses by subject"
          columns={["Subject", "Where"]}
          rows={[
            [
              "Anything about the product",
              "powerpioneer@pm.me",
            ],
            [
              "Refunds, invoices, VAT, cancellation",
              <>
                Paddle handles these as merchant of record — see{" "}
                <Link href="/refunds" className="text-text-link underline underline-offset-2">
                  Refund Policy
                </Link>
                . We can help too.
              </>,
            ],
            [
              "Privacy, data access, erasure",
              "powerpioneer@pm.me",
            ],
            [
              "Security vulnerabilities",
              "powerpioneer@pm.me",
            ],
            [
              "Press, partnerships, licensing the data",
              "powerpioneer@pm.me",
            ],
          ]}
        />
        <P>
          Postal address, for anything that needs one:{" "}
          Van Diemenstraat 138, 2518 VG Den Haag, Netherlands.
        </P>
      </LegalSection>

      <LegalSection id="billing" heading="Billing & invoices">
        <P>
          Every purchase is sold through Paddle, which means Paddle issued your
          invoice and can reissue it, add a VAT number to it, or refund it. The
          fastest route is{" "}
          <a
            href="https://paddle.net"
            className="text-text-link underline underline-offset-2"
            rel="noreferrer"
          >
            paddle.net
          </a>
          , where you can look up a purchase with the email address you used
          and manage or cancel the subscription. Your account page links to the
          same portal.
        </P>
      </LegalSection>

      <LegalSection id="data-problem" heading="The data looks wrong">
        <P>
          Tell us — this is the most useful mail we get. Two things it is worth
          knowing before you write:
        </P>
        <UL>
          <li>
            The climate figures are ten-year averages, not a forecast, and they
            can be legitimately unlike the weather you remember from one
            particular trip.
          </li>
          <li>
            Travel advisories are refreshed weekly from each government&rsquo;s
            own publication and every record on the site carries its source
            link and the date it was fetched. If ours disagrees with the
            source, that is a bug and we want it.
          </li>
        </UL>
        <P>
          Send the page link and what you expected to see. If it is an advisory,
          the government and the date help.
        </P>
      </LegalSection>

      <LegalSection id="self-serve" heading="Answers without waiting">
        <UL>
          <li>
            <Link href="/pricing" className="text-text-link underline underline-offset-2">
              Pricing
            </Link>{" "}
            — what each tier includes, and the questions people ask before
            subscribing.
          </li>
          <li>
            <Link href="/refunds" className="text-text-link underline underline-offset-2">
              Refund Policy
            </Link>{" "}
            — 14 days, no questions asked.
          </li>
          <li>
            <Link href="/privacy" className="text-text-link underline underline-offset-2">
              Privacy Policy
            </Link>{" "}
            — every cookie the site sets and every processor that sees your
            data.
          </li>
          <li>
            <Link href="/terms" className="text-text-link underline underline-offset-2">
              Terms of Service
            </Link>{" "}
            — including where the data comes from and how to attribute it.
          </li>
        </UL>
      </LegalSection>
    </LegalPage>
  );
}
