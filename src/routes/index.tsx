import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownToLine, BadgeCheck, Bell, ChevronRight, CirclePlay, Clock3,
  History, IdCard, Megaphone, Play, Sparkles, Star, Trophy, Users, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

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
type FormData = { fullName: string; email: string; phone: string; password: string; state: string };

const states = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT Abuja","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];

function MoneyBackdrop() {
  return <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
    <div className="glow-breathe absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-leaf/35 blur-3xl" />
    <div className="absolute top-1/4 -right-20 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
    <div className="absolute bottom-0 -left-24 h-72 w-72 rounded-full bg-gold/15 blur-3xl" />
    {["top-[14%] left-[4%] note-float","top-[38%] right-[4%] note-float-two","bottom-[18%] left-[8%] note-float","bottom-[7%] right-[12%] note-float-two"].map((pos, i) =>
      <div key={pos} className={`absolute ${pos} grid h-9 w-16 place-items-center rounded-lg border border-glass-border bg-glass backdrop-blur-sm`}><span className={`font-display text-[9px] font-semibold ${i % 2 ? "text-gold" : "text-leaf"}`}>₦1,000</span></div>
    )}
  </div>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="relative min-h-screen overflow-hidden bg-background text-foreground"><MoneyBackdrop/><div className="relative z-10 mx-auto min-h-screen w-full max-w-[430px] px-5 py-6">{children}</div></main>;
}

function Brand() {
  return <div className="flex items-center gap-2.5"><div className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-brand to-leaf font-display text-lg font-bold shadow-brand">₦</div><div><p className="font-display text-lg font-bold leading-none">ChixPay</p><p className="mt-1 text-[10px] text-muted-foreground">Rewards that keep moving</p></div></div>;
}

function ChixPay() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [form, setForm] = useState<FormData>({ fullName: "", email: "", phone: "", password: "", state: "" });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key: keyof FormData, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const login = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice("");
    const { data, error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
    setBusy(false);
    if (error) return setNotice(error.message);
    const meta = data.user.user_metadata as Partial<FormData>;
    setForm((old) => ({ ...old, fullName: meta.fullName ?? "ChixPay member", phone: meta.phone ?? "", state: meta.state ?? "Lagos" }));
    setScreen("dashboard");
  };
  const beginSignup = (event: FormEvent) => { event.preventDefault(); setScreen("state"); };
  const finishSignup = async () => {
    setBusy(true); setNotice("");
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { fullName: form.fullName, phone: form.phone, state: form.state } } });
    if (error) { setBusy(false); return setNotice(error.message); }
    if (data.session && data.user) await supabase.from("profiles").upsert({ id: data.user.id, full_name: form.fullName, phone: form.phone, state: form.state });
    setBusy(false); setScreen("tutorial");
  };
  const googleLogin = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) setNotice(result.error.message);
  };

  if (screen === "dashboard") return <Dashboard name={form.fullName || "ChixPay member"} state={form.state || "Lagos"} />;

  return <Shell>
    <header className="flex items-center justify-between"><Brand/>{screen !== "landing" && <Button variant="glass" size="sm" onClick={() => setScreen("landing")}>Exit</Button>}</header>
    {screen === "landing" && <section className="flex min-h-[calc(100vh-88px)] flex-col justify-center pb-8">
      <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-glass-border bg-glass px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-xl"><Sparkles className="size-3.5 text-gold"/> Welcome bonus unlocked</div>
      <h1 className="font-display text-[42px] font-semibold leading-[1.08]">Your money.<br/><span className="text-leaf">More rewarding.</span></h1>
      <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">Join ChixPay and unlock a ₦170,000 welcome bonus, daily tasks, videos, and referral rewards.</p>
      <div className="relative mt-8 overflow-hidden rounded-[28px] border border-glass-border bg-glass-strong p-5 backdrop-blur-2xl">
        <div className="glass-sheen pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-foreground/10 to-transparent"/>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Welcome balance</p><p className="mt-1 font-display text-4xl font-semibold">₦170,000</p>
        <div className="mt-5 flex items-center justify-between rounded-2xl border border-leaf/25 bg-leaf/10 p-3"><div><p className="text-[10px] text-leaf">EVERY 10 MINUTES</p><p className="font-display text-xl font-semibold">Claim ₦35,000</p></div><Clock3 className="size-8 text-gold"/></div>
      </div>
      <Button variant="reward" size="lg" className="mt-6 w-full" onClick={() => { setMode("signup"); setScreen("auth"); }}>Create free account <ChevronRight/></Button>
      <Button variant="glass" size="lg" className="mt-3 w-full" onClick={() => { setMode("login"); setScreen("auth"); }}>I already have an account</Button>
      <button className="mt-5 text-xs text-muted-foreground underline underline-offset-4" onClick={() => setScreen("dashboard")}>Preview dashboard</button>
    </section>}

    {screen === "auth" && <section className="pt-10">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-leaf">{mode === "signup" ? "Join ChixPay" : "Welcome back"}</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{mode === "signup" ? "Create your wallet" : "Log in to your wallet"}</h1>
      <form className="mt-7 space-y-3" onSubmit={mode === "signup" ? beginSignup : login}>
        {mode === "signup" && <><Input required placeholder="Full name" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} className="h-13 rounded-2xl border-glass-border bg-glass px-4 backdrop-blur-xl"/><Input required type="tel" placeholder="Phone number" value={form.phone} onChange={(e) => update("phone", e.target.value)} className="h-13 rounded-2xl border-glass-border bg-glass px-4 backdrop-blur-xl"/></>}
        <Input required type="email" placeholder="Email address" value={form.email} onChange={(e) => update("email", e.target.value)} className="h-13 rounded-2xl border-glass-border bg-glass px-4 backdrop-blur-xl"/>
        <Input required minLength={6} type="password" placeholder="Password" value={form.password} onChange={(e) => update("password", e.target.value)} className="h-13 rounded-2xl border-glass-border bg-glass px-4 backdrop-blur-xl"/>
        {notice && <p className="rounded-xl bg-destructive/15 p-3 text-xs text-destructive-foreground">{notice}</p>}
        <Button disabled={busy} variant="reward" size="lg" className="w-full">{busy ? "Please wait…" : mode === "signup" ? "Choose my state" : "Log in"}<ChevronRight/></Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-[10px] text-muted-foreground"><span className="h-px flex-1 bg-border"/>OR<span className="h-px flex-1 bg-border"/></div>
      <Button variant="glass" size="lg" className="w-full" onClick={googleLogin}><span className="font-display text-base">G</span> Continue with Google</Button>
      <button className="mt-6 w-full text-sm text-muted-foreground" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setNotice(""); }}>{mode === "signup" ? "Already registered? Log in" : "New here? Create an account"}</button>
    </section>}

    {screen === "state" && <section className="pt-10"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-leaf">One last detail</p><h1 className="mt-2 font-display text-3xl font-semibold">Where do you live?</h1><p className="mt-2 text-sm text-muted-foreground">We use your state to personalise available tasks and rewards.</p>
      <label className="mt-8 block text-xs font-medium text-muted-foreground">State</label><select value={form.state} onChange={(e) => update("state", e.target.value)} className="mt-2 h-13 w-full rounded-2xl border border-glass-border bg-glass px-4 text-sm outline-none backdrop-blur-xl"><option value="">Select your state</option>{states.map((state) => <option className="bg-ink" key={state}>{state}</option>)}</select>
      {notice && <p className="mt-3 rounded-xl bg-destructive/15 p-3 text-xs">{notice}</p>}
      <Button disabled={!form.state || busy} variant="reward" size="lg" className="mt-5 w-full" onClick={finishSignup}>{busy ? "Creating account…" : "Continue to tutorial"}<ChevronRight/></Button>
    </section>}

    {screen === "tutorial" && <Tutorial onDone={() => setScreen("dashboard")}/>} 
  </Shell>;
}

function Tutorial({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const slides = [
    { icon: Wallet, tag: "Your wallet", title: "Claim rewards", text: "A ₦35,000 reward appears every 10 minutes. Claim before the timer resets." },
    { icon: Trophy, tag: "Grow earnings", title: "Complete & earn", text: "Finish tasks, watch videos, broadcast updates, and invite friends for more rewards." },
    { icon: IdCard, tag: "Ready to cash out", title: "Get your Chix ID", text: "Buy and activate your Chix ID before making your first withdrawal." },
  ];
  const item = slides[step] ?? slides[0];
  if (!item) return null;
  const Icon = item.icon;
  return <section className="flex min-h-[calc(100vh-88px)] flex-col justify-center pb-8"><div className="rounded-[30px] border border-glass-border bg-glass-strong p-6 backdrop-blur-2xl"><div className="grid size-16 place-items-center rounded-[22px] bg-leaf/15 text-leaf"><Icon className="size-8"/></div><p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-leaf">{item.tag}</p><h1 className="mt-2 font-display text-3xl font-semibold">{item.title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p><div className="mt-8 flex gap-2">{slides.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-gold" : "w-2 bg-glass-strong"}`}/>)}</div></div><Button variant="reward" size="lg" className="mt-5 w-full" onClick={() => step === slides.length - 1 ? onDone() : setStep(step + 1)}>{step === slides.length - 1 ? "Open my wallet" : "Next"}<ChevronRight/></Button><button className="mt-5 text-xs text-muted-foreground" onClick={onDone}>Skip tutorial</button></section>;
}

const actions = [
  { label: "Withdraw", sub: "To your bank", icon: ArrowDownToLine }, { label: "Tasks", sub: "Earn daily", icon: BadgeCheck },
  { label: "Broadcast", sub: "Share & earn", icon: Megaphone }, { label: "Upgrade", sub: "Raise limits", icon: Trophy },
  { label: "Referral", sub: "Invite friends", icon: Users }, { label: "Videos", sub: "Watch to earn", icon: CirclePlay },
];

function Dashboard({ name, state }: { name: string; state: string }) {
  const [seconds, setSeconds] = useState(600); const [balance, setBalance] = useState(170000); const [message, setMessage] = useState("");
  useEffect(() => { const timer = window.setInterval(() => setSeconds((s) => s <= 0 ? 600 : s - 1), 1000); return () => window.clearInterval(timer); }, []);
  const clock = useMemo(() => `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`, [seconds]);
  const act = (label: string) => setMessage(`${label} is ready for your next step.`);
  return <Shell>
    <header className="flex items-center justify-between"><div className="flex items-center gap-2.5"><div className="grid size-10 place-items-center rounded-full border border-glass-border bg-glass font-display text-sm font-semibold text-gold">{name.charAt(0).toUpperCase()}</div><div><p className="font-display text-sm font-semibold">{name}</p><p className="text-[11px] text-muted-foreground">{state} State</p></div></div><Button aria-label="Notifications" variant="glass" size="icon" className="rounded-full"><Bell/></Button></header>
    {message && <button onClick={() => setMessage("")} className="mt-3 w-full rounded-2xl border border-leaf/25 bg-leaf/10 p-3 text-left text-xs text-leaf">{message}</button>}
    <section className="relative mt-5 overflow-hidden rounded-[28px] border border-glass-border bg-glass-strong p-5 backdrop-blur-2xl"><div className="glass-sheen pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-foreground/10 to-transparent"/><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Welcome balance</p><div className="mt-1 flex items-end gap-2"><h1 className="font-display text-4xl font-semibold">₦{balance.toLocaleString()}</h1><span className="mb-1 rounded-full bg-glass px-2 py-0.5 text-[10px] text-muted-foreground">bonus</span></div><p className="mt-2 text-xs text-muted-foreground">Your rewards are active and ready to grow.</p></section>
    <section className="mt-3 rounded-[24px] border border-leaf/25 bg-leaf/10 p-4 backdrop-blur-2xl"><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-leaf">Claimable reward</p><p className="font-display text-2xl font-semibold">₦35,000</p></div><div className="text-right"><p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Next claim</p><p className="mt-1 font-display text-xl font-semibold tabular-nums text-gold">{clock}</p></div></div><Button variant="reward" size="lg" className="mt-4 w-full rounded-full" onClick={() => { setBalance((b) => b + 35000); setSeconds(600); setMessage("₦35,000 claimed successfully."); }}>Claim ₦35,000</Button></section>
    <div className="mt-4 grid grid-cols-2 gap-2.5"><Button variant="brand" size="lg" onClick={() => act("Chix ID purchase")}>Buy Chix ID <IdCard/></Button><Button variant="glass" size="lg" onClick={() => act("Withdrawal")}>Withdraw <ArrowDownToLine/></Button></div>
    <section className="mt-5"><div className="flex items-center justify-between px-1"><h2 className="font-display text-sm font-semibold">Quick actions</h2><span className="text-[11px] text-muted-foreground">Earn & manage</span></div><div className="mt-2 grid grid-cols-2 gap-2.5">{actions.slice(1).map(({label,sub,icon:Icon}, i) => <Button key={label} variant="glass" className="h-auto justify-start rounded-2xl p-3 text-left" onClick={() => act(label)}><span className={`grid size-9 place-items-center rounded-xl ${i % 2 ? "bg-brand/15 text-brand" : "bg-leaf/15 text-leaf"}`}><Icon/></span><span><span className="block text-xs font-semibold">{label}</span><span className="block text-[9px] font-normal text-muted-foreground">{sub}</span></span></Button>)}</div></section>
    <section className="mb-32 mt-5 rounded-2xl border border-glass-border bg-glass p-4 backdrop-blur-xl"><div className="flex items-center justify-between"><h2 className="font-display text-sm font-semibold">Recent activity</h2><Button variant="ghost" size="sm" onClick={() => act("History")}>View all</Button></div><div className="mt-2 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-leaf/15 text-leaf"><Star/></span><div className="flex-1"><p className="text-xs font-medium">Welcome bonus added</p><p className="text-[10px] text-muted-foreground">Today</p></div><p className="text-xs font-semibold text-leaf">+₦170,000</p></div></section>
    <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 px-5 pb-5"><div className="grid grid-cols-5 rounded-full border border-glass-border bg-glass-strong p-1.5 backdrop-blur-2xl">{[[Wallet,"Wallet"],[BadgeCheck,"Tasks"],[Play,"Videos"],[History,"History"],[Users,"Profile"]].map(([Icon,label],i) => { const I = Icon as typeof Wallet; return <button key={label as string} onClick={() => act(label as string)} className={`flex flex-col items-center gap-1 rounded-full py-2 text-[9px] ${i === 0 ? "bg-glass-strong text-foreground" : "text-muted-foreground"}`}><I className="size-4"/>{label as string}</button>})}</div></nav>
  </Shell>;
}