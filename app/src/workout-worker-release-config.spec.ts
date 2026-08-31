import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('workout worker release configuration', () => {
  it('keeps Moshi-reflected schema models available after R8', () => {
    const rulesPath = resolve(
      __dirname,
      '../modules/workout-worker/android/consumer-rules.pro',
    );
    const rules = readFileSync(rulesPath, 'utf8');

    expect(rules).toContain('-keep class com.limajuice.liftlog.** { *; }');
    expect(rules).toContain('-keep class kotlin.Metadata { *; }');
    expect(rules).toContain('-keepattributes RuntimeVisibleAnnotations');
  });
});
