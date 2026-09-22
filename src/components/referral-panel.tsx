import { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, Share2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const REFERRAL_BONUS = 5200;

type Referral = { id: string; referred_name: string; amount: number; created_at: string };

export function ReferralPanel({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState("");
  const [list, setList] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return setLoading(false);
      const [{ data: profile }, { data: referrals }] = await Promise.all([
        supabase.from("profiles").select("referral_code").eq("id", user.id).maybeSingle(),
        supabase.from("referrals").select("id, referred_name, amount, created_at").eq("referrer_id", user.id).order("created_at", { ascending: false }),
      ]);
      let referralCode = profile?.referral_code ?? "";
      if (!referralCode) {
        const meta = (user.user_metadata ?? {}) as { fullName?: string; phone?: string; state?: string };
        const args: { _full_name?: string; _phone?: string; _state?: string } = {};
        if (meta.fullName) args._full_name = meta.fullName;
        if (meta.phone) args._phone = meta.phone;
        if (meta.state) args._state = meta.state;
        const { data: ensured } = await supabase.rpc("ensure_profile", args);
        referralCode = (ensured as string | null) ?? "";
      }
      setCode(referralCode);
      setList((referrals ?? []).map((row) => ({ ...row, amount: Number(row.amount) })));
      setLoading(false);
    };
    void load();
  }, []);

  const link = typeof window === "undefined" ? "" : `${window.location.origin}/?ref=${code}`;
  const earned = list.reduce((total, row) => total + row.amount, 0);
  const copy = (value: string, key: string) => { void navigator.clipboard.writeText(value); setCopied(key); window.setTimeout(() => setCopied(""), 2000); };

  return (
    <section className="pb-28">
      <header className="flex items-center gap-3">
        <Button variant="glass" size="icon" aria-label="Back" className="rounded-full" onClick={onBack}><ArrowLeft /></Button>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-leaf">Referrals</p>
          <h1 className="font-display text-xl font-semibold">Invite &amp; earn ₦{REFERRAL_BONUS.toLocaleString()}</h1>
        </div>
      </header>

      <div className="auth-enter mt-5 rounded-[28px] border border-leaf/25 bg-leaf/10 p-5 backdrop-blur-2xl">
        <p className="text-[10px] uppercase tracking-[0.14em] text-leaf">Referral earnings</p>
        <p className="mt-1 font-display text-3xl font-semibold">₦{earned.toLocaleString()}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{list.length} successful {list.length === 1 ? "referral" : "referrals"} · ₦{REFERRAL_BONUS.toLocaleString()} each</p>
      </div>

      <div className="mt-3 rounded-[26px] border border-glass-border bg-glass p-4 backdrop-blur-xl">
        <p className="text-xs font-semibold">Your referral code</p>
        <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-glass-border bg-background/45 px-4 py-3">
          <span className="font-display text-lg font-semibold tracking-[0.12em] text-gold">{loading ? "…" : code || "Unavailable"}</span>
          <Button variant="ghost" size="sm" disabled={!code} onClick={() => copy(code, "code")}>{copied === "code" ? <Check /> : <Copy />}</Button>
        </div>
        <Button variant="glass" size="lg" disabled={!code} className="mt-3 w-full rounded-2xl" onClick={() => copy(link, "link")}>
          {copied === "link" ? <Check /> : <Share2 />} {copied === "link" ? "Invite link copied" : "Copy invite link"}
        </Button>
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Your friend enters this code while registering. Once their account is created, ₦{REFERRAL_BONUS.toLocaleString()} is added to your referral earnings.</p>
      </div>

      <div className="mt-3 rounded-[26px] border border-glass-border bg-glass p-4 backdrop-blur-xl">
        <p className="text-xs font-semibold">People you invited</p>
        {loading && <p className="mt-3 text-[11px] text-muted-foreground">Loading…</p>}
        {!loading && list.length === 0 && <p className="mt-3 text-[11px] leading-5 text-muted-foreground">No referrals yet. Share your code to start earning.</p>}
        <div className="mt-3 space-y-2">
          {list.map((row) => (
            <div key={row.id} className="flex items-center gap-3 rounded-2xl border border-glass-border bg-background/35 p-3">
              <span className="grid size-9 place-items-center rounded-xl bg-leaf/15 text-leaf"><Users className="size-4" /></span>
              <div className="flex-1">
                <p className="text-xs font-medium">{row.referred_name}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</p>
              </div>
              <p className="text-xs font-semibold text-leaf">+₦{row.amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
