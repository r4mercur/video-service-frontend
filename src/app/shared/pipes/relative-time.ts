import { Pipe, PipeTransform } from '@angular/core';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

@Pipe({ name: 'appRelativeTime' })
export class RelativeTimePipe implements PipeTransform {
  private readonly formatter = new Intl.RelativeTimeFormat('en', {
    numeric: 'auto',
    style: 'short',
  });

  transform(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    const diffMs = date.getTime() - Date.now();

    if (Math.abs(diffMs) < HOUR) {
      return this.formatter.format(Math.round(diffMs / MINUTE), 'minute');
    }
    if (Math.abs(diffMs) < DAY) {
      return this.formatter.format(Math.round(diffMs / HOUR), 'hour');
    }
    return this.formatter.format(Math.round(diffMs / DAY), 'day');
  }
}
