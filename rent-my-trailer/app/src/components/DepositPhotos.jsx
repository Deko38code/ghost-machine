import { useState, useEffect } from "react";

/* Real deposit photo check — uploads go to the server: POST /api/deposit-photos/:code */
import { api, upload, user } from "../lib/api.js";

const SLOTS = [
  ["hitch", "Hitch + latch"],
  ["tires", "Tires & wheels"],
  ["corners", "Box corners / rack"],
  ["extras", "Extras (ramps, straps, keys)"],
];
const LVLS = ["dropoff", "pickup"];

export default function DepositPhotos({ bookingCode, role = "renter" }) {
  const [level, setLevel] = useState("dropoff");
  const [photos, setPhotos] = useState({});       // `${stage}:${slot}` -> file url
  const [depositState, setDepositState] = useState(null);
  const [err, setErr] = useState("");

  if (!user()) return <div className="dphoto"><b>Photo check</b><p className="dnote">Log in to attach pickup photos to this booking.</p></div>;

  useEffect(() => { refresh(); }, [bookingCode]); // eslint-disable-line
  const refresh = async () => {
    try {
      const r = await api("GET", `/api/deposit-photos/${bookingCode}`);
      const next = {};
      for (const row of r.rows || []) next[`${row.stage}:${row.slot}`] = row.file;
      setPhotos(next);
      setDepositState(r.deposit_state);
    } catch (e) { setErr(e.message); }
  };

  const onSave = (slot) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    const fd = new FormData();
    fd.append("photo", file);
    fd.append("role", role);
    fd.append("stage", level);
    fd.append("slot", slot);
    try {
      await upload(`/api/deposit-photos/${bookingCode}`, fd);
      await refresh();
    } catch (ex) { setErr(ex.message); }
  };

  const count = SLOTS.filter(([k]) => photos[`${level}:${k}`]).length;

  return (
    <div className="dphoto">
      <div className="dphoto-head">
        <h3>Deposit photo check — {role}</h3>
        <span>{count}/4 on file{depositState ? ` · deposit: ${depositState}` : ""}</span>
      </div>
      <div className="lvlswitch">
        {LVLS.map((lv) => (
          <button key={lv} className={lv === level ? "on" : ""} onClick={() => setLevel(lv)}>
            {lv === "dropoff" ? "Drop-off (renter)" : "Pickup (owner)"}
          </button>
        ))}
      </div>
      <div className="slots">
        {SLOTS.map(([k, label]) => (
          <div className="photo-slot" key={k}>
            <span>{label}</span>
            <label className="shotbox">
              {photos[`${level}:${k}`] ? <img src={photos[`${level}:${k}`]} alt={label} /> : <><b>＋</b><small>tap to snap</small></>}
              <input type="file" accept="image/*" capture="environment" hidden onChange={onSave(k)} />
            </label>
          </div>
        ))}
      </div>
      {err && <p className="coupon-no">{err}</p>}
      <p className="dnote">Deposit is refundable against these photos — 4 shots at drop-off (renter) and 4 at pickup (owner). Camera opens on mobile.</p>
    </div>
  );
}