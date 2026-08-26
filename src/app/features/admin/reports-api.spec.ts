import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ReportsApi } from './reports-api';

describe('ReportsApi', () => {
  let api: ReportsApi;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ReportsApi);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('uphold posts the reason to the uphold endpoint', async () => {
    const promise = api.uphold(42, 'looks legitimate');
    const req = httpMock.expectOne('/api/admin/reports/42/uphold');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'looks legitimate' });
    req.flush({});
    await promise;
  });

  it('dismiss posts the reason to the dismiss endpoint', async () => {
    const promise = api.dismiss(7, 'no violation found');
    const req = httpMock.expectOne('/api/admin/reports/7/dismiss');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'no violation found' });
    req.flush({});
    await promise;
  });

  it('block posts the reason to the video block endpoint', async () => {
    const promise = api.block('video-1', 'copyright violation');
    const req = httpMock.expectOne('/api/admin/videos/video-1/block');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'copyright violation' });
    req.flush(null);
    await promise;
  });

  it('unblock posts the reason to the video unblock endpoint', async () => {
    const promise = api.unblock('video-1', 'appeal accepted');
    const req = httpMock.expectOne('/api/admin/videos/video-1/unblock');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'appeal accepted' });
    req.flush(null);
    await promise;
  });

  it('deleteVideo sends a DELETE without a body', async () => {
    const promise = api.deleteVideo('video-1');
    const req = httpMock.expectOne('/api/videos/video-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await promise;
  });
});
