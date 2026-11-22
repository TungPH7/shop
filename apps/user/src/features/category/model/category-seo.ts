import { siteConfig } from '~/lib/site-config';

/**
 * The title and the meta description of S5 (SPEC of SHOP-81, section SEO, S5; AC18). Lengths are `String.length`, as
 * the SPEC counts them. The texts come translated, with the name of the category as an ICU argument, so these only
 * pick among them.
 */

/** The suffix the title template of the root layout adds (`%s · ‹site›`): ` · tungph7 codebase`, 19 characters. */
export const TITLE_SUFFIX = ` · ${siteConfig.name}`;

/** The longest title the SPEC wants, suffix included. */
const TITLE_MAX_LENGTH = 60;

/** The longest meta description the SPEC allows: a hard limit. */
const DESCRIPTION_MAX_LENGTH = 160;

/**
 * The first of the `tiers` (tier 1, then tier 2) whose length with the suffix is at most 60 characters, else the name
 * alone (tier 3), never cut nor padded: a longer name is left whole for the search engine to cut. The page sets this as
 * a plain title, so the template still adds the suffix (no `title.absolute`).
 */
export function categoryTitleOf(name: string, tiers: readonly string[]): string {
  return tiers.find((title) => title.length + TITLE_SUFFIX.length <= TITLE_MAX_LENGTH) ?? name;
}

/** Sentence 1, the name first, then sentence 2 when both fit in 160 characters. */
export function categoryDescriptionOf(first: string, second: string): string {
  const both = `${first} ${second}`;
  return both.length <= DESCRIPTION_MAX_LENGTH ? both : first;
}
