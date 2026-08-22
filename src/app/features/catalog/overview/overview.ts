import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Pagination } from '@shared/pagination/pagination';
import { MOCK_VIDEOS } from './mock-videos';
import { VideoRow } from './video-row/video-row';

@Component({
  selector: 'app-overview',
  imports: [RouterLink, VideoRow, Pagination],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class Overview {
  protected readonly videos = signal(MOCK_VIDEOS);
  protected readonly currentPage = signal(1);
  // Fest verdrahtet bis AP 4 echte Server-Pagination anbindet.
  protected readonly totalPages = signal(12);
  protected readonly totalCount = signal(142);

  protected onPageChange(page: number): void {
    this.currentPage.set(page);
  }
}
