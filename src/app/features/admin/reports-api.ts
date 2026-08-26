import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { components } from '@core/api/schema';
import { firstValueFrom } from 'rxjs';

type ModerationActionRequest = components['schemas']['ModerationActionRequest'];
type AdminReportDto = components['schemas']['AdminReportDto'];

@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly http = inject(HttpClient);

  uphold(reportId: number, reason: string): Promise<AdminReportDto> {
    const body: ModerationActionRequest = { reason };
    return firstValueFrom(
      this.http.post<AdminReportDto>(`/api/admin/reports/${reportId}/uphold`, body),
    );
  }

  dismiss(reportId: number, reason: string): Promise<AdminReportDto> {
    const body: ModerationActionRequest = { reason };
    return firstValueFrom(
      this.http.post<AdminReportDto>(`/api/admin/reports/${reportId}/dismiss`, body),
    );
  }

  block(videoId: string, reason: string): Promise<void> {
    const body: ModerationActionRequest = { reason };
    return firstValueFrom(this.http.post<void>(`/api/admin/videos/${videoId}/block`, body));
  }

  unblock(videoId: string, reason: string): Promise<void> {
    const body: ModerationActionRequest = { reason };
    return firstValueFrom(this.http.post<void>(`/api/admin/videos/${videoId}/unblock`, body));
  }

  deleteVideo(videoId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/videos/${videoId}`));
  }
}
