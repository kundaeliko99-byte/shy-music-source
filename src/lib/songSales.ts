import { supabase } from "@/integrations/supabase/client";

export type SaleType = "full" | "partial" | "negotiable";
export type PaymentMethod = "Airtel Money" | "MTN Mobile Money" | "Visa card" | "Payoneer";

export const PAYMENT_METHODS: PaymentMethod[] = ["Airtel Money", "MTN Mobile Money", "Visa card", "Payoneer"];

export const DEFAULT_BUYER_RIGHTS = [
  "record",
  "remix",
  "edit",
  "perform",
  "distribute",
  "publish",
  "commercially use",
];

export interface SongSaleTerms {
  track_id: string;
  artist_id: string;
  is_available: boolean;
  sale_type: SaleType;
  asking_price: number | null;
  currency: string;
  seller_royalty_percentage: number | null;
  buyer_rights: string[];
  restrictions: string | null;
  extra_notes: string | null;
  contract_terms: string | null;
}

export interface SellerContact {
  display_name: string;
  contact_email: string | null;
  public_phone?: string | null;
  country: string | null;
  mobile_money_network: string | null;
  mobile_money_number: string | null;
  preferred_payment_method?: string | null;
}

export interface ContractDetails {
  songTitle: string;
  sellerName: string;
  buyerName?: string;
  priceLabel: string;
  paymentMethod: string;
  saleType: SaleType;
  sellerRoyaltyPercentage: number | null;
  buyerRights: string[];
  restrictions?: string | null;
  extraNotes?: string | null;
  contractTerms?: string | null;
}

export function defaultSaleTerms(trackId: string, artistId: string): SongSaleTerms {
  return {
    track_id: trackId,
    artist_id: artistId,
    is_available: true,
    sale_type: "negotiable",
    asking_price: null,
    currency: "USD",
    seller_royalty_percentage: null,
    buyer_rights: DEFAULT_BUYER_RIGHTS,
    restrictions: null,
    extra_notes: null,
    contract_terms: null,
  };
}

export function saleTypeLabel(type: SaleType) {
  if (type === "full") return "Full Rights Sale";
  if (type === "partial") return "Partial Rights Sale";
  return "Negotiable Rights Agreement";
}

export function formatPrice(terms: SongSaleTerms) {
  if (!terms.asking_price) return "Price negotiable";
  return `${terms.currency} ${Number(terms.asking_price).toLocaleString()}`;
}

export async function fetchSongSaleTerms(trackId: string, artistId: string): Promise<SongSaleTerms> {
  const fallback = defaultSaleTerms(trackId, artistId);
  const { data, error } = await (supabase as any)
    .from("track_sale_terms")
    .select("*")
    .eq("track_id", trackId)
    .maybeSingle();

  if (error || !data) return fallback;
  return {
    ...fallback,
    ...data,
    buyer_rights: Array.isArray(data.buyer_rights) ? data.buyer_rights : fallback.buyer_rights,
  };
}

export async function fetchSellerContact(artistId: string, fallbackName: string): Promise<SellerContact> {
  const fallback: SellerContact = {
    display_name: fallbackName,
    contact_email: null,
    country: null,
    mobile_money_network: null,
    mobile_money_number: null,
  };

  const { data, error } = await supabase
    .from("artists")
    .select("display_name, contact_email, country, mobile_money_network, mobile_money_number")
    .eq("id", artistId)
    .maybeSingle();

  if (error || !data) return fallback;
  return { ...fallback, ...data };
}

export function buildContractTemplate(details: ContractDetails) {
  const rights = details.buyerRights.length ? details.buyerRights.join(", ") : "to be agreed by both parties";
  const retained = details.sellerRoyaltyPercentage == null ? "To be agreed" : `${details.sellerRoyaltyPercentage}%`;

  return `SONG RIGHTS SALE AGREEMENT

This agreement is made between:

Seller/Songwriter: ${details.sellerName}
Buyer: ${details.buyerName || "[Buyer Name]"}
Song Title: ${details.songTitle}
Date of Agreement: ${new Date().toLocaleDateString()}
Agreed Price: ${details.priceLabel}
Payment Method: ${details.paymentMethod || "[Payment Method]"}

The Seller agrees to sell or license rights to the song named above to the Buyer according to the selected terms.

Rights Type: ${saleTypeLabel(details.saleType)}

If Full Rights Sale is selected, the Buyer may record, remix, edit, perform, distribute, publish, promote, license, and commercially use the song. The Seller gives up ownership rights after the sale unless otherwise stated in the additional terms.

If Partial Rights Sale is selected, the Buyer may use the song according to the agreed terms, while the Seller keeps the agreed percentage of ownership, royalties, credit, or other rights.

Buyer Rights Included: ${rights}
Seller Retained Percentage: ${retained}
Restrictions: ${details.restrictions || "None stated"}
Additional Notes: ${details.extraNotes || "None stated"}

Custom Contract Terms:
${details.contractTerms || "No additional custom terms provided."}

Both parties confirm that they understand and agree to the terms of this song rights sale or license.

Seller Confirmation: __________________
Buyer Confirmation: __________________
Date: __________________

Note: This is a basic contract template and should be reviewed before use.`;
}
