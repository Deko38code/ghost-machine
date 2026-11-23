import { useEffect, useRef, useState } from "react";

const FEED_URL = "/api/public/cards";
const TRACK_URL = "/api/network-ads/track";
const SITE = "rmt.haksterai.com";

function trackAdEvent(type, campaignId, slotIndex) {
  if (!campaignId) return;
  fetch(TRACK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ type, campaign_id: campaignId, event_key: crypto.randomUUID(), site: SITE, slot_index: slotIndex }),
  }).catch(() => {});
}

function safeHttps(value) {
  try {
    const url = new URL(String(value || ""), location.origin);
    return url.protocol === "https:" ? url.href : "";
  } catch { return ""; }
}

export default function PartnerAds({ compact = false, floating = true }) {
  const [campaigns, setCampaigns] = useState([]);
  const [index, setIndex] = useState(0);
  const [feedState, setFeedState] = useState("loading");
  const [imageState, setImageState] = useState("loading");
  const [retryCount, setRetryCount] = useState(0);
  const campaignsRef = useRef(campaigns);
  const indexRef = useRef(index);
  const adLinkRef = useRef(null);
  campaignsRef.current = campaigns;
  indexRef.current = index;
  const item = campaigns[index % Math.max(campaigns.length, 1)];

  useEffect(() => {
    const element = adLinkRef.current;
    if (!element || !item?.id) return undefined;
    let timer;
    let sent = false;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
      if (visible && !document.hidden && !timer && !sent) {
        timer = window.setTimeout(() => {
          if (!document.hidden) {
            trackAdEvent("impression", item.id, index);
            sent = true;
          }
          timer = undefined;
        }, 1000);
      } else if (!visible && timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    }, { threshold: [0.5] });
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [item?.id, index]);

  useEffect(() => {
    let live = true;
    const refresh = async () => {
      setFeedState("loading");
      try {
        const response = await fetch(FEED_URL, { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) throw new Error("campaign feed unavailable");
        const data = await response.json();
        const next = (data.templates || []).filter((item) => item.status === "active" && safeHttps(item.image) && safeHttps(item.href));
        if (!live) return;
        if (!next.length) { setCampaigns([]); setFeedState("empty"); return; }
        const currentId = campaignsRef.current[indexRef.current]?.id;
        const preservedIndex = currentId ? next.findIndex((item) => item.id === currentId) : 0;
        setCampaigns(next);
        setIndex(preservedIndex >= 0 ? preservedIndex : 0);
        setFeedState("ready");
      } catch {
        if (live) { setCampaigns([]); setFeedState("unavailable"); }
      }
    };
    refresh();
    const refreshTimer = window.setInterval(refresh, 30000);
    const rotateTimer = window.setInterval(() => {
      if (campaignsRef.current.length > 1) {
        setIndex((current) => (current + 1) % campaignsRef.current.length);
        setImageState("loading");
      }
    }, 8000);
    return () => { live = false; clearInterval(refreshTimer); clearInterval(rotateTimer); };
  }, [retryCount]);

  const href = safeHttps(item?.href);
  const image = safeHttps(item?.image);
  const domain = item?.host || (() => { try { return new URL(href).hostname.replace(/^www\./i, ""); } catch { return ""; } })();
  const title = item?.headline || item?.title || "Sponsored offer";
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: item?.title || title, text: title, url: href });
      else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(href);
    } catch { /* User dismissed the share sheet. */ }
  };
  const issue = feedState === "unavailable"
    ? "Sponsored offers couldn’t load. Your browser may be blocking the feed, or the connection may be unavailable."
    : imageState === "failed"
      ? "The sponsored image couldn’t load. Your browser may be blocking it, or the connection may be unavailable."
      : feedState === "empty" ? "There are no sponsored offers available right now." : "Loading sponsored offers…";

  return (
    <aside className={`house-campaign-panel${floating ? " house-campaign-floating" : ""}${compact ? " house-campaign-compact" : ""}`} aria-label="Sponsored campaigns">
      <div className="house-campaign-heading">Sponsored offers</div>
      {feedState === "ready" && imageState !== "failed" && item && href && image ? <>
        <a ref={adLinkRef} className="house-campaign-link" href={href} target="_blank" rel="noopener noreferrer sponsored" onClick={() => trackAdEvent("click", item.id, index)}>
          <img className="house-campaign-image" src={image} alt={item.title || "Sponsored campaign"} loading="eager" onLoad={() => setImageState("ready")} onError={() => setImageState("failed")} />
          {imageState === "ready" ? <span className="house-campaign-copy">
            <strong>{title}</strong>
            <span>{item.support || "Explore this partner offer."}</span>
            <small className="house-campaign-domain">{domain}</small>
            <b>{item.cta || "LEARN MORE"} →</b>
          </span> : <span className="house-campaign-status" role="status">Loading campaign image…</span>}
        </a>
        {imageState === "ready" && <div className="house-campaign-social">
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(href)}`} target="_blank" rel="noopener noreferrer">Facebook</a>
          <button type="button" onClick={share}>Instagram · Share</button>
        </div>}
      </> : <div className="house-campaign-status" role="status">
        <span>{issue}</span>
        {feedState === "unavailable" || imageState === "failed" ? <>
          <button type="button" onClick={() => { setImageState("loading"); setRetryCount((count) => count + 1); }}>Retry</button>
          <a href="https://adguard.com/kb/adguard-browser-extension/features/filters/#allowlist" target="_blank" rel="noopener noreferrer">How to allow this site in AdGuard</a>
        </> : null}
      </div>}
    </aside>
  );
}
