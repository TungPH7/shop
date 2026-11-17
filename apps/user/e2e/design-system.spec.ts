import { expect, test } from '@playwright/test';

// The font of the design system (SHOP-10): Be Vietnam Pro, self-hosted by next/font, so the CSP keeps font-src 'self'
// (NFR13), and at most 150 KB of font on a page (NFR5). jsdom loads no font, so only a real browser shows this.
test.describe('design system: font', () => {
  test('draws Vietnamese text in Be Vietnam Pro, served from this origin within 150 KB', async ({
    page,
    baseURL,
  }) => {
    // The listener keeps the promise of each body, so the count below waits for every font, even one whose body is
    // still on its way when the network goes idle.
    const pending: Promise<{ url: string; bytes: number }>[] = [];
    page.on('response', (response) => {
      if (response.request().resourceType() !== 'font') return;
      pending.push(response.body().then((body) => ({ url: response.url(), bytes: body.length })));
    });

    await page.goto('/vi/about');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(family).toMatch(/^"Be Vietnam Pro", "Be Vietnam Pro Fallback"/);

    // Each weight draws the letters with tone marks with the real font, not the fallback: the vietnamese subset loads.
    for (const weight of [500, 600, 700]) {
      const faces = await page.evaluate(
        async (w) =>
          (
            await document.fonts.load(`${w} 14px "Be Vietnam Pro"`, 'Sản phẩm, Giới thiệu, ữ ự ổ')
          ).map((face) => face.status),
        weight,
      );
      expect(faces.length, `faces of weight ${weight}`).toBeGreaterThan(0);
      expect(faces.every((status) => status === 'loaded')).toBe(true);
    }

    await page.waitForLoadState('networkidle');
    const fonts = await Promise.all(pending);
    expect(fonts.length).toBeGreaterThan(0);
    const origin = new URL(baseURL ?? page.url()).origin;
    for (const font of fonts) {
      expect(new URL(font.url).origin).toBe(origin);
      expect(font.url).toMatch(/\.woff2$/);
    }
    expect(fonts.reduce((sum, font) => sum + font.bytes, 0)).toBeLessThanOrEqual(150 * 1024);
  });
});
