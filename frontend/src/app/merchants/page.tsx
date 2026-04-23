import { PageHeader } from "@/components/PageHeader";

export default function MerchantsPage() {
  return (
    <div>
      <PageHeader kicker="Payees" title={<>Your <em>merchants</em>.</>} />
      <div className="fern-card">
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Merchants coming soon.</p>
      </div>
    </div>
  );
}
