import { PageHeader } from "@/components/PageHeader";

export default function RecurringPage() {
  return (
    <div>
      <PageHeader kicker="Subscriptions" title={<>Recurring <em>payments</em>.</>} />
      <div className="fern-card">
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Recurring coming soon.</p>
      </div>
    </div>
  );
}
