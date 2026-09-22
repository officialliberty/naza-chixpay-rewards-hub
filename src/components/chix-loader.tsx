import logoMark from "@/assets/chixpay-logo.png";

export function ChixLoader({ title = "Setting up your upgrade", note = "Securing your plan…" }: { title?: string; note?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="relative grid size-28 place-items-center">
        <span className="chix-orbit absolute inset-0 rounded-full border-2 border-transparent border-t-leaf border-r-gold" />
        <span className="absolute inset-3 rounded-full bg-leaf/10 blur-md" />
        <img src={logoMark} alt="" className="chix-pulse size-16 rounded-2xl object-cover shadow-brand" />
      </div>
      <h2 className="mt-7 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
      <div className="mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-glass-strong">
        <span className="chix-bar block h-full w-1/3 rounded-full bg-gradient-to-r from-leaf to-gold" />
      </div>
    </div>
  );
}
