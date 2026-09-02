// Small helpers for local timestamp handling
export function toLocalDateTimeInput(iso) {
  // Convert ISO to yyyy-MM-ddTHH:mm for <input type="datetime-local">
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalDateTimeInput(local) {
  // local like '2026-02-01T14:30' -> full ISO in local time
  if (!local) return new Date().toISOString();
  const d = new Date(local);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export function nowLocalDateTimeInput() {
  return toLocalDateTimeInput(new Date().toISOString());
}
