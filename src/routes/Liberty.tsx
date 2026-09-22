import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Ban, CheckCircle2, Eye, FileText, LogOut, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import logoMark from "@/assets/chixpay-logo.png";

export const Route = createFileRoute("/Liberty")({
  head: () => ({ meta: [
    { title: "ChixPay Control — Admin" },
    { name: "description", content: "Private ChixPay control room for managing members, activity and account restrictions." },
    { property: "og:title", content: "ChixPay Control — Admin" },
    { property: "og:description", content: "Private ChixPay control room for managing members, activity and account restrictions." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ]}),
  component: AdminPage,
});

type AdminUser = {
  id: string; email: string | null; full_name: string | null; phone: string | null; state: string | null;
  status: string | null; restriction_reason: string | null; referral_code: string | null;
  created_at: string; last_sign_in_at: string | null;
  referral_count: number; upgrade_count: number; pending_upgrades: number;
};
type AdminRequest = {
  id: string; user_id: string; email: string | null; full_name: string | null; plan_name: string;
  amount: number; receipt_path: string | null; status: string; created_at: string;
};
type ChixRequest = AdminRequest & { uses_total: number | null; chix_id: string | null };

const money = (value: number) => `₦${Number(value).toLocaleString()}`;
const when = (value: string | null) => value ? new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Never";

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[28px] border border-glass-border bg-glass p-5 shadow-brand backdrop-blur-2xl ${className}`}>{children}</div>;
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "active" || status === "approved" ? "border-leaf/30 bg-leaf/12 text-leaf"
    : status === "pending" ? "border-gold/30 bg-gold/12 text-gold"
    : "border-destructive/35 bg-destructive/15 text-destructive-foreground";
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${tone}`}>{status}</span>;
}

function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const verify = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) { setIsAdmin(false); setChecking(false); return false; }
    const { data: ok } = await supabase.rpc("claim_admin");
    setIsAdmin(ok === true);
    setChecking(false);
    return ok === true;
  }, []);

  useEffect(() => { void verify(); }, [verify]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setNotice("");
    const address = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email: address, password });
    if (error) {
      const created = await supabase.auth.signUp({ email: address, password });
      if (created.error) { setBusy(false); return setNotice("Those admin details were not accepted."); }
    }
    const ok = await verify();
    setBusy(false);
    if (!ok) { await supabase.auth.signOut(); setNotice("This account is not authorised for the control room."); }
  };

  const signOut = async () => { await supabase.auth.signOut(); setIsAdmin(false); };

  if (checking) return <Backdrop><p className="text-sm text-muted-foreground">Checking access…</p></Backdrop>;

  if (!isAdmin) return <Backdrop>
    <Panel className="w-full max-w-md">
      <div className="flex items-center gap-3"><img src={logoMark} alt="ChixPay" className="size-11 rounded-2xl object-cover"/><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-leaf">Restricted area</p><h1 className="font-display text-2xl font-semibold">Control room</h1></div></div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Only authorised ChixPay staff can open this page.</p>
      <form className="mt-6 space-y-4" onSubmit={signIn}>
        <label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">Staff email</span><Input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-13 rounded-2xl border-glass-border bg-background/45 px-4"/></label>
        <label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">Password</span><Input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-13 rounded-2xl border-glass-border bg-background/45 px-4"/></label>
        {notice && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/15 p-3 text-xs text-destructive-foreground">{notice}</p>}
        <Button disabled={busy} variant="reward" size="lg" className="w-full">{busy ? "Verifying…" : "Enter control room"}<ShieldCheck/></Button>
      </form>
    </Panel>
  </Backdrop>;

  return <AdminDashboard onSignOut={signOut}/>;
}

function Backdrop({ children }: { children: React.ReactNode }) {
  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-5 py-10 text-foreground">
    <div className="pointer-events-none fixed inset-0" aria-hidden="true"><div className="public-aura absolute inset-x-0 top-0 h-[60vh]"/></div>
    <div className="relative z-10 w-full max-w-md">{children}</div>
  </main>;
}

function AdminDashboard({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<"users" | "upgrades" | "chixids">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [chixRequests, setChixRequests] = useState<ChixRequest[]>([]);
  const [chixCode, setChixCode] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [userRows, requestRows, chixRows, setting] = await Promise.all([
      supabase.rpc("admin_list_users"),
      supabase.rpc("admin_list_upgrade_requests"),
      supabase.rpc("admin_list_chix_requests"),
      supabase.from("app_settings").select("value").eq("key", "chix_id_code").maybeSingle(),
    ]);
    if (userRows.data) setUsers(userRows.data as unknown as AdminUser[]);
    if (requestRows.data) setRequests(requestRows.data as unknown as AdminRequest[]);
    if (chixRows.data) setChixRequests(chixRows.data as unknown as ChixRequest[]);
    if (setting.data?.value) setChixCode(setting.data.value);
    if (userRows.error || requestRows.error) setMessage("Some records could not be loaded. Try refreshing.");
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveChixCode = async () => {
    const value = chixCode.trim();
    if (!value) return setMessage("Enter a Chix ID before saving.");
    const { error } = await supabase.rpc("admin_set_setting", { _key: "chix_id_code", _value: value });
    setMessage(error ? "The Chix ID could not be saved." : `Chix ID updated to ${value}.`);
  };

  const setChixRequestStatus = async (request: ChixRequest, status: string) => {
    const { error } = await supabase.rpc("admin_set_chix_request_status", { _request_id: request.id, _status: status });
    if (error) return setMessage("That Chix ID request could not be updated.");
    setMessage(status === "approved" ? "Chix ID released to the member." : `Chix ID request ${status}.`);
    void load();
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => [user.email, user.full_name, user.phone, user.state, user.referral_code]
      .some((field) => (field ?? "").toLowerCase().includes(term)));
  }, [users, query]);

  const restricted = users.filter((user) => (user.status ?? "active") !== "active").length;
  const pending = requests.filter((request) => request.status === "pending").length;

  const setStatus = async (user: AdminUser, status: string) => {
    const reason = status === "active" ? null : window.prompt("Reason for restricting this account?", "Suspicious activity");
    if (status !== "active" && reason === null) return;
    const args = reason === null ? { _user_id: user.id, _status: status } : { _user_id: user.id, _status: status, _reason: reason };
    const { error } = await supabase.rpc("admin_set_account_status", args);
    if (error) return setMessage("That account could not be updated.");
    setMessage(status === "active" ? `${user.full_name ?? user.email} was restored.` : `${user.full_name ?? user.email} is now restricted.`);
    void load();
  };

  const setRequestStatus = async (request: AdminRequest, status: string) => {
    const { error } = await supabase.rpc("admin_set_upgrade_status", { _request_id: request.id, _status: status });
    if (error) return setMessage("That request could not be updated.");
    setMessage(`Upgrade request ${status}.`);
    void load();
  };

  const openReceipt = async (request: AdminRequest) => {
    if (!request.receipt_path) return setMessage("No receipt was uploaded for this request.");
    const { data, error } = await supabase.storage.from("upgrade-receipts").createSignedUrl(request.receipt_path, 300);
    if (error || !data) return setMessage("The receipt could not be opened.");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
    <div className="pointer-events-none fixed inset-0" aria-hidden="true"><div className="public-aura absolute inset-x-0 top-0 h-[50vh]"/></div>
    <div className="relative z-10 mx-auto w-full max-w-6xl px-5 py-6 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><img src={logoMark} alt="ChixPay" className="size-11 rounded-2xl object-cover"/><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-leaf">Control room</p><h1 className="font-display text-2xl font-semibold">Member management</h1></div></div>
        <div className="flex gap-2"><Button variant="glass" size="sm" onClick={() => void load()}><RefreshCw/> Refresh</Button><Button variant="glass" size="sm" onClick={onSignOut}><LogOut/> Sign out</Button></div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        {[{ label: "Members", value: users.length, icon: Users }, { label: "Restricted", value: restricted, icon: Ban }, { label: "Pending upgrades", value: pending, icon: FileText }].map(({ label, value, icon: Icon }) =>
          <Panel key={label} className="flex items-center gap-4 p-4"><span className="grid size-11 place-items-center rounded-2xl bg-leaf/15 text-leaf"><Icon className="size-5"/></span><div><p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p><p className="font-display text-2xl font-semibold">{value}</p></div></Panel>)}
      </section>

      {message && <Button variant="glass" className="mt-3 h-auto w-full justify-start whitespace-normal rounded-2xl border-leaf/25 bg-leaf/10 p-3 text-left text-xs text-leaf" onClick={() => setMessage("")}>{message}</Button>}

      <div className="mt-5 flex gap-2">
        <Button variant={tab === "users" ? "brand" : "glass"} size="sm" onClick={() => setTab("users")}>Members</Button>
        <Button variant={tab === "upgrades" ? "brand" : "glass"} size="sm" onClick={() => setTab("upgrades")}>Upgrade reviews</Button>
        <Button variant={tab === "chixids" ? "brand" : "glass"} size="sm" onClick={() => setTab("chixids")}>Chix ID reviews</Button>
      </div>

      {tab === "chixids" && <>
        <Panel className="mt-3">
          <p className="font-display text-sm font-semibold">Chix ID issued to approved members</p>
          <p className="mt-1 text-xs text-muted-foreground">This is the ID released to every member once their key payment is approved.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input value={chixCode} onChange={(e) => setChixCode(e.target.value.toUpperCase())} placeholder="CHIX-76628-22" className="h-12 max-w-xs rounded-2xl border-glass-border bg-background/45 px-4 tracking-[0.14em]"/>
            <Button variant="reward" size="lg" onClick={() => void saveChixCode()}>Save Chix ID</Button>
          </div>
        </Panel>
        <Panel className="mt-3">
          <div className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Loading Chix ID payments…</p>}
            {!loading && chixRequests.length === 0 && <p className="text-sm text-muted-foreground">No Chix ID payments yet.</p>}
            {chixRequests.map((request) => <div key={request.id} className="rounded-2xl border border-glass-border bg-glass p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-semibold">{request.plan_name} · {money(request.amount)}</p>
                  <p className="text-xs text-muted-foreground">{request.full_name ?? "Unnamed member"} · {request.email ?? "No email"}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{request.uses_total === null ? "Unlimited uses" : `${request.uses_total} use${request.uses_total === 1 ? "" : "s"}`} · Submitted {when(request.created_at)}</p>
                  {request.chix_id && <p className="mt-1 text-[11px] text-leaf">Released ID: {request.chix_id}</p>}
                </div>
                <StatusPill status={request.status}/>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="glass" size="sm" onClick={() => void openReceipt(request)}><Eye/> View receipt</Button>
                <Button variant="reward" size="sm" onClick={() => void setChixRequestStatus(request, "approved")}><CheckCircle2/> Approve</Button>
                <Button variant="glass" size="sm" className="border-destructive/30 text-destructive-foreground" onClick={() => void setChixRequestStatus(request, "rejected")}><Ban/> Reject</Button>
              </div>
            </div>)}
          </div>
        </Panel>
      </>}

      {tab === "users" && <Panel className="mt-3">
        <div className="flex items-center gap-2 rounded-2xl border border-glass-border bg-background/45 px-3"><Search className="size-4 text-muted-foreground"/><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email, phone, state or code" className="h-12 border-0 bg-transparent px-1 focus-visible:ring-0"/></div>
        <div className="mt-4 space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading members…</p>}
          {!loading && filtered.length === 0 && <p className="text-sm text-muted-foreground">No members match that search.</p>}
          {filtered.map((user) => {
            const status = user.status ?? "active";
            return <div key={user.id} className="rounded-2xl border border-glass-border bg-glass p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-semibold">{user.full_name ?? "Unnamed member"}</p>
                  <p className="text-xs text-muted-foreground">{user.email ?? "No email"} · {user.phone ?? "No phone"} · {user.state ?? "No state"}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Joined {when(user.created_at)} · Last sign in {when(user.last_sign_in_at)}</p>
                  {user.restriction_reason && <p className="mt-1 text-[11px] text-destructive-foreground">Reason: {user.restriction_reason}</p>}
                </div>
                <StatusPill status={status}/>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full bg-glass-strong px-2.5 py-1">{user.referral_count} referrals</span>
                <span className="rounded-full bg-glass-strong px-2.5 py-1">{user.upgrade_count} upgrades</span>
                {user.pending_upgrades > 0 && <span className="rounded-full bg-gold/15 px-2.5 py-1 text-gold">{user.pending_upgrades} pending</span>}
                {user.referral_code && <span className="rounded-full bg-glass-strong px-2.5 py-1 tracking-[0.12em]">{user.referral_code}</span>}
              </div>
              <div className="mt-3 flex gap-2">
                {status === "active"
                  ? <Button variant="glass" size="sm" className="border-destructive/30 text-destructive-foreground" onClick={() => void setStatus(user, "restricted")}><Ban/> Restrict account</Button>
                  : <Button variant="glass" size="sm" onClick={() => void setStatus(user, "active")}><CheckCircle2/> Restore access</Button>}
              </div>
            </div>;
          })}
        </div>
      </Panel>}

      {tab === "upgrades" && <Panel className="mt-3">
        <div className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading requests…</p>}
          {!loading && requests.length === 0 && <p className="text-sm text-muted-foreground">No upgrade requests yet.</p>}
          {requests.map((request) => <div key={request.id} className="rounded-2xl border border-glass-border bg-glass p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-sm font-semibold">{request.plan_name} · {money(request.amount)}</p>
                <p className="text-xs text-muted-foreground">{request.full_name ?? "Unnamed member"} · {request.email ?? "No email"}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Submitted {when(request.created_at)}</p>
              </div>
              <StatusPill status={request.status}/>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="glass" size="sm" onClick={() => void openReceipt(request)}><Eye/> View receipt</Button>
              <Button variant="reward" size="sm" onClick={() => void setRequestStatus(request, "approved")}><CheckCircle2/> Approve</Button>
              <Button variant="glass" size="sm" className="border-destructive/30 text-destructive-foreground" onClick={() => void setRequestStatus(request, "rejected")}><Ban/> Reject</Button>
            </div>
          </div>)}
        </div>
      </Panel>}

      <p className="py-8 text-center text-[11px] text-muted-foreground">ChixPay control room · access is limited to approved staff accounts.</p>
    </div>
  </main>;
}
