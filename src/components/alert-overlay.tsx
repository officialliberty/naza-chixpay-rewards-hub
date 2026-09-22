import { Ban, BellRing, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AlertNotice = { id: string; title: string; body: string; created_at: string };

function tone(title: string) {
  const text = title.toLowerCase();
  if (text.includes("reject") || text.includes("restrict") || text.includes("declin") || text.includes("debit")) {
    return { icon: Ban, ring: "border-destructive/35 bg-destructive/12 text-destructive-foreground", label: "Action needed" };
  }
  if (text.includes("approv") || text.includes("credit") || text.includes("restored") || text.includes("complete")) {
    return { icon: CheckCircle2, ring: "border-leaf/35 bg-leaf/12 text-leaf", label: "Good news" };
  }
  return { icon: BellRing, ring: "border-gold/35 bg-gold/12 text-gold", label: "Update" };
}

export function AlertOverlay({ notice, remaining, onDismiss }: { notice: AlertNotice; remaining: number; onDismiss: () => void }) {
  const { icon: Icon, ring, label } = tone(notice.title);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-5 backdrop-blur-xl">
    <div className="w-full max-w-[400px] rounded-[30px] border border-glass-border bg-glass-strong p-7 text-center shadow-brand backdrop-blur-2xl">
      <div className={`mx-auto grid size-20 place-items-center rounded-3xl border ${ring}`}><Icon className="size-9"/></div>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">{notice.title}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{notice.body}</p>
      <p className="mt-3 text-[11px] text-muted-foreground">{new Date(notice.created_at).toLocaleString()}</p>
      <Button variant="reward" size="lg" className="mt-6 w-full rounded-full" onClick={onDismiss}>
        {remaining > 1 ? `Next update (${remaining - 1} more)` : "Got it"}
      </Button>
    </div>
  </div>;
}
