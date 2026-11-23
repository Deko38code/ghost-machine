(function(){
  document.addEventListener('DOMContentLoaded', () => {
    var f=document.createElement('footer');
    f.innerHTML=`
      <div class="wrap footer-inner">
        <div class="mini">© Orebolt — real mining build. No fake returns, no fake balances, no fake payouts.</div>
        <div class="mini"><b>Live</b> telemetry from real server logs.</div>
        <div class="mini">Built on <b>ghost-Inspiron-7348</b>.</div>
      </div>`;
    document.body.appendChild(f);
  });
})();
