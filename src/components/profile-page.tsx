import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Check, ChevronLeft, IdCard, LoaderCircle, LogOut, Mail, MapPin, Moon, Phone, Sun, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Theme = "light" | "dark";

type ProfilePageProps = {
  fallbackName: string;
  fallbackState: string;
  chixIdActive: boolean;
  onBack: () => void;
  onLogout: () => Promise<void>;
  onAvatarChange: (url: string | null) => void;
};

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem("chixpay-theme", theme);
}

export function ProfilePage({ fallbackName, fallbackState, chixIdActive, onBack, onLogout, onAvatarChange }: ProfilePageProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.classList.contains("dark") ? "dark" : "light");
  const [profile, setProfile] = useState({ fullName: fallbackName, email: "", phone: "", state: fallbackState });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user || !active) return;
      const { data } = await supabase.from("profiles").select("full_name, phone, state, avatar_path").eq("id", user.id).maybeSingle();
      if (!active) return;
      setProfile({ fullName: data?.full_name ?? fallbackName, email: user.email ?? "", phone: data?.phone ?? "", state: data?.state ?? fallbackState });
      if (data?.avatar_path) {
        const { data: signed } = await supabase.storage.from("profile-photos").createSignedUrl(data.avatar_path, 60 * 60 * 24);
        if (active && signed?.signedUrl) {
          setAvatarUrl(signed.signedUrl);
          onAvatarChange(signed.signedUrl);
        }
      }
    })();
    return () => { active = false; };
  }, [fallbackName, fallbackState, onAvatarChange]);

  const chooseTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setNotice("Choose a JPG, PNG, or WebP image.");
    if (file.size > 5 * 1024 * 1024) return setNotice("Your photo must be smaller than 5 MB.");
    setUploading(true);
    setNotice("");
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) { setUploading(false); return setNotice("Please log in again to change your photo."); }
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("profile-photos").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { setUploading(false); return setNotice("Your photo could not be uploaded. Please try again."); }
    const { error: saveError } = await supabase.from("profiles").update({ avatar_path: path, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (saveError) {
      await supabase.storage.from("profile-photos").remove([path]);
      setUploading(false);
      return setNotice("Your photo could not be saved. Please try again.");
    }
    const { data: signed } = await supabase.storage.from("profile-photos").createSignedUrl(path, 60 * 60 * 24);
    const url = signed?.signedUrl ?? null;
    setAvatarUrl(url);
    onAvatarChange(url);
    setUploading(false);
    setNotice("Profile photo updated.");
  };

  const logout = async () => {
    setLoggingOut(true);
    await onLogout();
    setLoggingOut(false);
  };

  return <div className="auth-enter pb-10">
    <header className="flex items-center justify-between">
      <Button aria-label="Back to wallet" variant="glass" size="icon" className="rounded-full" onClick={onBack}><ChevronLeft/></Button>
      <p className="font-display text-sm font-semibold">Profile</p>
      <span className="size-9" aria-hidden="true" />
    </header>

    <section className="mt-7 text-center">
      <div className="relative mx-auto w-fit">
        <Avatar className="size-28 border-2 border-gold/35 bg-glass shadow-brand">
          <AvatarImage src={avatarUrl ?? undefined} alt={`${profile.fullName}'s profile`} className="object-cover" />
          <AvatarFallback className="bg-leaf/15 font-display text-3xl font-semibold text-leaf">{profile.fullName.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <Button aria-label="Choose profile photo" variant="reward" size="icon" className="absolute -bottom-1 -right-1 rounded-full border-4 border-background" onClick={() => fileInput.current?.click()} disabled={uploading}>
          {uploading ? <LoaderCircle className="animate-spin"/> : <Camera/>}
        </Button>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={uploadPhoto} />
      </div>
      <h1 className="mt-4 font-display text-2xl font-semibold">{profile.fullName}</h1>
      <p className="mt-1 text-xs text-muted-foreground">ChixPay member</p>
      {notice && <p role="status" className="mx-auto mt-3 w-fit rounded-full bg-leaf/10 px-3 py-1.5 text-xs text-leaf">{notice}</p>}
    </section>

    <section className="mt-7">
      <h2 className="px-1 font-display text-sm font-semibold">Personal details</h2>
      <div className="mt-2 divide-y divide-border overflow-hidden rounded-[24px] border border-glass-border bg-glass backdrop-blur-xl">
        {[
          { icon: UserRound, label: "Full name", value: profile.fullName },
          { icon: Mail, label: "Email address", value: profile.email || "Not available" },
          { icon: Phone, label: "Phone number", value: profile.phone ? `+234 ${profile.phone}` : "Not available" },
          { icon: MapPin, label: "State", value: `${profile.state} State` },
          { icon: IdCard, label: "Chix ID", value: chixIdActive ? "Active" : "Not active" },
        ].map(({ icon: Icon, label, value }) => <div key={label} className="flex min-h-16 items-center gap-3 px-4 py-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-leaf/15 text-leaf"><Icon className="size-4"/></span><div className="min-w-0 flex-1"><p className="text-[10px] text-muted-foreground">{label}</p><p className="truncate text-sm font-medium">{value}</p></div>{label === "Chix ID" && chixIdActive ? <Check className="size-4 text-leaf"/> : null}</div>)}
      </div>
    </section>

    <section className="mt-6">
      <h2 className="px-1 font-display text-sm font-semibold">Appearance</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 rounded-[24px] border border-glass-border bg-glass p-2 backdrop-blur-xl">
        <Button variant={theme === "light" ? "reward" : "ghost"} className="h-14 rounded-2xl" onClick={() => chooseTheme("light")}><Sun/>Light</Button>
        <Button variant={theme === "dark" ? "brand" : "ghost"} className="h-14 rounded-2xl" onClick={() => chooseTheme("dark")}><Moon/>Dark</Button>
      </div>
    </section>

    <Button variant="destructive" size="lg" className="mt-7 w-full rounded-2xl" disabled={loggingOut} onClick={logout}><LogOut/>{loggingOut ? "Logging out…" : "Log out"}</Button>
  </div>;
}