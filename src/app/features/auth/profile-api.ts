import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { components } from '@core/api/schema';
import { firstValueFrom } from 'rxjs';

type UserResponse = components['schemas']['UserResponse'];

@Injectable({ providedIn: 'root' })
export class ProfileApi {
  private readonly http = inject(HttpClient);

  /**
   * `multipart/form-data` with field `file` - the generated spec wrongly shows this request as
   * `application/json` (same springdoc artefact as the thumbnail upload, see CLAUDE.md §12).
   */
  uploadAvatar(file: File): Promise<UserResponse> {
    const body = new FormData();
    body.append('file', file);
    return firstValueFrom(this.http.put<UserResponse>('/api/me/avatar', body));
  }

  removeAvatar(): Promise<UserResponse> {
    return firstValueFrom(this.http.delete<UserResponse>('/api/me/avatar'));
  }
}
