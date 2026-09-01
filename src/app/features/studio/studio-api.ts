import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { components } from '@core/api/schema';
import { firstValueFrom } from 'rxjs';

type CursorPage = components['schemas']['CursorPageVideoDetailDto'];
type VideoDetailDto = components['schemas']['VideoDetailDto'];
type UpdateVideoRequest = components['schemas']['UpdateVideoRequest'];
type VideoStatusResponse = components['schemas']['VideoStatusResponse'];

@Injectable({ providedIn: 'root' })
export class StudioApi {
  private readonly http = inject(HttpClient);

  myVideos(params: { limit: number; cursor?: string }): Promise<CursorPage> {
    return firstValueFrom(this.http.get<CursorPage>('/api/me/videos', { params }));
  }

  deleteVideo(videoId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/videos/${videoId}`));
  }

  updateVideo(videoId: string, patch: UpdateVideoRequest): Promise<VideoDetailDto> {
    return firstValueFrom(this.http.patch<VideoDetailDto>(`/api/videos/${videoId}`, patch));
  }

  status(videoId: string): Promise<VideoStatusResponse> {
    return firstValueFrom(this.http.get<VideoStatusResponse>(`/api/videos/${videoId}/status`));
  }
}
