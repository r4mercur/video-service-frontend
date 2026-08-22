export interface VideoSummary {
  id: string;
  title: string;
  genre: string;
  uploadedAt: Date;
  views: number;
  durationSeconds: number;
  /** 0 = not started, 1-100 = percent watched. */
  progress: number;
}

export function watchProgressLabel(video: VideoSummary): string {
  return video.progress > 0 ? `${video.progress}% watched — resume` : 'Not started';
}
