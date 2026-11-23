(function(){
  document.addEventListener('DOMContentLoaded', () => {
    const nav = document.createElement('header');
    nav.className = 'top-nav';
    nav.innerHTML = `
      <div class="wrap top-nav-grid">
        <a href="/" class="logo">Ore<span>bolt</span></a>
        <div class="links">
          <a href="/" class="active">Home</a>
          <a href="/hardware.html">Hardware</a>
          <a href="/pool.html">Pool</a>
          <a href="/logs.html">Logs</a>
          <a href="/security.html">Security</a>
        </div>
        <span class="status"><i></i> Live</span>
      </div>`;
    document.body.prepend(nav);
  });
})();
