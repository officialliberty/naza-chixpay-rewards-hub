import { useState } from "react";
import { Ban, Headphones, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupportPage } from "@/components/support-page";

export function RestrictedScreen({ reason, onLogout }: { reason: string | null; onLogout: () => void | Promise<void> }) {
  const [showSupport, setShowSupport] = useState(false);

  return <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
    <div className="pointer-events-none fixed inset-0" aria-hidden="true"><div className="public-aura absolute inset-x-0 top-0 h-[55vh]"/></div>
    <div className="relative z-10 mx-auto w-full max-w-[430px] px-5 py-8">
      {showSupport
        ? <SupportPage onBack={() => setShowSupport(false)}/>
        : <section className="flex min-h-[calc(100vh-64px)] flex-col justify-center">
            <div className="rounded-[30px] border border-destructive/30 bg-destructive/10 p-6 backdrop-blur-2xl">
              <span className="grid size-14 place-items-center rounded-[22px] bg-destructive/20 text-destructive-foreground"><Ban className="size-7"/></span>
              <h1 className="mt-5 font-display text-3xl font-semibold">Account restricted</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Your ChixPay account has been placed on hold, so wallet features are unavailable right now.</p>
              {reason && <p className="mt-4 rounded-2xl border border-glass-border bg-glass p-3 text-xs leading-5 text-destructive-foreground">Reason: {reason}</p>}
              <p className="mt-4 text-xs leading-5 text-muted-foreground">Contact support to review your account. You can still sign out at any time.</p>
            </div>
            <Button variant="reward" size="lg" className="mt-5 w-full" onClick={() => setShowSupport(true)}><Headphones/> Contact support</Button>
            <Button variant="glass" size="lg" className="mt-3 w-full" onClick={() => void onLogout()}><LogOut/> Log out</Button>
          </section>}
    </div>
  </main>;
}
