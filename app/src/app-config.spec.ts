import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('Android app configuration', () => {
  it('pins the app to portrait instead of following the sensor', () => {
    const appJson = JSON.parse(
      readFileSync(resolve(__dirname, '../app.json'), 'utf8'),
    ) as { expo?: { orientation?: string } };

    expect(appJson.expo?.orientation).toBe('portrait');
  });
});
