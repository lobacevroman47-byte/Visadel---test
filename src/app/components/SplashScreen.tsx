export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center vd-splash">
      <div className="flex items-center gap-3 vd-splash-logo">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 12 L9 18 L21 6" stroke="#5C7BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[#0F2A36] font-extrabold text-[40px] tracking-tight">VISADEL</span>
      </div>

      <div className="absolute bottom-12 flex gap-2 vd-splash-dots">
        <span className="w-2 h-2 bg-[#3B5BFF] rounded-full" style={{ animationDelay: '0s' }} />
        <span className="w-2 h-2 bg-[#3B5BFF] rounded-full" style={{ animationDelay: '0.2s' }} />
        <span className="w-2 h-2 bg-[#3B5BFF] rounded-full" style={{ animationDelay: '0.4s' }} />
      </div>

      <style>{`
        .vd-splash-logo {
          animation: vd-pop 0.6s ease-out;
        }
        .vd-splash-dots > span {
          animation: vd-pulse 1s ease-in-out infinite;
        }
        @keyframes vd-pop {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes vd-pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.3); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
