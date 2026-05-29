/**
 * Tiny className joiner. Drop-in for shadcn's `cn` so we can paste-port community
 * components without pulling clsx + tailwind-merge.
 */
export const cn = (...args) => args.filter(Boolean).join(' ');
