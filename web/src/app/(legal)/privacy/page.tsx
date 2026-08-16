import type { Metadata } from "next";
import Link from "next/link";

import {
  H3,
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
  title: "Privacy Policy · Atlas Weather",
  description:
    "What Where to Go for Great Weather collects, why, who processes it, and the cookies the site sets. Analytics before sign-in are cookieless.",
  alternates: { canonical: canonical("/privacy") },
};

export const revalidate = 2592000;

const TOC: readonly TocEntry[] = [
  { id: "who-we-are", label: "Who we are" },
  { id: "what-we-collect", label: "What we collect" },
  { id: "why", label: "Why, and on what basis" },
  { id: "cookies", label: "Cookies & local storage" },
  { id: "analytics", label: "Analytics & error reporting" },
  { id: "processors", label: "Who else processes it" },
  { id: "retention", label: "How long we keep it" },
  { id: "security", label: "How it is protected" },
  { id: "your-rights", label: "Your rights" },
  { id: "children", label: "Children" },
  { id: "climate-data", label: "Where the climate data comes from" },
  { id: "changes", label: "Changes to this policy" },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="What this service collects about you, why it collects it, and every third party that sees any of it. Written from the code rather than from a template — each cookie and processor named below is one the software actually uses."
      updated="16 August 2026"
      toc={TOC}
    >
      <LegalSection id="who-we-are" heading="Who we are">
        <P>
          Where to Go for Great Weather (&ldquo;the service&rdquo;) is operated
          by <OwnerPlaceholder>legal entity name</OwnerPlaceholder>, registered
          at <OwnerPlaceholder>registered address</OwnerPlaceholder>
          {" "}
          <OwnerPlaceholder>company registration number, if any</OwnerPlaceholder>.
          That entity is the data controller for the personal data described
          here.
        </P>
        <P>
          For any question about this policy, or to exercise a right under{" "}
          <a
            href="https://eur-lex.europa.eu/eli/reg/2016/679/oj"
            className="text-text-link underline underline-offset-2"
            rel="noreferrer"
          >
            the GDPR
          </a>
          , write to{" "}
          <OwnerPlaceholder>data protection contact email</OwnerPlaceholder>.
          If the controller is established outside the EU/EEA, an Article 27
          representative must be named here:{" "}
          <OwnerPlaceholder>
            EU representative, or a statement that none is required
          </OwnerPlaceholder>
          .
        </P>
      </LegalSection>

      <LegalSection id="what-we-collect" heading="What we collect">
        <H3>If you never sign in</H3>
        <P>
          Nothing that identifies you. The map, the country pages and the
          month pages are served as static documents; the climate figures on
          them are baked into the map tiles and the pre-rendered HTML, so
          browsing them sends us no queries about what you looked at. Your
          weather preferences on the map live in the page URL, which means
          they never leave your browser except when you choose to share the
          link.
        </P>
        <P>
          Our servers keep ordinary web-server request logs. Analytics for
          this traffic is cookieless and non-identifying — see{" "}
          <a href="#analytics" className="text-text-link underline underline-offset-2">
            Analytics
          </a>
          .
        </P>
        <H3>If you create an account</H3>
        <UL>
          <li>
            <strong className="text-text">Your email address.</strong> It is
            the account identifier: sign-in is a magic link mailed to it, or
            Google sign-in, which returns your address and name from Google.
          </li>
          <li>
            <strong className="text-text">What you save.</strong> Trips
            (a destination, a month, and the weather preferences you saved
            them with), favourites, and email alerts.
          </li>
          <li>
            <strong className="text-text">Your plan.</strong> Free or paid,
            and for agency accounts the organisation you belong to and your
            role in it. We do <em>not</em> store card details — see{" "}
            <a href="#processors" className="text-text-link underline underline-offset-2">
              processors
            </a>
            .
          </li>
          <li>
            <strong className="text-text">Agency data you enter.</strong> If
            you run an agency account: the names, optional email addresses and
            notes you record about your own clients. You are responsible for
            having a lawful basis to put them there; as between us, we process
            them on your instructions.
          </li>
        </UL>
        <P>
          We do not buy personal data, we do not sell it, and we run no
          advertising network on the site.
        </P>
      </LegalSection>

      <LegalSection id="why" heading="Why, and on what basis">
        <LegalTable
          caption="Processing purposes and their legal bases"
          columns={["Data", "Purpose", "Basis"]}
          rows={[
            [
              "Email address",
              "Sign you in, and send the transactional mail the account needs (magic links, invitations, receipts).",
              "Performance of the contract (Art. 6(1)(b)).",
            ],
            [
              "Trips, favourites, alerts",
              "Provide the features you asked for, and send weekly alert emails where you created an alert.",
              "Performance of the contract (Art. 6(1)(b)).",
            ],
            [
              "Plan and subscription status",
              "Decide what the account unlocks; comply with tax and accounting duties.",
              "Contract, and legal obligation (Art. 6(1)(c)).",
            ],
            [
              "Server logs, error reports",
              "Keep the service up, diagnose faults, and limit abuse.",
              "Legitimate interests (Art. 6(1)(f)) in a secure, working service.",
            ],
            [
              "Product analytics after sign-in",
              "Understand which features signed-in users actually use.",
              <>
                Legitimate interests (Art. 6(1)(f)).{" "}
                <OwnerPlaceholder>
                  confirm with counsel whether consent is preferred here
                </OwnerPlaceholder>
              </>,
            ],
          ]}
        />
      </LegalSection>

      <LegalSection id="cookies" heading="Cookies & local storage">
        <P>
          The site sets three cookies of its own. All three are strictly
          necessary — they exist to sign you in, to keep sign-in safe, and to
          remember that you pressed &ldquo;upgrade&rdquo; before you had an
          account. None of them is used to profile you or to advertise, and
          there is nothing here for a consent banner to switch off, which is
          why the site does not show one.
        </P>
        <LegalTable
          caption="Cookies set by this site"
          columns={["Cookie", "Purpose", "Lifetime", "Attributes"]}
          rows={[
            [
              "wtg_session",
              "Your signed-in session. Holds a signed reference to your user id and nothing else.",
              "30 days, sliding",
              "HttpOnly · Secure · SameSite=Lax",
            ],
            [
              "wtg_oauth_state",
              "Single-use anti-forgery value for Google sign-in. Deleted as soon as you return from Google.",
              "10 minutes",
              "HttpOnly · Secure · SameSite=Lax · scoped to /api/auth",
            ],
            [
              "wtg_checkout_intent",
              "Remembers which plan you clicked before signing in, so the sign-in link can carry you to the right checkout. Holds a plan identifier — never a URL.",
              "30 minutes",
              "HttpOnly · Secure · SameSite=Lax",
            ],
          ]}
        />
        <P>
          <strong className="text-text">Local storage is not used.</strong>{" "}
          Map preferences are held in the URL precisely so that they are
          shareable and so that nothing has to be written to your device.
        </P>
        <P>
          Two third parties may set storage of their own:{" "}
          <strong className="text-text">PostHog</strong>, after you sign in
          (see below), and <strong className="text-text">Paddle</strong>, on
          Paddle&rsquo;s own checkout pages, governed by Paddle&rsquo;s
          policies rather than this one. Plausible, our pre-login analytics,
          sets none.
        </P>
      </LegalSection>

      <LegalSection id="analytics" heading="Analytics & error reporting">
        <H3>Before you sign in: Plausible, cookieless</H3>
        <P>
          Anonymous traffic is measured with{" "}
          <a
            href="https://plausible.io/data-policy"
            className="text-text-link underline underline-offset-2"
            rel="noreferrer"
          >
            Plausible Analytics
          </a>
          , which we run on our own server. It sets no cookies, stores no
          identifiers on your device, and does not follow you between sites. It
          counts page views in aggregate. Because it neither reads nor writes
          anything on your device and processes no personal data, it needs no
          consent — this is the reason the site has no cookie banner.
        </P>
        <H3>After you sign in: PostHog, identified</H3>
        <P>
          Product analytics for signed-in users runs on PostHog and loads only
          once a session exists — an anonymous visitor never downloads it.
          It is told your user id, your plan, your role and your organisation
          id so that we can tell a feature that agencies use from one that
          nobody does. It sets its own cookies for this purpose. Session
          replay — recording your screen — is switched off.
        </P>
        <P>
          If you would rather not be counted, most content blockers stop both
          tools, and the site is built to work identically when they are
          blocked.
        </P>
        <H3>Errors</H3>
        <P>
          Crashes and server errors are reported to GlitchTip, which we also
          self-host. Reports are scrubbed before they are sent: email
          addresses and IP addresses are replaced with markers at the point the
          report is built, and the client is configured not to attach
          personally identifying request data.
        </P>
      </LegalSection>

      <LegalSection id="processors" heading="Who else processes it">
        <P>
          These are every third party that sees any part of your data, and what
          they see. A data processing agreement must be on file with each one
          before launch:{" "}
          <OwnerPlaceholder>confirm DPAs signed with each processor</OwnerPlaceholder>
          .
        </P>
        <LegalTable
          caption="Sub-processors"
          columns={["Processor", "What it handles", "Where"]}
          rows={[
            [
              "Paddle",
              "Merchant of record for every purchase: checkout, card data, VAT, invoices, refunds and the customer portal. We receive the fact of a subscription, not your card.",
              <OwnerPlaceholder key="paddle">confirm Paddle entity &amp; region</OwnerPlaceholder>,
            ],
            [
              "Google",
              "Optional Google sign-in. Google tells us the email address and name on the account you choose.",
              "Global",
            ],
            [
              "SendGrid",
              "Transactional email: magic links, invitations, alert mail, receipts. Sees the recipient address and the message.",
              <OwnerPlaceholder key="sg">confirm sending region / EU data residency</OwnerPlaceholder>,
            ],
            [
              "PostHog",
              "Product analytics for signed-in users only.",
              <OwnerPlaceholder key="ph">confirm US or EU cloud instance</OwnerPlaceholder>,
            ],
            [
              "Backblaze B2",
              "Storage for nightly database backups, encrypted before they leave our server.",
              <OwnerPlaceholder key="b2">confirm bucket region</OwnerPlaceholder>,
            ],
            [
              "bunny.net",
              "Content delivery for map tiles and static assets. Sees request metadata, including IP addresses, as any CDN does.",
              "Global edge",
            ],
            [
              "Hosting provider",
              "The server the application and its database run on.",
              <OwnerPlaceholder key="host">hosting provider &amp; datacentre location</OwnerPlaceholder>,
            ],
          ]}
        />
        <P>
          Plausible and GlitchTip are not on this list because they are not
          third parties: both run on our own server, and the data they hold
          never leaves it.
        </P>
        <P>
          Where a processor is outside the EU/EEA, transfers rely on the
          European Commission&rsquo;s standard contractual clauses or an
          adequacy decision.{" "}
          <OwnerPlaceholder>
            confirm the transfer mechanism for each non-EEA processor
          </OwnerPlaceholder>
        </P>
      </LegalSection>

      <LegalSection id="retention" heading="How long we keep it">
        <UL>
          <li>
            <strong className="text-text">Account data</strong> — for as long
            as the account exists, and{" "}
            <OwnerPlaceholder>retention period after closure</OwnerPlaceholder>{" "}
            after you close it.
          </li>
          <li>
            <strong className="text-text">Purchase and tax records</strong> —
            for the period the applicable tax law requires, which Paddle also
            retains as merchant of record.{" "}
            <OwnerPlaceholder>statutory retention period</OwnerPlaceholder>
          </li>
          <li>
            <strong className="text-text">Backups</strong> — database backups
            are taken nightly, encrypted, and kept on a rolling schedule of 30
            daily, 8 weekly and 12 monthly copies. Deleted data survives in
            backups until those copies age out; it is not restored into the
            live service.
          </li>
          <li>
            <strong className="text-text">Error reports and server logs</strong>{" "}
            — <OwnerPlaceholder>log retention period</OwnerPlaceholder>.
          </li>
        </UL>
      </LegalSection>

      <LegalSection id="security" heading="How it is protected">
        <UL>
          <li>
            Everything is served over HTTPS. Session cookies are HttpOnly,
            Secure and SameSite=Lax, and their contents are cryptographically
            signed, so a tampered cookie is rejected rather than trusted.
          </li>
          <li>
            We never handle your card. Paddle takes payment on its own pages
            and tells us only that a subscription started, changed or ended.
          </li>
          <li>
            The database is reachable only from inside the application&rsquo;s
            private network — it is not exposed to the internet.
          </li>
          <li>
            Backups are encrypted on our server before upload, so the storage
            provider holds ciphertext.
          </li>
          <li>
            Logs are written with email addresses and IP addresses redacted at
            the point the log line is constructed.
          </li>
        </UL>
        <P>
          No system is perfect. If you find a security problem, please report
          it to{" "}
          <OwnerPlaceholder>security contact email</OwnerPlaceholder> before
          disclosing it publicly.
        </P>
      </LegalSection>

      <LegalSection id="your-rights" heading="Your rights">
        <P>
          If you are in the EU/EEA or the UK you have the right to access a
          copy of your data, to have it corrected, to have it erased, to
          restrict or object to processing, to portability, and to withdraw
          consent where processing rests on it. Everyone who uses the service
          gets the same treatment on request regardless of where they live.
        </P>
        <P>
          Email <OwnerPlaceholder>data protection contact email</OwnerPlaceholder>{" "}
          and we will answer within one month. There is currently no
          self-service delete button in the account area — closure and erasure
          are handled by that address.{" "}
          <OwnerPlaceholder>
            confirm the erasure workflow, or ship self-service deletion
          </OwnerPlaceholder>
        </P>
        <P>
          Alert emails carry a one-click unsubscribe, which takes effect
          without needing to contact anyone.
        </P>
        <P>
          You may also complain to your local supervisory authority. Ours is{" "}
          <OwnerPlaceholder>lead supervisory authority</OwnerPlaceholder>.
        </P>
      </LegalSection>

      <LegalSection id="children" heading="Children">
        <P>
          The service is not directed at children and we do not knowingly
          collect data from anyone under{" "}
          <OwnerPlaceholder>minimum age, e.g. 16</OwnerPlaceholder>. If you
          believe a child has created an account, tell us and we will remove
          it.
        </P>
      </LegalSection>

      <LegalSection id="climate-data" heading="Where the climate data comes from">
        <P>
          None of it is about you — it is reference data, computed once and
          served to everybody identically. It is listed here because knowing
          what a page is built from is part of knowing what it does.
        </P>
        <UL>
          <li>
            <strong className="text-text">Climate</strong> — ERA5, the ECMWF
            reanalysis distributed through the Copernicus Climate Data Store.
            We compute ten-year monthly averages and percentiles from it.
          </li>
          <li>
            <strong className="text-text">Country and region boundaries</strong>{" "}
            — Natural Earth (public domain) for countries and first-level
            subdivisions, and geoBoundaries for second-level districts.
          </li>
          <li>
            <strong className="text-text">Travel advisories</strong> — the
            published advisories of six governments: the United States, the
            United Kingdom, Canada, Australia, Germany and the Netherlands.
            Each record keeps its source link and the date it was fetched, and
            the level shown by default is the highest of the six.
          </li>
        </UL>
        <P>
          Attribution and licence terms for these sources are set out in the{" "}
          <Link href="/terms#data" className="text-text-link underline underline-offset-2">
            Terms of Service
          </Link>
          .
        </P>
      </LegalSection>

      <LegalSection id="changes" heading="Changes to this policy">
        <P>
          If this policy changes materially we will say so on the site before
          the change takes effect, and where the law requires it we will ask
          again for your consent. The date at the top of this page is when it
          was last reviewed.
        </P>
      </LegalSection>
    </LegalPage>
  );
}
