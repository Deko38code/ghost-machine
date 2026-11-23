document.addEventListener('DOMContentLoaded', () => {
  const nav = document.createElement('nav');
  nav.innerHTML = `Ore<span>bolt</span> <span class="pill">Live security telemetry</span>`;
  const style = document.createElement('style');
  style.textContent = `nav.main{position:sticky;top:0;z-index:10;backdrop-filter:blur(12px);background:rgba(7,12,23,.78);border-bottom:1px solid rgba(255,255,255,.08)}nav.main .wrap{display:flex;align-items:center;gap:16px;padding:18px 0}nav.main .logo{font-weight:800;font-size:1.2rem;letter-spacing:.04em}nav.main .logo span{color:var(--gold)}`;
  document.head.appendChild(style);
  document.body.prepend(nav);
});
