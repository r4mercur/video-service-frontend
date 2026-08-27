import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThumbnailPicker } from './thumbnail-picker';

function createFixture(): ComponentFixture<ThumbnailPicker> {
  const fixture = TestBed.createComponent(ThumbnailPicker);
  fixture.detectChanges();
  return fixture;
}

function setFile(fixture: ComponentFixture<ThumbnailPicker>, file: File): void {
  const input = fixture.nativeElement.querySelector('.thumbnail-picker__input') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

describe('ThumbnailPicker', () => {
  const jpeg = (name: string, sizeBytes: number) =>
    new File([new Uint8Array(sizeBytes)], name, { type: 'image/jpeg' });

  it('accepts a valid image and shows a preview', () => {
    const fixture = createFixture();

    setFile(fixture, jpeg('cover.jpg', 1_000));

    expect(fixture.componentInstance.file()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.thumbnail-picker__image')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.thumbnail-picker__remove')).toBeTruthy();
  });

  it('rejects a file with the wrong type', () => {
    const fixture = createFixture();
    const rejectedSpy = vi.fn();
    fixture.componentInstance.rejected.subscribe(rejectedSpy);

    setFile(fixture, new File(['not an image'], 'notes.txt', { type: 'text/plain' }));

    expect(rejectedSpy).toHaveBeenCalledWith('Please choose a JPEG, PNG or WebP image.');
    expect(fixture.componentInstance.file()).toBeNull();
  });

  it('rejects an image larger than 8 MB', () => {
    const fixture = createFixture();
    const rejectedSpy = vi.fn();
    fixture.componentInstance.rejected.subscribe(rejectedSpy);

    setFile(fixture, jpeg('huge.jpg', 8_000_001));

    expect(rejectedSpy).toHaveBeenCalledWith('This image is larger than 8 MB.');
    expect(fixture.componentInstance.file()).toBeNull();
  });

  it('clears the selection when Remove is clicked', () => {
    const fixture = createFixture();
    setFile(fixture, jpeg('cover.jpg', 1_000));
    expect(fixture.componentInstance.file()).not.toBeNull();

    const removeButton = fixture.nativeElement.querySelector(
      '.thumbnail-picker__remove',
    ) as HTMLButtonElement;
    removeButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.file()).toBeNull();
    expect(fixture.nativeElement.querySelector('.thumbnail-picker__image')).toBeFalsy();
  });
});
