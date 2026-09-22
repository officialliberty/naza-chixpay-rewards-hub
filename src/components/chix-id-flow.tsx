import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Clock3, Copy, IdCard, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ChixLoader } from "@/components/chix-loader";

export type KeyPlan = { name: string; amount: number; uses: number | null; note: string };

export const keyPlans: KeyPlan[] = [
  { name: "Basic Key", amount: 6200, uses: 1, note: "1 withdrawal · valid 24 hours (1 day)" },
  { name: "Standard Key", amount: 9400, uses: 2, note: "2 withdrawals · valid 48 hours (2 days)" },
  { name: "Premium Key", amount: 14900, uses: 3, note: "3 withdrawals · valid 72 hours (3 days)" },
  { name: "Gold Key", amount: 25600, uses: 4, note: "4 withdrawals · valid 96 hours (4 days)" },
  { name: "Platinum Key", amount: 35900, uses: 5, note: "5 withdrawals · valid 120 hours (5 days)" },
  { name: "Diamond Key", amount: 42800, uses: null, note: "Unlimited withdrawals · never expires" },
];

export type KeyInfo = { code: string; uses_left: number | null; unlimited: boolean; expires_at: string | null };

export const keyIsActive = (key: KeyInfo | null | undefined) => {
  if (!key) return false;
  if (key.unlimited) return true;
  if ((key.uses_left ?? 0) <= 0) return false;
  return !key.expires_at || new Date(key.expires_at).getTime() > Date.now();
};

const countdown = (iso: string) => {
  const left = new Date(iso).getTime() - Date.now();
  if (left <= 0) return "Expired";
  const hours = Math.floor(left / 3600000);
  const minutes = Math.floor((left % 3600000) / 60000);
  const seconds = Math.floor((left % 60000) / 1000);
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
};

const payment = { bank: "ChixPay Collections (Demo)", accountName: "ChixPay Technologies Ltd", accountNumber: "0000000000" };

type Step = "boot" | "name" | "select" | "loading" | "payment" | "pending" | "approved";

export function ChixIdFlow({ onBack, onActivated }: { onBack: () => void; onActivated?: (code: string) => void }) {
  const [step, setStep] = useState<Step>("boot");
  const [plan, setPlan] = useState<KeyPlan | null>(null);
  const [fullName, setFullName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [chixId, setChixId] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (cancelled || !user) return;
      const meta = user.user_metadata as { fullName?: string; full_name?: string } | undefined;
      setFullName(meta?.fullName ?? meta?.full_name ?? "");
      const { data: key } = await supabase.from("chix_keys").select("code, uses_left, unlimited").eq("user_id", user.id).maybeSingle();
      if (cancelled) return;
      if (key && (key.unlimited || (key.uses_left ?? 0) > 0)) {
        setChixId(key.code);
        onActivated?.(key.code);
        setStep("approved");
        return;
      }
      const { data: pendingRow } = await supabase.from("chix_key_requests").select("status, plan_name").eq("user_id", user.id).eq("status", "pending").maybeSingle();
      if (cancelled) return;
      setStep(pendingRow ? "pending" : "name");
    })();
    return () => { cancelled = true; };
  }, [onActivated]);

  useEffect(() => {
    if (step !== "loading") return undefined;
    const timer = window.setTimeout(() => setStep("payment"), 2200);
    return () => window.clearTimeout(timer);
  }, [step]);

  const confirmName = () => {
    if (fullName.trim().split(/\s+/).length < 2) return setNotice("Enter your full name exactly as it appears on your bank account.");
    setNotice(""); setStep("select");
  };

  const choosePlan = (selected: KeyPlan) => { setPlan(selected); setNotice(""); setStep("loading"); };

  const submitReceipt = async () => {
    if (!plan) return;
    if (!file) return setNotice("Please attach your payment receipt first.");
    setBusy(true); setNotice("");
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { setBusy(false); return setNotice("Please sign in again to submit your payment."); }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/chixid-${Date.now()}.${ext}`;
    const upload = await supabase.storage.from("upgrade-receipts").upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (upload.error) { setBusy(false); return setNotice(upload.error.message); }
    const { error } = await supabase.from("chix_key_requests").insert({
      user_id: user.id, full_name: fullName.trim(), plan_name: plan.name, amount: plan.amount, uses_total: plan.uses, receipt_path: path,
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    setStep("pending");
  };

  const checkApproval = async () => {
    setBusy(true); setNotice("");
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { setBusy(false); return setNotice("Please sign in again."); }
    const { data: key } = await supabase.from("chix_keys").select("code, uses_left, unlimited").eq("user_id", user.id).maybeSingle();
    setBusy(false);
    if (key && (key.unlimited || (key.uses_left ?? 0) > 0)) {
      setChixId(key.code);
      onActivated?.(key.code);
      setStep("approved");
      return;
    }
    setNotice("Your payment is still under review. Please check again shortly.");
  };

  const copyId = () => { void navigator.clipboard.writeText(chixId); setCopied(true); window.setTimeout(() => setCopied(false), 2000); };

  const heading = step === "approved" ? "Chix ID ready" : step === "pending" ? "Payment under review"
    : step === "payment" ? "Make payment" : step === "select" ? "Choose your key" : "Chix ID";

  return (
    <section className="pb-28">
      <header className="flex items-center gap-3">
        <Button variant="glass" size="icon" aria-label="Back" className="rounded-full" onClick={onBack}><ArrowLeft /></Button>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-leaf">Withdrawal key</p>
          <h1 className="font-display text-xl font-semibold">{heading}</h1>
        </div>
      </header>

      {step === "boot" && <ChixLoader title="Opening Chix ID" note="Checking your key status…" />}

      {step === "name" && <div className="auth-enter mt-5 space-y-4">
        <div className="rounded-[26px] border border-glass-border bg-glass p-4 backdrop-blur-xl">
          <span className="grid size-12 place-items-center rounded-2xl bg-leaf/15 text-leaf"><IdCard /></span>
          <p className="mt-4 text-xs font-semibold">Confirm your name</p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Your Chix ID is issued in your name. Make sure it matches the bank account you will pay from.</p>
          <Input value={fullName} onChange={(e) => { setFullName(e.target.value); setNotice(""); }} placeholder="Your full name" autoComplete="name" className="mt-3 h-12 rounded-2xl border-glass-border bg-background/45" />
        </div>
        {notice && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/15 p-3 text-xs">{notice}</p>}
        <Button variant="reward" size="lg" className="w-full" onClick={confirmName}>Continue</Button>
      </div>}

      {step === "select" && <div className="auth-enter mt-5 space-y-3">
        <p className="text-xs leading-5 text-muted-foreground">Choose a plan that fits your usage. Each key unlocks a set number of withdrawals, then locks.</p>
        {keyPlans.map((item) => (
          <button key={item.name} onClick={() => choosePlan(item)} className="w-full rounded-[24px] border border-glass-border bg-glass p-4 text-left backdrop-blur-xl transition hover:border-leaf/40">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">{item.name}</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-display text-2xl font-semibold">₦{item.amount.toLocaleString()}</p>
              <span className="text-xs font-semibold text-gold">Select →</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{item.note}</p>
          </button>
        ))}
      </div>}

      {step === "loading" && <ChixLoader title={`Preparing ${plan?.name ?? "key"}`} note="Generating your secure payment details…" />}

      {step === "payment" && plan && <div className="auth-enter mt-5 space-y-4">
        <div className="rounded-[26px] border border-leaf/25 bg-leaf/10 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-leaf">Amount to pay</p>
          <p className="mt-1 font-display text-3xl font-semibold">₦{plan.amount.toLocaleString()}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{plan.name} · {plan.note}</p>
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
        </div>

        {notice && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/15 p-3 text-xs">{notice}</p>}
        <Button disabled={busy} variant="reward" size="lg" className="w-full" onClick={submitReceipt}>{busy ? "Submitting…" : "I have paid — submit receipt"}</Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setStep("select")}>Choose another key</Button>
      </div>}

      {step === "pending" && <div className="auth-enter mt-6 rounded-[28px] border border-glass-border bg-glass p-6 text-center backdrop-blur-2xl">
        <span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-gold/15 text-gold"><Clock3 className="size-8" /></span>
        <h2 className="mt-5 font-display text-2xl font-semibold">Payment under review</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Your receipt has been sent for review. Your Chix ID is released as soon as the payment is approved.</p>
        <div className="mt-5 flex items-center justify-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-2 text-[11px]"><ShieldCheck className="size-4 text-leaf" /> Receipt received · status: pending</div>
        {notice && <p className="mt-4 rounded-xl border border-gold/25 bg-gold/10 p-3 text-xs">{notice}</p>}
        <Button disabled={busy} variant="reward" size="lg" className="mt-6 w-full" onClick={checkApproval}>{busy ? "Checking…" : "Check approval status"}</Button>
        <Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={onBack}>Back to wallet</Button>
      </div>}

      {step === "approved" && <div className="auth-enter relative mt-6 overflow-hidden rounded-[28px] border border-leaf/30 bg-glass p-6 text-center backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => <span key={i} className={`confetti-bit confetti-${i + 1}`} />)}
        </div>
        <span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-leaf/15 text-leaf success-pop"><Check className="size-9" /></span>
        <h2 className="mt-5 font-display text-2xl font-semibold">Congratulations 👏</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Your payment was approved and your Chix ID is now active. Copy it and use it whenever you withdraw.</p>
        <div className="mt-5 rounded-[22px] border border-gold/30 bg-gold/10 p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-gold">Your Chix ID</p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-[0.1em]">{chixId}</p>
        </div>
        <Button variant="glass" size="lg" className="mt-3 w-full rounded-full" onClick={copyId}>{copied ? <Check /> : <Copy />} {copied ? "Chix ID copied" : "Copy Chix ID"}</Button>
        <Button variant="reward" size="lg" className="mt-2 w-full" onClick={onBack}>Back to wallet</Button>
      </div>}
    </section>
  );
}
