import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BadgeCheck, CheckCircle2, Play, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import ad1 from "@/assets/ad-1.jpg";
import ad2 from "@/assets/ad-2.jpg";
import ad3 from "@/assets/ad-3.jpg";
import ad4 from "@/assets/ad-4.jpg";
import ad5 from "@/assets/ad-5.jpg";

type Task = {
  key: string;
  title: string;
  detail: string;
  amount: number;
  kind: "video" | "referral" | "simple";
  image?: string;
  seconds?: number;
};

export const dailyTasks: Task[] = [
  { key: "ad_starter", title: "Watch: ChixPay starter spot", detail: "A 15-second advert from our partner brands.", amount: 1100, kind: "video", image: ad1, seconds: 15 },
  { key: "ad_merchant", title: "Watch: Merchant success story", detail: "See how sellers get paid faster.", amount: 1200, kind: "video", image: ad2, seconds: 15 },
  { key: "ad_fintech", title: "Watch: Card & coin feature reel", detail: "A quick look at new wallet features.", amount: 1300, kind: "video", image: ad3, seconds: 15 },
  { key: "ad_night", title: "Watch: Evening bonus advert", detail: "Sponsored advert, plays once a day.", amount: 1400, kind: "video", image: ad4, seconds: 20 },
  { key: "ad_community", title: "Watch: Community invite advert", detail: "Our biggest paying advert of the day.", amount: 1500, kind: "video", image: ad5, seconds: 20 },
  { key: "refer_two", title: "Refer 2 members today", detail: "Both friends must register with your code.", amount: 3000, kind: "referral" },
  { key: "check_in", title: "Daily check-in", detail: "Open your wallet and confirm you are here.", amount: 700, kind: "simple" },
  { key: "share_link", title: "Share your invite link", detail: "Post your link on WhatsApp or X.", amount: 800, kind: "simple" },
  { key: "money_tip", title: "Read today's money tip", detail: "Save 20% of every reward before you spend.", amount: 600, kind: "simple" },
  { key: "profile_check", title: "Confirm your profile details", detail: "Make sure your name and bank details match.", amount: 900, kind: "simple" },
];

const DAILY_TOTAL = dailyTasks.reduce((sum, task) => sum + task.amount, 0);
const REFERRALS_NEEDED = 2;

function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

export function TasksPage({ onBack, onEarned }: { onBack: () => void; onEarned: (amount: number) => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [referralsToday, setReferralsToday] = useState(0);
  const [openVideo, setOpenVideo] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [watched, setWatched] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id;
      if (!id || cancelled) return;
      setUserId(id);
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const [completions, referrals] = await Promise.all([
        supabase.from("task_completions").select("task_key").eq("user_id", id).eq("task_day", todayKey()),
        supabase.from("referrals").select("id").eq("referrer_id", id).gte("created_at", startOfDay.toISOString()),
      ]);
      if (cancelled) return;
      setDone((completions.data ?? []).map((row) => row.task_key));
      setReferralsToday(referrals.data?.length ?? 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  const earnedToday = useMemo(
    () => dailyTasks.filter((task) => done.includes(task.key)).reduce((sum, task) => sum + task.amount, 0),
    [done],
  );

  const complete = useCallback(async (task: Task) => {
    if (done.includes(task.key)) return;
    if (!userId) { setNotice("Please sign in again to record this task."); return; }
    setDone((current) => [...current, task.key]);
    onEarned(task.amount);
    setNotice(`₦${task.amount.toLocaleString()} added for "${task.title}".`);
    const { error } = await supabase.from("task_completions").insert({ user_id: userId, task_key: task.key, amount: task.amount, task_day: todayKey() });
    if (error) {
      setDone((current) => current.filter((key) => key !== task.key));
      onEarned(-task.amount);
      setNotice("We couldn't save that task. Please try again.");
    }
  }, [done, onEarned, userId]);

  const toggleVideo = (task: Task, on: boolean) => {
    if (timer.current) { window.clearInterval(timer.current); timer.current = null; }
    if (!on) { setOpenVideo(null); setProgress(0); return; }
    setOpenVideo(task.key);
    setProgress(0);
    const total = task.seconds ?? 15;
    let elapsed = 0;
    timer.current = window.setInterval(() => {
      elapsed += 1;
      setProgress(Math.min(100, Math.round((elapsed / total) * 100)));
      if (elapsed >= total) {
        if (timer.current) { window.clearInterval(timer.current); timer.current = null; }
        setWatched((current) => current.includes(task.key) ? current : [...current, task.key]);
      }
    }, 1000);
  };

  return <section className="pb-32">
    <header className="flex items-center justify-between">
      <Button aria-label="Back to wallet" variant="glass" size="icon" className="rounded-full" onClick={onBack}><ArrowLeft/></Button>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-leaf">Daily tasks</span>
      <span className="size-10"/>
    </header>

    <div className="mt-6 rounded-[28px] border border-glass-border bg-glass-strong p-5 backdrop-blur-2xl">
      <span className="grid size-12 place-items-center rounded-2xl bg-gold/15 text-gold"><BadgeCheck className="size-6"/></span>
      <h1 className="mt-4 font-display text-3xl font-semibold">Earn up to ₦{DAILY_TOTAL.toLocaleString()} today</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Ten tasks refresh every day. Watch adverts, invite friends and keep your wallet growing.</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-glass">
        <div className="h-full rounded-full bg-leaf transition-all" style={{ width: `${Math.round((earnedToday / DAILY_TOTAL) * 100)}%` }}/>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>₦{earnedToday.toLocaleString()} earned</span>
        <span>{done.length}/{dailyTasks.length} completed</span>
      </div>
    </div>

    {notice && <Button variant="glass" onClick={() => setNotice("")} className="mt-4 h-auto w-full justify-start whitespace-normal rounded-2xl border-leaf/25 bg-leaf/10 p-3 text-left text-xs text-leaf">{notice}</Button>}

    <div className="mt-5 space-y-3">
      {dailyTasks.map((task) => {
        const complete_ = done.includes(task.key);
        const isOpen = openVideo === task.key;
        const hasWatched = watched.includes(task.key);
        const referralReady = referralsToday >= REFERRALS_NEEDED;
        return <article key={task.key} className={`rounded-[24px] border p-4 backdrop-blur-xl ${complete_ ? "border-leaf/30 bg-leaf/10" : "border-glass-border bg-glass"}`}>
          <div className="flex items-start gap-3">
            <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${complete_ ? "bg-leaf/20 text-leaf" : task.kind === "video" ? "bg-brand/15 text-brand" : task.kind === "referral" ? "bg-gold/15 text-gold" : "bg-leaf/15 text-leaf"}`}>
              {complete_ ? <CheckCircle2 className="size-5"/> : task.kind === "video" ? <Play className="size-5"/> : task.kind === "referral" ? <Users className="size-5"/> : <BadgeCheck className="size-5"/>}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{task.title}</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{task.detail}</p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-leaf">+₦{task.amount.toLocaleString()}</span>
          </div>

          {task.kind === "video" && !complete_ && <div className="mt-3">
            <div className="flex items-center justify-between rounded-2xl border border-glass-border bg-glass px-3 py-2">
              <span className="text-[11px] text-muted-foreground">{isOpen ? "Advert playing" : "Turn on to watch advert"}</span>
              <Switch checked={isOpen} aria-label={`Play advert for ${task.title}`} onCheckedChange={(on) => toggleVideo(task, on)}/>
            </div>
            {isOpen && <div className="mt-3 overflow-hidden rounded-2xl border border-glass-border">
              <img src={task.image} alt="" loading="lazy" width={992} height={672} className="h-36 w-full animate-pulse object-cover"/>
              <div className="bg-glass-strong p-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-glass">
                  <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${progress}%` }}/>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">{hasWatched ? "Advert finished. Claim your reward." : `Keep watching — ${Math.max(0, Math.round(((task.seconds ?? 15) * (100 - progress)) / 100))}s left`}</p>
              </div>
            </div>}
          </div>}

          {task.kind === "referral" && !complete_ && <div className="mt-3 rounded-2xl border border-glass-border bg-glass p-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>Friends joined today</span><span className="font-semibold text-foreground">{referralsToday}/{REFERRALS_NEEDED}</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-glass-strong"><div className="h-full rounded-full bg-leaf transition-all" style={{ width: `${Math.min(100, (referralsToday / REFERRALS_NEEDED) * 100)}%` }}/></div>
          </div>}

          <Button
            variant={complete_ ? "glass" : "reward"}
            className="mt-3 w-full rounded-full"
            disabled={loading || complete_ || (task.kind === "video" && !hasWatched) || (task.kind === "referral" && referralsToday < REFERRALS_NEEDED)}
            onClick={() => void complete(task)}
          >
            {complete_ ? "Completed today" : task.kind === "video" ? (hasWatched ? `Claim ₦${task.amount.toLocaleString()}` : "Watch to unlock") : task.kind === "referral" ? (referralsToday >= REFERRALS_NEEDED ? `Claim ₦${task.amount.toLocaleString()}` : "Invite 2 friends to unlock") : `Claim ₦${task.amount.toLocaleString()}`}
          </Button>
        </article>;
      })}
    </div>

    <p className="mt-5 text-center text-[11px] text-muted-foreground">Tasks reset at midnight. Adverts can only be watched once per day.</p>
  </section>;
}
