import { PageHeader } from "@/components/PageHeader";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        kicker="Overview"
        title={<>Good morning, <em>Hermine</em>.</>}
      />
      <div className="fern-card">
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Dashboard coming soon.</p>
      </div>
    </div>
  );
}
