import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchBox } from './search-box';

async function setup(query = ''): Promise<ComponentFixture<SearchBox>> {
  const fixture = TestBed.createComponent(SearchBox);
  fixture.componentRef.setInput('inputId', 'test-search');
  fixture.componentRef.setInput('query', query);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function inputOf(fixture: ComponentFixture<SearchBox>): HTMLInputElement {
  return fixture.nativeElement.querySelector('input') as HTMLInputElement;
}

describe('SearchBox', () => {
  it('prefills the field from the query input and re-syncs on change', async () => {
    const fixture = await setup('kubernetes');
    expect(inputOf(fixture).value).toBe('kubernetes');

    fixture.componentRef.setInput('query', 'docker');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(inputOf(fixture).value).toBe('docker');
  });

  it('emits the trimmed query on submit', async () => {
    const fixture = await setup();
    const searchedSpy = vi.fn();
    fixture.componentInstance.searched.subscribe(searchedSpy);

    const input = inputOf(fixture);
    input.value = '  kubernetes  ';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('.search-box__submit') as HTMLButtonElement).click();

    expect(searchedSpy).toHaveBeenCalledWith('kubernetes');
  });
});
