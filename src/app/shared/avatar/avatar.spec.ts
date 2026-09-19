import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Avatar } from './avatar';

async function createFixture(
  name: string,
  src: string | null = null,
): Promise<ComponentFixture<Avatar>> {
  const fixture = TestBed.createComponent(Avatar);
  fixture.componentRef.setInput('name', name);
  fixture.componentRef.setInput('src', src);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function image(fixture: ComponentFixture<Avatar>): HTMLImageElement | null {
  return fixture.nativeElement.querySelector('img');
}

describe('Avatar', () => {
  it('shows the first two letters of the name, uppercased, without a photo', async () => {
    const fixture = await createFixture('testuser');
    expect(image(fixture)).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('TE');
  });

  it('shows the photo with the name as alt text', async () => {
    const fixture = await createFixture('testuser', 'https://media.example/a.jpg');
    expect(image(fixture)?.src).toBe('https://media.example/a.jpg');
    expect(image(fixture)?.alt).toBe('testuser');
  });

  it('falls back to the initials when the photo fails to load', async () => {
    const fixture = await createFixture('testuser', 'https://media.example/gone.jpg');
    image(fixture)?.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(image(fixture)).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('TE');
  });

  it('tries again when a new URL arrives after a failed one', async () => {
    const fixture = await createFixture('testuser', 'https://media.example/gone.jpg');
    image(fixture)?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    fixture.componentRef.setInput('src', 'https://media.example/new.jpg');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(image(fixture)?.src).toBe('https://media.example/new.jpg');
  });
});
