import { motion } from 'framer-motion';

/**
 * Drop-in route wrapper that gives each page a tiny fade + lift on mount.
 * Pair with `<AnimatePresence mode="wait">` around `<Routes>` to get the
 * exit animation when switching pages.
 */
export default function PageTransition({ children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={`min-h-full ${className}`}
    >
      {children}
    </motion.div>
  );
}
