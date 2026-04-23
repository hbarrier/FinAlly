import { PageHeader } from "@/components/PageHeader";

export default function ReimbursementsPage() {
  return (
    <div>
      <PageHeader kicker="Refunds" title={<>Your <em>reimbursements</em>.</>} />
      <div className="fern-card">
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Reimbursements coming soon.</p>
      </div>
    </div>
  );
}
