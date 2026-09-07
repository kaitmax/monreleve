import { test } from '@playwright/test';

test('resolve snapshot paths', ({}, testInfo) => {
  console.log('SCREENSHOT_PATH=' + testInfo.snapshotPath('rail-inline-compliant.png', { kind: 'screenshot' }));
  console.log('PLATFORM=' + process.platform);
  console.log('SNAPSHOT_DIR=' + testInfo.project.snapshotDir);
  console.log('TEST_DIR=' + testInfo.project.testDir);
});
