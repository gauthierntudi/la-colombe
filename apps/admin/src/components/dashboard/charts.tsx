"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useTheme } from "@/components/theme/theme-provider";

const STOCK_DATA_EMPTY = [
  { month: "Jan", entrees: 0, sorties: 0 },
  { month: "Fév", entrees: 0, sorties: 0 },
  { month: "Mar", entrees: 0, sorties: 0 },
  { month: "Avr", entrees: 0, sorties: 0 },
  { month: "Mai", entrees: 0, sorties: 0 },
  { month: "Juin", entrees: 0, sorties: 0 },
  { month: "Juil", entrees: 0, sorties: 0 },
  { month: "Aoû", entrees: 0, sorties: 0 },
  { month: "Sep", entrees: 0, sorties: 0 },
  { month: "Oct", entrees: 0, sorties: 0 },
  { month: "Nov", entrees: 0, sorties: 0 },
  { month: "Déc", entrees: 0, sorties: 0 },
];

const CATEGORY_COLORS = ["#0d30f5", "#f59e0b", "#10b981", "#8b5cf6"];

type StockActivityPoint = { month: string; entrees: number; sorties: number };

type CategoryStat = { name: string; value: number; color: string };

type ChartsProps = {
  categories: CategoryStat[];
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111827] text-white text-xs rounded-xl px-4 py-3 shadow-xl">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export function StockActivityChart({ data }: { data?: StockActivityPoint[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const chartData = data?.length ? data : STOCK_DATA_EMPTY;
  const gridColor = isDark ? "#212933" : "#f0f3f8";
  const tickColor = isDark ? "#64748b" : "#9ca3af";
  const barEntrees = isDark ? "#2a3544" : "#e4e9f2";

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-[var(--text)]">Mouvements stock</h3>
          <p className="text-xs text-[var(--muted)] mt-0.5">Entrées vs sorties mensuelles (année en cours)</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barGap={4} barSize={14}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: tickColor }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: tickColor }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(59,110,246,0.05)" }} />
          <Bar dataKey="entrees" name="Entrées" fill={barEntrees} radius={[4, 4, 0, 0]} />
          <Bar dataKey="sorties" name="Sorties" fill="#0d30f5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-4">
        <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: barEntrees }} /> Entrées
        </span>
        <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="w-3 h-3 rounded-sm bg-[var(--accent)] inline-block" /> Sorties
        </span>
      </div>
    </div>
  );
}

export function CategoryChart({ categories }: ChartsProps) {
  const data = categories.length
    ? categories
    : [{ name: "Aucune donnée", value: 1, color: "#e4e9f2" }];

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-[var(--text)]">Répartition produits</h3>
          <p className="text-xs text-[var(--muted)] mt-0.5">Par catégorie</p>
        </div>
        <select className="text-xs bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[var(--text-secondary)]">
          <option>Tous les sites</option>
        </select>
      </div>

      <div className="flex items-center gap-4">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={65}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={entry.color ?? CATEGORY_COLORS[i % 4]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="flex-1 space-y-2.5">
          {data.map((cat, i) => (
            <div key={cat.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: cat.color ?? CATEGORY_COLORS[i % 4] }}
                />
                <span className="text-sm text-[var(--text-secondary)]">{cat.name}</span>
              </div>
              <span className="text-sm font-semibold">{cat.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SitesOverview({
  sites,
}: {
  sites: { name: string; code: string; type: string; stock: number }[];
}) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-[var(--text)]">Stock par site</h3>
          <p className="text-xs text-[var(--muted)] mt-0.5">Unités disponibles</p>
        </div>
      </div>
      <div className="space-y-3">
        {sites.map((site) => (
          <div
            key={site.code}
            className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg)]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--accent)]">
                {site.code.slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-semibold">{site.name}</p>
                <span
                  className={`badge ${site.type === "STORE" ? "badge-store" : "badge-depot"} mt-0.5`}
                >
                  {site.type}
                </span>
              </div>
            </div>
            <p className="text-lg font-bold text-[var(--text)]">{site.stock}</p>
          </div>
        ))}
        {sites.length === 0 && (
          <p className="text-sm text-[var(--muted)] text-center py-4">Aucun site</p>
        )}
      </div>
    </div>
  );
}
