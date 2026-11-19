type Series = { values: number[]; stroke: string; fill?: string; dashed?: boolean };

export function LineChart({
  series,
  xLabels,
  formatY,
}: {
  series: Series[];
  xLabels: [string, string];
  formatY: (v: number) => string;
}) {
  const W = 720, H = 260, L = 8, R = 8, T = 12, B = 8;
  const n = Math.max(...series.map((s) => s.values.length));
  if (n < 2) return <div className="py-10 text-center text-sm text-green-800/60">Data grafik belum tersedia</div>;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(...all, 1);
  const min = Math.min(...all, 0) > 0 ? Math.min(...all) * 0.95 : Math.min(...all, 0);
  const x = (i: number, len: number) => L + (i / (len - 1)) * (W - L - R);
  const y = (v: number) => H - B - ((v - min) / (max - min || 1)) * (H - T - B);
  const path = (v: number[]) => v.map((p, i) => `${i ? "L" : "M"}${x(i, v.length).toFixed(1)},${y(p).toFixed(1)}`).join(" ");

  return (
    <div>
      <div className="relative">
        <span className="absolute left-1 top-0 rounded bg-white/80 px-1 text-xs text-green-800/60">{formatY(max)}</span>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1={L} x2={W - R} y1={T + g * (H - T - B)} y2={T + g * (H - T - B)} className="stroke-green-50" />
          ))}
          {series.map((s, i) => (
            <g key={i}>
              {s.fill && (
                <path
                  d={`${path(s.values)} L${x(s.values.length - 1, s.values.length)},${H - B} L${L},${H - B} Z`}
                  className={s.fill}
                />
              )}
              <path d={path(s.values)} fill="none" className={s.stroke} strokeWidth={2.5} strokeDasharray={s.dashed ? "6 5" : undefined} strokeLinejoin="round" />
            </g>
          ))}
        </svg>
      </div>
      <div className="flex justify-between text-xs text-green-800/60">
        <span>{xLabels[0]}</span>
        <span>{xLabels[1]}</span>
      </div>
    </div>
  );
}

export function BarChart({
  data,
  format,
}: {
  data: { label: string; value: number; sub?: string }[];
  format: (v: number) => string;
}) {
  if (!data.length) return <div className="py-8 text-center text-sm text-green-800/60">Tidak ada riwayat dividen</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex h-56 items-end gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[11px] font-medium tabular-nums text-green-800">{format(d.value)}</span>
          {d.sub && <span className="text-[11px] font-semibold tabular-nums text-green-600">{d.sub}</span>}
          <div className="w-full rounded-t-md bg-green-500" style={{ height: `${Math.max((d.value / max) * 65, 2)}%` }} />
          <span className="text-xs text-green-800/60">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
