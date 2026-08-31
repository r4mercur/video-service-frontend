import path from 'node:path';
import { expect, test } from './support/fixtures';

/**
 * Regression coverage for the mobile/iOS player bugs described in CLAUDE.md section 12
 * (2026-08-31 fix): a broken fullscreen button, a volume slider that iOS silently ignores, and a
 * controls row that could overflow on narrow phone viewports.
 *
 * The video pipeline (detail lookup + manifest) is mocked; only the presigned-storage-style
 * network boundary is real vs. mocked, mirroring the convention in upload.spec.ts. The HLS stream
 * itself is a tiny real fixture (e2e/fixtures/hls) generated with ffmpeg so hls.js has something
 * genuine to parse, rather than mocking hls.js away and testing nothing real.
 *
 * Caveat (see CLAUDE.md): Playwright's bundled WebKit is a desktop build. It does not reproduce
 * iOS Safari's restricted Fullscreen API (`document.fullscreenEnabled === false` +
 * `HTMLVideoElement.webkitEnterFullscreen`) on its own — no chromium or webkit build run through
 * Playwright satisfies that combination for real. The iOS-path test below patches in exactly
 * those two platform primitives via `addInitScript` so the component's real, unmodified detection
 * logic (`PlayerFrame.detectIosWebkit`) runs and takes the real iOS branch. That verifies our
 * branching logic faithfully; it cannot substitute for a manual check on an actual iPhone.
 *
 * Second, sharper caveat found while writing this suite: Playwright's WebKit build on Windows/
 * Linux hosts ships with neither MediaSource nor native HLS (`video.canPlayType(...)` returns
 * `''` and `'MediaSource' in window` is `false`) — Apple's media frameworks that back both are
 * macOS-only, so this is a Playwright platform gap, not something our app controls. `PlayerFrame`
 * correctly reports "HLS playback is not supported in this browser" in that case and hides the
 * controls entirely, same as it should for a real unsupported browser — so every test below that
 * needs the controls to render skips itself when the current browser build can't decode our
 * fixture, rather than asserting against a false negative. On a macOS-hosted `webkit` run (or real
 * iOS/Safari) these would actually exercise the codepath instead of skipping.
 */

const SLUG = 'mobile-player-fix-test';
const VIDEO_ID = '11111111-1111-1111-1111-111111111111';
const HLS_FIXTURE_DIR = path.join(__dirname, 'fixtures', 'hls');

function fixtureContentType(filename: string): string {
  return filename.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t';
}

async function mockVideoAndManifest(page: import('@playwright/test').Page): Promise<void> {
  await page.route(`**/api/videos/${SLUG}`, async (route) => {
    await route.fulfill({
      json: {
        id: VIDEO_ID,
        slug: SLUG,
        title: 'Mobile player fix test',
        description: '',
        durationSeconds: 3,
        width: 640,
        height: 360,
        visibility: 'PUBLIC',
        status: 'READY',
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    });
  });

  await page.route(`**/api/videos/${VIDEO_ID}/manifest`, async (route) => {
    await route.fulfill({ json: { playlistUrl: '/e2e-fixtures/hls/stream.m3u8' } });
  });

  await page.route('**/e2e-fixtures/hls/**', async (route) => {
    const filename = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    await route.fulfill({
      path: path.join(HLS_FIXTURE_DIR, filename),
      contentType: fixtureContentType(filename),
    });
  });
}

test.describe('Player controls on a mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    const canDecodeHls = await page.evaluate(() => {
      const probe = document.createElement('video');
      return probe.canPlayType('application/vnd.apple.mpegurl') !== '' || 'MediaSource' in window;
    });
    test.skip(
      !canDecodeHls,
      'This browser build has neither native HLS nor MediaSource support (a known Playwright ' +
        'WebKit gap on non-macOS hosts, not an app bug) -- cannot decode the HLS fixture here.',
    );
  });

  test('play, mute and fullscreen buttons stay reachable without horizontal overflow', async ({
    page,
  }) => {
    await mockVideoAndManifest(page);
    await page.goto(`/watch/${SLUG}`);

    const playButton = page.getByRole('button', { name: 'Play' });
    const muteButton = page.getByRole('button', { name: 'Mute' });
    const fullscreenButton = page.getByRole('button', { name: 'Full screen' });
    await expect(playButton).toBeVisible();
    await expect(muteButton).toBeVisible();
    await expect(fullscreenButton).toBeVisible();

    const viewportWidth = page.viewportSize()?.width ?? 390;
    for (const button of [playButton, muteButton, fullscreenButton]) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);
    }

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });

  test('play and mute toggles actually control the video element', async ({ page }) => {
    await mockVideoAndManifest(page);
    await page.goto(`/watch/${SLUG}`);

    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect.poll(() => page.locator('video').evaluate((video) => video.paused)).toBe(false);

    await page.getByRole('button', { name: 'Mute' }).click();
    await expect(page.getByRole('button', { name: 'Unmute' })).toBeVisible();
    await expect(page.locator('video').evaluate((video) => video.muted)).resolves.toBe(true);
  });

  test('on a simulated iOS WebKit runtime, fullscreen uses the native video API and the volume slider is hidden', async ({
    page,
  }) => {
    // Reproduce the exact iOS platform signature `PlayerFrame.detectIosWebkit` looks for, so the
    // component's real detection code (not a stub) takes the real iOS branch.
    await page.addInitScript(() => {
      (window as unknown as { __playerTestFlags: Record<string, boolean> }).__playerTestFlags = {
        enterFullscreenCalled: false,
        requestFullscreenCalled: false,
      };
      Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true });
      (
        HTMLVideoElement.prototype as unknown as { webkitEnterFullscreen: () => void }
      ).webkitEnterFullscreen = function (this: HTMLVideoElement) {
        (window as unknown as { __playerTestFlags: Record<string, boolean> }).__playerTestFlags[
          'enterFullscreenCalled'
        ] = true;
        this.dispatchEvent(new Event('webkitbeginfullscreen'));
      };
      (
        HTMLVideoElement.prototype as unknown as { webkitExitFullscreen: () => void }
      ).webkitExitFullscreen = function (this: HTMLVideoElement) {
        this.dispatchEvent(new Event('webkitendfullscreen'));
      };
      const originalRequestFullscreen = HTMLElement.prototype.requestFullscreen;
      HTMLElement.prototype.requestFullscreen = function (
        this: HTMLElement,
        ...args: Parameters<typeof originalRequestFullscreen>
      ) {
        (window as unknown as { __playerTestFlags: Record<string, boolean> }).__playerTestFlags[
          'requestFullscreenCalled'
        ] = true;
        return originalRequestFullscreen?.apply(this, args);
      };
    });

    await mockVideoAndManifest(page);
    await page.goto(`/watch/${SLUG}`);

    await expect(page.getByLabel('Volume')).toHaveCount(0);

    await page.getByRole('button', { name: 'Full screen' }).click();
    await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeVisible();

    const flags = await page.evaluate(
      () => (window as unknown as { __playerTestFlags: Record<string, boolean> }).__playerTestFlags,
    );
    expect(flags['enterFullscreenCalled']).toBe(true);
    expect(flags['requestFullscreenCalled']).toBe(false);
  });
});
