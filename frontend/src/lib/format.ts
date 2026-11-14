export function money(v: number | string | null | undefined, c?: string) {
    if (v == null || v === "") return "-";
    const n = typeof v === "string" ? Number(v) : v;
    if (Number.isNaN(n)) return String(v);
    return `${n.toFixed(2)}${c ? " " + c : ""}`;
}
export function dt(v?: string | null) {
    if (!v) return "-";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
}
export function shortId(v?: string | null) {
    return v ? v.slice(0, 8) : "-";
}
