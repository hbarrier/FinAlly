interface PageHeaderProps {
  kicker: string;
  title: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ kicker, title, actions }: PageHeaderProps) {
  return (
    <div className="fern-page-header">
      <div>
        <p className="fern-kicker">{kicker}</p>
        <h1 className="fern-page-title">{title}</h1>
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}
