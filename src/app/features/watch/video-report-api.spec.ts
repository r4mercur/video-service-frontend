import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { VideoReportApi } from './video-report-api';

describe('VideoReportApi', () => {
  let api: VideoReportApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(VideoReportApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('posts the reason and detail to the report endpoint', async () => {
    const promise = api.submit('video-1', { reason: 'SPAM', detail: 'looks like spam' });
    const req = httpMock.expectOne('/api/videos/video-1/report');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'SPAM', detail: 'looks like spam' });
    req.flush({ id: 1, status: 'OPEN' });
    await expect(promise).resolves.toEqual({ id: 1, status: 'OPEN' });
  });

  it('posts without a detail when none is given', async () => {
    const promise = api.submit('video-1', { reason: 'OTHER' });
    const req = httpMock.expectOne('/api/videos/video-1/report');
    expect(req.request.body).toEqual({ reason: 'OTHER' });
    req.flush({ id: 2, status: 'OPEN' });
    await promise;
  });
});
