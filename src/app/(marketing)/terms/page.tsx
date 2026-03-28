import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, BadgeCheck, Mail, Scale, ShieldAlert } from "lucide-react";

type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

const effectiveDate = "March 28, 2026";

const highlights = [
  {
    title: "Authorized use only",
    description:
      "You may use OutboundFlow only for lawful business communication, with mailboxes, contacts, and data that you are authorized to access and process.",
    icon: BadgeCheck,
  },
  {
    title: "Mailbox integrations",
    description:
      "Google Workspace Gmail and Microsoft 365 Outlook connections are provided so the service can send messages, sync replies, and maintain shared campaign visibility.",
    icon: Mail,
  },
  {
    title: "Outbound compliance",
    description:
      "You are responsible for honoring unsubscribe requests, avoiding unlawful or abusive email practices, and complying with anti-spam, privacy, employment, and marketing laws.",
    icon: ShieldAlert,
  },
  {
    title: "Platform terms",
    description:
      "Use of Google, Microsoft, and other third-party integrations remains subject to the terms, policies, and technical limits of those providers.",
    icon: Scale,
  },
];

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "1. Agreement to these terms",
    paragraphs: [
      "These Terms and Conditions govern your access to and use of the OutboundFlow website and application located at https://outbound-flow.vercel.app/. By accessing the service, creating an account, connecting a mailbox, or using any product feature, you agree to these terms.",
      "If you are using OutboundFlow on behalf of a business, employer, client, or other organization, you represent that you are authorized to bind that organization to these terms and that \"you\" includes that organization.",
    ],
  },
  {
    id: "service",
    title: "2. Service description",
    paragraphs: [
      "OutboundFlow is an outbound campaign and inbox workspace that helps teams manage contacts, create and send email sequences, connect supported mailboxes, sync replies, and keep campaign activity visible in one place.",
      "Features may evolve over time and may include campaign management, shared inbox views, mailbox connection management, analytics, imports, integrations, automation, and operational tooling for outbound workflows.",
    ],
  },
  {
    id: "eligibility",
    title: "3. Eligibility and account responsibility",
    paragraphs: [
      "You must provide accurate information, keep your authentication credentials secure, and limit access to authorized users. You are responsible for all activity that occurs under your account or workspace credentials.",
      "You must promptly update information that becomes inaccurate and must not share access with anyone who is not authorized to use the service on your behalf.",
    ],
  },
  {
    id: "acceptable-use",
    title: "4. Acceptable use and legal compliance",
    paragraphs: [
      "You may use OutboundFlow only in compliance with applicable law and these terms. You are responsible for your campaigns, recipient lists, message content, consent or lawful basis where required, and operational decisions made through the product.",
    ],
    bullets: [
      "Do not use the service for spam, phishing, fraud, harassment, malware delivery, deceptive practices, or unlawful surveillance.",
      "Connect only the mailboxes, contacts, spreadsheets, and third-party systems that you are authorized to access and use.",
      "Honor opt-outs, unsubscribe requests, and suppression obligations, and do not continue sending after a reply or opt-out where sending should stop.",
      "Do not attempt to probe, disrupt, reverse engineer, or gain unauthorized access to the product, infrastructure, integrations, or other users' data.",
    ],
  },
  {
    id: "integrations",
    title: "5. Third-party integrations and platform rules",
    paragraphs: [
      "OutboundFlow may connect to third-party services, including Google Workspace Gmail, Microsoft 365 Outlook, CRMs, calendars, sheets, and webhook endpoints. Your use of those services remains subject to the third party's own terms, privacy notices, and API rules.",
      "You authorize OutboundFlow to access and process the integration data needed to provide the product features you enable. You are responsible for maintaining any required permissions, domain approvals, or internal authorizations for those integrations.",
    ],
  },
  {
    id: "customer-data",
    title: "6. Your data and permissions",
    paragraphs: [
      "You or your organization retain responsibility for the data you submit to the service, including campaign content, imports, contacts, and connected mailbox activity. You grant OutboundFlow a limited right to host, store, transmit, synchronize, transform, and display that data only as needed to operate the service and its user-facing features.",
      "If you submit personal data about other individuals, you are responsible for having an appropriate legal basis and for making any notices required by law.",
    ],
  },
  {
    id: "availability",
    title: "7. Service availability, changes, and suspension",
    paragraphs: [
      "We may update, improve, limit, or discontinue features at any time. We may suspend or restrict access if we reasonably believe it is necessary to prevent abuse, maintain security, respond to legal requirements, or protect the service, its users, or third parties.",
      "We may also suspend or terminate accounts or integrations that violate these terms, create excessive risk, or jeopardize the integrity of third-party platform access.",
    ],
  },
  {
    id: "ip",
    title: "8. Intellectual property",
    paragraphs: [
      "OutboundFlow and its software, branding, design, and related materials are protected by applicable intellectual property laws. Except for the limited rights expressly granted to use the service, these terms do not transfer ownership of the product or its underlying technology.",
    ],
  },
  {
    id: "disclaimers",
    title: "9. Disclaimers",
    paragraphs: [
      "OutboundFlow is provided on an \"as is\" and \"as available\" basis. To the maximum extent permitted by law, we disclaim warranties of merchantability, fitness for a particular purpose, non-infringement, uninterrupted availability, and error-free operation.",
      "We do not guarantee inbox placement, response rates, conversion outcomes, regulatory compliance for your specific use case, or uninterrupted access to third-party APIs or mailbox providers.",
    ],
  },
  {
    id: "liability",
    title: "10. Limitation of liability",
    paragraphs: [
      "To the maximum extent permitted by law, OutboundFlow and its operators will not be liable for indirect, incidental, consequential, special, exemplary, or punitive damages, or for lost profits, lost data, business interruption, goodwill loss, or procurement of substitute services arising out of or related to the service.",
      "To the maximum extent permitted by law, any aggregate liability arising from the service will be limited to the amount you paid, if any, for the service giving rise to the claim during the twelve months before the event that created the claim.",
    ],
  },
  {
    id: "updates",
    title: "11. Changes to these terms",
    paragraphs: [
      "We may update these Terms and Conditions from time to time. When we do, we will post the updated version on this page and update the effective date. Continued use of the service after the updated terms become effective constitutes acceptance of the revised terms.",
    ],
  },
  {
    id: "contact",
    title: "12. Questions about these terms",
    paragraphs: [
      "If you have a question about these terms, please contact the workspace administrator or the service operator responsible for this OutboundFlow deployment before using the service in a way that could create legal or compliance risk for your organization.",
    ],
  },
];

export const metadata: Metadata = {
  title: "Terms & Conditions | OutboundFlow",
  description:
    "Terms and Conditions for OutboundFlow, including public product and integration terms for verification and consent flows.",
};

export default function TermsPage() {
  return (
    <main className="page-gradient min-h-screen px-6 py-10 md:px-10 md:py-14">
      <div className="mx-auto max-w-5xl space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#5f5975] transition hover:text-[#b4236d]"
        >
          <ArrowLeft className="size-4" />
          Back to OutboundFlow
        </Link>

        <section className="marketing-light-cta-panel overflow-hidden px-7 py-8 md:px-10 md:py-10">
          <p className="font-mono text-xs uppercase tracking-[0.32em] text-[#b4236d]">
            Public legal page
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-[#1e1735] md:text-5xl">
            Terms &amp; Conditions for OutboundFlow
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[#544e68]">
            These terms govern use of the OutboundFlow website and application on
            https://outbound-flow.vercel.app/, including connected Gmail and Microsoft Outlook
            mailbox features, campaign workflows, reply sync, and related integrations.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-[#5f5975]">
            <span className="rounded-full border border-[#ead7e3] bg-white/80 px-4 py-2">
              Effective date: {effectiveDate}
            </span>
            <span className="rounded-full border border-[#ead7e3] bg-white/80 px-4 py-2">
              Related page: <Link href="/privacy" className="font-medium text-[#b4236d]">Privacy Policy</Link>
            </span>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {highlights.map(({ title, description, icon: Icon }) => (
            <article
              key={title}
              className="marketing-light-card p-6"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[#fff0f7] p-3 text-[#b4236d]">
                  <Icon className="size-5" />
                </div>
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#1e1735]">
                  {title}
                </h2>
              </div>
              <p className="mt-4 text-sm leading-7 text-[#5c566f]">{description}</p>
            </article>
          ))}
        </section>

        <article className="marketing-light-card p-7 md:p-9">
          <div className="flex flex-col gap-8">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24 border-b border-[#efe4eb] pb-8 last:border-b-0 last:pb-0">
                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[#1e1735]">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-base leading-8 text-[#4f4963]">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {section.bullets ? (
                  <ul className="mt-5 space-y-3 text-base leading-7 text-[#4f4963]">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-3">
                        <span className="mt-2 size-2 shrink-0 rounded-full bg-[#b4236d]" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}
