import Image from "next/image";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Inbox,
  ShieldCheck,
  Workflow,
  Zap,
} from "lucide-react";
import { RotatingEyebrow } from "@/components/marketing/rotating-eyebrow";
import { DeferredHeroVideo } from "@/components/marketing/deferred-hero-video";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";
import { getSessionUser } from "@/lib/auth/session";

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Proof", href: "#proof" },
  { label: "Workflow", href: "#workflow" },
  { label: "Why OutboundFlow", href: "#why" },
];

const rotatingEyebrowItems = [
  "Email Campaign Platform",
  "Cibirix SEO Team Product",
  "Outbound Workspace",
  "Cibirix Outreach Product",
];

const productPillars = [
  {
    icon: Workflow,
    eyebrow: "Campaign orchestration",
    title: "Build sequences that stay readable and easy to launch",
    description:
      "Create outreach with clear step logic, live contact visibility, send-now controls, and workspace-safe collaboration.",
    bullets: [
      "Manual contact add, CSV import, and workspace audience management",
      "Two-step personalized sequences with fixed follow-up logic",
      "Immediate launch controls for operators who need campaigns live now",
    ],
  },
  {
    icon: Inbox,
    eyebrow: "Reply capture",
    title: "Turn campaign replies into a real operating inbox",
    description:
      "Stop losing hot conversations across personal mailboxes. Threads, replies, and campaign context stay tied to the contact record.",
    bullets: [
      "Shared inbox visibility for founders, SDRs, and GTM leads",
      "Reply-aware sending logic that stops sequences when prospects answer",
      "Live sync between mailbox activity, dashboards, and campaign records",
    ],
  },
  {
    icon: ShieldCheck,
    eyebrow: "Team control",
    title: "Run outbound from one secure, workspace-based system",
    description:
      "Keep users, contacts, mailboxes, and analytics scoped correctly while still moving fast inside a lightweight product stack.",
    bullets: [
      "Workspace membership and role-aware data access",
      "Centralized mailbox health and campaign state tracking",
      "Built for teams that need clarity, not enterprise bloat",
    ],
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Import the right contacts",
    description:
      "Bring in lists manually or from files, enrich campaign targeting, and keep every prospect visible before launch.",
  },
  {
    step: "02",
    title: "Launch from a real mailbox",
    description:
      "Choose the sending account, write the sequence, and push live immediately with controls built for actual outbound ops.",
  },
  {
    step: "03",
    title: "Work replies in real time",
    description:
      "New responses sync back into the product so the dashboard, inbox, and campaign health all reflect what is happening now.",
  },
];

const audiences = [
  "Founders running outbound before hiring a full GTM team",
  "Lean SDR teams that need shared visibility without extra tooling sprawl",
  "Agencies and operators managing multiple campaigns inside one workspace",
];

const proofCards = [
  {
    stat: "7 tabs -> 1 workspace",
    text: "Replace spreadsheet juggling, personal Gmail digging, and disconnected analytics with one operational surface.",
  },
  {
    stat: "Faster reply handling",
    text: "The moment a lead answers, your team can see it in the inbox instead of discovering it hours later in a mailbox.",
  },
  {
    stat: "Cleaner launch flow",
    text: "Contacts, copy, Gmail setup, and campaign sends are all handled in the same product, so campaigns do not stall mid-build.",
  },
];

function HydrationSafeDiv(props: ComponentPropsWithoutRef<"div">) {
  return <div suppressHydrationWarning {...props} />;
}

function getHomepageCtas(isAuthenticated: boolean) {
  if (isAuthenticated) {
    return {
      headerPrimary: {
        href: "/dashboard",
        label: "Open your dashboard",
      },
      heroPrimary: {
        href: "/dashboard",
        label: "Continue in workspace",
      },
      finalPrimary: {
        href: "/dashboard",
        label: "Go to dashboard",
      },
    };
  }

  return {
    headerPrimary: {
      href: "/sign-up",
      label: "Start free workspace",
    },
    heroPrimary: {
      href: "/sign-up",
      label: "Start your workspace",
    },
    finalPrimary: {
      href: "/sign-up",
      label: "Create workspace",
    },
  };
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  const isAuthenticated = Boolean(user);
  const ctas = getHomepageCtas(isAuthenticated);

  return (
    <main className="marketing-shell min-h-screen overflow-hidden">
      <ScrollReveal />
      <section className="marketing-grid relative isolate">
        <HydrationSafeDiv className="marketing-orb marketing-orb-left" />
        <HydrationSafeDiv className="marketing-orb marketing-orb-right" />
        <HydrationSafeDiv className="marketing-orb marketing-orb-bottom" />

        <HydrationSafeDiv className="marketing-hero">
          <DeferredHeroVideo />
          <HydrationSafeDiv className="marketing-hero-overlay" />

          <HydrationSafeDiv className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-6 pb-16 pt-4 md:px-10 md:pb-24 md:pt-5 lg:px-14 lg:pb-32">
            <header className="marketing-panel flex flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-7 lg:px-8">
              <Link href="/" className="flex items-center gap-3">
                <HydrationSafeDiv className="rounded-full bg-white/10 p-2 shadow-[0_14px_36px_rgba(17,8,56,0.45)]">
                  <Image
                    src="/brand/rocket-logo.webp"
                    alt="OutboundFlow logo"
                    width={44}
                    height={44}
                    className="h-11 w-11 -scale-x-100 object-contain"
                    priority
                  />
                </HydrationSafeDiv>
                <HydrationSafeDiv>
                  <p className="text-xl font-semibold tracking-[-0.04em] text-white">
                    OutboundFlow
                  </p>
                  <RotatingEyebrow
                    items={rotatingEyebrowItems}
                    className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/58 sm:text-[11px] sm:tracking-[0.2em]"
                  />
                </HydrationSafeDiv>
              </Link>

              <nav className="hidden items-center gap-8 text-sm text-white/70 lg:flex">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="transition hover:text-white">
                    {item.label}
                  </Link>
                ))}
              </nav>

              <HydrationSafeDiv className="flex items-center gap-3">
                {!isAuthenticated ? (
                  <Button
                    variant="ghost"
                    asChild
                    className="border border-white/12 bg-white/4 !text-white hover:bg-white/10 hover:!text-white"
                  >
                    <Link href="/sign-in">Sign in</Link>
                  </Button>
                ) : null}
                <Button
                  asChild
                  className="marketing-primary-button"
                >
                  <Link href={ctas.headerPrimary.href}>{ctas.headerPrimary.label}</Link>
                </Button>
              </HydrationSafeDiv>
            </header>

            <HydrationSafeDiv className="max-w-3xl space-y-7 pt-8 md:pt-12 lg:pt-16">
              <p className="font-mono text-sm uppercase tracking-[0.18em] text-white/62">
                Outbound campaign workspace
              </p>

              <HydrationSafeDiv className="space-y-5">
                <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.06em] text-white md:text-6xl lg:text-7xl">
                  Launch outbound that stays organized from first send to reply.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-white/80 md:text-xl">
                  Import leads, send from Gmail or Outlook, and keep every reply,
                  follow-up, and campaign update in one shared workspace.
                </p>
              </HydrationSafeDiv>

              <p className="max-w-xl text-base font-medium leading-7 text-white/72 md:text-lg">
                Built for founders, lean sales teams, and agencies that want clean
                execution without adding more software.
              </p>

              <HydrationSafeDiv className="flex flex-wrap items-center gap-4">
                <Button
                  size="lg"
                  asChild
                  className="marketing-primary-button"
                >
                  <Link href={ctas.heroPrimary.href}>
                    {ctas.heroPrimary.label}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </HydrationSafeDiv>
            </HydrationSafeDiv>
          </HydrationSafeDiv>
        </HydrationSafeDiv>

        <HydrationSafeDiv className="marketing-proof-section px-6 pb-20 pt-12 md:px-10 lg:px-14">
          <HydrationSafeDiv className="mx-auto max-w-7xl">
            <HydrationSafeDiv className="max-w-3xl" data-reveal="up">
              <p className="font-mono text-xs uppercase tracking-[0.32em] text-[#f6b3d7]">
                Why teams switch
              </p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
                Less tool switching. Faster campaign execution.
              </h2>
              <p className="mt-5 pb-4 text-lg leading-8 text-white/68">
                OutboundFlow keeps lists, sends, replies, and follow-up context inside one
                workspace so operators can focus on conversion instead of coordination.
              </p>
            </HydrationSafeDiv>

            <HydrationSafeDiv className="grid gap-4 md:grid-cols-3" id="proof">
              {proofCards.map((card, index) => (
                <article
                  key={card.stat}
                  data-reveal="up"
                  className={`marketing-proof-card marketing-hover-card reveal-delay-${index + 1}`}
                >
                  <HydrationSafeDiv className="flex h-full flex-col gap-4 p-6 sm:p-7">
                    <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#f6b3d7]">
                      {card.stat}
                    </p>
                    <p className="text-lg leading-8 text-white/78">{card.text}</p>
                  </HydrationSafeDiv>
                </article>
              ))}
            </HydrationSafeDiv>
          </HydrationSafeDiv>
        </HydrationSafeDiv>
      </section>

      <section id="product" className="marketing-product-section px-6 py-24 md:px-10 lg:px-14">
        <HydrationSafeDiv className="mx-auto max-w-7xl">
          <HydrationSafeDiv className="max-w-3xl" data-reveal="left">
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-[#b4236d]">
              Product pillars
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#1e1735] md:text-5xl">
              Everything your outbound motion needs, without the bloated sales stack.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#544e68]">
              The product is designed for teams that need to move from list to live
              conversation quickly, while still keeping clean campaign logic, shared
              visibility, and reply intelligence.
            </p>
          </HydrationSafeDiv>

          <HydrationSafeDiv className="mt-12 grid gap-6 lg:grid-cols-3">
            {productPillars.map(({ icon: Icon, eyebrow, title, description, bullets }, index) => (
              <article
                key={title}
                data-reveal="up"
                className={`marketing-light-card marketing-hover-card p-7 reveal-delay-${index + 1}`}
              >
                <HydrationSafeDiv className="flex items-center gap-3">
                  <HydrationSafeDiv className="rounded-2xl bg-[#f7d9e8] p-3 text-[#b4236d]">
                    <Icon className="size-5" />
                  </HydrationSafeDiv>
                  <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#766f8d]">
                    {eyebrow}
                  </p>
                </HydrationSafeDiv>
                <h3 className="mt-6 text-2xl font-semibold tracking-[-0.04em] text-[#1e1735]">
                  {title}
                </h3>
                <p className="mt-4 text-base leading-7 text-[#5c566f]">{description}</p>
                <HydrationSafeDiv className="mt-6 space-y-3">
                  {bullets.map((bullet) => (
                    <HydrationSafeDiv key={bullet} className="flex items-start gap-3 text-[#4f4963]">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#b4236d]" />
                      <p className="text-sm leading-6">{bullet}</p>
                    </HydrationSafeDiv>
                  ))}
                </HydrationSafeDiv>
              </article>
            ))}
          </HydrationSafeDiv>
        </HydrationSafeDiv>
      </section>

      <section id="workflow" className="marketing-workflow-section px-6 py-24 md:px-10 lg:px-14">
        <HydrationSafeDiv className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <HydrationSafeDiv data-reveal="left">
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-[#b4236d]">
              Workflow
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#1e1735] md:text-5xl">
              A cleaner path from cold list to qualified reply.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#544e68]">
              OutboundFlow is opinionated enough to keep operators moving, while still
              flexible enough for real campaign execution.
            </p>

            <HydrationSafeDiv
              className="marketing-light-card marketing-hover-card mt-10 p-7 reveal-delay-1"
              id="why"
              data-reveal="left"
            >
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b4236d]">
                Who it is for
              </p>
              <HydrationSafeDiv className="mt-5 space-y-4">
                {audiences.map((item) => (
                  <HydrationSafeDiv key={item} className="flex items-start gap-3 text-[#4f4963]">
                    <Zap className="mt-0.5 size-4 shrink-0 text-[#b4236d]" />
                    <p className="text-sm leading-6">{item}</p>
                  </HydrationSafeDiv>
                ))}
              </HydrationSafeDiv>
            </HydrationSafeDiv>
          </HydrationSafeDiv>

          <HydrationSafeDiv className="space-y-5">
            {workflowSteps.map((item, index) => (
              <HydrationSafeDiv
                key={item.step}
                data-reveal="right"
                className={`marketing-light-card marketing-hover-card flex gap-5 p-6 md:p-7 reveal-delay-${index + 1}`}
              >
                <HydrationSafeDiv className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#ead7e3] bg-[#fff2f8] font-mono text-sm tracking-[0.24em] text-[#b4236d]">
                  {item.step}
                </HydrationSafeDiv>
                <HydrationSafeDiv>
                  <h3 className="text-2xl font-semibold tracking-[-0.04em] text-[#1e1735]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-base leading-7 text-[#5c566f]">
                    {item.description}
                  </p>
                </HydrationSafeDiv>
              </HydrationSafeDiv>
            ))}
          </HydrationSafeDiv>
        </HydrationSafeDiv>
      </section>

      <section className="marketing-final-section px-6 pb-12 pt-8 md:px-10 lg:px-14">
        <HydrationSafeDiv className="mx-auto max-w-7xl">
          <HydrationSafeDiv
            data-reveal="up"
            className="marketing-light-cta-panel marketing-hover-card flex flex-col gap-8 overflow-hidden px-7 py-8 md:px-10 md:py-10 lg:flex-row lg:items-center lg:justify-between"
          >
            <HydrationSafeDiv className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.32em] text-[#b4236d]">
                Ready to move faster
              </p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#1e1735] md:text-5xl">
                Replace scattered outbound operations with one focused workspace.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#544e68]">
                Set up your workspace, connect Gmail or Outlook, load contacts, and
                launch campaigns with reply visibility from day one.
              </p>
            </HydrationSafeDiv>

            <HydrationSafeDiv className="flex flex-wrap gap-4">
              <Button
                size="lg"
                asChild
                className="marketing-primary-button"
              >
                <Link href={ctas.finalPrimary.href}>
                  {ctas.finalPrimary.label}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              {!isAuthenticated ? (
                <Button
                  size="lg"
                  variant="ghost"
                  asChild
                  className="border border-white/14 bg-white/6 text-white hover:bg-white/12"
                >
                  <Link href="/sign-in">Sign in to product</Link>
                </Button>
              ) : null}
            </HydrationSafeDiv>
          </HydrationSafeDiv>
        </HydrationSafeDiv>
      </section>

      <footer className="marketing-footer px-6 py-4 md:px-10 lg:px-14">
        <HydrationSafeDiv className="mx-auto flex max-w-7xl flex-col gap-4 border-t border-[#e7d6e3] pt-4 text-sm text-[#6f6882] md:flex-row md:items-center md:justify-between">
          <HydrationSafeDiv>
            <p>OutboundFlow</p>
            <p className="mt-1 text-xs text-[#8a829c]">
              Public product site for Gmail and Microsoft 365 outbound workflow tooling.
            </p>
          </HydrationSafeDiv>
          <HydrationSafeDiv className="flex flex-wrap items-center gap-5">
            <Link href="/privacy" className="transition hover:text-[#b4236d]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition hover:text-[#b4236d]">
              Terms &amp; Conditions
            </Link>
            <p>Built by the Cibirix SEO team</p>
          </HydrationSafeDiv>
        </HydrationSafeDiv>
      </footer>
    </main>
  );
}
