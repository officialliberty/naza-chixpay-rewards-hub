import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownToLine, BadgeCheck, Bell, ChevronRight, Clock3,
  Check, Copy, Eye, EyeOff, Headphones, History, IdCard, LockKeyhole,
  ShieldCheck, Sparkles, Star, Trophy, Users, Wallet, Zap,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import logoMark from "@/assets/chixpay-logo.png";
import { UpgradeFlow } from "@/components/upgrade-flow";
import { ReferralPanel } from "@/components/referral-panel";
import { ChixIdFlow } from "@/components/chix-id-flow";
import { WithdrawFlow } from "@/components/withdraw-flow";
import { ProfilePage } from "@/components/profile-page";
import { SupportPage } from "@/components/support-page";

import nairaNote from "@/assets/naira-1000-clean.png";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "ChixPay — Rewards that keep moving" },
    { name: "description", content: "Join ChixPay, claim rewards, complete tasks and grow your wallet." },
    { property: "og:title", content: "ChixPay — Rewards that keep moving" },
    { property: "og:description", content: "Join ChixPay, claim rewards, complete tasks and grow your wallet." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: ChixPay,
});

type Screen = "landing" | "auth" | "state" | "tutorial" | "dashboard";
type FormData = { fullName: string; email: string; phone: string; password: string; state: string; referralCode: string };
type ClaimRecord = { id: number; claimedAt: number; amount: number };

const states = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT Abuja","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];

function MoneyBackdrop() {
  return <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
    <div className="glow-breathe absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-leaf/35 blur-3xl" />
    <div className="absolute top-1/4 -right-20 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
    <div className="absolute bottom-0 -left-24 h-72 w-72 rounded-full bg-gold/15 blur-3xl" />
    {["top-[14%] left-[4%] note-float","top-[38%] right-[4%] note-float-two","bottom-[18%] left-[8%] note-float","bottom-[7%] right-[12%] note-float-two"].map((pos) =>
      <div key={pos} className={`absolute ${pos} h-10 w-20 overflow-hidden rounded-md border border-glass-border opacity-55 shadow-brand`}><img src={nairaNote} alt="" className="h-full w-full object-cover" /></div>
    )}
  </div>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="relative min-h-screen overflow-hidden bg-background text-foreground"><MoneyBackdrop/><div className="relative z-10 mx-auto min-h-screen w-full max-w-[430px] px-5 py-6">{children}</div></main>;
}

function CashFall({ burst }: { burst: number }) {
  if (burst === 0) return null;
  const paths = ["cash-path-1", "cash-path-2", "cash-path-3", "cash-path-4", "cash-path-5", "cash-path-6", "cash-path-7", "cash-path-8", "cash-path-9", "cash-path-10", "cash-path-11", "cash-path-12"];
  return <div key={burst} className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
    {paths.map((path, index) => <img key={path} src={nairaNote} alt="" className={`cash-fall absolute top-[-70px] h-9 w-[72px] rounded-sm object-cover shadow-brand ${path}`} />)}
    <div className="claim-pop absolute left-1/2 top-[42%] -translate-x-1/2 rounded-full border border-gold/35 bg-background/85 px-5 py-3 font-display text-lg font-semibold text-gold shadow-reward backdrop-blur-xl">+₦35,000</div>
  </div>;
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div className="public-aura absolute inset-x-0 top-0 h-[62vh]" />
      <div className="absolute left-[8%] top-[20%] h-px w-24 bg-leaf/30" />
      <div className="absolute right-[8%] top-[36%] h-px w-16 bg-brand/30" />
    </div>
    <div className="relative z-10 mx-auto min-h-screen w-full max-w-6xl px-5 py-5 sm:px-8 lg:px-10">{children}</div>
  </main>;
}

function Brand() {
  return <div className="flex items-center gap-2.5"><img src={logoMark} alt="ChixPay logo" width={40} height={40} loading="eager" className="size-10 rounded-2xl shadow-brand object-cover"/><div><p className="font-display text-lg font-bold leading-none">Chix<span className="text-gold">Pay</span></p><p className="mt-1 text-[10px] text-muted-foreground">Move forward with rewards</p></div></div>;
}

function ChixPay() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [form, setForm] = useState<FormData>({ fullName: "", email: "", phone: "", password: "", state: "", referralCode: "" });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    const openSignedInAccount = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return;
      const meta = ((data.user.user_metadata ?? {}) as Partial<FormData>);
      setForm((old) => ({
        ...old,
        email: data.user.email ?? old.email,
        fullName: meta.fullName ?? old.fullName ?? "ChixPay member",
        phone: meta.phone ?? old.phone,
        state: meta.state ?? old.state ?? "Lagos",
      }));
      if (await blockedIfRestricted(data.user.id)) return;
      setScreen("dashboard");
    };

    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setForm((old) => ({ ...old, referralCode: ref.toUpperCase() }));

    void openSignedInAccount();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event !== "SIGNED_IN" && event !== "USER_UPDATED") || !session?.user) return;
      const meta = ((session.user.user_metadata ?? {}) as Partial<FormData>);
      setForm((old) => ({
        ...old,
        email: session.user.email ?? old.email,
        fullName: meta.fullName ?? old.fullName ?? "ChixPay member",
        phone: meta.phone ?? old.phone,
        state: meta.state ?? old.state ?? "Lagos",
      }));
      void blockedIfRestricted(session.user.id).then((blocked) => { if (!blocked) setScreen("dashboard"); });
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const update = (key: keyof FormData, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const blockedIfRestricted = async (userId: string) => {
    const { data } = await supabase.from("profiles").select("status, restriction_reason").eq("id", userId).maybeSingle();
    if (!data || (data.status ?? "active") === "active") return false;
    await supabase.auth.signOut();
    setScreen("auth");
    setNotice(`This account is restricted${data.restriction_reason ? `: ${data.restriction_reason}` : ""}. Please contact ChixPay support.`);
    return true;
  };
  const login = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice("");
    const email = form.email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: form.password });
    setBusy(false);
    if (error) return setNotice(error.message === "Invalid login credentials" ? "The email or password is incorrect. Please try again." : error.message);
    if (!data.user) return setNotice("We could not open your account. Please try again.");
    if (await blockedIfRestricted(data.user.id)) return;
    const meta = ((data.user.user_metadata ?? {}) as Partial<FormData>);
    setForm((old) => ({ ...old, fullName: meta.fullName ?? "ChixPay member", phone: meta.phone ?? "", state: meta.state ?? "Lagos" }));
    setScreen("dashboard");
  };
  const beginSignup = (event: FormEvent) => {
    event.preventDefault();
    if (!termsAccepted) return setNotice("Please accept the Terms and Privacy Notice to continue.");
    setNotice(""); setScreen("state");
  };
  const finishSignup = async () => {
    setBusy(true); setNotice("");
    const email = form.email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({ email, password: form.password, options: { data: { fullName: form.fullName, phone: form.phone, state: form.state } } });
    if (error) { setBusy(false); return setNotice(error.message); }
    if (!data.session) {
      const signIn = await supabase.auth.signInWithPassword({ email, password: form.password });
      if (signIn.error) { setBusy(false); return setNotice(signIn.error.message); }
    }
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) await supabase.from("profiles").upsert({ id: userData.user.id, full_name: form.fullName, phone: form.phone, state: form.state });
    const code = form.referralCode.trim();
    if (code) {
      const { data: result } = await supabase.rpc("redeem_referral", { _code: code, _name: form.fullName });
      const outcome = result as { ok?: boolean; reason?: string } | null;
      if (outcome && !outcome.ok) setNotice(outcome.reason === "invalid_code" ? "That referral code was not recognised, so no referral was recorded." : "Your referral code could not be applied.");
    }
    setBusy(false);
    setForm((old) => ({ ...old, email }));
    setScreen("tutorial");
  };
  const googleLogin = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) setNotice(result.error.message);
  };

  if (screen === "dashboard") return <Dashboard name={form.fullName || "ChixPay member"} state={form.state || "Lagos"} onLogout={async () => {
    await supabase.auth.signOut();
    setForm((old) => ({ ...old, password: "" }));
    setScreen("landing");
  }} />;

  return <PublicShell>
    <header className="flex items-center justify-between"><Brand/><div className="flex items-center gap-2">{screen === "landing" ? <Button variant="glass" size="sm" onClick={() => { setMode("login"); setScreen("auth"); }}>Log in</Button> : <Button variant="glass" size="sm" onClick={() => setScreen("landing")}>Back</Button>}</div></header>

    {screen === "landing" && <section className="landing-enter grid min-h-[calc(100vh-80px)] items-center gap-10 py-10 lg:grid-cols-[1.08fr_.92fr] lg:py-16">
      <div className="max-w-xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-leaf/25 bg-leaf/10 px-3 py-1.5 text-xs text-leaf backdrop-blur-xl"><Sparkles className="size-3.5"/> A smarter way to earn rewards</div>
        <h1 className="mt-6 font-display text-[42px] font-semibold leading-[1.07] sm:text-5xl lg:text-6xl">Move money forward.<br/><span className="text-leaf">Get rewarded.</span></h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">ChixPay brings rewards, tasks, referrals, and member support into one clear experience built for everyday Nigerians.</p>
        <p className="mt-4 flex items-start gap-2 text-sm text-foreground/80"><Check className="mt-0.5 size-4 shrink-0 text-gold"/> New members can unlock a ₦170,000 welcome offer after registration.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button variant="reward" size="lg" className="sm:min-w-48" onClick={() => { setMode("signup"); setScreen("auth"); }}>Create free account <ChevronRight/></Button>
          <Button variant="glass" size="lg" className="sm:min-w-40" onClick={() => { setMode("login"); setScreen("auth"); }}>Log in securely</Button>
        </div>
        <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="size-3.5 text-leaf"/> Your sign-in details are encrypted and handled securely.</p>
      </div>

      <div className="relative mx-auto w-full max-w-md">
        <div className="relative overflow-hidden rounded-[32px] border border-glass-border bg-glass p-5 shadow-brand backdrop-blur-2xl sm:p-7">
          <div className="glass-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-foreground/10 to-transparent"/>
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-leaf">CHIXPAY EXPERIENCE</span><span className="size-2 rounded-full bg-gold"/></div>
          <h2 className="mt-8 font-display text-2xl font-semibold">Everything in one place.</h2>
          <div className="mt-6 space-y-3">
            {[{icon: BadgeCheck,title:"Complete verified tasks",text:"See opportunities clearly before you begin."},{icon: Headphones,title:"Support when you need it",text:"Reach the ChixPay team through trusted channels."},{icon: Users,title:"Invite your people",text:"Track referral activity from your account."}].map(({icon:Icon,title,text}) => <div key={title} className="flex gap-3 rounded-2xl border border-glass-border bg-glass p-3.5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-leaf/15 text-leaf"><Icon className="size-5"/></span><div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{text}</p></div></div>)}
          </div>
        </div>
      </div>
    </section>}

    {screen === "auth" && <section className="auth-enter mx-auto grid min-h-[calc(100vh-80px)] max-w-5xl items-center gap-10 py-8 lg:grid-cols-[.8fr_1.2fr] lg:py-12">
      <div className="hidden max-w-sm lg:block"><p className="text-xs font-semibold text-leaf">ACCOUNT OPENING</p><h1 className="mt-4 font-display text-4xl font-semibold leading-tight">A secure start to your ChixPay journey.</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">Create your profile, choose your state, and take a quick guided tour before opening your account.</p><div className="mt-8 space-y-4">{["Your details stay private","Clear step-by-step setup","Access your account from any device"].map((text) => <p key={text} className="flex items-center gap-3 text-sm"><span className="grid size-7 place-items-center rounded-full bg-leaf/15 text-leaf"><Check className="size-4"/></span>{text}</p>)}</div></div>
      <div className="mx-auto w-full max-w-xl rounded-[32px] border border-glass-border bg-glass p-5 shadow-brand backdrop-blur-2xl sm:p-8">
        <div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-leaf">{mode === "signup" ? "STEP 1 OF 2" : "SECURE SIGN IN"}</p><h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{mode === "signup" ? "Create your account" : "Welcome back"}</h1><p className="mt-2 text-sm text-muted-foreground">{mode === "signup" ? "Enter your details exactly as you use them." : "Use the email linked to your ChixPay account."}</p></div><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-leaf/15 text-leaf"><ShieldCheck/></span></div>
        {mode === "signup" && <div className="mt-6 grid grid-cols-2 gap-2"><span className="h-1.5 rounded-full bg-gold"/><span className="h-1.5 rounded-full bg-glass-strong"/></div>}
        <form className="mt-6 space-y-4" onSubmit={mode === "signup" ? beginSignup : login}>
          {mode === "signup" && <><label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">Full legal name</span><Input required autoComplete="name" placeholder="e.g. Adaeze Okafor" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} className="h-13 rounded-2xl border-glass-border bg-background/45 px-4"/></label><label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">Phone number</span><div className="flex h-13 overflow-hidden rounded-2xl border border-glass-border bg-background/45 focus-within:ring-1 focus-within:ring-ring"><span className="grid place-items-center border-r border-glass-border px-4 text-sm font-semibold">+234</span><Input required autoComplete="tel" inputMode="tel" placeholder="801 234 5678" value={form.phone} onChange={(e) => update("phone", e.target.value)} className="h-full rounded-none border-0 bg-transparent px-4 focus-visible:ring-0"/></div></label><label className="block"><span className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">Referral code <span className="font-normal">Optional</span></span><Input placeholder="e.g. CHX4F29A1" value={form.referralCode} onChange={(e) => update("referralCode", e.target.value.toUpperCase())} className="h-13 rounded-2xl border-glass-border bg-background/45 px-4 uppercase tracking-[0.12em]"/><span className="mt-2 block text-[11px] text-muted-foreground">Have a friend&rsquo;s code? Enter it and they earn ₦5,200 when your account is created.</span></label></>}
          <label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">Email address</span><Input required autoComplete="email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => update("email", e.target.value)} className="h-13 rounded-2xl border-glass-border bg-background/45 px-4"/></label>
          <label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">Password</span><div className="relative"><Input required autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} type={showPassword ? "text" : "password"} placeholder={mode === "signup" ? "At least 6 characters" : "Enter your password"} value={form.password} onChange={(e) => update("password", e.target.value)} className="h-13 rounded-2xl border-glass-border bg-background/45 px-4 pr-12"/><Button type="button" variant="ghost" size="icon" aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-2 rounded-xl text-muted-foreground" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff/> : <Eye/>}</Button></div></label>
          {mode === "signup" && <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-muted-foreground"><input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 size-4 accent-[var(--gold)]"/><span>I agree to the <span className="font-semibold text-foreground">Terms of Use</span> and acknowledge the <span className="font-semibold text-foreground">Privacy Notice</span>.</span></label>}
          {notice && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/15 p-3 text-xs text-destructive-foreground">{notice}</p>}
          <Button disabled={busy} variant="reward" size="lg" className="w-full">{busy ? "Please wait…" : mode === "signup" ? "Continue" : "Log in securely"}<ChevronRight/></Button>
        </form>
        <div className="my-5 flex items-center gap-3 text-[10px] text-muted-foreground"><span className="h-px flex-1 bg-border"/>OR CONTINUE WITH<span className="h-px flex-1 bg-border"/></div>
        <Button variant="glass" size="lg" className="w-full" onClick={googleLogin}><span className="grid size-6 place-items-center rounded-full bg-foreground font-display text-xs text-background">G</span> Google</Button>
        <Button variant="ghost" className="mt-4 w-full text-sm text-muted-foreground" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setNotice(""); }}>{mode === "signup" ? "Already have an account? Log in" : "New to ChixPay? Create an account"}</Button>
      </div>
    </section>}

    {screen === "state" && <section className="auth-enter mx-auto flex min-h-[calc(100vh-80px)] max-w-lg items-center py-8"><div className="w-full rounded-[32px] border border-glass-border bg-glass p-6 shadow-brand backdrop-blur-2xl sm:p-8"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-leaf">STEP 2 OF 2</p><h1 className="mt-2 font-display text-3xl font-semibold">Choose your state</h1></div><span className="grid size-11 place-items-center rounded-2xl bg-brand/15 text-brand"><ShieldCheck/></span></div><p className="mt-3 text-sm leading-6 text-muted-foreground">This helps us personalise the tasks and rewards available to you.</p><div className="mt-6 grid grid-cols-2 gap-2"><span className="h-1.5 rounded-full bg-gold"/><span className="h-1.5 rounded-full bg-gold"/></div>
      <label className="mt-7 block text-xs font-semibold text-muted-foreground">State of residence</label><select value={form.state} onChange={(e) => update("state", e.target.value)} className="mt-2 h-13 w-full rounded-2xl border border-glass-border bg-background/60 px-4 text-sm outline-none focus:ring-1 focus:ring-ring"><option value="">Select your state</option>{states.map((state) => <option className="bg-ink" key={state}>{state}</option>)}</select>
      {notice && <p className="mt-3 rounded-xl bg-destructive/15 p-3 text-xs">{notice}</p>}
      <Button disabled={!form.state || busy} variant="reward" size="lg" className="mt-5 w-full" onClick={finishSignup}>{busy ? "Creating account…" : "Create my account"}<ChevronRight/></Button><Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={() => setScreen("auth")}>Back to my details</Button></div></section>}


    {screen === "tutorial" && <div className="mx-auto max-w-[430px]"><Tutorial onDone={() => setScreen("dashboard")}/></div>}
  </PublicShell>;
}

function Tutorial({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const slides = [
    { icon: Wallet, tag: "Your wallet", title: "Claim rewards", text: "A ₦35,000 reward appears every 10 minutes. Claim before the timer resets." },
    { icon: Trophy, tag: "Grow earnings", title: "Complete & earn", text: "Finish tasks and invite friends for more rewards." },
    { icon: IdCard, tag: "Ready to cash out", title: "Get your Chix ID", text: "Buy and activate your Chix ID before making your first withdrawal." },
  ];
  const item = slides[step] ?? slides[0];
  if (!item) return null;
  const Icon = item.icon;
  return <section className="flex min-h-[calc(100vh-88px)] flex-col justify-center pb-8"><div className="rounded-[30px] border border-glass-border bg-glass-strong p-6 backdrop-blur-2xl"><div className="grid size-16 place-items-center rounded-[22px] bg-leaf/15 text-leaf"><Icon className="size-8"/></div><p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-leaf">{item.tag}</p><h1 className="mt-2 font-display text-3xl font-semibold">{item.title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p><div className="mt-8 flex gap-2">{slides.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-gold" : "w-2 bg-glass-strong"}`}/>)}</div></div><Button variant="reward" size="lg" className="mt-5 w-full" onClick={() => step === slides.length - 1 ? onDone() : setStep(step + 1)}>{step === slides.length - 1 ? "Open my wallet" : "Next"}<ChevronRight/></Button><button className="mt-5 text-xs text-muted-foreground" onClick={onDone}>Skip tutorial</button></section>;
}

const actions = [
  { label: "Withdraw", sub: "To your bank", icon: ArrowDownToLine }, { label: "Tasks", sub: "Earn daily", icon: BadgeCheck },
  { label: "Upgrade", sub: "Raise limits", icon: Trophy },
  { label: "Referral", sub: "Invite friends", icon: Users }, { label: "Support", sub: "Get help", icon: Headphones },
];

const actionCopy: Record<string, { title: string; description: string; button: string }> = {
  "Buy Chix ID": { title: "Activate your Chix ID", description: "Your Chix ID verifies your wallet before your first withdrawal.", button: "Activate Chix ID" },
  Withdraw: { title: "Withdraw funds", description: "Choose an amount and continue to your verified bank details.", button: "Continue withdrawal" },
  Tasks: { title: "Daily tasks", description: "Complete today’s verified activities to grow your reward balance.", button: "Start today’s task" },
  History: { title: "Reward history", description: "Your latest wallet activity appears here.", button: "Done" },
  Notifications: { title: "Notifications", description: "You’re all caught up. New reward and account updates will appear here.", button: "Done" },
};

const WELCOME_BONUS = 170000;
const CLAIM_AMOUNT = 35000;
const CLAIM_COOLDOWN = 10 * 60 * 1000;

function Dashboard({ name, state, onLogout }: { name: string; state: string; onLogout: () => Promise<void> }) {
  const [nextClaimAt, setNextClaimAt] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(0); const [message, setMessage] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [chixIdActive, setChixIdActive] = useState(false);
  const [view, setView] = useState<"home" | "upgrade" | "referral" | "chixid" | "withdraw" | "profile" | "support">("home");
  const [claimHistory, setClaimHistory] = useState<ClaimRecord[]>([]);
  const [withdrawn, setWithdrawn] = useState(0);
  const [cashBurst, setCashBurst] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const balance = WELCOME_BONUS + claimHistory.reduce((total, entry) => total + entry.amount, 0) - withdrawn;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id;
      if (!id || cancelled) return;
      setUserId(id);
      const [claims, payouts, key, profile] = await Promise.all([
        supabase.from("reward_claims").select("id, amount, created_at").eq("user_id", id).order("created_at", { ascending: false }),
        supabase.from("withdrawals").select("amount").eq("user_id", id),
        supabase.from("chix_keys").select("uses_left, unlimited").eq("user_id", id).maybeSingle(),
        supabase.from("profiles").select("avatar_path").eq("id", id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (payouts.data) setWithdrawn(payouts.data.reduce((total, row) => total + Number(row.amount), 0));
      if (key.data) setChixIdActive(Boolean(key.data.unlimited) || (key.data.uses_left ?? 0) > 0);
      if (profile.data?.avatar_path) {
        const { data: signed } = await supabase.storage.from("profile-photos").createSignedUrl(profile.data.avatar_path, 60 * 60 * 24);
        if (signed?.signedUrl) setAvatarUrl(signed.signedUrl);
      }
      const rows = claims.data;
      if (!rows) return;
      setClaimHistory(rows.map((row) => ({ id: new Date(row.created_at).getTime(), claimedAt: new Date(row.created_at).getTime(), amount: Number(row.amount) })));
      const latest = rows[0];
      if (latest) setNextClaimAt(new Date(latest.created_at).getTime() + CLAIM_COOLDOWN);
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const updateCountdown = () => setSeconds(Math.max(0, Math.ceil((nextClaimAt - Date.now()) / 1000)));
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [nextClaimAt]);
  useEffect(() => {
    if (cashBurst === 0) return;
    const timer = window.setTimeout(() => setCashBurst(0), 3600);
    return () => window.clearTimeout(timer);
  }, [cashBurst]);
  const clock = useMemo(() => `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`, [seconds]);
  const claimReady = seconds === 0;
  const claimReward = async () => {
    if (!claimReady) return;
    const claimedAt = Date.now();
    setClaimHistory((current) => [{ id: claimedAt, claimedAt, amount: CLAIM_AMOUNT }, ...current]);
    setNextClaimAt(claimedAt + CLAIM_COOLDOWN);
    setCashBurst(claimedAt);
    setMessage("₦35,000 claimed. Your next reward unlocks in 10 minutes.");
    if (!userId) return;
    const { error } = await supabase.from("reward_claims").insert({ user_id: userId, amount: CLAIM_AMOUNT });
    if (error) {
      setClaimHistory((current) => current.filter((entry) => entry.id !== claimedAt));
      setNextClaimAt(Date.now());
      setMessage("We couldn’t save that claim. Please try again.");
    }
  };
  const openAction = (label: string) => {
    if (label === "Upgrade") return setView("upgrade");
    if (label === "Referral") return setView("referral");
    if (label === "Buy Chix ID") return setView("chixid");
    if (label === "Withdraw") return setView("withdraw");
    if (label === "Profile") return setView("profile");
    if (label === "Support") return setView("support");
    setActiveAction(label);
  };
  const completeAction = () => {
    if (!activeAction) return;
    const completed = activeAction;
    setActiveAction(null);
    setMessage(`${completed} action completed.`);
  };
  const activeCopy = activeAction ? actionCopy[activeAction] : undefined;
  if (view === "upgrade") return <Shell><UpgradeFlow onBack={() => setView("home")}/></Shell>;
  if (view === "referral") return <Shell><ReferralPanel onBack={() => setView("home")}/></Shell>;
  if (view === "chixid") return <Shell><ChixIdFlow onBack={() => setView("home")} onActivated={() => setChixIdActive(true)}/></Shell>;
  if (view === "withdraw") return <Shell><WithdrawFlow
    onBack={() => setView("home")}
    balance={balance}
    defaultName={name}
    onNeedKey={(text) => { setMessage(text); setView("chixid"); }}
    onSuccess={(amount) => { setWithdrawn((total) => total + amount); setChixIdActive(true); }}
  /></Shell>;
  if (view === "profile") return <Shell><ProfilePage fallbackName={name} fallbackState={state} chixIdActive={chixIdActive} onBack={() => setView("home")} onLogout={onLogout} onAvatarChange={setAvatarUrl}/></Shell>;
  if (view === "support") return <Shell><SupportPage onBack={() => setView("home")}/></Shell>;
  return <Shell>
    <CashFall burst={cashBurst}/>
    <header className="flex items-center justify-between"><div className="flex items-center gap-2.5"><Button aria-label="Open profile" variant="ghost" size="icon" className="size-10 rounded-full p-0" onClick={() => openAction("Profile")}><Avatar className="size-10 border border-glass-border bg-glass"><AvatarImage src={avatarUrl ?? undefined} alt={`${name}'s profile`} className="object-cover"/><AvatarFallback className="bg-glass font-display text-sm font-semibold text-gold">{name.charAt(0).toUpperCase()}</AvatarFallback></Avatar></Button><Button variant="ghost" className="h-auto flex-col items-start gap-0 rounded-xl px-1 py-1 text-left" onClick={() => openAction("Profile")}><span className="font-display text-sm font-semibold">{name}</span><span className="text-[11px] font-normal text-muted-foreground">{state} State · View profile</span></Button></div><Button aria-label="Notifications" variant="glass" size="icon" className="rounded-full" onClick={() => openAction("Notifications")}><Bell/></Button></header>
    {message && <Button variant="glass" onClick={() => setMessage("")} className="mt-3 h-auto w-full justify-start whitespace-normal rounded-2xl border-leaf/25 bg-leaf/10 p-3 text-left text-xs text-leaf">{message}</Button>}
    <section className="relative mt-5 overflow-hidden rounded-[28px] border border-glass-border bg-glass-strong p-5 backdrop-blur-2xl"><div className="glass-sheen pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-foreground/10 to-transparent"/><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Welcome balance</p><div className="mt-1 flex items-end gap-2"><h1 className="font-display text-4xl font-semibold">₦{balance.toLocaleString()}</h1><span className="mb-1 rounded-full bg-glass px-2 py-0.5 text-[10px] text-muted-foreground">bonus</span></div><p className="mt-2 text-xs text-muted-foreground">Your rewards are active and ready to grow.</p></section>
    <section className="mt-3 rounded-[24px] border border-leaf/25 bg-leaf/10 p-4 backdrop-blur-2xl"><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-leaf">{claimReady ? "Reward ready" : "Next reward"}</p><p className="font-display text-2xl font-semibold">₦35,000</p></div><div className="text-right"><p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{claimReady ? "Available now" : "Ready in"}</p><p className="mt-1 font-display text-xl font-semibold tabular-nums text-gold">{clock}</p></div></div><Button disabled={!claimReady} variant="reward" size="lg" className="mt-4 w-full rounded-full" onClick={claimReward}>{claimReady ? "Claim ₦35,000" : `Claim in ${clock}`}</Button></section>
    <div className="mt-4 grid grid-cols-2 gap-2.5"><Button variant="brand" size="lg" onClick={() => openAction("Buy Chix ID")}>{chixIdActive ? "Chix ID active" : "Buy Chix ID"} <IdCard/></Button><Button variant="glass" size="lg" onClick={() => openAction("Withdraw")}>Withdraw <ArrowDownToLine/></Button></div>
    <section className="mt-5"><div className="flex items-center justify-between px-1"><h2 className="font-display text-sm font-semibold">Quick actions</h2><span className="text-[11px] text-muted-foreground">Earn & manage</span></div><div className="mt-2 grid grid-cols-2 gap-2.5">{actions.slice(1).map(({label,sub,icon:Icon}, i) => <Button key={label} variant="glass" className="h-auto justify-start rounded-2xl p-3 text-left" onClick={() => openAction(label)}><span className={`grid size-9 place-items-center rounded-xl ${i % 2 ? "bg-brand/15 text-brand" : "bg-leaf/15 text-leaf"}`}><Icon/></span><span><span className="block text-xs font-semibold">{label}</span><span className="block text-[9px] font-normal text-muted-foreground">{sub}</span></span></Button>)}</div></section>
    <section className="mb-32 mt-5 rounded-2xl border border-glass-border bg-glass p-4 backdrop-blur-xl"><div className="flex items-center justify-between"><h2 className="font-display text-sm font-semibold">Recent activity</h2><Button variant="ghost" size="sm" onClick={() => openAction("History")}>View all</Button></div>{claimHistory[0] && <div className="mt-2 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-gold/15 text-gold"><Zap/></span><div className="flex-1"><p className="text-xs font-medium">Reward claimed</p><p className="text-[10px] text-muted-foreground">{new Date(claimHistory[0].claimedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div><p className="text-xs font-semibold text-leaf">+₦{claimHistory[0].amount.toLocaleString()}</p></div>}<div className="mt-2 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-leaf/15 text-leaf"><Star/></span><div className="flex-1"><p className="text-xs font-medium">Welcome bonus added</p><p className="text-[10px] text-muted-foreground">Today</p></div><p className="text-xs font-semibold text-leaf">+₦170,000</p></div></section>
    <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 px-5 pb-5"><div className="grid grid-cols-5 rounded-full border border-glass-border bg-glass-strong p-1.5 backdrop-blur-2xl">{[[Wallet,"Wallet"],[BadgeCheck,"Tasks"],[Headphones,"Support"],[History,"History"],[Users,"Referral"]].map(([Icon,label],i) => { const I = Icon as typeof Wallet; return <Button variant="ghost" key={label as string} onClick={() => label !== "Wallet" && openAction(label as string)} className={`h-auto flex-col gap-1 rounded-full px-1 py-2 text-[9px] ${i === 0 ? "bg-glass-strong text-foreground" : "text-muted-foreground"}`}><I className="size-4"/>{label as string}</Button>})}</div></nav>
    <Dialog open={Boolean(activeAction)} onOpenChange={(open) => !open && setActiveAction(null)}><DialogContent className="w-[calc(100%-32px)] rounded-[28px] border-glass-border bg-background/95 p-6 text-foreground shadow-brand backdrop-blur-2xl"><DialogHeader><div className="mb-3 grid size-12 place-items-center rounded-2xl bg-leaf/15 text-leaf">{activeAction === "Referral" ? <Copy/> : <Zap/>}</div><DialogTitle className="font-display text-xl">{activeCopy?.title}</DialogTitle><DialogDescription className="leading-6">{activeCopy?.description}</DialogDescription></DialogHeader>{activeAction === "Withdraw" && <Input inputMode="numeric" placeholder="Enter amount in naira" className="h-12 rounded-2xl bg-glass"/>}{activeAction === "History" && <div className="max-h-72 space-y-2 overflow-y-auto">{claimHistory.map((entry) => <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-glass-border bg-glass p-4 text-xs"><span><span className="block font-semibold">Reward claimed</span><span className="mt-1 block text-[10px] text-muted-foreground">{new Date(entry.claimedAt).toLocaleString()}</span></span><strong className="text-leaf">+₦{entry.amount.toLocaleString()}</strong></div>)}<div className="flex items-center justify-between rounded-2xl border border-glass-border bg-glass p-4 text-xs"><span><span className="block font-semibold">Welcome bonus</span><span className="mt-1 block text-[10px] text-muted-foreground">Account opened</span></span><strong className="text-leaf">+₦170,000</strong></div></div>}<Button variant="reward" size="lg" className="mt-2 w-full" onClick={completeAction}>{activeCopy?.button}</Button></DialogContent></Dialog>
  </Shell>;
}