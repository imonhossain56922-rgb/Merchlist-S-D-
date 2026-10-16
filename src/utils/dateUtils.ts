export const DEFAULT_TIMEZONE = 'Asia/Dubai';

export function getNowInTimezone(timeZone = DEFAULT_TIMEZONE): Date {
  const now = new Date();
  return now;
}

export function formatDateInTimezone(
  dateInput: string | Date | number | undefined | null,
  timeZone = DEFAULT_TIMEZONE,
  includeTime = true
): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '-';

    const options: Intl.DateTimeFormatOptions = {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      ...(includeTime
        ? {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }
        : {}),
    };
    return new Intl.DateTimeFormat('en-US', options).format(d);
  } catch {
    return String(dateInput);
  }
}

export function getTimeOnlyInTimezone(
  dateInput: string | Date | number | undefined | null,
  timeZone = DEFAULT_TIMEZONE
): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return '-';
  }
}

export function getDateKeyInTimezone(
  dateInput: string | Date | number | undefined | null,
  timeZone = DEFAULT_TIMEZONE
): string {
  if (!dateInput) return '';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d); // YYYY-MM-DD
  } catch {
    return '';
  }
}

export function getTodayKeyInTimezone(timeZone = DEFAULT_TIMEZONE): string {
  return getDateKeyInTimezone(new Date(), timeZone);
}

export function formatWaitingTime(startTime: string | Date, endTime?: string | Date | null): string {
  if (!startTime) return '-';
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();

  if (isNaN(start) || isNaN(end)) return '-';
  const diffMs = Math.max(0, end - start);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min`;
  if (diffHours < 24) {
    const remainingMins = diffMinutes % 60;
    return remainingMins > 0 ? `${diffHours} hr ${remainingMins} min` : `${diffHours} hr`;
  }
  const remainingHours = diffHours % 24;
  return remainingHours > 0 ? `${diffDays} day ${remainingHours} hr` : `${diffDays} day`;
}

export interface DayOverviewStats {
  createdToday: number;
  completedToday: number;
  pendingToday: number;
  previousPending: number;
  totalPending: number;
  completionRate: number;
  urgentCount: number;
  superUrgentCount: number;
}

export function calculateDailyOverview(
  requests: Array<{
    createdAt: string;
    completedAt?: string | null;
    status: 'PENDING' | 'REJECTED' | 'COMPLETED';
    priority: 'REGULAR' | 'URGENT' | 'SUPER_URGENT';
    deleted?: boolean;
  }>,
  timeZone = DEFAULT_TIMEZONE
): DayOverviewStats {
  const todayKey = getTodayKeyInTimezone(timeZone);

  let createdToday = 0;
  let completedToday = 0;
  let pendingToday = 0;
  let previousPending = 0;
  let urgentCount = 0;
  let superUrgentCount = 0;

  for (const req of requests) {
    if (req.deleted) continue;

    const reqCreatedKey = getDateKeyInTimezone(req.createdAt, timeZone);
    const reqCompletedKey = req.completedAt ? getDateKeyInTimezone(req.completedAt, timeZone) : null;

    if (reqCreatedKey === todayKey) {
      createdToday++;
    }

    if (req.status === 'COMPLETED' && reqCompletedKey === todayKey) {
      completedToday++;
    }

    if (req.status === 'PENDING') {
      if (reqCreatedKey === todayKey) {
        pendingToday++;
      } else {
        // Created before today and still pending
        previousPending++;
      }

      if (req.priority === 'URGENT') urgentCount++;
      if (req.priority === 'SUPER_URGENT') superUrgentCount++;
    }
  }

  const totalPending = pendingToday + previousPending;
  const totalRelevant = completedToday + totalPending;
  const completionRate = totalRelevant > 0 ? Math.round((completedToday / totalRelevant) * 100) : 0;

  return {
    createdToday,
    completedToday,
    pendingToday,
    previousPending,
    totalPending,
    completionRate,
    urgentCount,
    superUrgentCount,
  };
}
