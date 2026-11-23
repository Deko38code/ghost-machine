(function(){
  const nav = document.createElement('header');
  nav.innerHTML = `
  <div class="wrap top-nav-grid">
    <a href="/" class="logo">Ore<span>bolt</span></a>
    <nav class="links">
      <a href="/">Home</a>
      <a href="/hardware.html">Hardware</a>
      <a href="/pool.html">Pool</a>
      <a href="/logs.html">Logs</a>
      <a href="/security.html">Security</a>
    </nav>
    <div class="status"><i></i> Live</div>
  </div>`;
  document.body.prepend(nav);
})();
