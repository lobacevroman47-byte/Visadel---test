import BrandHeader from './shared/BrandHeader';

interface ComingSoonProps {
  /** Опционально — title и description оставлены для совместимости с
   *  прежними вызовами, но больше не отображаются: показывается только
   *  emoji + «COMING SOON». */
  title?: string;
  description?: string;
  emoji: string;
  onOpenProfile?: () => void;
}

export default function ComingSoon({ emoji, onOpenProfile }: ComingSoonProps) {
  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-24">
      <BrandHeader onOpenProfile={onOpenProfile} />

      <div className="max-w-2xl mx-auto px-5 pt-20 pb-20 flex flex-col items-center text-center">
        <div className="w-28 h-28 rounded-3xl vd-grad-soft border border-blue-100 flex items-center justify-center text-6xl shadow-sm mb-8">
          {emoji}
        </div>

        <h1 className="text-[42px] font-extrabold tracking-tight vd-grad-text uppercase">
          Coming Soon
        </h1>
      </div>
    </div>
  );
}
