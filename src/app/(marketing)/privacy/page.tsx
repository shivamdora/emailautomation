import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Database, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

const effectiveDate = "March 28, 2026";

const highlights = [
  {
    title: "Mailbox permissions",
    description:
      "OutboundFlow requests only the Google Workspace Gmail and Microsoft 365 Outlook permissions needed to connect a mailbox, send outbound email, sync replies, and keep campaign state accurate.",
    icon: Mail,
  },
  {
    title: "Security controls",
    description:
      "OAuth credentials are stored in encrypted form, access is limited to the service functions required to operate the product, and workspace access is scoped by account membership and product permissions.",
    icon: LockKeyhole,
  },
  {
    title: "Data handling limits",
    description:
      "OutboundFlow does not sell Google or Microsoft user data, does not use mailbox data for advertising, and does not use Google Workspace API data to develop, improve, or train generalized AI or machine learning models.",
    icon: ShieldCheck,
  },
  {
    title: "Workspace records",
    description:
      "The app stores workspace, contact, campaign, message-thread, and operational event data so teams can launch campaigns, monitor delivery, sync replies, and collaborate from one shared system.",
    icon: Database,
  },
];

const sections: LegalSection[] = [
  {
    id: "overview",
    title: "1. Scope and service identity",
    paragraphs: [
      "This Privacy Policy explains how OutboundFlow handles personal information when you access or use the OutboundFlow application and public website located at https://outbound-flow.vercel.app/. In this policy, \"OutboundFlow,\" \"we,\" \"our,\" and \"us\" refer to the operator of the OutboundFlow service.",
      "This policy is intended to support public-facing product use, Google Auth Platform verification, and Microsoft Entra branding and consent verification. It applies to information collected on the public site, inside the product, and through connected services such as Google Workspace Gmail and Microsoft 365 Outlook.",
    ],
  },
  {
    id: "collect",
    title: "2. Information we collect",
    paragraphs: [
      "We collect and process information needed to operate the service, authenticate users, run outbound campaigns, sync replies, and secure the product. The information we collect depends on how you use OutboundFlow and which integrations you connect.",
    ],
    bullets: [
      "Account and workspace data, such as your name, email address, role, workspace membership, and account authentication records.",
      "Campaign and contact data, including contact lists, imported records, campaign drafts, templates, send schedules, reply disposition, unsubscribe status, and related operating notes.",
      "Mailbox integration data, including connected mailbox address, provider account label, OAuth scopes, encrypted access and refresh credentials, token expiry, message-thread identifiers, headers, snippets, message bodies, and send or reply timestamps.",
      "Operational and security data, such as IP-derived logs, error traces, audit events, usage counters, job status, webhook events, and diagnostics needed to maintain the platform.",
    ],
  },
  {
    id: "use",
    title: "3. How we use information",
    paragraphs: [
      "We use personal information to provide, maintain, secure, and improve the user-facing functionality of OutboundFlow. That includes creating workspaces, authenticating users, connecting mailboxes, sending outreach, syncing replies, suppressing follow-ups after a response, updating campaign analytics, and troubleshooting product issues.",
      "We may also use information to prevent abuse, investigate security incidents, comply with law, enforce our Terms and Conditions, and communicate operational notices related to your use of the service.",
    ],
  },
  {
    id: "google",
    title: "4. Google user data and Gmail permissions",
    paragraphs: [
      "When you connect a Google account, OutboundFlow requests the Gmail scopes https://www.googleapis.com/auth/gmail.send, https://www.googleapis.com/auth/gmail.readonly, and https://www.googleapis.com/auth/gmail.modify. We also use the Gmail profile endpoint to identify the connected mailbox email address.",
      "We use Gmail data only to provide or improve the user-facing features of OutboundFlow. In practical terms, that means connecting a mailbox, sending campaign emails or manual replies, reading thread and message data to sync replies back into the workspace, updating campaign state when a recipient replies, and showing the team accurate inbox and thread history inside the product.",
      "OutboundFlow's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. We do not sell Google user data, use Google user data for targeted advertising, or use Google Workspace API data to develop, improve, or train generalized or non-personalized AI or machine learning models.",
    ],
    bullets: [
      "Google user data is accessed only after you authorize the mailbox connection.",
      "Google OAuth credentials are stored in encrypted form.",
      "Google mailbox content is processed so the service can send messages, sync threads, classify replies, and keep campaign records accurate.",
      "If you revoke Google's access to the app or disconnect the mailbox, future Google API access stops once valid credentials are no longer available to the service.",
    ],
  },
  {
    id: "microsoft",
    title: "5. Microsoft user data and Outlook permissions",
    paragraphs: [
      "When you connect a Microsoft account, OutboundFlow requests the scopes openid, profile, email, offline_access, User.Read, Mail.Send, and Mail.ReadWrite through the Microsoft identity platform and Microsoft Graph.",
      "We use Microsoft data to identify the connected mailbox, send email, create or continue reply threads, sync inbox activity back into OutboundFlow, update campaign and inbox records, and display workspace-visible thread history. We do not access Microsoft mailbox data for unrelated analytics, advertising, resale, or profiling outside the product features a user has asked us to provide.",
    ],
    bullets: [
      "Microsoft account profile data is used to identify the mailbox owner and connected mailbox address.",
      "Microsoft mailbox data is used to send outbound mail, create replies, read synchronized messages, and keep reply-aware campaign state accurate.",
      "Microsoft OAuth credentials are stored in encrypted form and refreshed only as needed to keep the connected mailbox working.",
    ],
  },
  {
    id: "sharing",
    title: "6. Sharing and disclosure",
    paragraphs: [
      "We do not sell personal information, Google user data, or Microsoft user data. We disclose information only when necessary to run the service, comply with law, protect rights and security, or complete an instruction authorized by the workspace.",
    ],
    bullets: [
      "Service providers that host, secure, or support the infrastructure used by OutboundFlow.",
      "Authorized workspace users who need shared visibility into campaigns, replies, contacts, and mailbox-connected activity.",
      "Integration endpoints or third-party services you intentionally configure, such as CRM adapters, webhooks, calendars, or similar connected tools.",
      "Regulators, law enforcement, or other parties when disclosure is legally required or necessary to investigate fraud, abuse, or security incidents.",
    ],
  },
  {
    id: "security",
    title: "7. Security protections",
    paragraphs: [
      "We use administrative, technical, and organizational measures designed to protect personal information against unauthorized access, loss, misuse, or disclosure. These measures include encrypted storage for OAuth credentials, access controls, logging, and environment-based secrets management.",
      "No service can guarantee absolute security. You are responsible for securing your account credentials, limiting access to authorized team members, and connecting only mailboxes and data sources you are permitted to use.",
    ],
  },
  {
    id: "retention",
    title: "8. Retention and deletion",
    paragraphs: [
      "We retain personal information for as long as it is needed to provide the service, maintain workspace history, enforce agreements, resolve disputes, comply with legal obligations, and protect the security and integrity of OutboundFlow.",
      "Campaign, contact, inbox, and workspace records may remain available until they are deleted by the workspace or removed during account closure or administrative cleanup. OAuth credentials remain stored only while a mailbox connection is maintained and are removed when no longer needed, revoked, or deleted as part of account or integration cleanup.",
      "If you want mailbox access to stop immediately, you can disconnect the mailbox in the product or revoke the app's access from your Google or Microsoft account settings. If you need a deletion request handled at the service level, please work through the workspace administrator or the service operator for this deployment.",
    ],
  },
  {
    id: "rights",
    title: "9. Your choices and rights",
    paragraphs: [
      "Depending on your location and relationship to the workspace, you may have rights to access, correct, export, restrict, or delete certain personal information. Many workspace records can also be updated or removed directly through the product by an authorized user.",
      "If you are using OutboundFlow through an employer, client, or private workspace, that organization may control some of the information processed in the service and may need to handle your request first.",
    ],
  },
  {
    id: "changes",
    title: "10. Policy changes",
    paragraphs: [
      "We may update this Privacy Policy from time to time to reflect product changes, legal requirements, security practices, or changes in how connected services are used. When we make a material change, we will update the effective date on this page and, where appropriate, provide an in-product notice or other reasonable notification.",
    ],
  },
  {
    id: "contact",
    title: "11. Privacy requests and contact",
    paragraphs: [
      "If you need to make a privacy, access, correction, or deletion request relating to this deployment of OutboundFlow, please contact the workspace administrator or the service operator who granted you access to the app. If you are the operator of this deployment, you are responsible for receiving and processing user requests relating to the data you control through the service.",
    ],
  },
];

export const metadata: Metadata = {
  title: "Privacy Policy | OutboundFlow",
  description:
    "Privacy Policy for OutboundFlow, including Google Auth Platform and Microsoft Entra verification disclosures.",
};

export default function PrivacyPage() {
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
            Privacy Policy for OutboundFlow
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[#544e68]">
            This page is the public privacy statement for the OutboundFlow application on
            https://outbound-flow.vercel.app/. It explains how OutboundFlow accesses, uses,
            stores, protects, and discloses personal information, including Google and Microsoft
            mailbox data connected through the product.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-[#5f5975]">
            <span className="rounded-full border border-[#ead7e3] bg-white/80 px-4 py-2">
              Effective date: {effectiveDate}
            </span>
            <span className="rounded-full border border-[#ead7e3] bg-white/80 px-4 py-2">
              Applicable domain: outbound-flow.vercel.app
            </span>
            <span className="rounded-full border border-[#ead7e3] bg-white/80 px-4 py-2">
              Related page: <Link href="/terms" className="font-medium text-[#b4236d]">Terms &amp; Conditions</Link>
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
