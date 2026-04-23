import { PageHeader } from "@/components/PageHeader";

export default function CategoriesPage() {
  return (
    <div>
      <PageHeader kicker="Tags" title={<>Spending <em>categories</em>.</>} />
      <div className="fern-card">
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>Categories coming soon.</p>
      </div>
    </div>
  );
}
