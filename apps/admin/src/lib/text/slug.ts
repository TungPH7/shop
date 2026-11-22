// The slug rules shared by products and categories (plan of SHOP-81, Architecture
// Decisions 9): the slug rules of the Product Rules of docs/specs/SHOP-7/spec.md, which
// the Category Rules of docs/specs/SHOP-81/spec.md take as they are, like Slugs of the
// api. Lengths are UTF-16 units (`.length`), as `String.length()` of the api counts them.

/** The longest slug. */
export const SLUG_MAX_LENGTH = 100;

const SLUG_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** The accents NFD splits off a letter, as COMBINING_MARKS of Slugs. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * The slug the api generates from a name (Slugs.fromName): no Vietnamese accents, `đ`
 * and `Đ` as `d`, lower case, each run of characters other than a–z and 0–9 one hyphen,
 * no hyphen at either end, cut at 100 characters without a hyphen at the end. A name
 * with no letter or digit left gives `fallback`, the one of its kind of slug, as the api
 * does; a blank name gives an empty slug, so the field stays empty.
 */
export function slugFromName(name: string, fallback: string): string {
  if (name.trim() === '') return '';
  const slug = name
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '');
  return slug === '' ? fallback : slug;
}

/** Whether a slug has the format: a–z, digits and single hyphens inside, at most 100. */
export function isSlug(slug: string): boolean {
  return slug.length <= SLUG_MAX_LENGTH && SLUG_FORMAT.test(slug);
}

/** Whether two slugs are the same for the api, which compares them ignoring case (citext). */
export function isSameSlug(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
