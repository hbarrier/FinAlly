import { PageHeader } from "@/components/PageHeader";

export default function MovementsPage() {
  return (
    <div>
      <PageHeader kicker="Transactions" title={<>Your <em>movements</em>.</>} />
      <div className="fern-card">
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Movements coming soon.</p>
      </div>
    </div>
  );
}
