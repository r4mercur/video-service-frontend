import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { components } from '@core/api/schema';
import { firstValueFrom } from 'rxjs';

type CursorPage = components['schemas']['CursorPageVideoDetailDto'];
type UpdateVideoRequest = components['schemas']['UpdateVideoRequest'];
type Visibility = NonNullable<UpdateVideoRequest['visibility']>;

@Injectable({ providedIn: 'root' })
export class StudioApi {
  private readonly http = inject(HttpClient);

  myVideos(params: { limit: number; cursor?: string }): Promise<CursorPage> {
    return firstValueFrom(this.http.get<CursorPage>('/api/me/videos', { params }));
  }

  deleteVideo(videoId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/videos/${videoId}`));
  }

  updateVisibility(videoId: string, visibility: Visibility): Promise<void> {
    const body: UpdateVideoRequest = { visibility };
    return firstValueFrom(this.http.patch<void>(`/api/videos/${videoId}`, body));
  }
}
