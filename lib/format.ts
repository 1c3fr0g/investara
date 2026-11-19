const nf = (v: number, d = 0) =>
  v.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });

export const dash = "-";

export const rp = (v: number | null | undefined) => (v == null ? dash : "Rp " + nf(Math.round(v)));
export const num = (v: number | null | undefined, d = 2) => (v == null ? dash : nf(v, d));
export const pct = (v: number | null | undefined, d = 2) => (v == null ? dash : nf(v, d) + "%");

export function compact(v: number | null | undefined) {
  if (v == null) return dash;
  const a = Math.abs(v);
  if (a >= 1e12) return `Rp ${nf(v / 1e12, 2)} T`;
  if (a >= 1e9) return `Rp ${nf(v / 1e9, 2)} M`;
  if (a >= 1e6) return `Rp ${nf(v / 1e6, 2)} Jt`;
  return rp(v);
}

export function compactNum(v: number | null | undefined) {
  if (v == null) return dash;
  const a = Math.abs(v);
  if (a >= 1e9) return `${nf(v / 1e9, 2)} M`;
  if (a >= 1e6) return `${nf(v / 1e6, 2)} Jt`;
  return nf(v);
}
