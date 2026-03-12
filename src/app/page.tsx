import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Inbox,
  ShieldCheck,
  Workflow,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Proof", href: "#proof" },
  { label: "Workflow", href: "#workflow" },
  { label: "Why OutboundFlow", href: "#why" },
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

export default function HomePage() {
  return (
    <main className="marketing-shell min-h-screen overflow-hidden">
      <ScrollReveal />
      <section className="marketing-grid relative isolate pt-6">
        <div className="marketing-orb marketing-orb-left" />
        <div className="marketing-orb marketing-orb-right" />
        <div className="marketing-orb marketing-orb-bottom" />

        <div className="px-6 md:px-10 lg:px-14">
          <div className="mx-auto max-w-7xl">
            <header className="marketing-panel flex flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-7">
              <Link href="/" className="flex items-center gap-3">
                <div className="rounded-full bg-white/10 p-2 shadow-[0_14px_36px_rgba(17,8,56,0.45)]">
                  <Image
                    src="/brand/rocket-logo.webp"
                    alt="OutboundFlow logo"
                    width={44}
                    height={44}
                    className="h-11 w-11 object-contain"
                    priority
                  />
                </div>
                <div>
                  <p className="text-xl font-semibold tracking-[-0.04em] text-white">
                    OutboundFlow
                  </p>
                  <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-white/58">
                    email campaign platform
                  </p>
                </div>
              </Link>

              <nav className="hidden items-center gap-8 text-sm text-white/70 lg:flex">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="transition hover:text-white">
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  asChild
                  className="border border-white/12 bg-white/4 !text-white hover:bg-white/10 hover:!text-white"
                >
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button
                  asChild
                  className="bg-[#ff2c88] text-white shadow-[0_16px_40px_rgba(255,44,136,0.35)] hover:bg-[#ff4a9c]"
                >
                  <Link href="/sign-up">Start free workspace</Link>
                </Button>
              </div>
            </header>
          </div>
        </div>

        <div className="marketing-hero mt-8">
          <video
            className="marketing-hero-video"
            src="/media/outboundflow-hero.mp4"
            autoPlay
            muted
            loop
            playsInline
          />
          <div className="marketing-hero-overlay" />

          <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-24 lg:px-14 lg:py-32">
            <div className="relative z-10 max-w-3xl space-y-7">
              <p className="font-mono text-sm uppercase tracking-[0.18em] text-white/62">
                SaaS email campaign platform
              </p>

              <div className="space-y-5">
                <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.06em] text-white md:text-6xl lg:text-7xl">
                  Launch email campaigns that turn cold leads into booked pipeline.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-white/80 md:text-xl">
                  Add contacts, send from real Gmail inboxes, track replies, and manage
                  follow-ups from one shared workspace.
                </p>
              </div>

              <p className="max-w-xl text-base font-medium leading-7 text-white/72 md:text-lg">
                Built for founders and lean GTM teams that need more replies without more tools.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Button
                  size="lg"
                  asChild
                  className="bg-[#ff2c88] text-white shadow-[0_18px_45px_rgba(255,44,136,0.38)] hover:bg-[#ff4a9c]"
                >
                  <Link href="/sign-up">
                    Start free workspace
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-white/58">
                  Gmail-native. Reply-aware. Real-time inbox sync.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="marketing-proof-section px-6 pb-20 pt-12 md:px-10 lg:px-14">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl" data-reveal="up">
              <p className="font-mono text-xs uppercase tracking-[0.32em] text-[#f6b3d7]">
                Why teams switch
              </p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
                Less tool switching. Faster campaign execution.
              </h2>
              <p className="mt-5 text-lg leading-8 text-white/68">
                OutboundFlow keeps lists, sends, replies, and follow-up context inside one
                workspace so operators can focus on conversion instead of coordination.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3" id="proof">
              {proofCards.map((card, index) => (
                <Card
                  key={card.stat}
                  data-reveal="up"
                  className={`marketing-card marketing-hover-card border-0 bg-transparent text-white shadow-none reveal-delay-${index + 1}`}
                >
                  <CardContent className="p-6">
                    <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#f6b3d7]">
                      {card.stat}
                    </p>
                    <p className="mt-4 text-lg leading-8 text-white/78">{card.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="product" className="marketing-product-section px-6 py-24 md:px-10 lg:px-14">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl" data-reveal="left">
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
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {productPillars.map(({ icon: Icon, eyebrow, title, description, bullets }, index) => (
              <article
                key={title}
                data-reveal="up"
                className={`marketing-light-card marketing-hover-card p-7 reveal-delay-${index + 1}`}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-[#f7d9e8] p-3 text-[#b4236d]">
                    <Icon className="size-5" />
                  </div>
                  <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#766f8d]">
                    {eyebrow}
                  </p>
                </div>
                <h3 className="mt-6 text-2xl font-semibold tracking-[-0.04em] text-[#1e1735]">
                  {title}
                </h3>
                <p className="mt-4 text-base leading-7 text-[#5c566f]">{description}</p>
                <div className="mt-6 space-y-3">
                  {bullets.map((bullet) => (
                    <div key={bullet} className="flex items-start gap-3 text-[#4f4963]">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#b4236d]" />
                      <p className="text-sm leading-6">{bullet}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="marketing-workflow-section px-6 py-24 md:px-10 lg:px-14">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div data-reveal="left">
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

            <div
              className="marketing-light-card marketing-hover-card mt-10 p-7 reveal-delay-1"
              id="why"
              data-reveal="left"
            >
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b4236d]">
                Who it is for
              </p>
              <div className="mt-5 space-y-4">
                {audiences.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-[#4f4963]">
                    <Zap className="mt-0.5 size-4 shrink-0 text-[#b4236d]" />
                    <p className="text-sm leading-6">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {workflowSteps.map((item, index) => (
              <div
                key={item.step}
                data-reveal="right"
                className={`marketing-light-card marketing-hover-card flex gap-5 p-6 md:p-7 reveal-delay-${index + 1}`}
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#ead7e3] bg-[#fff2f8] font-mono text-sm tracking-[0.24em] text-[#b4236d]">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-2xl font-semibold tracking-[-0.04em] text-[#1e1735]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-base leading-7 text-[#5c566f]">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-final-section px-6 pb-24 pt-8 md:px-10 lg:px-14">
        <div className="mx-auto max-w-7xl">
          <div
            data-reveal="up"
            className="marketing-light-cta-panel marketing-hover-card flex flex-col gap-8 overflow-hidden px-7 py-8 md:px-10 md:py-10 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.32em] text-[#b4236d]">
                Ready to move faster
              </p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#1e1735] md:text-5xl">
                Replace scattered outbound operations with one focused workspace.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#544e68]">
                Set up your workspace, connect Gmail, load contacts, and launch
                campaigns with reply visibility from day one.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Button
                size="lg"
                asChild
                className="bg-[#ff2c88] text-white shadow-[0_18px_45px_rgba(255,44,136,0.38)] hover:bg-[#ff4a9c]"
              >
                <Link href="/sign-up">
                  Create workspace
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                asChild
                className="border border-white/14 bg-white/6 text-white hover:bg-white/12"
              >
                <Link href="/sign-in">Sign in to product</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
