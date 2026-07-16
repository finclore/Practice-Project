import type { ReactNode } from "react";

export function DeskHeader({
  question,
  title,
  actions,
}: {
  question: string;
  title?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-border bg-card">
      <div className="max-w-6xl mx-auto px-8 py-6 flex items-start justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {title ?? "Desk"}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            {question}
          </h1>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function DeskBody({ children }: { children: ReactNode }) {
  return <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>;
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-8 py-16 text-center">
      <h2 className="text-base font-medium text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
        {description}
      </p>
    </div>
  );
}
