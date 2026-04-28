import { motion } from 'motion/react';

export default function Skeleton({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      className={`bg-gray-200 rounded ${className}`}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-10 w-64 bg-gray-200 rounded" />
      <div className="grid grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-200 rounded border-l-4 border-gray-300" />
        ))}
      </div>
      <div className="h-48 bg-gray-200 rounded shadow-[8px_8px_0px_0px_rgba(200,200,200,1)]" />
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="w-64 border-r border-gray-200 h-screen p-6 space-y-8">
      <div className="h-8 w-32 bg-gray-200 rounded" />
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-10 bg-gray-200 rounded" />
        ))}
      </div>
    </div>
  );
}
