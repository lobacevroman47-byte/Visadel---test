import BrandHeader from './shared/BrandHeader';

interface ComingSoonProps {
  title: string;
  description: string;
  emoji: string;
  onOpenProfile?: () => void;
}

export default function ComingSoon({ title, description, emoji, onOpenProfile }: ComingSoonProps) {
  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-24">
      <BrandHeader onOpenProfile={onOpenProfile} />

      <div className="max-w-2xl mx-auto px-5 pt-12 pb-20 flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-3xl vd-grad-soft border border-blue-100 flex items-center justify-center text-5xl shadow-sm mb-6">
          {emoji}
        </div>

        <p className="text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold">Скоро</p>
        <h1 className="text-[28px] font-extrabold tracking-tight text-[#0F2A36] mt-1">{title}</h1>
        <p className="text-sm text-[#0F2A36]/60 mt-3 max-w-md leading-relaxed">{description}</p>

        <div className="mt-8 vd-grad-soft border border-blue-100 rounded-2xl px-5 py-4 max-w-md">
          <p className="text-[11px] uppercase tracking-widest text-[#3B5BFF] font-bold">Что уже работает</p>
          <p className="text-sm text-[#0F2A36] mt-1">
            Раздел <strong>«Визы»</strong> — оформление виз в 9 стран. Брони отеля и билета доступны как
            дополнительные услуги при оформлении визы.
          </p>
        </div>
      </div>
    </div>
  );
}
