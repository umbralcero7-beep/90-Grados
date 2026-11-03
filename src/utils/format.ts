export function formatCOP(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '$ 0';
  }
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatDateTimeBogota(isoString?: string): string {
  const date = isoString ? new Date(isoString) : new Date();
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatTimeBogota(isoString?: string): string {
  const date = isoString ? new Date(isoString) : new Date();
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}
