import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Headphones, Mail, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type SupportSettings = {
  support_email?: string;
  support_telegram_url?: string;
  support_whatsapp_url?: string;
};

const supportOptions = [
  {
    key: "support_email" as const,
    title: "Email support",
    description: "Send our support team a detailed message.",
    icon: Mail,
    tone: "bg-brand/15 text-brand",
  },
  {
    key: "support_telegram_url" as const,
    title: "Telegram support",
    description: "Open a direct chat with ChixPay support.",
    icon: Send,
    tone: "bg-leaf/15 text-leaf",
  },
  {
    key: "support_whatsapp_url" as const,
    title: "Private WhatsApp channel",
    description: "Join the private channel for member updates.",
    icon: MessageCircle,
    tone: "bg-gold/15 text-gold",
  },
];

export function SupportPage({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<SupportSettings>({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["support_email", "support_telegram_url", "support_whatsapp_url"])
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setNotice("Support contacts could not be loaded. Please try again.");
        const next: SupportSettings = {};
        for (const row of data ?? []) {
          if (row.key === "support_email" || row.key === "support_telegram_url" || row.key === "support_whatsapp_url") next[row.key] = row.value;
        }
        setSettings(next);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const openSupport = (key: keyof SupportSettings) => {
    const value = settings[key];
    if (!value) {
      setNotice("This support option is not available yet. Please choose another contact method.");
      return;
    }
    if (key === "support_email") {
      window.location.href = `mailto:${value}?subject=${encodeURIComponent("ChixPay support request")}`;
      return;
    }
    window.open(value, "_blank", "noopener,noreferrer");
  };

  return <section className="pb-10">
    <header className="flex items-center justify-between">
      <Button aria-label="Back to wallet" variant="glass" size="icon" className="rounded-full" onClick={onBack}><ArrowLeft/></Button>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-leaf">Help centre</span>
      <span className="size-10"/>
    </header>

    <div className="mt-6">
      <span className="grid size-14 place-items-center rounded-2xl bg-leaf/15 text-leaf"><Headphones className="size-7"/></span>
      <h1 className="mt-5 font-display text-3xl font-semibold">How can we help?</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose the best way to reach ChixPay support.</p>
    </div>

    {notice && <Button variant="glass" className="mt-4 h-auto w-full justify-start whitespace-normal rounded-2xl border-gold/25 bg-gold/10 p-3 text-left text-xs text-gold" onClick={() => setNotice("")}>{notice}</Button>}

    <div className="mt-6 space-y-3">
      {supportOptions.map(({ key, title, description, icon: Icon, tone }) => {
        const available = Boolean(settings[key]);
        return <Button key={key} disabled={loading} variant="glass" className="h-auto w-full justify-start rounded-[22px] p-4 text-left" onClick={() => openSupport(key)}>
          <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tone}`}><Icon className="size-5"/></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{title}</span>
            <span className="mt-1 block whitespace-normal text-[11px] font-normal leading-5 text-muted-foreground">{loading ? "Loading contact…" : available ? description : "Not configured yet"}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground"/>
        </Button>;
      })}
    </div>

    <div className="mt-6 rounded-[22px] border border-glass-border bg-glass p-4 text-xs leading-5 text-muted-foreground backdrop-blur-xl">
      Never share your password or one-time code with anyone claiming to be ChixPay support.
    </div>
  </section>;
}
