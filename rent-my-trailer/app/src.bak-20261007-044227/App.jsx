import { useEffect, useState } from "react";
import { routes } from "./router.jsx";
import { Logo } from "./components/Logo.jsx";
import AiWidget from "./components/AiWidget.jsx";
import { AuthModal } from "./lib/Auth.jsx";
import { AccountChip } from "./lib/Auth.jsx";
import Bookings from "./lib/Bookings.jsx";
import Confirmation from "./pages/Confirmation.jsx";
import { user } from "./lib/api.js";
import Home from "./pages/Home.jsx";
import Browse from "./pages/Browse.jsx";
import Detail from "./pages/Detail.jsx";
import Messages from "./pages/Messages.jsx";
import Deposit from "./pages/Deposit.jsx";
import Post from "./pages/Post.jsx";

const PAGES = { home: Home, browse: Browse, detail: Detail, messages: Messages, deposit: Deposit, post: Post, bookings: Bookings, confirmation: Confirmation };

export default function App() {
  const [authOpen, setAuthOpen] = useState(false);
  useEffect(() => {
    const on = (e) => setAuthOpen(true);
    addEventListener("rmt-auth", on);
    return () => removeEventListener("rmt-auth", on);
  }, []);
  const [route, setRoute] = useState(() => routes.parse(location.hash));
  useEffect(() => {
    const onHash = () => setRoute(routes.parse(location.hash));
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => { scrollTo(0, 0); }, [route.name, route.param]);

  const Page = PAGES[route.name] || Home;
  const active = (n) => (route.name === n ? " navlink active" : " navlink");
  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#/home">
          <Logo size={30} />
          <span className="brand-word">Rent My <em>Trailer</em></span>
        </a>
        <nav>
          <a className={active("browse")} href="#/browse">Browse Trailers</a>
          <a className={active("deposit")} href="#/deposit">Deposits</a>
          <a className={active("messages")} href="#/messages">Messages</a>
          <a className={active("post")} href="#/post">List Your Trailer</a>
          <a className={active("bookings")} href="#/bookings">Bookings</a>
        </nav>
        <AccountChip />
      </header>

      <main>
        <Page route={route} />
      </main>

      <footer className="sitefoot">
        <div className="hazard" aria-hidden="true"></div>
        <div className="foot-inner">
          <span className="brand-mark small">RMT</span>
          <span>Rent My Trailer — marketplace demo · data snapshot v1</span>
          <span>{(route.name || "")}</span>
        </div>
      </footer>
      <AiWidget onListingDraft={(d) => { location.hash = "#/post"; dispatchEvent(new CustomEvent("rmt-ai-listing", { detail: d })); }} />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}