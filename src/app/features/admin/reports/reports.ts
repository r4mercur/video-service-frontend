import { HttpClient, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Tab, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { RouterLink } from '@angular/router';
import { APP_VERSION } from '@core/app-version.generated';
import { components } from '@core/api/schema';
import { isApiProblem } from '@core/http/api-problem';
import { ConfirmDialog } from '@shared/confirm-dialog/confirm-dialog';
import { RelativeTimePipe } from '@shared/pipes/relative-time';
import { Tag } from '@shared/tag/tag';
import { firstValueFrom } from 'rxjs';
import { ReportsApi } from '../reports-api';

type AdminReportDto = components['schemas']['AdminReportDto'];
type CursorPage = components['schemas']['CursorPageAdminReportDto'];
type ReportStatus = 'OPEN' | 'REVIEWED' | 'DISMISSED';
type VideoStatus = NonNullable<AdminReportDto['videoStatus']>;
type ActionKind = 'uphold' | 'dismiss' | 'block' | 'unblock' | 'delete';

interface PendingAction {
  kind: ActionKind;
  report: AdminReportDto;
}

interface DialogMeta {
  title: string;
  description: string;
  confirmLabel: string;
  danger: boolean;
}

const PAGE_SIZE = 20;

@Component({
  selector: 'app-reports',
  imports: [Tabs, TabList, Tab, TabPanel, RouterLink, Tag, RelativeTimePipe, ConfirmDialog],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ReportsApi);

  protected readonly appVersion = APP_VERSION;

  protected readonly activeTab = signal<ReportStatus>('OPEN');

  private readonly page = httpResource<CursorPage>(() => ({
    url: '/api/admin/reports',
    params: { status: this.activeTab(), limit: PAGE_SIZE },
  }));

  protected readonly reports = signal<AdminReportDto[]>([]);
  protected readonly nextCursor = signal<string | undefined>(undefined);
  protected readonly loadingMore = signal(false);
  protected readonly loadMoreError = signal<string | null>(null);

  protected readonly hasMore = computed(() => this.nextCursor() !== undefined);
  protected readonly initialLoading = this.page.isLoading;
  protected readonly initialError = computed(() => {
    const error = this.page.error();
    return error ? this.describeError(error) : null;
  });

  protected readonly pendingAction = signal<PendingAction | null>(null);
  protected readonly actionInFlight = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly dialogOpen = computed(() => this.pendingAction() !== null);
  protected readonly dialogMeta = computed<DialogMeta | null>(() => {
    const action = this.pendingAction();
    if (!action) {
      return null;
    }
    const title = action.report.videoTitle ?? 'this video';
    switch (action.kind) {
      case 'uphold':
        return {
          title: `Uphold report for "${title}"`,
          description: 'Marks the report as reviewed and upheld.',
          confirmLabel: 'Uphold',
          danger: false,
        };
      case 'dismiss':
        return {
          title: `Dismiss report for "${title}"`,
          description: 'Marks the report as reviewed and dismissed. The video is unaffected.',
          confirmLabel: 'Dismiss',
          danger: false,
        };
      case 'block':
        return {
          title: `Block "${title}"`,
          description: 'Blocks the video from being played or listed.',
          confirmLabel: 'Block video',
          danger: true,
        };
      case 'unblock':
        return {
          title: `Unblock "${title}"`,
          description: 'Makes the video playable and listed again.',
          confirmLabel: 'Unblock video',
          danger: false,
        };
      case 'delete':
        return {
          title: `Delete "${title}"`,
          description: 'Permanently deletes the video. This cannot be undone.',
          confirmLabel: 'Delete video',
          danger: true,
        };
    }
  });

  constructor() {
    effect(() => {
      const page = this.page.value();
      if (page) {
        this.reports.set(page.items ?? []);
        this.nextCursor.set(page.nextCursor ?? undefined);
      }
    });
  }

  protected selectTab(status: string | undefined): void {
    if (status === 'OPEN' || status === 'REVIEWED' || status === 'DISMISSED') {
      this.activeTab.set(status);
    }
  }

  protected canUphold(report: AdminReportDto): boolean {
    return report.status === 'OPEN';
  }

  protected canDismiss(report: AdminReportDto): boolean {
    return report.status === 'OPEN';
  }

  protected isBlocked(report: AdminReportDto): boolean {
    return report.videoStatus === 'BLOCKED';
  }

  protected canDelete(report: AdminReportDto): boolean {
    return report.status !== 'OPEN';
  }

  protected requestAction(kind: ActionKind, report: AdminReportDto): void {
    this.actionError.set(null);
    this.pendingAction.set({ kind, report });
  }

  protected cancelAction(): void {
    this.pendingAction.set(null);
  }

  protected async confirmAction(reason: string): Promise<void> {
    const action = this.pendingAction();
    if (!action) {
      return;
    }
    const reportId = action.report.id;
    const videoId = action.report.videoId;
    if (reportId === undefined || videoId === undefined) {
      return;
    }

    this.actionInFlight.set(true);
    this.actionError.set(null);
    try {
      switch (action.kind) {
        case 'uphold':
        case 'dismiss': {
          await (action.kind === 'uphold'
            ? this.api.uphold(reportId, reason)
            : this.api.dismiss(reportId, reason));
          this.removeReport(reportId);
          break;
        }
        case 'block':
          await this.api.block(videoId, reason);
          this.patchVideoStatus(reportId, 'BLOCKED');
          break;
        case 'unblock':
          await this.api.unblock(videoId, reason);
          this.patchVideoStatus(reportId, 'READY');
          break;
        case 'delete':
          await this.api.deleteVideo(videoId);
          this.removeReport(reportId);
          break;
      }
      this.pendingAction.set(null);
    } catch (error) {
      this.actionError.set(this.describeError(error));
    } finally {
      this.actionInFlight.set(false);
    }
  }

  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) {
      return;
    }

    this.loadingMore.set(true);
    this.loadMoreError.set(null);
    try {
      const page = await firstValueFrom(
        this.http.get<CursorPage>('/api/admin/reports', {
          params: { status: this.activeTab(), limit: PAGE_SIZE, cursor },
        }),
      );
      this.reports.update((existing) => [...existing, ...(page.items ?? [])]);
      this.nextCursor.set(page.nextCursor ?? undefined);
    } catch (error) {
      this.loadMoreError.set(this.describeError(error));
    } finally {
      this.loadingMore.set(false);
    }
  }

  private removeReport(reportId: number): void {
    this.reports.update((list) => list.filter((report) => report.id !== reportId));
  }

  private patchVideoStatus(reportId: number, videoStatus: VideoStatus): void {
    this.reports.update((list) =>
      list.map((report) => (report.id === reportId ? { ...report, videoStatus } : report)),
    );
  }

  private describeError(error: unknown): string {
    if (isApiProblem(error)) {
      return error.detail ?? error.title;
    }
    return 'Could not load reports. Please try again.';
  }
}
