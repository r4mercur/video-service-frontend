export type VideoLifecycleStatus = 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED' | 'BLOCKED';

export function videoStatusTone(
  status: VideoLifecycleStatus | undefined,
): 'accent' | 'danger' | 'success' | 'neutral' {
  switch (status) {
    case 'READY':
      return 'success';
    case 'FAILED':
    case 'BLOCKED':
      return 'danger';
    default:
      return 'neutral';
  }
}
