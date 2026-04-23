import { PageHeader } from "@/components/PageHeader";

export default function BudgetsPage() {
  return (
    <div>
      <PageHeader kicker="Planning" title={<>Your <em>budgets</em>.</>} />
      <div className="fern-card">
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Budgets coming soon.</p>
      </div>
    </div>
  );
}
