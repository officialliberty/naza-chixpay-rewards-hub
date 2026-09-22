import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PaymentDetails = { bank: string; accountName: string; accountNumber: string };

export const defaultPayment: PaymentDetails = {
  bank: "ChixPay Collections (Demo)",
  accountName: "ChixPay Technologies Ltd",
  accountNumber: "0000000000",
};

export const paymentSettingKeys = ["pay_bank_name", "pay_account_name", "pay_account_number"] as const;

export async function fetchPaymentDetails(): Promise<PaymentDetails> {
  const { data } = await supabase.from("app_settings").select("key, value").in("key", [...paymentSettingKeys]);
  const map = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
  return {
    bank: map["pay_bank_name"] || defaultPayment.bank,
    accountName: map["pay_account_name"] || defaultPayment.accountName,
    accountNumber: map["pay_account_number"] || defaultPayment.accountNumber,
  };
}

export function usePaymentDetails(): PaymentDetails {
  const [details, setDetails] = useState<PaymentDetails>(defaultPayment);
  useEffect(() => {
    let active = true;
    void fetchPaymentDetails().then((value) => { if (active) setDetails(value); });
    return () => { active = false; };
  }, []);
  return details;
}
