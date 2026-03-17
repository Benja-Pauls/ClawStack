import { Link } from "react-router-dom";
import Button from "@/components/Button";

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          ClawStack
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          A production-ready fullstack template for AI-agent-assisted
          development.
        </p>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          title="React + TypeScript"
          description="Type-safe frontend with React 18, strict TypeScript, and Vite for fast development."
        />
        <FeatureCard
          title="Tailwind CSS v4"
          description="Utility-first styling with CSS custom properties for consistent theming."
        />
        <FeatureCard
          title="React Query"
          description="Powerful server state management with caching, background updates, and mutations."
        />
        <FeatureCard
          title="API Client"
          description="Typed fetch-based API client with structured error handling."
        />
        <FeatureCard
          title="Docker Ready"
          description="Multi-stage Docker build with Nginx for production deployment."
        />
        <FeatureCard
          title="Testing"
          description="Vitest and Testing Library configured for unit and integration tests."
        />
      </section>

      <section className="flex justify-center">
        <Link to="/items">
          <Button>Browse Items</Button>
        </Link>
      </section>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-6 transition-shadow hover:shadow-md">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
