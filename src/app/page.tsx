import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  Check,
  CircleCheck,
  FileText,
  GraduationCap,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  WandSparkles,
} from "lucide-react";

import { Brand } from "./_components/brand";
import { SiteHeader } from "./_components/site-header";

export const metadata: Metadata = {
  title: "AI Corporate Training Platform | BSource Training",
  description:
    "Create AI assessments, track live attendance with secure QR codes, and manage corporate learning from one platform.",
};

/* -------------------------------------------------------------------------- */
/*  Static content                                                            */
/* -------------------------------------------------------------------------- */

/** 15 x 15 decorative QR matrix: 1 paints a module, 0 leaves the tile bare. */
const QR_PATTERN: readonly number[] = [
  1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1,
  1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1,
  1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1,
  1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1,
  1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1,
  1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1,
  1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1,
  0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0,
  1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1,
  1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1, 0,
  1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0, 1, 0,
  1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0,
  1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 1, 0,
  1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0,
  1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 1,
];

const WEEKLY_PROGRESS = [42, 55, 48, 70, 62, 84, 76, 92] as const;

const LOGOS = [
  "NORTHSTAR",
  "APERTURE",
  "Vertex",
  "MONOLITH",
  "SYNAPSE",
] as const;

const QUIZ_STATS = [
  { value: "10 Questions", label: "Generated" },
  { value: "Mixed format", label: "Difficulty" },
  { value: "8 min", label: "Est. time" },
] as const;

const ASSESSMENT_CHECKS = [
  "Learning objectives identified",
  "Question difficulty calibrated",
  "Answer explanations generated",
] as const;

const WORKSPACE_ROLES = [
  { icon: ShieldCheck, label: "Admin" },
  { icon: GraduationCap, label: "Trainer" },
  { icon: BookOpenCheck, label: "Trainee" },
] as const;

const PASSPORT_STATS = [
  { value: "92%", label: "Compliance rate" },
  { value: "14", label: "Verified skills" },
  { value: "Top 8%", label: "Team ranking" },
] as const;

const STEPS = [
  {
    number: "01",
    icon: Upload,
    title: "Create & Schedule",
    copy: "Set up a session, invite a cohort, and upload your learning material.",
  },
  {
    number: "02",
    icon: Sparkles,
    title: "AI Generates & Validates",
    copy: "The assessment is built instantly, then stays open for trainer review.",
  },
  {
    number: "03",
    icon: BarChart3,
    title: "Scan, Learn & Track",
    copy: "Trainees check in, complete the quiz, and live analytics populate.",
  },
] as const;

const METRICS = [
  { value: "99%", label: "Faster quiz creation" },
  { value: "50k+", label: "Training sessions logged" },
  { value: "Enterprise", label: "Grade security" },
] as const;

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: ["Features", "Integrations", "Security", "Changelog"],
  },
  {
    title: "Resources",
    links: ["Help center", "API docs", "Guides", "Community"],
  },
  { title: "Company", links: ["About", "Careers", "Partners", "Contact"] },
  { title: "Legal", links: ["Privacy", "Terms", "Cookies", "Compliance"] },
] as const;

const slugify = (value: string) => value.toLowerCase().replace(/\s+/g, "-");

/* -------------------------------------------------------------------------- */
/*  Shared pieces                                                             */
/* -------------------------------------------------------------------------- */

function SectionHeading({
  eyebrow,
  title,
  copy,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  copy: string;
  align?: "center" | "left";
}) {
  const centered = align === "center";
  return (
    <div className={centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-muted-foreground">{copy}</p>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  copy,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  copy: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article className={`feature-card flex flex-col ${className ?? ""}`}>
      <span className="flex size-10 items-center justify-center rounded-lg border border-primary/15 bg-primary-soft text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-lg font-bold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
      {/* Mocks bottom-align so the tall first card stays balanced. */}
      <div className="mt-auto pt-6">{children}</div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main id="top">
        {/* ------------------------------------------------------------ Hero */}
        <section
          className="hero-grid px-5 pt-32 pb-20 sm:pt-36 lg:pb-28"
          aria-label="Introduction"
        >
          <div className="mx-auto max-w-4xl text-center">
            <p className="animate-rise inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-3.5 py-1.5 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Built for the future of workforce learning
            </p>

            <h1 className="animate-rise-delay mt-7 text-4xl leading-[1.08] font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Elevate Corporate Training with{" "}
              <span className="text-primary">AI-Powered Intelligence.</span>
            </h1>

            <p className="animate-rise-delay-2 mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Seamlessly manage training sessions, automate pedagogical
              assessments with Gemini AI, and track attendance via secure QR
              codes—all in one unified platform.
            </p>
          </div>

          {/* --------------------------------------- Dashboard mockup */}
          <div className="relative mx-auto mt-16 max-w-6xl lg:mt-20">
            <div className="dashboard-glow" aria-hidden="true" />

            <div
              className="dashboard-shell animate-rise relative"
              role="img"
              aria-label="BSource Training product dashboard preview"
            >
              {/* Window chrome */}
              <div className="flex h-11 items-center justify-between border-b border-dashboard-line px-4">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-live" />
                  <span className="dashboard-label">Live workspace</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-dashboard-dot" />
                  <span className="size-2 rounded-full bg-dashboard-dot" />
                  <span className="size-2 rounded-full bg-dashboard-dot" />
                </div>
              </div>

              <div className="grid gap-4 p-3 sm:p-5 lg:grid-cols-[1.15fr_.85fr]">
                {/* Panel A — AI Quiz Builder */}
                <div className="dashboard-panel p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="icon-tile">
                        <WandSparkles aria-hidden="true" />
                      </span>
                      <span className="block">
                        <span className="dashboard-label block">
                          Assessment engine
                        </span>
                        <span className="mt-1 block text-sm font-semibold text-dashboard-foreground">
                          AI Quiz Builder
                        </span>
                      </span>
                    </div>
                    <span className="status-pill">
                      <span className="size-1.5 rounded-full bg-live" />
                      Generating
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashboard-line bg-dashboard-inset p-3">
                    <FileText
                      className="size-4 shrink-0 text-dashboard-accent"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-dashboard-foreground">
                        Leadership_Fundamentals.pdf
                      </span>
                      <span className="block text-[0.65rem] text-dashboard-muted">
                        2.4 MB · 36 pages
                      </span>
                    </span>
                    <CircleCheck
                      className="size-4 shrink-0 text-live"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="mt-4">
                    <div className="flex items-baseline justify-between gap-3 text-[0.65rem] text-dashboard-muted">
                      <span>Analyzing learning objectives</span>
                      <span className="font-semibold text-dashboard-foreground">
                        84%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-dashboard-track">
                      <div
                        className="h-full rounded-full bg-dashboard-accent"
                        style={{ width: "84%" }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {QUIZ_STATS.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-md border border-dashboard-line bg-dashboard-inset px-2.5 py-2"
                      >
                        <p className="truncate text-[0.7rem] font-semibold text-dashboard-foreground">
                          {stat.value}
                        </p>
                        <p className="mt-0.5 truncate text-[0.6rem] text-dashboard-muted">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Panel B — Live Attendance */}
                <div className="dashboard-panel p-4 sm:p-5">
                  <div className="flex items-center gap-4">
                    <div className="shrink-0 rounded-lg bg-qr p-2 shadow-inner-panel">
                      <div
                        className="grid size-24 gap-px sm:size-28"
                        style={{
                          gridTemplateColumns: "repeat(15, minmax(0, 1fr))",
                        }}
                      >
                        {QR_PATTERN.map((module, index) => (
                          <span
                            key={index}
                            className={
                              module ? "rounded-[1px] bg-qr-ink" : undefined
                            }
                          />
                        ))}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="dashboard-label">Live attendance</p>
                      <p className="mt-1.5 text-2xl font-bold tracking-tight text-dashboard-foreground">
                        47 / 52
                      </p>
                      <p className="mt-0.5 text-[0.65rem] text-dashboard-muted">
                        Checked in securely
                      </p>
                      <p className="mt-3 flex items-center gap-1.5 text-[0.65rem] font-medium text-live">
                        <ScanLine className="size-3.5" aria-hidden="true" />
                        Token rotates in 24s
                      </p>
                    </div>
                  </div>
                </div>

                {/* Panel C — Skill Passport */}
                <div className="dashboard-panel p-4 sm:p-5 lg:col-span-2">
                  <div className="flex items-center gap-3">
                    <span className="icon-tile">
                      <BadgeCheck aria-hidden="true" />
                    </span>
                    <span className="block">
                      <span className="block text-sm font-semibold text-dashboard-foreground">
                        Team readiness overview
                      </span>
                      <span className="block text-[0.65rem] text-dashboard-muted">
                        Learning progress across all active tracks
                      </span>
                    </span>
                  </div>

                  <div className="mt-5 flex items-end gap-6 sm:gap-10">
                    <div className="flex flex-1 items-end gap-2 sm:gap-3">
                      {WEEKLY_PROGRESS.map((value, index) => (
                        <div
                          key={value + index}
                          className="flex flex-1 flex-col items-center gap-2"
                        >
                          <div className="flex h-20 w-full items-end overflow-hidden rounded-[3px] bg-dashboard-track sm:h-24">
                            <div
                              className="w-full rounded-[3px] bg-dashboard-bar"
                              style={{ height: `${value}%` }}
                            />
                          </div>
                          <span className="text-[0.6rem] font-semibold text-dashboard-muted">
                            W{index + 1}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex shrink-0 items-center gap-3 pb-6">
                      <div className="skill-ring flex size-16 items-center justify-center rounded-full">
                        <div className="flex size-12 items-center justify-center rounded-full bg-dashboard-panel text-xs font-bold text-dashboard-foreground">
                          92%
                        </div>
                      </div>
                      <div>
                        <p className="dashboard-label">Compliance</p>
                        <p className="mt-1 text-[0.65rem] text-dashboard-muted">
                          On track
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- Trusted by */}
        <section
          className="border-y border-border bg-section py-14"
          aria-label="Customers"
        >
          <div className="mx-auto max-w-7xl px-5">
            <p className="text-center text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
              Trusted by learning teams at forward-thinking companies
            </p>
            <div className="mt-8 grid grid-cols-2 items-center justify-items-center gap-x-6 gap-y-7 sm:grid-cols-5">
              {LOGOS.map((logo) => (
                <span
                  key={logo}
                  className="text-sm font-bold tracking-wide text-logo"
                >
                  {logo}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- Features */}
        <section id="features" className="scroll-mt-20 px-5 py-24 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="One connected platform"
              title="Every training workflow, intelligently orchestrated."
              copy="From content upload to verified competency, BSource removes administrative friction without sacrificing oversight."
            />

            <div className="mt-14 grid gap-4 lg:grid-cols-2">
              <FeatureCard
                icon={WandSparkles}
                title="AI Assessment Engine"
                copy="Instantly transform training PDFs into focused 10-question pedagogical quizzes using enterprise-grade language models."
                className="lg:row-span-2"
              >
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
                      <FileText className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        Cybersecurity Essentials.pdf
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Ready to generate
                      </span>
                    </span>
                  </div>

                  <ul className="mt-4 space-y-2.5">
                    {ASSESSMENT_CHECKS.map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-2.5 text-xs text-muted-foreground"
                      >
                        <Check
                          className="size-3.5 shrink-0 text-success"
                          aria-hidden="true"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </FeatureCard>

              <FeatureCard
                icon={QrCode}
                title="Live QR Attendance"
                copy="Rotating, secure tokens enable frictionless classroom check-ins while preventing proxy attendance."
              >
                <div className="flex items-center gap-4 rounded-lg bg-inverse p-4">
                  <ScanLine
                    className="size-8 shrink-0 text-inverse-accent"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-inverse-foreground">
                      Session check-in active
                    </span>
                    <span className="block text-xs text-inverse-muted">
                      47 attendees verified in real time
                    </span>
                  </span>
                  <span className="size-2 shrink-0 rounded-full bg-live" />
                </div>
              </FeatureCard>

              <FeatureCard
                icon={Users}
                title="Role-Based Workspaces"
                copy="Purpose-built portals give Admins, Trainers, and Trainees exactly the context and controls they need."
              >
                <div className="grid grid-cols-3 gap-2">
                  {WORKSPACE_ROLES.map((role) => (
                    <div
                      key={role.label}
                      className="flex flex-col items-center gap-2 rounded-lg border border-border bg-background px-2 py-3"
                    >
                      <role.icon
                        className="size-4 text-primary"
                        aria-hidden="true"
                      />
                      <span className="text-[11px] font-semibold">
                        {role.label}
                      </span>
                    </div>
                  ))}
                </div>
              </FeatureCard>

              <FeatureCard
                icon={BadgeCheck}
                title="The Skill Passport"
                copy="Turn mandatory learning into visible progression with gamified milestones, verified skills, and always-current compliance records."
                className="lg:col-span-2"
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  {PASSPORT_STATS.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-border bg-background px-4 py-3.5"
                    >
                      <p className="text-xl font-bold tracking-tight">
                        {stat.value}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </FeatureCard>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- How it works */}
        <section
          id="workflow"
          className="scroll-mt-16 border-y border-border bg-section px-5 py-24 lg:py-28"
        >
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              align="left"
              eyebrow="Simple by design"
              title="From material to mastery in three steps."
              copy="A connected workflow that gives trainers time back and gives leaders a clear view of readiness."
            />

            <div className="relative mt-14">
              <span className="timeline-line" aria-hidden="true" />
              <ol className="grid gap-10 lg:grid-cols-3 lg:gap-8">
                {STEPS.map((step) => (
                  <li key={step.number} className="relative">
                    <span className="relative z-10 flex size-12 items-center justify-center rounded-lg border border-primary/20 bg-background text-primary shadow-sm">
                      <step.icon className="size-5" aria-hidden="true" />
                    </span>
                    <p className="mt-5 text-[11px] font-bold tracking-[0.14em] text-primary">
                      STEP {step.number}
                    </p>
                    <h3 className="mt-2 text-lg font-bold tracking-tight">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {step.copy}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- Metrics */}
        <section className="border-y border-border" aria-label="Platform impact">
          <div className="mx-auto grid max-w-7xl divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {METRICS.map((metric) => (
              <div key={metric.label} className="px-5 py-10 text-center">
                <p className="text-3xl font-bold tracking-tight">
                  {metric.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------ Final CTA */}
        <section id="enterprise" className="scroll-mt-16 px-5 py-20 lg:py-24">
          <div className="cta-panel mx-auto max-w-7xl px-5 py-14 text-center sm:px-10 lg:py-20">
            <span className="mx-auto flex size-12 items-center justify-center rounded-lg border border-cta-line bg-cta-soft text-cta-accent">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>

            <h2 className="mt-6 text-3xl font-bold tracking-tight text-cta-foreground sm:text-4xl lg:text-5xl">
              Ready to transform your corporate training?
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-cta-muted">
              Join thousands of forward-thinking enterprises building more
              capable, compliant teams.
            </p>

            <Link
              id="pricing"
              href="/signup"
              className="mt-9 inline-flex scroll-mt-24 items-center gap-2 rounded-full bg-cta-button px-7 py-3.5 text-base font-semibold text-cta-button-foreground transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-cta-accent focus-visible:outline-none"
            >
              Get Started for Free
              <ArrowRight className="size-[18px]" aria-hidden="true" />
            </Link>

            <p className="mt-4 text-xs text-cta-muted">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-cta-accent underline-offset-4 hover:underline"
              >
                Log in
              </Link>
            </p>
          </div>
        </section>
      </main>

      {/* ----------------------------------------------------------- Footer */}
      <footer className="border-t border-border py-14">
        <div className="mx-auto max-w-7xl px-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
            <div className="col-span-2 lg:col-span-1">
              <Brand />
              <p className="mt-4 max-w-xs text-sm text-muted-foreground">
                Intelligent training infrastructure for high-performing
                organizations.
              </p>
            </div>

            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title}>
                <h3 className="text-xs font-bold tracking-wide">
                  {column.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link}>
                      <a
                        href={`#${slugify(link)}`}
                        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 border-t border-border pt-6">
            <p className="text-xs text-muted-foreground">
              © 2026 BSource Training. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
