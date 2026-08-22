import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'appCompactNumber' })
export class CompactNumberPipe implements PipeTransform {
  private readonly formatter = new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  transform(value: number): string {
    return this.formatter.format(value);
  }
}
