export declare class DateParser {
    static relativeEndDateForCalendarDays(days: number): string;
    static parseDate(dateStr: string, baseDate?: Date): Date;
    static parseDateRange(settings: {
        startDate?: string;
        endDate?: string;
    }): [Date, Date];
    static formatDateForDisplay(date: Date | string): string;
    static formatDateTimeForDisplay(date: Date | string): string;
    static formatDateISO(date: Date | string): string;
    static formatTime12Hour(date: Date | string): string;
    static formatTimestamp(date: Date | string): string;
}
