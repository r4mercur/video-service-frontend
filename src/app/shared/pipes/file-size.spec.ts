import { FileSizePipe } from './file-size';

describe('FileSizePipe', () => {
  const pipe = new FileSizePipe();

  it('formats small values in bytes', () => {
    expect(pipe.transform(42)).toBe('42 byte');
  });

  it('scales up to megabytes', () => {
    expect(pipe.transform(24_600_000)).toBe('24.6 MB');
  });

  it('scales up to gigabytes', () => {
    expect(pipe.transform(2_400_000_000)).toBe('2.4 GB');
  });
});
