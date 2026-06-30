import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

export type KpiTone = "primary" | "success" | "warning" | "danger" | "neutral" | "info" | "violet";

type KpiCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  badge?: string;
  trend?: number;
  trendLabel?: string;
  icon: LucideIcon;
  tone?: KpiTone;
  /** Fond coloré uni (false = carte blanche) */
  filled?: boolean;
  /** Dégradé multicolore à la place du fond uni */
  multicolor?: boolean;
  loading?: boolean;
};

export function KpiCard({
  label,
  value,
  hint,
  badge,
  trend,
  trendLabel,
  icon: Icon,
  tone = "primary",
  filled = true,
  multicolor = false,
  loading,
}: KpiCardProps) {
  if (loading) {
    return (
      <div className="kpi-stat-card kpi-stat-card-skeleton" aria-busy="true" aria-label={label}>
        <div className="kpi-stat-card-shimmer" />
        <div className="kpi-stat-card-header">
          <div className="kpi-skeleton-line w-8 h-8 rounded-lg" />
          <div className="kpi-skeleton-line w-14 h-6 rounded-full" />
        </div>
        <div className="space-y-2.5">
          <div className="kpi-skeleton-line w-28 h-3.5" />
          <div className="kpi-skeleton-line w-36 h-9" />
        </div>
      </div>
    );
  }

  const trendUp = trend !== undefined && trend >= 0;
  const cardClass = [
    "kpi-stat-card",
    `kpi-stat-card-${tone}`,
    multicolor ? "kpi-stat-card-multicolor" : filled ? "kpi-stat-card-filled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass}>
      {multicolor && (
        <>
          <div className="kpi-stat-card-mesh" aria-hidden />
          <div className="kpi-stat-card-orb kpi-stat-card-orb-a" aria-hidden />
          <div className="kpi-stat-card-orb kpi-stat-card-orb-b" aria-hidden />
        </>
      )}
      <div className="kpi-stat-card-watermark" aria-hidden>
        <Icon size={88} strokeWidth={1.25} />
      </div>

      <div className="kpi-stat-card-header">
        <div className="kpi-stat-card-icon">
          <Icon size={30} strokeWidth={1.75} />
        </div>

        {trend !== undefined ? (
          <span
            className={`kpi-stat-card-badge ${trendUp ? "kpi-stat-card-badge-up" : "kpi-stat-card-badge-down"}`}
          >
            {trendUp ? "+" : ""}
            {trend}%
            {trendUp ? (
              <TrendingUp size={14} strokeWidth={2.5} />
            ) : (
              <TrendingDown size={14} strokeWidth={2.5} />
            )}
          </span>
        ) : badge ? (
          <span className="kpi-stat-card-badge">{badge}</span>
        ) : null}
      </div>

      <div className="kpi-stat-card-body">
        <p className="kpi-stat-card-label">{label}</p>
        <p className="kpi-stat-card-value tabular-nums">{value}</p>
        {hint && <p className="kpi-stat-card-hint">{hint}</p>}
        {trend !== undefined && trendLabel && (
          <p className="kpi-stat-card-hint">{trendLabel}</p>
        )}
      </div>
    </div>
  );
}
