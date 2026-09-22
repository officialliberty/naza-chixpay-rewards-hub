import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Clock3, Copy, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ChixLoader } from "@/components/chix-loader";

export type UpgradePlan = { name: string; amount: number; tag: string; perks: string[] };

export const upgradePlans: UpgradePlan[] = [
  { name: "Starter", amount: 15000, tag: "Entry level", perks: ["₦50,000 daily withdrawal", "Basic task access"] },
  { name: "Bronze", amount: 25000, tag: "Popular", perks: ["₦120,000 daily withdrawal", "Faster reward review"] },
  { name: "Silver", amount: 35000, tag: "Balanced", perks: ["₦250,000 daily withdrawal", "Priority tasks"] },
  { name: "Gold", amount: 50000, tag: "Advanced", perks: ["₦500,000 daily withdrawal", "Double video rewards"] },
  { name: "Platinum", amount: 75000, tag: "Premium", perks: ["₦1,000,000 daily withdrawal", "Dedicated support"] },
  { name: "Diamond", amount: 100000, tag: "Maximum", perks: ["Unlimited withdrawal review", "Highest referral tier"] },
];

const payment = { bank: "ChixPay Collections (Demo)", accountName: "ChixPay Technologies Ltd", accountNumber: "0000000000" };

type Step = "select" | "loading" | "payment" | "pending";

export function UpgradeFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>("select");
  const [plan, setPlan] = useState<UpgradePlan | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== "loading") return;
    const timer = window.setTimeout(() => setStep("payment"), 2200);
    return () => window.clearTimeout(timer);
  }, [step]);

  const choosePlan = (selected: UpgradePlan) => { setPlan(selected); setNotice(""); setStep("loading"); };

  const submitReceipt = async () => {
    if (!plan) return;
    if (!file) return setNotice("Please attach your payment receipt first.");
    setBusy(true); setNotice("");
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { setBusy(false); return setNotice("Please sign in again to submit your upgrade."); }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const upload = await supabase.storage.from("upgrade-receipts").upload(path, file, { contentType: file.type || undefined });
    if (upload.error) { setBusy(false); return setNotice(upload.error.message); }
    const { error } = await supabase.from("upgrade_requests").insert({ user_id: user.id, plan_name: plan.name, amount: plan.amount, receipt_path: path });
    setBusy(false);
    if (error) return setNotice(error.message);
    setStep("pending");
  };

  return (
    <section className="pb-28">
      <header className="flex items-center gap-3">
        <Button variant="glass" size="icon" aria-label="Back" className="rounded-full" onClick={onBack}><ArrowLeft /></Button>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-leaf">Account upgrade</p>
          <h1 className="font-display text-xl font-semibold">{step === "pending" ? "Upgrade pending" : step === "payment" ? "Make payment" : "Choose a plan"}</h1>
        </div>
      </header>

      {step === "select" && <div className="auth-enter mt-5 space-y-3">
        <p className="text-xs leading-5 text-muted-foreground">Pick the plan that matches how much you want to withdraw and earn.</p>
        {upgradePlans.map((item) => (
          <button key={item.name} onClick={() => choosePlan(item)} className="w-full rounded-[24px] border border-glass-border bg-glass p-4 text-left backdrop-blur-xl transition hover:border-leaf/40">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">{item.tag}</p>
                <p className="mt-1 font-display text-lg font-semibold">{item.name}</p>
              </div>
              <p className="font-display text-lg font-semibold text-leaf">₦{item.amount.toLocaleString()}</p>
            </div>
            <div className="mt-3 space-y-1.5">
              {item.perks.map((perk) => <p key={perk} className="flex items-center gap-2 text-[11px] text-muted-foreground"><Check className="size-3.5 text-leaf" />{perk}</p>)}
            </div>
          </button>
        ))}
      </div>}

      {step === "loading" && <ChixLoader title={`Preparing ${plan?.name ?? ""} plan`} note="Generating your secure payment details…" />}

      {step === "payment" && plan && <div className="auth-enter mt-5 space-y-4">
        <div className="rounded-[26px] border border-leaf/25 bg-leaf/10 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-leaf">Amount to pay</p>
          <p className="mt-1 font-display text-3xl font-semibold">₦{plan.amount.toLocaleString()}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{plan.name} plan upgrade</p>
        </div>

        <div className="rounded-[26px] border border-glass-border bg-glass p-4 backdrop-blur-xl">
          <p className="text-xs font-semibold">Payment details</p>
          {[["Bank", payment.bank], ["Account name", payment.accountName], ["Account number", payment.accountNumber]].map(([label, value]) => (
            <div key={label} className="mt-3 flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold">{value}</span>
            </div>
          ))}
          <Button variant="glass" size="sm" className="mt-4 w-full rounded-full" onClick={() => { void navigator.clipboard.writeText(payment.accountNumber); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}>
            {copied ? <Check /> : <Copy />} {copied ? "Account number copied" : "Copy account number"}
          </Button>
        </div>

        <div className="rounded-[26px] border border-glass-border bg-glass p-4 backdrop-blur-xl">
          <p className="text-xs font-semibold">Upload payment receipt</p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Attach a clear screenshot or photo of your transfer so it can be reviewed.</p>
          <input ref={fileInput} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setNotice(""); }} />
          <Button variant="glass" size="lg" className="mt-3 w-full justify-start rounded-2xl" onClick={() => fileInput.current?.click()}>
            <Upload /> <span className="truncate">{file ? file.name : "Choose receipt file"}</span>
          </Button>
          <Input readOnly value={`₦${plan.amount.toLocaleString()} · ${plan.name}`} className="mt-3 h-12 rounded-2xl border-glass-border bg-background/45 text-xs" />
        </div>

        {notice && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/15 p-3 text-xs">{notice}</p>}
        <Button disabled={busy} variant="reward" size="lg" className="w-full" onClick={submitReceipt}>{busy ? "Submitting…" : "I have paid — submit receipt"}</Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setStep("select")}>Choose another plan</Button>
      </div>}

      {step === "pending" && plan && <div className="auth-enter mt-6 rounded-[28px] border border-glass-border bg-glass p-6 text-center backdrop-blur-2xl">
        <span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-gold/15 text-gold"><Clock3 className="size-8" /></span>
        <h2 className="mt-5 font-display text-2xl font-semibold">Payment under review</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Your {plan.name} upgrade of ₦{plan.amount.toLocaleString()} is pending. Your receipt has been sent for review and your account upgrades once it is approved.</p>
        <div className="mt-5 flex items-center justify-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-2 text-[11px]"><ShieldCheck className="size-4 text-leaf" /> Receipt received · status: pending</div>
        <Button variant="reward" size="lg" className="mt-6 w-full" onClick={onBack}>Back to wallet</Button>
      </div>}
    </section>
  );
}
