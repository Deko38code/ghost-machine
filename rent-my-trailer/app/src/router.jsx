// Keep this list in sync with PAGES in App.jsx and the footer links.
export const pageRoutes = new Set(["home", "browse", "post", "membership", "bookings", "messages", "community", "deposit", "settings", "confirmation", "admin", "migrate", "reset", "terms", "privacy", "refund", "about", "faq", "contact", "r"]);

export const routes = {
 /* the query string is split off here so `param` is always a clean identifier.
    Anything that appends ?paid=1 (the Stripe return) or ?q=… (a shared browse
    link) would otherwise end up inside param — corrupting Number(param) on
    Messages and toUpperCase() on the referral gate. */
 parse(hash) {
   const h = (hash || "").replace(/^#\/?/, "");
   const qi = h.indexOf("?");
   const pathPart = qi === -1 ? h : h.slice(0, qi);
   const [name, ...rest] = pathPart.split("/");
   return {
     name: name || "home",
     param: rest.join("/") || null,
     query: new URLSearchParams(qi === -1 ? "" : h.slice(qi + 1)),
   };
 },
 go(hash) {
   location.hash = hash;
   dispatchEvent(new HashChangeEvent("hashchange"));
 },
};

export const money = (n) => (n == null ? "—" : `$${Number(n).toLocaleString()}`);
export const priceLine = (d) =>
 [d.daily && `Day ${money(d.daily)}`, d.weekly && `Week ${money(d.weekly)}`, d.monthly && `Month ${money(d.monthly)}`]
   .filter(Boolean)
   .join(" · ");

export const COUPONS = [
 { code: "HAULMORE", percent: 10, note: "10% off any rental over $100" },
 { code: "FIRSTTOW", percent: 15, note: "15% off your first booking" },
 { code: "WEEKENDHAUL", percent: 5, note: "5% off 3+ day weekends" },
 { code: "FLEETFIX", percent: 20, note: "20% off 7+ day rentals" },
];

/* Maps — mirrors neighbors trailer's google.maps JS API usage (Lat/Lng on the
  detail map + spherical distance vs deliveryRadius). We ship the no-key
  versions: OpenStreetMap embed + Google Maps directions deep link. */
export const directionsUrl = (l) =>
 `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}&destination_place_id=`;

export const directionsTextUrl = (l) =>
 `https://www.google.com/maps/search/${encodeURIComponent(`pickup ${l.city || ""} ${l.state || ""} ${l.zip || ""}`)}`;

export const mapEmbedUrl = (l) =>
 l.lat && l.lng
   ? `https://www.openstreetmap.org/export/embed.html?bbox=${l.lng - 0.06}%2C${l.lat - 0.035}%2C${l.lng + 0.06}%2C${l.lat + 0.035}&layer=mapnik&marker=${l.lat}%2C${l.lng}`
   : null;

export const milesFrom = (l1, l2) => {
 // spherical distance, same math the site does with google.maps.geometry.spherical
 const R = 6371000, toR = (d) => (d * Math.PI) / 180;
 const dy = toR(l2.lat - l1.lat), dx = toR(l2.lng - l1.lng);
 const a = Math.sin(dy / 2) ** 2 + Math.cos(toR(l1.lat)) * Math.cos(toR(l2.lat)) * Math.sin(dx / 2) ** 2;
 return (2 * R * Math.sqrt(a)) / 1609.34;
};
