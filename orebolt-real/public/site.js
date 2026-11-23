(function(){
  const nav = document.createElement('nav');
  nav.innerHTML = `
  <div class="wrap nav-grid">
    <a href="/" class="logo">Ore<span>bolt</span></a>
    <div class="links">
      <a href="/hardware">Hardware</a>
      <a href="/pool">Pool</a>
      <a href="/payouts">Payouts</a>
      <a href="/security">Security</a>
      <a href="/logs">Logs</a>
    </div>
    <div class="status"><span class="live-dot"></span> Live</div>
  </div>`;
  document.body.prepend(nav);

  const style = document.createElement('style');
  style.textContent = `
  nav.main{position:sticky; top:0; z-index:10; backdrop-filter:blur(12px); background:rgba(7,12,23,.78); border-bottom:1px solid rgba(255,255,255,.08)}
  nav.main .nav-grid{display:flex; align-items:center; gap:16px; padding:18px 0}
  nav.main .logo{font-weight:800; font-size:1.2rem; letter-spacing:.04em}
  nav.main .logo span{color:var(--gold)}
  nav.main .links{display:flex; align-items:center; gap:14px; margin-left:auto; font-size:.8rem; letter-spacing:.09em; text-transform:uppercase; font-weight:700}
  nav.main .links a{color:var(--dim); padding:8px 10px; border-radius:10px; transition:.15s}
  nav.main .links a:hover{color:var(--gold); background:rgba(255,255,255,.05)}
  nav.main .status{display:flex; align-items:center; gap:8px; font-size:.7rem; letter-spacing:.12em; text-transform:uppercase; color:var(--green); font-weight:700}
  nav.main .live-dot{width:8px; height:8px; background:var(--green); border-radius:999px; box-shadow:0 0 10px var(--green); animation:pulse 1.8s infinite}
  nav.main .links a.active{color:var(--gold); background:rgba(255,255,255,.05)}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  `;
  document.head.appendChild(style);

  const path = location.pathname.replace(/\/$/,'') || '/';
  nav.querySelectorAll('.links a').forEach(a=>{
    const href = a.getAttribute('href').replace(/\/$/,'') || '/';
    if (href === path) a.classList.add('active');
  });

  const foot = document.createElement('footer');
  foot.innerHTML = `
  <div class="wrap foot-inner">
    <div class="mini">© Orebolt — real build. No fake returns. No fake balances.</div>
    <div class="mini">Built with real server telemetry and live machine data.</div>
  </div>`;
  document.body.append(foot);
  const fstyle = document.createElement('style');
  fstyle.textContent = `
  footer{margin-top:40px; padding:18px 0; border-top:1px solid rgba(255,255,255,.08); color:var(--dim); font-size:.78rem}
  .foot-inner{display:flex; align-items:center; gap:20px; flex-wrap:wrap}
  .mini{margin:0}
  `;
  document.head.appendChild(fstyle);
})();
