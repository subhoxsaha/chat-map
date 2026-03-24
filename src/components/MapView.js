"use client";

import { useEffect, useRef } from "react";
import { divIcon } from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MAP_TILES = {
  dark: {
    url:  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attr: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  light: {
    url:  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attr: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

function dicebearUrl(seed) {
  return `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(seed || "default")}&radius=50&size=80`;
}

function getImgSrc(user) {
  return user.customAvatar || dicebearUrl(user.id || user.name);
}

// Global icon cache—prevents Leaflet DOM destruction on React re-renders
const iconCache = new Map();

function createAvatarIcon(user, isSelf) {
  const imgSrc = getImgSrc(user);
  const cacheKey = `${user.id}_${imgSrc}_${user.displayName || user.name || ""}_${isSelf}`;

  if (iconCache.has(cacheKey)) return iconCache.get(cacheKey);

  const size        = isSelf ? 46 : 40;
  const borderColor = isSelf ? "#408A71" : "rgba(176,228,204,0.5)";
  const borderWidth = isSelf ? "3px" : "2px";
  const caretColor  = isSelf ? "#408A71" : "rgba(176,228,204,0.7)";
  const shadow      = "drop-shadow(0 4px 10px rgba(0,0,0,0.5))";

  const html = `
    <div style="position:relative;width:${size}px;height:${size + 10}px;filter:${shadow};">
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        border:${borderWidth} solid ${borderColor};
        overflow:hidden;background:#1a2a28;position:relative;z-index:1;">
        <img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;" alt=""
             onerror="this.src='${dicebearUrl(user.id || "fallback")}'" />
      </div>
      <div style="
        position:absolute;bottom:0;left:50%;
        transform:translateX(-50%);
        width:0;height:0;
        border-left:6px solid transparent;
        border-right:6px solid transparent;
        border-top:9px solid ${caretColor};
        z-index:0;">
      </div>
    </div>`;

  const icon = divIcon({
    className:   "",
    html,
    iconSize:    [size, size + 10],
    iconAnchor:  [size / 2, size + 10],
    popupAnchor: [0, -(size + 14)],
  });

  iconCache.set(cacheKey, icon);
  return icon;
}

// Fan out co-located users so markers don't overlap
function spreadUsers(users) {
  const THRESH = 0.00003;
  const groups = [];
  users.forEach(u => {
    if (u.lat == null) return;
    const g = groups.find(g => Math.abs(g.lat - u.lat) < THRESH && Math.abs(g.lng - u.lng) < THRESH);
    g ? g.members.push(u) : groups.push({ lat: u.lat, lng: u.lng, members: [u] });
  });
  const out = [];
  groups.forEach(({ lat, lng, members }) => {
    if (members.length === 1) { out.push({ ...members[0] }); return; }
    const R = 0.00009 + members.length * 0.00002;
    members.forEach((u, i) => {
      const angle = (2 * Math.PI * i) / members.length - Math.PI / 2;
      out.push({ ...u, lat: lat + R * Math.cos(angle), lng: lng + R * Math.sin(angle), _spread: true });
    });
  });
  return out;
}

function AutoCenter({ center }) {
  const map  = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (center && !done.current) {
      map.setView([center.lat, center.lng], 15, { animate: true });
      done.current = true;
    }
  }, [center, map]);
  return null;
}

export default function MapView({ users = [], sessionUser, userLocation, mapTheme = "dark", onUserClick }) {
  const tile   = MAP_TILES[mapTheme] || MAP_TILES.dark;
  const spread = spreadUsers(users);
  const isDark = mapTheme === "dark";

  const popupBg     = isDark ? "#0d1f1d" : "#ffffff";
  const popupText   = isDark ? "#f1f5f9"  : "#0f172a";
  const popupSub    = isDark ? "#94a3b8"  : "#64748b";
  const dividerCol  = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const btnBg       = "rgba(64,138,113,0.15)";
  const btnBorder   = "rgba(64,138,113,0.4)";
  const btnText     = isDark ? "#B0E4CC" : "#285A48";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <MapContainer
        center={[20, 0]} zoom={3} scrollWheelZoom
        style={{ width: "100%", height: "100%", background: isDark ? "#091413" : "#f8fafc" }}
        zoomControl={false}
      >
        <TileLayer url={tile.url} attribution={tile.attr} subdomains="abcd" maxZoom={19} />
        <ZoomControl position="bottomright" />
        {userLocation && <AutoCenter center={userLocation} />}

        {spread.map(u => {
          if (u.lat == null) return null;
          const isSelf = u.id === sessionUser?.id;
          const name   = u.displayName || u.name || "User";
          const imgSrc = getImgSrc(u);

          return (
            <Marker
              key={`${u.id}_${u._spread ? `${u.lat}_${u.lng}` : ""}`}
              position={[u.lat, u.lng]}
              icon={createAvatarIcon(u, isSelf)}
              zIndexOffset={isSelf ? 1000 : 0}
            >
              <Popup closeButton={false} className="custom-map-popup">
                <div style={{
                  minWidth: 160, fontFamily: "Inter, sans-serif",
                  background: popupBg, borderRadius: 12, overflow: "hidden",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
                }}>
                  {/* Header — avatar + name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 10px" }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%",
                      overflow: "hidden", flexShrink: 0,
                      border: `2px solid ${isSelf ? "#408A71" : dividerCol}`,
                      background: "#1a2a28"
                    }}>
                      <img
                        src={imgSrc}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        alt={name}
                        onError={e => { e.target.src = dicebearUrl(u.id || name); }}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        fontWeight: 700, margin: 0, fontSize: 13,
                        color: popupText, lineHeight: 1.3,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        maxWidth: 100
                      }}>{name}</p>
                      <p style={{
                        fontSize: 11, margin: "2px 0 0",
                        color: isSelf ? "#408A71" : "#549E86",
                        fontWeight: 600
                      }}>{isSelf ? "● You" : "● Online"}</p>
                    </div>
                  </div>

                  {/* Message button */}
                  {!isSelf && onUserClick && (
                    <div style={{ padding: "0 10px 10px" }}>
                      <button
                        onClick={() => onUserClick(u.id, name, imgSrc)}
                        style={{
                          width: "100%", padding: "7px 0", borderRadius: 8, cursor: "pointer",
                          border: `1px solid ${btnBorder}`, background: btnBg,
                          color: btnText, fontWeight: 600, fontSize: 12,
                          fontFamily: "Inter, sans-serif", transition: "background 0.15s"
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(64,138,113,0.28)"}
                        onMouseLeave={e => e.currentTarget.style.background = btnBg}
                      >
                        Message
                      </button>
                    </div>
                  )}

                  {u._spread && (
                    <p style={{
                      fontSize: 10, color: popupSub,
                      margin: 0, padding: "6px 14px 10px",
                      borderTop: `1px solid ${dividerCol}`
                    }}>Nearby users spread apart</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Locating overlay */}
      {!userLocation && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 20,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: "rgba(9,20,19,0.7)", backdropFilter: "blur(6px)"
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            border: "4px solid #408A71", borderTopColor: "transparent",
            animation: "spin 1s linear infinite", marginBottom: 12
          }} />
          <p style={{ color: "#fff", fontWeight: 600, fontSize: 14, margin: 0 }}>Locating you…</p>
          <p style={{ color: "rgba(176,228,204,0.6)", fontSize: 12, margin: "4px 0 0" }}>
            Please allow location access
          </p>
        </div>
      )}

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .custom-map-popup .leaflet-popup-content-wrapper { padding: 0; border-radius: 12px; overflow: hidden; border: none; box-shadow: none; background: transparent; }
        .custom-map-popup .leaflet-popup-content { margin: 0; }
        .custom-map-popup .leaflet-popup-tip-container { display: none; }
      `}</style>
    </div>
  );
}
