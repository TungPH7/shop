import { describe, expect, it } from 'vitest';

import { pathWithoutLocale, routing } from './routing';

describe('routing', () => {
  // pathWithoutLocale cuts the prefix '/<locale>' by hand. That is right only while every locale has the prefix
  // '/<locale>' and the paths are the same in every locale: a change of either must come with a change of the cut.
  it('keeps the prefix of every locale, the locale itself, and one path for all locales', () => {
    expect(routing.localePrefix ?? 'always').toBe('always');
    expect(routing).not.toHaveProperty('pathnames');
    expect(routing).not.toHaveProperty('domains');
  });
});

describe('pathWithoutLocale', () => {
  it('cuts the locale from a page below it', () => {
    expect(pathWithoutLocale('/en/about', 'en')).toBe('/about');
  });

  it('keeps a page with a dynamic param', () => {
    expect(pathWithoutLocale('/vi/products/ao-thun-co-tron', 'vi')).toBe(
      '/products/ao-thun-co-tron',
    );
  });

  it('gives the home page for the locale alone', () => {
    expect(pathWithoutLocale('/en', 'en')).toBe('/');
  });

  it('leaves a path of another locale as it is', () => {
    expect(pathWithoutLocale('/vi/about', 'en')).toBe('/vi/about');
  });

  it('does not cut a page whose name starts with the locale', () => {
    expect(pathWithoutLocale('/enroll', 'en')).toBe('/enroll');
  });
});
