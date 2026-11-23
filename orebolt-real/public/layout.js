(function(){
  var nav=document.createElement('div');
  nav.innerHTML=`
  <nav class="top-nav">
    <div class="top-nav-grid">
      <a href="/" class="logo">Ore<span>bolt</span></a>
      <div class="links" id="links">
        <a href="/">Home</a>
        <a href="/hardware.html">Hardware</a>
        <a href="/pool.html">Pool</a>
        <a href="/logs.html">Logs</a>
        <a href="/security.html">Security</a>
      </div>
      <div class="status"><i></i> Live</div>
    </div>
  </nav>`;
  document.body.prepend(nav);
})();
