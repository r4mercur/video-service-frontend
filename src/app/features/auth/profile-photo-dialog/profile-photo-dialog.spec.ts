import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService, UserResponse } from '@core/auth/auth';
import { errorInterceptor } from '@core/http/error';
import { MAX_AVATAR_BYTES, ProfilePhotoDialog, validateAvatarFile } from './profile-photo-dialog';

/** jsdom implements HTMLDialogElement's `open` reflection but not `showModal`/`close`. */
function polyfillDialog(): void {
  const proto = globalThis.HTMLDialogElement.prototype;
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (typeof proto.close !== 'function') {
    proto.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  }
}

/** jsdom has no object URLs; the dialog only needs a string back for the preview. */
function polyfillObjectUrls(): void {
  URL.createObjectURL = () => 'blob:preview';
  URL.revokeObjectURL = () => undefined;
}

function file(name: string, type: string, size = 10): File {
  return new File([new Uint8Array(size)], name, { type });
}

const USER: UserResponse = { id: 'u1', username: 'testuser', role: 'USER' };

async function settle(fixture: ComponentFixture<ProfilePhotoDialog>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function selectFile(fixture: ComponentFixture<ProfilePhotoDialog>, selected: File): void {
  const input = fixture.nativeElement.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [selected], configurable: true });
  input.dispatchEvent(new Event('change'));
}

function button(
  fixture: ComponentFixture<ProfilePhotoDialog>,
  selector: string,
): HTMLButtonElement {
  return fixture.nativeElement.querySelector(selector) as HTMLButtonElement;
}

describe('validateAvatarFile', () => {
  it('accepts the image types the backend whitelists', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
      expect(validateAvatarFile(file('a', type))).toBeNull();
    }
  });

  it('rejects other types, e.g. a playlist disguised as an upload', () => {
    expect(validateAvatarFile(file('a.m3u8', 'application/vnd.apple.mpegurl'))).toContain('JPEG');
  });

  it('rejects files above the backend limit before any request is made', () => {
    expect(validateAvatarFile(file('big.jpg', 'image/jpeg', MAX_AVATAR_BYTES + 1))).toContain(
      '5 MB',
    );
    expect(validateAvatarFile(file('ok.jpg', 'image/jpeg', MAX_AVATAR_BYTES))).toBeNull();
  });
});

describe('ProfilePhotoDialog', () => {
  let httpMock: HttpTestingController;
  let auth: AuthService;

  beforeAll(() => {
    polyfillDialog();
    polyfillObjectUrls();
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      // The real error interceptor, so rejected requests arrive as ApiProblem like in the app.
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    auth.updateCurrentUser(USER);
  });

  afterEach(() => httpMock.verify());

  async function createFixture(): Promise<ComponentFixture<ProfilePhotoDialog>> {
    const fixture = TestBed.createComponent(ProfilePhotoDialog);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    return fixture;
  }

  it('keeps Save disabled until a valid file is chosen', async () => {
    const fixture = await createFixture();
    expect(button(fixture, '.profile-photo-dialog__save').disabled).toBe(true);

    selectFile(fixture, file('me.png', 'image/png'));
    await settle(fixture);

    expect(button(fixture, '.profile-photo-dialog__save').disabled).toBe(false);
  });

  it('shows the validation message and sends nothing for an invalid file', async () => {
    const fixture = await createFixture();

    selectFile(fixture, file('notes.txt', 'text/plain'));
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('[role=alert]')?.textContent).toContain('JPEG');
    expect(button(fixture, '.profile-photo-dialog__save').disabled).toBe(true);
  });

  it('uploads as multipart, updates the current user and closes', async () => {
    const fixture = await createFixture();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    selectFile(fixture, file('me.png', 'image/png'));
    await settle(fixture);

    button(fixture, '.profile-photo-dialog__save').click();
    const req = httpMock.expectOne('/api/me/avatar');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toBeInstanceOf(FormData);
    expect((req.request.body as FormData).get('file')).toBeInstanceOf(File);
    req.flush({ ...USER, avatarUrl: 'https://media.example/new.jpg' });
    await settle(fixture);

    expect(auth.currentUser()?.avatarUrl).toBe('https://media.example/new.jpg');
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('shows the backend detail and stays open when the upload is rejected', async () => {
    const fixture = await createFixture();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    selectFile(fixture, file('me.png', 'image/png'));
    await settle(fixture);

    button(fixture, '.profile-photo-dialog__save').click();
    httpMock
      .expectOne('/api/me/avatar')
      .flush(
        { title: 'Bad Request', status: 400, detail: 'Uploaded file is not a valid image' },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('[role=alert]')?.textContent).toContain(
      'Uploaded file is not a valid image',
    );
    expect(closed).not.toHaveBeenCalled();
    expect(auth.currentUser()?.avatarUrl).toBeUndefined();
  });

  it('offers Remove only when a photo exists, and clears it via DELETE', async () => {
    auth.updateCurrentUser({ ...USER, avatarUrl: 'https://media.example/old.jpg' });
    const fixture = await createFixture();

    button(fixture, '.profile-photo-dialog__remove').click();
    const req = httpMock.expectOne('/api/me/avatar');
    expect(req.request.method).toBe('DELETE');
    req.flush(USER);
    await settle(fixture);

    expect(auth.currentUser()?.avatarUrl).toBeUndefined();
    expect(fixture.nativeElement.querySelector('.profile-photo-dialog__remove')).toBeNull();
  });
});
