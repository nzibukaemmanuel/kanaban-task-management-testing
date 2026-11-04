import { Pipe, PipeTransform } from '@angular/core';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Formats an ISO 'YYYY-MM-DD' due date as e.g. 'Aug 10, 2026'. The parts are read straight from the
// string (no Date timezone conversion), so the result never shifts by a day. Empty, null or
// invalid dates (including impossible ones like 2026-02-31) render as an empty string.
@Pipe({ name: 'dueDate' })
export class DueDatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    const match = ISO_DATE.exec(value ?? '');
    if (!match) {
      return '';
    }
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
      return '';
    }
    return `${MONTHS[month - 1]} ${day}, ${year}`;
  }
}
