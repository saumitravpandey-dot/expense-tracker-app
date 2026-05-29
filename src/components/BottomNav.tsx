'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
  onAdd: () => void;
}

const NAV_ITEMS = [
  { href: '/', icon: HomeIcon, label: 'Home' },
  { href: '/expenses', icon: ListIcon, label: 'Expenses' },
  { href: null, icon: PlusIcon, label: 'Add', isAdd: true },
  { href: '/trends', icon: ChartIcon, label: 'Trends' },
  { href: '/import', icon: UploadIcon, label: 'Import' },
];

export default function BottomNav({ onAdd }: Props) {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 safe-area-pb">
      <div className="flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.map(item => {
          if (item.isAdd) {
            return (
              <button
                key="add"
                onClick={onAdd}
                className="flex flex-col items-center justify-center w-14 h-14 -mt-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform"
                aria-label="Quick add"
              >
                <item.icon className="w-6 h-6" />
              </button>
            );
          }
          const active = item.href === '/' ? pathname === '/' : item.href ? pathname.startsWith(item.href) : false;
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
                active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'
              }`}
            >
              <item.icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// SVG icon components
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}
