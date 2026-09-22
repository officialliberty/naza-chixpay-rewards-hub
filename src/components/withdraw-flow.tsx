import { useEffect, useState } from "react";
import { ArrowLeft, Banknote, Check, IdCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ChixLoader } from "@/components/chix-loader";

export const nigerianBanks = [
  "Access Bank", "Citibank Nigeria", "Ecobank Nigeria", "Fidelity Bank", "First Bank of Nigeria",
  "First City Monument Bank (FCMB)", "Globus Bank", "Guaranty Trust Bank (GTBank)", "Heritage Bank",
  "Jaiz Bank", "Keystone Bank", "Kuda Microfinance Bank", "Lotus Bank", "Moniepoint MFB", "Opay",
  "Optimus Bank", "Palmpay", "Parallex Bank", "Polaris Bank", "PremiumTrust Bank", "Providus Bank",
  "Signature Bank", "Stanbic IBTC Bank", "Standard Chartered Bank", "Sterling Bank", "SunTrust Bank",
  "Taj Bank", "Titan Trust Bank", "Union Bank of Nigeria", "United Bank for Africa (UBA)",
  "Unity Bank", "VFD Microfinance Bank", "Wema Bank", "Zenith Bank",
];

type Step = "details" | "verify" | "loading" | "done";

type Props = {
  onBack: () => void;
  onNeedKey: (message: string) => void;
  onSuccess: (amount: number) => void;
  balance: number;
  defaultName: string;
};

export function WithdrawFlow({ onBack, onNeedKey, onSuccess, balance, defaultName }: Props) {
  const [step, setStep] = useState<Step>("details");
  const [fullName, setFullName] = useState(defaultName);
  const [bank, setBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const value = Number(amount.replace(/[^\d]/g, "")) || 0;

  useEffect(() => {
    if (step !== "loading") return undefined;
    const timer = window.setTimeout(() => setStep("done"), 1800);
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
    const result = data as { ok?: boolean; reason?: string } | null;
    if (!result?.ok) {
      const reason = result?.reason;
      if (reason === "no_key") return onNeedKey("You need an active Chix ID before you can withdraw.");
      if (reason === "locked") return onNeedKey("Your Chix ID is locked — all its uses have been used. Buy a new key to withdraw.");
      if (reason === "wrong_code") return onNeedKey("That Chix ID is not correct. Buy or activate your Chix ID to withdraw.");
      return setNotice("That withdrawal could not be completed.");
    }
    onSuccess(value);
    setStep("loading");
  };

  return (
    <section className="pb-28">
      <header className="flex items-center gap-3">
        <Button variant="glass" size="icon" aria-label="Back" className="rounded-full" onClick={onBack}><ArrowLeft /></Button>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-leaf">Cash out</p>
          <h1 className="font-display text-xl font-semibold">{step === "done" ? "Withdrawal sent" : step === "verify" ? "Verify your Chix ID" : "Withdraw funds"}</h1>
        </div>
      </header>

      {step === "details" && <div className="auth-enter mt-5 space-y-4">
        <div className="rounded-[26px] border border-leaf/25 bg-leaf/10 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-leaf">Available balance</p>
          <p className="mt-1 font-display text-3xl font-semibold">₦{balance.toLocaleString()}</p>
        </div>

        <div className="rounded-[26px] border border-glass-border bg-glass p-4 backdrop-blur-xl">
          <p className="text-xs font-semibold">Bank details</p>
          <label className="mt-3 block text-[11px] font-semibold text-muted-foreground">Account name</label>
          <Input value={fullName} onChange={(e) => { setFullName(e.target.value); setNotice(""); }} placeholder="Your full name" className="mt-1.5 h-12 rounded-2xl border-glass-border bg-background/45" />
          <label className="mt-3 block text-[11px] font-semibold text-muted-foreground">Bank</label>
          <select value={bank} onChange={(e) => { setBank(e.target.value); setNotice(""); }} className="mt-1.5 h-12 w-full rounded-2xl border border-glass-border bg-background/60 px-4 text-sm outline-none focus:ring-1 focus:ring-ring">
            <option value="">Select your bank</option>
            {nigerianBanks.map((item) => <option className="bg-ink" key={item}>{item}</option>)}
          </select>
          <label className="mt-3 block text-[11px] font-semibold text-muted-foreground">Account number</label>
          <Input value={accountNumber} inputMode="numeric" maxLength={10} onChange={(e) => { setAccountNumber(e.target.value.replace(/[^\d]/g, "")); setNotice(""); }} placeholder="0123456789" className="mt-1.5 h-12 rounded-2xl border-glass-border bg-background/45 tracking-[0.12em]" />
          <label className="mt-3 block text-[11px] font-semibold text-muted-foreground">Amount to withdraw</label>
          <Input value={amount} inputMode="numeric" onChange={(e) => { setAmount(e.target.value.replace(/[^\d]/g, "")); setNotice(""); }} placeholder="e.g. 50000" className="mt-1.5 h-12 rounded-2xl border-glass-border bg-background/45" />
        </div>

        {notice && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/15 p-3 text-xs">{notice}</p>}
        <Button variant="reward" size="lg" className="w-full" onClick={continueToVerify}>Continue</Button>
      </div>}

      {step === "verify" && <div className="auth-enter mt-5 space-y-4">
        <div className="rounded-[26px] border border-glass-border bg-glass p-4 backdrop-blur-xl">
          <span className="grid size-12 place-items-center rounded-2xl bg-gold/15 text-gold"><IdCard /></span>
          <p className="mt-4 text-xs font-semibold">Enter your Chix ID</p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Your Chix ID confirms this withdrawal. Each key allows a set number of withdrawals before it locks.</p>
          <Input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setNotice(""); }} placeholder="CHIX-00000-00" className="mt-3 h-12 rounded-2xl border-glass-border bg-background/45 uppercase tracking-[0.14em]" />
        </div>
        <div className="flex items-center justify-between rounded-[26px] border border-leaf/25 bg-leaf/10 p-4 text-xs">
          <span className="text-muted-foreground">{bank} · {accountNumber}</span>
          <span className="font-display text-base font-semibold text-leaf">₦{value.toLocaleString()}</span>
        </div>
        {notice && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/15 p-3 text-xs">{notice}</p>}
        <Button disabled={busy} variant="reward" size="lg" className="w-full" onClick={submit}>{busy ? "Verifying…" : "Continue"}</Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setStep("details")}>Edit bank details</Button>
      </div>}

      {step === "loading" && <ChixLoader title="Processing withdrawal" note="Sending your money to your bank…" />}

      {step === "done" && <div className="auth-enter relative mt-6 overflow-hidden rounded-[28px] border border-leaf/30 bg-glass p-6 text-center backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => <span key={i} className={`confetti-bit confetti-${i + 1}`} />)}
        </div>
        <span className="success-pop mx-auto grid size-16 place-items-center rounded-[22px] bg-leaf/15 text-leaf"><Check className="size-9" /></span>
        <h2 className="mt-5 font-display text-2xl font-semibold">Congratulations 👏</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">₦{value.toLocaleString()} is on its way to {bank} · {accountNumber}.</p>
        <div className="mt-5 flex items-center justify-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-2 text-[11px]"><ShieldCheck className="size-4 text-leaf" /> Debited from your wallet balance</div>
        <Button variant="reward" size="lg" className="mt-6 w-full" onClick={onBack}><Banknote /> Back to wallet</Button>
      </div>}
    </section>
  );
}
