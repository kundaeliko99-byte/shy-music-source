import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Copy, Download, Mail, MessageCircle, Phone, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { TrackRow } from "@/lib/api";
import { withTimeout } from "@/lib/request";
import {
  PAYMENT_METHODS,
  buildContractTemplate,
  fetchSellerContact,
  fetchSongSaleTerms,
  formatPrice,
  saleTypeLabel,
  type PaymentMethod,
  type SellerContact,
  type SongSaleTerms,
} from "@/lib/songSales";

interface BuySongButtonProps {
  track: TrackRow;
  size?: "sm" | "md";
}

export function BuySongButton({ track, size = "md" }: BuySongButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState<SongSaleTerms | null>(null);
  const [seller, setSeller] = useState<SellerContact | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Airtel Money");
  const [buyerName, setBuyerName] = useState("");
  const [buyerContact, setBuyerContact] = useState("");
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const artistName = track.artists?.display_name ?? "Unknown songwriter";

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingDetails(true);
    Promise.allSettled([
      withTimeout(fetchSongSaleTerms(track.id, track.artist_id), "Song sale terms", 6000),
      withTimeout(fetchSellerContact(track.artist_id, artistName), "Seller contact", 6000),
    ]).then(([termsResult, sellerResult]) => {
      if (!active) return;
      setTerms(termsResult.status === "fulfilled" ? termsResult.value : null);
      setSeller(sellerResult.status === "fulfilled" ? sellerResult.value : null);
      if (termsResult.status === "rejected" || sellerResult.status === "rejected") {
        toast.warning("Some seller details could not be loaded yet.");
      }
    }).finally(() => {
      if (active) setLoadingDetails(false);
    });
    return () => {
      active = false;
    };
  }, [artistName, open, track.artist_id, track.id]);

  const priceLabel = terms ? formatPrice(terms) : "Price negotiable";
  const contract = useMemo(() => {
    if (!terms) return "";
    return buildContractTemplate({
      songTitle: track.title,
      sellerName: seller?.display_name ?? artistName,
      buyerName,
      priceLabel,
      paymentMethod,
      saleType: terms.sale_type,
      sellerRoyaltyPercentage: terms.seller_royalty_percentage,
      buyerRights: terms.buyer_rights,
      restrictions: terms.restrictions,
      extraNotes: terms.extra_notes,
      contractTerms: terms.contract_terms,
    });
  }, [artistName, buyerName, paymentMethod, priceLabel, seller?.display_name, terms, track.title]);

  async function copyContract() {
    try {
      await navigator.clipboard.writeText(contract);
      toast.success("Contract copied");
    } catch {
      toast.error("Couldn't copy the contract. Select the text and copy it manually.");
    }
  }

  function downloadContract() {
    const blob = new Blob([contract], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${track.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-song-rights-agreement.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function requestPurchase() {
    if (requesting) return;
    if (!user) {
      toast.error("Sign in to request a song purchase.");
      navigate({ to: "/auth" });
      return;
    }

    setRequesting(true);
    try {
      const { error } = await withTimeout<{ error?: { message?: string } | null }>((supabase as any).from("song_purchase_requests").insert({
        track_id: track.id,
        artist_id: track.artist_id,
        buyer_id: user.id,
        buyer_name: buyerName || null,
        buyer_contact: buyerContact || null,
        requested_payment_method: paymentMethod,
        proposed_price: terms?.asking_price ?? null,
        currency: terms?.currency ?? "USD",
        message: "Buyer requested to purchase song rights from the SHY Buy Song flow.",
      }), "Purchase request", 8000);

      if (error) {
        toast.error("Purchase request could not be saved yet. Contact the seller directly.");
        return;
      }
      toast.success("Purchase request sent to the seller");
    } catch {
      toast.error("Purchase request timed out. Contact the seller directly or try again.");
    } finally {
      setRequesting(false);
    }
  }

  function openDialog(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  }

  const buttonClass =
    size === "sm"
      ? "text-[11px] px-2.5 py-1 gap-1"
      : "text-xs px-4 py-2 gap-1.5";

  const hasContact = Boolean(seller?.contact_email || seller?.public_phone || seller?.mobile_money_number);
  const phone = seller?.public_phone || seller?.mobile_money_number;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={openDialog}
        className={`inline-flex items-center rounded-full font-medium bg-surface hairline text-foreground hover:bg-surface-elevated ${buttonClass}`}
        aria-label={`Buy rights for ${track.title}`}
      >
        <ShoppingBag className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
        Buy Song
      </button>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto bg-surface border-border p-0">
        <div className="p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary-glow" />
              Buy This Song
            </DialogTitle>
            <DialogDescription>
              Review price, contact options, payment placeholders, and a basic song-rights agreement.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1.2fr]">
            <section className="space-y-3">
              <InfoBox label="Song">
                <Link
                  to="/tracks/$id"
                  params={{ id: track.id }}
                  aria-label={`Open song page for ${track.title}`}
                  className="hover:text-primary-glow hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  {track.title}
                </Link>
              </InfoBox>
              <InfoBox label="Writer / Seller">
                {track.artists?.slug ? (
                  <Link
                    to="/artists/$slug"
                    params={{ slug: track.artists.slug }}
                    aria-label={`Open artist profile for ${seller?.display_name ?? artistName}`}
                    className="hover:text-primary-glow hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    {seller?.display_name ?? artistName}
                  </Link>
                ) : (
                  seller?.display_name ?? artistName
                )}
              </InfoBox>
              <Info label="Price" value={priceLabel} />
              <Info label="Rights" value={terms ? saleTypeLabel(terms.sale_type) : "Negotiable Rights Agreement"} />
              {loadingDetails && <p className="text-xs text-muted-foreground">Loading seller details...</p>}

              <div className="rounded-xl hairline bg-background/50 p-4">
                <h3 className="text-sm font-semibold">Payment Options</h3>
                <div className="mt-3 grid gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <button
                      type="button"
                      key={method}
                      onClick={() => {
                        setPaymentMethod(method);
                        toast.info("Payment integration coming soon. Contact the songwriter/seller to complete this purchase.");
                      }}
                      className={`rounded-lg hairline px-3 py-2 text-left text-xs transition-colors ${
                        paymentMethod === method ? "border-primary bg-primary/15 text-primary-glow" : "bg-surface"
                      }`}
                    >
                      {method}
                      <span className="block pt-0.5 text-[10px] text-muted-foreground">
                        Integration coming soon. Contact seller to complete purchase.
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl hairline bg-background/50 p-4">
                <h3 className="text-sm font-semibold">Contact Seller</h3>
                {hasContact ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {seller?.contact_email && (
                      <a className="contact-action" href={`mailto:${seller.contact_email}?subject=Song purchase request: ${encodeURIComponent(track.title)}`}>
                        <Mail className="h-3.5 w-3.5" /> Email seller
                      </a>
                    )}
                    {phone && (
                      <a className="contact-action" href={`tel:${phone}`}>
                        <Phone className="h-3.5 w-3.5" /> Call seller
                      </a>
                    )}
                    {phone && (
                      <a className="contact-action" href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Seller contact details are not available yet.</p>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Buyer name</span>
                  <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className="input-lite" placeholder="Your name" />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Buyer contact</span>
                  <input value={buyerContact} onChange={(e) => setBuyerContact(e.target.value)} className="input-lite" placeholder="Email or phone" />
                </label>
              </div>

              <div className="rounded-xl hairline bg-background/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Song Rights Contract</h3>
                  <div className="flex gap-2">
                    <button type="button" onClick={copyContract} className="icon-action" aria-label="Copy contract"><Copy className="h-4 w-4" /></button>
                    <button type="button" onClick={downloadContract} className="icon-action" aria-label="Download contract"><Download className="h-4 w-4" /></button>
                  </div>
                </div>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-background p-3 text-[11px] leading-relaxed text-muted-foreground">
                  {contract || "Loading contract..."}
                </pre>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  This is a basic contract template and should be reviewed before use.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={requestPurchase}
                  disabled={requesting}
                  className="rounded-full bg-gradient-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-glow-soft disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {requesting ? "Sending..." : "Request purchase"}
                </button>
                {seller?.contact_email && (
                  <a href={`mailto:${seller.contact_email}?subject=Song purchase request: ${encodeURIComponent(track.title)}`} className="rounded-full bg-surface-elevated px-4 py-2 text-xs font-medium hairline">
                    Contact seller
                  </a>
                )}
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <InfoBox label={label}>
      {value}
    </InfoBox>
  );
}

function InfoBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl hairline bg-background/50 p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{children}</div>
    </div>
  );
}
