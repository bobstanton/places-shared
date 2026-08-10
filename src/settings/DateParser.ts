export class DateParser {

  static relativeEndDateForCalendarDays(days: number): string {
    const wholeDays = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : 1;
    return `+${wholeDays - 1}d`;
  }

  static parseDate(dateStr: string, baseDate: Date = new Date()): Date {
    if (!dateStr) {
      return baseDate;
    }

    dateStr = dateStr.trim().toLowerCase();

    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parts = dateStr.split('-');
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1])
      const day = parseInt(parts[2]);
      return new Date(year, month - 1, day);
    }

    if (dateStr.match(/^\d{8}$/)) {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6));
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(year, month - 1, day);
    }

    if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const parts = dateStr.split('/');
      const month = parseInt(parts[0]);
      const day = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      return new Date(year, month - 1, day);
    }

    if (dateStr === 'today') {
      return new Date(baseDate);
    }

    if (dateStr === 'tomorrow') {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + 1);
      return date;
    }

    if (dateStr === 'yesterday') {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - 1);
      return date;
    }

    if (dateStr === 'this weekend') {
      const date = new Date(baseDate);
      const dayOfWeek = date.getDay();

      const daysUntilSaturday = dayOfWeek === 6 ? 0 : (6 - dayOfWeek);
      date.setDate(date.getDate() + daysUntilSaturday);

      return date;
    }

    // +3 or +3d, -2w, +1m. Unitless relative offsets default to days.
    const relativeMatch = dateStr.match(/^([+-]?)(\d+)([dwmy])?$/);
    if (relativeMatch) {
      const [, sign, amount, unit = 'd'] = relativeMatch;
      const multiplier = sign === '-' ? -1 : 1;
      const value = parseInt(amount) * multiplier;

      const date = new Date(baseDate);

      switch (unit) {
        case 'd':
          date.setDate(date.getDate() + value);
          break;
        case 'w':
          date.setDate(date.getDate() + (value * 7));
          break;
        case 'm':
          date.setMonth(date.getMonth() + value);
          break;
        case 'y':
          date.setFullYear(date.getFullYear() + value);
          break;
      }

      return date;
    }

    throw new Error(`Invalid date format. Supported: today, tomorrow, yesterday, this weekend, +3, +3d, -2w, +1m, YYYY-MM-DD, MM/DD/YYYY, YYYYMMDD`);
  }

  static parseDateRange(settings: { startDate?: string; endDate?: string; }): [Date, Date] {
    const baseDate = new Date();

    let startDate: Date;
    try {
      startDate = settings.startDate
        ? this.parseDate(settings.startDate, baseDate)
        : new Date(baseDate);
    } catch {
      throw new Error('Invalid startDate. Supported: today, tomorrow, yesterday, this weekend, +3, +3d, -2w, +1m, YYYY-MM-DD, MM/DD/YYYY, YYYYMMDD');
    }

    let endDate: Date;
    try {
      endDate = settings.endDate
        ? this.parseDate(settings.endDate, startDate)
        : new Date(startDate);
    } catch {
      throw new Error('Invalid endDate. Supported: today, tomorrow, yesterday, this weekend, +3, +3d, -2w, +1m, YYYY-MM-DD, MM/DD/YYYY, YYYYMMDD');
    }

    if (endDate < startDate) {
      throw new Error('End date cannot be before start date');
    }

    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      throw new Error('Date range cannot exceed 1 year (365 days)');
    }

    return [startDate, endDate];
  }

  static formatDateForDisplay(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  static formatDateTimeForDisplay(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  static formatDateISO(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static formatTime12Hour(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  static formatTimestamp(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
}
