import { db } from "./db.js";
import { archiveNetworkAdCampaigns, networkAdsArchiveRoot } from "./network-ads-archive.js";

const uploadsDirectory = process.env.RMT_UPLOADS || new URL("./uploads/", import.meta.url).pathname;
const owned = db.prepare("SELECT * FROM network_campaigns ORDER BY id").all().map((row) => ({
  ...row,
  id: `network-campaign-${row.id}`,
}));

let published = [];
try {
  const response = await fetch("https://phantomide.com/house-ads/campaign-templates.json", {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (response.ok) {
    const feed = await response.json();
    published = (feed.templates || [])
      .filter((campaign) => campaign.status === "active")
      .map((campaign) => ({
        ...campaign,
        id: `phantom-${String(campaign.id || "campaign").replace(/[^a-z0-9-]/gi, "-")}`,
        image: campaign.image && !/^https:\/\//i.test(campaign.image)
          ? `https://phantomide.com/house-ads/${String(campaign.image).replace(/^\/+/, "")}`
          : campaign.image,
      }));
  }
} catch (error) {
  console.warn(`[network-ad-archive] PhantomIDE feed unavailable: ${error.message}`);
}

const failures = await archiveNetworkAdCampaigns([...owned, ...published], { uploadsDirectory });
console.log(`[network-ad-archive] saved ${owned.length} Dell campaign records and ${published.length} active PhantomIDE ads under ${networkAdsArchiveRoot()}`);
for (const failure of failures) console.warn(`[network-ad-archive] ${failure.id}: ${failure.error}`);
if (failures.length) process.exitCode = 1;
