import { Pipe, PipeTransform } from '@angular/core';

const UNITS: Intl.NumberFormatOptions['unit'][] = [
  'byte',
  'kilobyte',
  'megabyte',
  'gigabyte',
  'terabyte',
];

@Pipe({ name: 'appFileSize' })
export class FileSizePipe implements PipeTransform {
  transform(bytes: number): string {
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1000 && unitIndex < UNITS.length - 1) {
      value /= 1000;
      unitIndex++;
    }

    const formatter = new Intl.NumberFormat('en', {
      style: 'unit',
      unit: UNITS[unitIndex],
      unitDisplay: 'short',
      maximumFractionDigits: unitIndex === 0 ? 0 : 1,
    });
    return formatter.format(value);
  }
}
