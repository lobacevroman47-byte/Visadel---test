import { FileText, Calendar, Plane, Hotel, Shield } from 'lucide-react';

export type MainTab = 'visas' | 'bookings' | 'flights' | 'hotels' | 'insurance';

const TABS: { id: MainTab; label: string; Icon: typeof FileText }[] = [
  { id: 'visas',     label: 'Визы',       Icon: FileText },
  { id: 'bookings',  label: 'Брони',      Icon: Calendar },
  { id: 'flights',   label: 'Билеты',     Icon: Plane },
  { id: 'hotels',    label: 'Отели',      Icon: Hotel },
  { id: 'insurance', label: 'Страховки',  Icon: Shield },
];

interface BottomNavProps {
  active: MainTab;
  onChange: (tab: MainTab) => void;
}

export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
    >
      <div className="max-w-2xl mx-auto flex justify-around px-2 pt-2 pb-2">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all min-w-[58px] ${
                isActive ? 'bg-[#EAF1FF] text-[#3B5BFF]' : 'text-gray-400 hover:text-gray-600'
              }`}
              aria-label={label}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className={`text-[10px] font-semibold ${isActive ? 'text-[#3B5BFF]' : 'text-gray-500'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
