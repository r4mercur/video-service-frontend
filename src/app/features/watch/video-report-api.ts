import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { components } from '@core/api/schema';
import { firstValueFrom } from 'rxjs';

type SubmitReportRequest = components['schemas']['SubmitReportRequest'];
type ReportResponse = components['schemas']['ReportResponse'];
export type ReportReason = SubmitReportRequest['reason'];

@Injectable({ providedIn: 'root' })
export class VideoReportApi {
  private readonly http = inject(HttpClient);

  submit(videoId: string, body: SubmitReportRequest): Promise<ReportResponse> {
    return firstValueFrom(this.http.post<ReportResponse>(`/api/videos/${videoId}/report`, body));
  }
}
