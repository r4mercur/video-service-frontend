import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PresignedUploadTransport } from './upload-transport';

describe('PresignedUploadTransport', () => {
  let transport: PresignedUploadTransport;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    transport = TestBed.inject(PresignedUploadTransport);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('setThumbnail PUTs the file as multipart/form-data to the video-scoped endpoint', async () => {
    const file = new File(['image-bytes'], 'cover.jpg', { type: 'image/jpeg' });
    const promise = transport.setThumbnail('video-1', file);

    const req = httpMock.expectOne('/api/videos/video-1/thumbnail');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toBeInstanceOf(FormData);
    expect((req.request.body as FormData).get('file')).toBe(file);

    req.flush({ id: 'video-1', hasCustomThumbnail: true });
    await expect(promise).resolves.toEqual({ id: 'video-1', hasCustomThumbnail: true });
  });
});
