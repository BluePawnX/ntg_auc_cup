import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Searchable table that visually dims non-matching rows instead of hiding them.
 * Keeps row positions stable so scanning feels smooth.
 *
 * Props
 *  - rows: array of objects
 *  - columns: [{ key, label, render?, className?, mono? }, ...]
 *  - searchKeys: which row keys participate in matching (default = all column keys)
 *  - placeholder: search input placeholder
 *  - emptyState: shown when rows is empty
 *  - rowKey: function to derive a stable key from a row
 *  - compact: smaller padding
 */
export default function SpotlightTable({
  rows = [],
  columns = [],
  searchKeys,
  placeholder = 'Search…',
  emptyState = 'Nothing here yet.',
  rowKey = (r, i) => r.id ?? i,
  compact = false,
}) {
  const [q, setQ] = useState('');
  const lower = q.trim().toLowerCase();
  const keys = searchKeys || columns.map((c) => c.key);

  const annotated = useMemo(() => rows.map((row, i) => {
    const hit = !lower || keys.some((k) => String(row[k] ?? '').toLowerCase().includes(lower));
    return { row, hit, i };
  }), [rows, keys, lower]);

  if (!rows.length) return <div className="text-muted text-sm py-2">{emptyState}</div>;

  return (
    <div>
      <div className="mb-3 relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl bg-ink-700/60 border border-ink-600 px-3 py-2 text-sm outline-none transition-all
                     focus:border-accent focus:bg-ink-700 focus:shadow-glowsoft placeholder:text-muted/70"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-accent text-xs transition-colors"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted text-xs">
            {columns.map((c) => (
              <th key={c.key} className={`text-left font-medium pb-1.5 ${c.className || ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {annotated.map(({ row, hit, i }) => (
              <motion.tr
                key={rowKey(row, i)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: hit ? 1 : 0.18, y: 0, scale: hit && lower ? 1.005 : 1 }}
                transition={{ duration: 0.18 }}
                className="border-t border-white/5 hover:bg-white/[0.03] transition-colors"
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`${compact ? 'py-1' : 'py-1.5'} ${c.mono ? 'tabular-nums' : ''} ${c.className || ''}`}
                  >
                    {c.render ? c.render(row, { hit }) : row[c.key]}
                  </td>
                ))}
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
