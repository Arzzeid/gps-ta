/**
 * GPS Tracker Dashboard
 * Deps: react-leaflet, leaflet, paho-mqtt
 *
 * index.html <head>:
 *   <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap" rel="stylesheet">
 * main.jsx:
 *   import 'leaflet/dist/leaflet.css'
 */

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import Paho from 'paho-mqtt';

import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl       from 'leaflet/dist/images/marker-icon.png';
import shadowUrl     from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

// ── Fonts ─────────────────────────────────────────────────────────
const FONT_LINK = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap';
if (!document.querySelector(`link[href="${FONT_LINK}"]`)) {
  Object.assign(document.head.appendChild(document.createElement('link')),
    { rel: 'stylesheet', href: FONT_LINK });
}
const FUI  = "'Syne', sans-serif";
const FMONO = "'JetBrains Mono', monospace";

// ── Themes ────────────────────────────────────────────────────────
const THEMES = {
  light: {
    isDark:      false,
    root:        '#f1f5f9',
    surface:     '#ffffff',
    border:      '#e2e8f0',
    text:        '#0f172a',
    textMuted:   '#64748b',
    textFaint:   '#94a3b8',
    tabBg:       '#f1f5f9',
    tabActive:   '#ffffff',
    tabOn:       '#0f172a',
    tabOff:      '#94a3b8',
    logBg:       '#f8fafc',
    logBorder:   '#cbd5e1',
    logTime:     '#94a3b8',
    tagIn:       { bg:'#dbeafe', text:'#1d4ed8' },
    tagOut:      { bg:'#ede9fe', text:'#6d28d9' },
    tagErr:      { bg:'#fee2e2', text:'#b91c1c' },
    tagSys:      { bg:'#f1f5f9', text:'#64748b' },
    logIn:       '#1d4ed8',
    logOut:      '#6d28d9',
    logErr:      '#b91c1c',
    logSys:      '#64748b',
    inputBg:     '#f8fafc',
    modalBg:     '#ffffff',
    overlayBg:   'rgba(255,255,255,0.92)',
    noSignalBg:  'rgba(241,245,249,0.75)',
    fenceCard:   '#f8fafc',
    emptyText:   '#94a3b8',
    tile:        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  dark: {
    isDark:      true,
    root:        '#0a0e1a',
    surface:     '#111827',
    border:      '#1e293b',
    text:        '#e2e8f0',
    textMuted:   '#475569',
    textFaint:   '#334155',
    tabBg:       '#0f172a',
    tabActive:   '#1e293b',
    tabOn:       '#e2e8f0',
    tabOff:      '#475569',
    logBg:       '#0f172a',
    logBorder:   '#1e293b',
    logTime:     '#475569',
    tagIn:       { bg:'#1e3a5f', text:'#60a5fa' },
    tagOut:      { bg:'#2e1065', text:'#a78bfa' },
    tagErr:      { bg:'#450a0a', text:'#f87171' },
    tagSys:      { bg:'#1e293b', text:'#475569' },
    logIn:       '#93c5fd',
    logOut:      '#c4b5fd',
    logErr:      '#fca5a5',
    logSys:      '#64748b',
    inputBg:     '#0f172a',
    modalBg:     '#111827',
    overlayBg:   'rgba(10,14,26,0.88)',
    noSignalBg:  'rgba(10,14,26,0.65)',
    fenceCard:   '#0f172a',
    emptyText:   '#334155',
    tile:        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
};

// ── Styles factory ────────────────────────────────────────────────
const makeS = (T, isMobile=false) => ({
  root:        { display:'flex', flexDirection:'column', height:'100vh', background:T.root, color:T.text, padding: isMobile ? 8 : 16, gap: isMobile ? 8 : 12, boxSizing:'border-box', fontFamily:FUI }, header: { display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  header:      { display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
  logoBox:     { width:32, height:32, borderRadius:8, background:'#1d4ed8', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  subTitle:    { fontSize:11, color:T.textMuted, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' },
  statusBadge: { display:'flex', alignItems:'center', gap:6, background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:'6px 12px' },
  dot:         { width:8, height:8, borderRadius:'50%', flexShrink:0 },
  badgePaused: { background:'#7c2d12', color:'#fb923c', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20 },
  badgeActive: { background:'#14532d', color:'#4ade80', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20 },
  body:        { flex:1, display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr', gridTemplateRows: isMobile ? 'auto 1fr' : '1fr', gap:12, minHeight:0, maxHeight:'100%', overflowX:'hidden', overflowY: isMobile ? 'auto' : 'hidden' },
  sidebar:     { display: 'flex', flexDirection: 'column', gap:10, width: isMobile ? '100%' : 320, minHeight: isMobile ? 'auto' : 0, maxHeight: isMobile ? 'none' : '100%', overflowX: 'hidden', overflowY: isMobile ? 'visible' : 'hidden', transition: 'width .25s ease, opacity .2s ease' },
  sidebarScroll: { flex: isMobile ? 'none' : 1, overflowY: isMobile ? 'visible' : 'auto', display:'flex', flexDirection:'column', gap:10, minHeight:0 },  sidebarHide  : isMobile ? { height:0, opacity:0, overflowX:'hidden', overflowY:'hidden', pointerEvents:'none' } : { width:0,  opacity:0, overflowX:'hidden', overflowY:'hidden', pointerEvents:'none' },
  card:        { background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:14, flexShrink:0 },
  secTitle:    { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:T.textMuted, marginBottom:8 },
  label:       { fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', color:T.textMuted, marginBottom:2 },
  val:         { fontWeight:700, color:T.text },
  divider:     { height:1, background:T.border, margin:'10px 0' },
  logWrap:     { padding:'5px 8px', borderRadius:6, background:T.logBg, borderLeft:'2px solid', display:'flex', gap:8, alignItems:'flex-start' },
  tag:         { fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4, textTransform:'uppercase', letterSpacing:'0.06em', flexShrink:0 },
  iconBtn:     { background:'transparent', border:'none', cursor:'pointer', padding:'2px 4px' },
  mapWrap:     { background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, overflowX:'hidden', overflowY:'hidden', position:'relative', minHeight: isMobile ? 380 : 'auto' },
  mapOverlay:  { position:'absolute', top:12, right:12, zIndex:999, background:T.overlayBg, border:`1px solid ${T.border}`, borderRadius:8, padding:'8px 12px', backdropFilter:'blur(6px)', fontSize:12 },
  noSignal:    { position:'absolute', inset:0, zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', background:T.noSignalBg, borderRadius:12, pointerEvents:'none', textAlign:'center' },
  btnPrimary:  { display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border:'none', background:'#3b82f6', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:FUI },
  btnOutline:  { display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, background:'transparent', color:T.textMuted, border:`1px solid ${T.border}`, fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:FUI },
  btnDanger:   { display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 12px', borderRadius:8, border:'none', background:'#ef4444', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:FUI },
  btnSuccess:  { display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 12px', borderRadius:8, border:'none', background:'#22c55e', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:FUI },
  input:       { background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:8, padding:'8px 12px', color:T.text, fontSize:13, width:'100%', outline:'none', boxSizing:'border-box', fontFamily:FMONO },
  veil:        { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' },
  modal:       { background:T.modalBg, border:`1px solid ${T.border}`, borderRadius:12, padding:20, width:420, maxWidth:'95vw', color:T.text, fontFamily:FUI },
});

// ── Util ──────────────────────────────────────────────────────────
const nowStr   = () => new Date().toLocaleTimeString('id-ID', { hour12:false });
const fmtCoord = (v) => v != null ? v.toFixed(6) : '—';
const fmtDist  = (m) => m < 1000 ? `${m.toFixed(0)} m` : `${(m/1000).toFixed(2)} km`;

const haversine = (a, b) => {
  if (!a || !b) return 0;
  const R = 6371000, r = Math.PI/180;
  const dLat = (b.lat-a.lat)*r, dLng = (b.lng-a.lng)*r;
  const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
};

const pointInPolygon = (pt, poly) => {
  if (poly.length < 3) return false;
  let inside = false;
  const { lat:py, lng:px } = pt;
  for (let i=0, j=poly.length-1; i<poly.length; j=i++) {
    const { lng:xi, lat:yi } = poly[i], { lng:xj, lat:yj } = poly[j];
    if (((yi>py) !== (yj>py)) && (px < (xj-xi)*(py-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
};

// ── Leaflet icons ─────────────────────────────────────────────────
const gpsIcon = L.divIcon({
  className:'',
  html:`<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 5px rgba(59,130,246,.25),0 2px 8px rgba(0,0,0,.5)"></div>`,
  iconSize:[16,16], iconAnchor:[8,8], popupAnchor:[0,-10],
});
const draftIcon = L.divIcon({
  className:'',
  html:`<div style="width:14px;height:14px;background:#f59e0b;border:2px solid white;border-radius:50%;box-shadow:0 0 0 3px rgba(245,158,11,.3);cursor:grab"></div>`,
  iconSize:[14,14], iconAnchor:[7,7],
});
const savedIcon = L.divIcon({
  className:'',
  html:`<div style="width:12px;height:12px;background:#fff;border:2px solid #3b82f6;border-radius:50%;box-shadow:0 0 0 3px rgba(59,130,246,.25);cursor:grab"></div>`,
  iconSize:[12,12], iconAnchor:[6,6],
});
const deviceIcon = L.divIcon({
  className:'',
  html:`<div style="width:16px;height:16px;background:#10b981;border:3px solid white;border-radius:50%;box-shadow:0 0 0 5px rgba(16,185,129,.25),0 2px 8px rgba(0,0,0,.5)"></div>`,
  iconSize:[16,16], iconAnchor:[8,8], popupAnchor:[0,-10],
});

// ── Map sub-components ────────────────────────────────────────────
function MapUpdater({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null)
      map.setView([lat,lng], map.getZoom()<15 ? 15 : map.getZoom());
  }, [lat, lng, map]);
  return null;
}

function GeofenceDrawer({ active, onAdd }) {
  useMapEvents({ click(e) { if (active) onAdd({ lat:e.latlng.lat, lng:e.latlng.lng }); } });
  return null;
}

function DraggableVertex({ position, icon, onDrag }) {
  const ref = useRef(null);
  const handlers = useMemo(() => ({
    dragstart: () => ref.current?._map.scrollWheelZoom.disable(),
    dragend:   () => {
      const ll = ref.current?.getLatLng();
      if (ll) { onDrag({ lat:ll.lat, lng:ll.lng }); ref.current._map.scrollWheelZoom.enable(); }
    },
  }), [onDrag]);
  return <Marker ref={ref} position={[position.lat, position.lng]} icon={icon} draggable eventHandlers={handlers} />;
}

// ── Mini SVG Line Chart ───────────────────────────────────────────
function MiniChart({ data, color, height=80 }) {
  if (data.length < 2) return (
    <div style={{height,display:'flex',alignItems:'center',justifyContent:'center',
      fontSize:11,color:'#94a3b8',fontFamily:"'JetBrains Mono',monospace"}}>
      Butuh minimal 2 sampel…
    </div>
  );
  const W = 100, H = height;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v,i) => {
    const x = (i/(data.length-1))*W;
    const y = H - ((v-min)/range)*(H*0.8) - H*0.1;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height}} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round"/>
      <polyline points={`0,${H} ${pts} ${W},${H}`}
        fill={color} fillOpacity="0.1" stroke="none"/>
    </svg>
  );
}

// ── Modals ────────────────────────────────────────────────────────
function SettingsModal({ config, onSave, onClose, S }) {
  const [local, setLocal] = useState({...config});
  const set = (k,v) => setLocal(p=>({...p,[k]:v}));
  const fields = [
    ['Host','host','text'], ['Port (WebSocket)','port','number'],
    ['Username','user','text'], ['Password','pass','password'],
    ['Topic Data','topicData','text'], ['Topic Command','topicCmd','text'],
  ];
  return (
    <div style={S.veil}>
      <div style={S.modal}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <span style={{fontWeight:700,fontSize:15}}>Konfigurasi MQTT</span>
          <button style={S.btnOutline} onClick={onClose}>✕</button>
        </div>
        {fields.map(([label,key,type]) => (
          <div key={key} style={{marginBottom:12}}>
            <div style={S.label}>{label}</div>
            <input style={S.input} type={type} value={local[key]}
              onChange={e => set(key, type==='number' ? Number(e.target.value) : e.target.value)} />
          </div>
        ))}
        <div style={{display:'flex',gap:8,marginTop:16}}>
          <button style={{...S.btnPrimary,flex:1}} onClick={()=>{onSave(local);onClose();}}>Simpan & Sambungkan</button>
          <button style={S.btnOutline} onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  );
}

function FenceNameModal({ onConfirm, onCancel, S }) {
  const [name, setName] = useState('Zona 1');
  return (
    <div style={S.veil}>
      <div style={{...S.modal, width:340}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>Beri Nama Geofence</div>
        <input style={{...S.input,marginBottom:16,fontFamily:FUI}} value={name}
          onChange={e=>setName(e.target.value)} placeholder="Nama zona…" autoFocus />
        <div style={{display:'flex',gap:8}}>
          <button style={{...S.btnPrimary,flex:1}} onClick={()=>onConfirm(name||'Zona')}>Simpan</button>
          <button style={S.btnOutline} onClick={onCancel}>Batal</button>
        </div>
      </div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  host:'v9341076.ala.asia-southeast1.emqxsl.com', port:8084,
  user:'gpsta', pass:'12345678?',
  topicData:'gps/data', topicCmd:'gps/cmd',
};
const DEFAULT_POS   = { lat:-7.797068, lng:110.370529 };
const FENCE_COLORS  = ['#f59e0b','#10b981','#8b5cf6','#ef4444','#06b6d4','#f43f5e'];

// ── Responsive hook ───────────────────────────────────────────────
function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}

// ── App ───────────────────────────────────────────────────────────
export default function App() {
  // — UI state —
  const [isDark,       setIsDark]       = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [activeTab,    setActiveTab]    = useState('data');
  const [showSettings, setShowSettings] = useState(false);
  const [showNameModal,setShowNameModal]= useState(false);

  // — GPS / MQTT state —
  const [config,     setConfig]     = useState(DEFAULT_CONFIG);
  const [connStatus, setConnStatus] = useState('disconnected');
  const [position,   setPosition]   = useState(null);
  const [trail,      setTrail]      = useState([]);
  const [isPaused,   setIsPaused]   = useState(false);
  const [totalDist,  setTotalDist]  = useState(0);
  const [msgCount,   setMsgCount]   = useState(0);
  const [lastTime,   setLastTime]   = useState('—');
  const [maxTrail,   setMaxTrail]   = useState(200);
  const [logs,       setLogs]       = useState([]);

  // — Geofence state —
  const [geofences,      setGeofences]      = useState([]);
  const [isDrawing,      setIsDrawing]      = useState(false);
  const [draftPoints,    setDraftPoints]    = useState([]);
  const [fenceAlerts,    setFenceAlerts]    = useState({});
  const [breachLog,      setBreachLog]      = useState([]);

  // — Komparasi state —
  const [compActive,    setCompActive]    = useState(false);
  const [compInterval,  setCompInterval]  = useState(5);   // detik
  const [devicePos,     setDevicePos]     = useState(null);
  const [compSamples,   setCompSamples]   = useState([]);  // [{time,modLat,modLng,devLat,devLng,error}]
  const [geoError,      setGeoError]      = useState(null);
  const compTimerRef  = useRef(null);

  const clientRef  = useRef(null);
  const prevPosRef = useRef(null);
  const alertRef   = useRef({});

  // — Derived theme & styles (memoised) —
  const { w } = useWindowSize();
  const isMobile = w < 768;
  const T = THEMES[isDark ? 'dark' : 'light'];
  const S = useMemo(() => makeS(T, isMobile), [T, isMobile]);
  
  // ── Logging ─────────────────────────────────────────────────────
  const addLog = useCallback((text, type='system') =>
    setLogs(p => [{id:Date.now()+Math.random(), time:nowStr(), text, type}, ...p].slice(0,100))
  , []);

  const addBreach = useCallback((text, type) =>
    setBreachLog(p => [{id:Date.now()+Math.random(), time:nowStr(), text, type}, ...p].slice(0,50))
  , []);

  // ── Komparasi GPS ────────────────────────────────────────────────
  const takeSample = useCallback(() => {
    if (!navigator.geolocation) { setGeoError('Browser tidak support Geolocation'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const devLat = pos.coords.latitude;
        const devLng = pos.coords.longitude;
        setDevicePos({ lat:devLat, lng:devLng });
        setGeoError(null);
        setPosition(cur => {
          if (!cur) return cur;
          const err = haversine(cur, { lat:devLat, lng:devLng });
          setCompSamples(p => [...p, {
            id: Date.now(),
            time: nowStr(),
            modLat: cur.lat, modLng: cur.lng,
            devLat, devLng,
            error: err,
          }].slice(-100));
          return cur;
        });
      },
      (err) => setGeoError(`Geolocation error: ${err.message}`),
      { enableHighAccuracy:true, timeout:5000 }
    );
  }, []);

  useEffect(() => {
    if (compActive) {
      takeSample();
      compTimerRef.current = setInterval(takeSample, compInterval * 1000);
    } else {
      clearInterval(compTimerRef.current);
    }
    return () => clearInterval(compTimerRef.current);
  }, [compActive, compInterval, takeSample]);

  // ── Geofence check ───────────────────────────────────────────────
  useEffect(() => {
    if (!position) return;
    geofences.forEach(f => {
      if (!f.active || f.points.length < 3) return;
      const inside  = pointInPolygon(position, f.points);
      const prev    = alertRef.current[f.id];
      const current = inside ? 'inside' : 'outside';
      if (prev === current) return;
      alertRef.current[f.id] = current;
      setFenceAlerts(a => ({...a, [f.id]:current}));
      if (inside) {
        addBreach(`✅ Masuk zona "${f.name}"`, 'enter');
        addLog(`[Geofence] Masuk zona "${f.name}"`, 'system');
      } else if (prev !== undefined) {
        addBreach(`⚠️ Keluar zona "${f.name}"`, 'exit');
        addLog(`[Geofence] KELUAR zona "${f.name}"`, 'error');
      }
    });
  }, [position, geofences, addLog, addBreach]);

  // ── MQTT ─────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    try { if (clientRef.current?.isConnected()) clientRef.current.disconnect(); } catch(_){}
    clientRef.current = null;
    setConnStatus('disconnected');
  }, []);

  const connect = useCallback((cfg=config) => {
    disconnect();
    setConnStatus('connecting');
    addLog(`Menghubungkan ke ${cfg.host}:${cfg.port}…`, 'system');
    const client = new Paho.Client(cfg.host, Number(cfg.port),
      'web_gps_'+Math.random().toString(16).slice(2,8));

    client.onConnectionLost = ({errorMessage}) => {
      setConnStatus('disconnected');
      addLog(`Koneksi terputus: ${errorMessage}`, 'error');
    };

    client.onMessageArrived = ({destinationName, payloadString}) => {
      if (destinationName !== cfg.topicData) return;
      try {
        const {lat, lng} = JSON.parse(payloadString);
        if (typeof lat==='number' && typeof lng==='number') {
          const pos = {lat, lng};
          setPosition(pos);
          setTrail(p => [...p, pos].slice(-maxTrail));
          setTotalDist(p => p + haversine(prevPosRef.current, pos));
          prevPosRef.current = pos;
          setMsgCount(c => c+1);
          setLastTime(nowStr());
          addLog(payloadString, 'incoming');
        }
      } catch(_) { addLog(`Parse error: ${payloadString}`, 'error'); }
    };

    client.connect({
      useSSL:true, userName:cfg.user, password:cfg.pass,
      onSuccess: () => {
        setConnStatus('connected');
        addLog('Berhasil terhubung ke broker MQTT ✓', 'system');
        client.subscribe(cfg.topicData);
        addLog(`Subscribe ke "${cfg.topicData}"`, 'system');
      },
      onFailure: ({errorMessage}) => {
        setConnStatus('disconnected');
        addLog(`Gagal terhubung: ${errorMessage||'Unknown'}`, 'error');
      },
    });
    clientRef.current = client;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, disconnect, addLog, maxTrail]);

  useEffect(() => () => disconnect(), [disconnect]);

  // ── Commands ─────────────────────────────────────────────────────
  const sendCmd = (cmd, label) => {
    if (!clientRef.current?.isConnected()) { addLog('Tidak terhubung', 'error'); return; }
    const msg = new Paho.Message(cmd);
    msg.destinationName = config.topicCmd;
    clientRef.current.send(msg);
    addLog(`CMD → "${cmd}" (${label})`, 'outgoing');
  };
  const handlePause  = () => { setIsPaused(true);  sendCmd('0','PAUSE'); };
  const handleResume = () => { setIsPaused(false); sendCmd('1','RESUME'); };
  const handleReset  = () => {
    setTrail([]); setTotalDist(0); setMsgCount(0);
    prevPosRef.current=null; addLog('Data di-reset','system');
  };

  // ── Geofence actions ──────────────────────────────────────────────
  const startDraw  = () => { setDraftPoints([]); setIsDrawing(true); };
  const addVertex  = (pt) => setDraftPoints(p=>[...p,pt]);
  const undoVertex = () => setDraftPoints(p=>p.slice(0,-1));
  const cancelDraw = () => { setDraftPoints([]); setIsDrawing(false); };
  const finishDraw = () => draftPoints.length>=3 ? setShowNameModal(true) : cancelDraw();

  const saveFence = (name) => {
    const color = FENCE_COLORS[geofences.length % FENCE_COLORS.length];
    setGeofences(p=>[...p,{id:Date.now(),name,points:draftPoints,active:true,color}]);
    addLog(`Geofence "${name}" dibuat (${draftPoints.length} titik)`,'system');
    setDraftPoints([]); setIsDrawing(false); setShowNameModal(false);
  };

  const toggleFence = (id) => setGeofences(p=>p.map(f=>f.id===id?{...f,active:!f.active}:f));
  const deleteFence = (id) => {
    setGeofences(p=>p.filter(f=>f.id!==id));
    setFenceAlerts(a=>{const n={...a};delete n[id];return n;});
    delete alertRef.current[id];
  };
  const dragFenceVertex = useCallback((fenceId, idx, newPt) =>
    setGeofences(p=>p.map(f=>f.id!==fenceId?f:{
      ...f, points:f.points.map((pt,i)=>i===idx?newPt:pt)
    }))
  , []);
  const dragDraftVertex = useCallback((idx, newPt) =>
    setDraftPoints(p=>p.map((pt,i)=>i===idx?newPt:pt))
  , []);

  // ── Derived ───────────────────────────────────────────────────────
  const mapCenter    = position ? [position.lat, position.lng] : [DEFAULT_POS.lat, DEFAULT_POS.lng];
  const trailLatLngs = useMemo(() => trail.map(p=>[p.lat,p.lng]), [trail]);
  const anyBreach    = geofences.some(f=>f.active && fenceAlerts[f.id]==='outside' && alertRef.current[f.id]!==undefined);
  const insideCount  = geofences.filter(f=>f.active && fenceAlerts[f.id]==='inside').length;

  // ── Helpers for log tag styling ───────────────────────────────────
  const tagStyle = (type) => {
    const map = {incoming:T.tagIn, outgoing:T.tagOut, error:T.tagErr, system:T.tagSys};
    const t = map[type]||T.tagSys;
    return {background:t.bg, color:t.text};
  };
  const logTextColor = (type) =>
    ({incoming:T.logIn, outgoing:T.logOut, error:T.logErr})[type] || T.logSys;
  const tagLabel = (type) =>
    ({incoming:'IN', outgoing:'OUT', error:'ERR'})[type] || 'SYS';
  const connColor = connStatus==='connected'?'#22c55e':connStatus==='connecting'?'#f59e0b':'#ef4444';

  // ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      {showSettings && <SettingsModal config={config} S={S}
        onSave={c=>{setConfig(c);connect(c);}} onClose={()=>setShowSettings(false)} />}
      {showNameModal && <FenceNameModal S={S} onConfirm={saveFence}
        onCancel={()=>{setShowNameModal(false);setIsDrawing(false);setDraftPoints([]);}} />}

      {/* ── Header ── */}
      <header style={{...S.header, flexWrap:'wrap', gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button onClick={()=>setSidebarOpen(o=>!o)}
            title={sidebarOpen?'Sembunyikan sidebar':'Tampilkan sidebar'}
            style={{...S.btnOutline,padding:'6px 10px',fontSize:16,lineHeight:1}}>
            {sidebarOpen?'◀':'▶'}
          </button>
          <div style={S.logoBox}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="10" r="3"/>
              <path d="M12 21.7C8.4 17.4 4 15.5 4 10a8 8 0 0116 0c0 5.5-4.4 7.4-8 11.7z"/>
            </svg>
          </div>
          <div>
            <div style={{fontWeight:800,fontSize:16,letterSpacing:'-0.02em',lineHeight:1}}>GPS Tracker</div>
            <div style={S.subTitle}>MQTT Monitor</div>
          </div>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
          {anyBreach && (
            <div style={{background:'#450a0a',border:'1px solid #ef4444',color:'#fca5a5',
              fontSize:12,fontWeight:700,padding:'5px 12px',borderRadius:8}}>⚠ KELUAR ZONA</div>
          )}
          {insideCount>0 && !anyBreach && (
            <div style={{background:'#14532d',color:'#4ade80',fontSize:12,fontWeight:700,padding:'5px 12px',borderRadius:8}}>
              ✓ DALAM ZONA ({insideCount})
            </div>
          )}
          <div style={S.statusBadge}>
            <span style={{...S.dot, background:connColor}} />
            {!isMobile && <span style={{fontSize:12,fontWeight:600,color:connColor}}>
              {connStatus==='connected'?'Terhubung':connStatus==='connecting'?'Menghubungkan…':'Terputus'}
            </span>}
          </div>
          {isPaused && <span style={S.badgePaused}>PAUSED</span>}
          {!isPaused && connStatus==='connected' && !isMobile && <span style={S.badgeActive}>AKTIF</span>}
          <button onClick={()=>setIsDark(d=>!d)} style={{...S.btnOutline,padding:'6px 10px',fontSize:15}}>
            {isDark?'☀️':'🌙'}
          </button>
          {!isMobile && <button style={S.btnOutline} onClick={()=>setShowSettings(true)}>⚙ Pengaturan</button>}
          {isMobile && <button style={{...S.btnOutline,padding:'6px 10px'}} onClick={()=>setShowSettings(true)}>⚙</button>}
          {connStatus!=='connected'
            ? <button style={S.btnPrimary} onClick={()=>connect()}>
                {isMobile ? '▶' : 'Hubungkan'}
              </button>
            : <button style={{...S.btnOutline,color:'#ef4444',borderColor:'#7f1d1d'}} onClick={disconnect}>
                {isMobile ? '✕' : 'Putuskan'}
              </button>
          }
        </div>
      </header>

      {/* ── Body ── */}
      <div style={S.body}>

        {/* ── Sidebar ── */}
        <aside style={{...S.sidebar,...(sidebarOpen?{}:S.sidebarHide)}}>

          {/* Tabs */}
          <div style={{display:'flex',background:T.tabBg,borderRadius:10,padding:4,gap:4,flexShrink:0}}>
            {[['data','📊 Data & Log'],['geo','🔷 Geofence'],['cmp','📍 Komparasi']].map(([key,label])=>(
              <button key={key} onClick={()=>setActiveTab(key)} style={{
                flex:1, padding:'7px 0', borderRadius:7, border:'none',
                background: activeTab===key?T.tabActive:'transparent',
                color: activeTab===key?T.tabOn:T.tabOff,
                fontFamily:FUI, fontWeight:700, fontSize:12,
                letterSpacing:'0.04em', cursor:'pointer', transition:'all .15s',
                boxShadow: activeTab===key?'0 1px 3px rgba(0,0,0,.1)':'none',
              }}>{label}</button>
            ))}
          </div>

          {/* Scrollable area */}
          <div style={S.sidebarScroll}>
            {/* ── Tab: Data ── */}
            {activeTab==='data' && <>
              {/* GPS data card */}
              <div style={S.card}>
                <div style={S.secTitle}>Data GPS</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  {[['Latitude',position?.lat],['Longitude',position?.lng]].map(([lbl,val])=>(
                    <div key={lbl}>
                      <div style={S.label}>{lbl}</div>
                      <div style={{...S.val,fontSize:15,color:position?'#60a5fa':T.textFaint,fontFamily:FMONO}}>
                        {fmtCoord(val)}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={S.divider}/>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                  <div><div style={S.label}>Pesan</div><div style={{...S.val,fontSize:18,fontFamily:FMONO}}>{msgCount}</div></div>
                  <div><div style={S.label}>Jarak</div><div style={{...S.val,fontSize:13,fontFamily:FMONO}}>{fmtDist(totalDist)}</div></div>
                  <div><div style={S.label}>Update</div><div style={{fontFamily:FMONO,fontSize:12,color:T.textMuted,paddingTop:4}}>{lastTime}</div></div>
                </div>
              </div>

              {/* Control card */}
              <div style={S.card}>
                <div style={S.secTitle}>Kontrol ESP32</div>
                <div style={{display:'flex',gap:8,marginBottom:12}}>
                  <button style={{...S.btnDanger,flex:1,opacity:(connStatus!=='connected'||isPaused)?.4:1}}
                    disabled={connStatus!=='connected'||isPaused} onClick={handlePause}>⏸ Pause</button>
                  <button style={{...S.btnSuccess,flex:1,opacity:(connStatus!=='connected'||!isPaused)?.4:1}}
                    disabled={connStatus!=='connected'||!isPaused} onClick={handleResume}>▶ Resume</button>
                </div>
                <div style={S.divider}/>
                <div style={S.secTitle}>Trail ({trail.length} / {maxTrail})</div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input type="range" min="10" max="1000" step="10" value={maxTrail}
                    onChange={e=>setMaxTrail(Number(e.target.value))}
                    style={{flex:1,accentColor:'#3b82f6'}} />
                  <span style={{fontFamily:FMONO,fontSize:12,color:T.textMuted,minWidth:34}}>{maxTrail}</span>
                </div>
                <button style={{...S.btnOutline,width:'100%',marginTop:10}} onClick={handleReset}>
                  Hapus Trail & Reset Data
                </button>
              </div>

              {/* Connection info card */}
              <div style={S.card}>
                <div style={S.secTitle}>Info Koneksi</div>
                <div style={{fontFamily:FMONO,fontSize:11,lineHeight:1.9,color:T.textMuted,wordBreak:'break-all'}}>
                  {[
                    ['broker',config.host,'#3b82f6'],
                    ['port',`${config.port} (WSS)`,'#3b82f6'],
                    ['user',config.user,'#3b82f6'],
                    ['sub',config.topicData,'#60a5fa'],
                    ['pub',config.topicCmd,'#a78bfa'],
                  ].map(([k,v,c])=>(
                    <div key={k}><span style={{color:c}}>{k.padEnd(6)}</span>{v}</div>
                  ))}
                </div>
              </div>

              {/* Log card — flex:1 so it fills remaining space */}
              <div style={{...S.card,flex:1,minHeight:0,display:'flex',flexDirection:'column'}}>
                <div style={{...S.secTitle,flexShrink:0}}>Log ({logs.length})</div>
                <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
                  {logs.length===0 && (
                    <div style={{color:T.emptyText,fontSize:12,textAlign:'center',paddingTop:20}}>
                      Belum ada aktivitas…
                    </div>
                  )}
                  {logs.map(l=>(
                    <div key={l.id} style={{...S.logWrap,
                      borderLeftColor:l.type==='incoming'?'#3b82f6':l.type==='outgoing'?'#8b5cf6':l.type==='error'?'#ef4444':T.logBorder}}>
                      <span style={{...S.tag,...tagStyle(l.type)}}>{tagLabel(l.type)}</span>
                      <span style={{color:T.logTime,flexShrink:0,fontFamily:FMONO,fontSize:11}}>{l.time}</span>
                      <span style={{fontFamily:FMONO,fontSize:11,wordBreak:'break-all',color:logTextColor(l.type)}}>
                        {l.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>}

            {/* ── Tab: Geofence ── */}
            {activeTab==='geo' && <>
              {/* Draw controls */}
              <div style={S.card}>
                <div style={S.secTitle}>Buat Geofence</div>
                {!isDrawing ? (
                  <button style={{...S.btnPrimary,width:'100%',justifyContent:'center'}} onClick={startDraw}>
                    + Gambar Polygon Baru
                  </button>
                ) : (
                  <>
                    <div style={{background:'#1e3a5f',border:'1px solid #3b82f6',borderRadius:8,padding:'10px 12px',marginBottom:10}}>
                      <div style={{color:'#60a5fa',fontWeight:700,fontSize:12,marginBottom:4}}>🖱 Mode Menggambar Aktif</div>
                      <div style={{color:'#93c5fd',fontSize:11,fontFamily:FMONO}}>
                        Klik peta untuk tambah titik ({draftPoints.length} titik)
                      </div>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button style={{...S.btnPrimary,flex:1,justifyContent:'center',opacity:draftPoints.length<3?.4:1}}
                        disabled={draftPoints.length<3} onClick={finishDraw}>✓ Selesai</button>
                      <button style={{...S.btnOutline,fontSize:13}} onClick={undoVertex} title="Undo">↩</button>
                      <button style={{...S.btnOutline,color:'#ef4444',borderColor:'#7f1d1d',fontSize:13}} onClick={cancelDraw}>✕</button>
                    </div>
                  </>
                )}
              </div>

              {/* Fence list */}
              <div style={{...S.card,flex:1,minHeight:0,display:'flex',flexDirection:'column'}}>
                <div style={{...S.secTitle,flexShrink:0}}>Daftar Zona ({geofences.length})</div>
                <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:8}}>
                  {geofences.length===0 && (
                    <div style={{color:T.emptyText,fontSize:12,textAlign:'center',paddingTop:20}}>
                      Belum ada geofence.<br/>Klik "+ Gambar Polygon Baru"
                    </div>
                  )}
                  {geofences.map(f=>{
                    const status = fenceAlerts[f.id];
                    return (
                      <div key={f.id} style={{background:T.fenceCard,borderRadius:8,padding:'10px 12px',
                        border:`1px solid ${f.active?f.color+'55':T.border}`}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:10,height:10,borderRadius:2,background:f.color,flexShrink:0}}/>
                            <span style={{fontWeight:700,fontSize:13,color:f.active?T.text:T.textMuted}}>{f.name}</span>
                          </div>
                          <div style={{display:'flex',gap:6}}>
                            <button style={{...S.iconBtn,color:f.active?'#22c55e':T.textMuted,fontSize:14}}
                              onClick={()=>toggleFence(f.id)} title={f.active?'Nonaktifkan':'Aktifkan'}>
                              {f.active?'●':'○'}
                            </button>
                            <button style={{...S.iconBtn,color:'#ef4444',fontSize:14}}
                              onClick={()=>deleteFence(f.id)} title="Hapus">✕</button>
                          </div>
                        </div>
                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                          <span style={{fontFamily:FMONO,fontSize:10,color:T.textMuted}}>{f.points.length} titik</span>
                          {f.active && status && (
                            <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,
                              background:status==='inside'?'#14532d':'#450a0a',
                              color:status==='inside'?'#4ade80':'#f87171'}}>
                              {status==='inside'?'✓ DALAM':'⚠ LUAR'}
                            </span>
                          )}
                          {f.active && !status && position && (
                            <span style={{fontSize:10,color:T.textMuted,fontFamily:FMONO}}>mendeteksi…</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Alert history */}
              <div style={{...S.card,flexShrink:0}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <div style={S.secTitle}>Alert History ({breachLog.length})</div>
                  {breachLog.length>0 && (
                    <button style={{...S.iconBtn,color:T.textMuted,fontSize:11}} onClick={()=>setBreachLog([])}>Hapus</button>
                  )}
                </div>
                <div style={{maxHeight:140,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
                  {breachLog.length===0 && <div style={{color:T.emptyText,fontSize:11,fontFamily:FMONO}}>Tidak ada alert</div>}
                  {breachLog.map(a=>(
                    <div key={a.id} style={{fontFamily:FMONO,fontSize:11,display:'flex',gap:8,
                      color:a.type==='enter'?'#4ade80':'#fca5a5'}}>
                      <span style={{color:T.logTime,flexShrink:0}}>{a.time}</span>
                      <span>{a.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>}

            {/* ── Tab: Komparasi ── */}
            {activeTab==='cmp' && (() => {
              const errors    = compSamples.map(s=>s.error);
              const avgErr    = errors.length ? errors.reduce((a,b)=>a+b,0)/errors.length : 0;
              const maxErr    = errors.length ? Math.max(...errors) : 0;
              const minErr    = errors.length ? Math.min(...errors) : 0;
              // CEP: median error
              const sorted    = [...errors].sort((a,b)=>a-b);
              const cep       = sorted.length ? sorted[Math.floor(sorted.length/2)] : 0;
              return <>
                {/* Control card */}
                <div style={S.card}>
                  <div style={S.secTitle}>Pengaturan Komparasi</div>
                  {geoError && (
                    <div style={{background:'#450a0a',border:'1px solid #ef4444',borderRadius:8,
                      padding:'8px 10px',marginBottom:10,fontSize:11,color:'#fca5a5',fontFamily:FMONO}}>
                      {geoError}
                    </div>
                  )}
                  <div style={S.label}>Interval Sampel (detik)</div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,marginTop:4}}>
                    <input type="range" min="1" max="60" step="1" value={compInterval}
                      onChange={e=>setCompInterval(Number(e.target.value))}
                      style={{flex:1,accentColor:'#3b82f6'}} disabled={compActive}/>
                    <span style={{fontFamily:FMONO,fontSize:12,color:T.textMuted,minWidth:28}}>{compInterval}s</span>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>setCompActive(a=>!a)} disabled={!position}
                      style={{...( compActive ? S.btnDanger : S.btnSuccess ),
                        flex:1, justifyContent:'center',
                        opacity:!position?.5:1}}>
                      {compActive ? '⏹ Stop' : '▶ Mulai'}
                    </button>
                    <button style={{...S.btnOutline,fontSize:12}}
                      onClick={()=>{setCompSamples([]);setDevicePos(null);}}
                      title="Reset data">↺ Reset</button>
                  </div>
                  {!position && (
                    <div style={{fontSize:11,color:T.textMuted,marginTop:8,textAlign:'center'}}>
                      Hubungkan modul GPS terlebih dahulu
                    </div>
                  )}
                </div>

                {/* Stat cards */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[
                    ['Sampel', compSamples.length, '', '#3b82f6'],
                    ['Rata-rata Error', avgErr.toFixed(2), 'm', '#f59e0b'],
                    ['CEP (Median)', cep.toFixed(2), 'm', '#8b5cf6'],
                    ['Min / Max', `${minErr.toFixed(1)} / ${maxErr.toFixed(1)}`, 'm', '#10b981'],
                  ].map(([lbl,val,unit,color])=>(
                    <div key={lbl} style={{...S.card,padding:10}}>
                      <div style={{...S.label,marginBottom:4}}>{lbl}</div>
                      <div style={{fontFamily:FMONO,fontWeight:700,fontSize:15,color}}>
                        {val}<span style={{fontSize:11,color:T.textMuted,fontWeight:400}}> {unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div style={S.card}>
                  <div style={S.secTitle}>Error Over Time</div>
                  <MiniChart data={errors} color="#3b82f6" height={80}/>
                  <div style={{display:'flex',justifyContent:'space-between',
                    fontSize:10,color:T.textMuted,fontFamily:FMONO,marginTop:4}}>
                    <span>← sampel pertama</span><span>terbaru →</span>
                  </div>
                </div>

                {/* Posisi device saat ini */}
                <div style={S.card}>
                  <div style={S.secTitle}>Posisi Device (Referensi)</div>
                  {devicePos ? (
                    <div style={{fontFamily:FMONO,fontSize:12,lineHeight:2,color:T.textMuted}}>
                      <div><span style={{color:'#10b981'}}>lat </span>{devicePos.lat.toFixed(6)}</div>
                      <div><span style={{color:'#10b981'}}>lng </span>{devicePos.lng.toFixed(6)}</div>
                    </div>
                  ) : (
                    <div style={{fontSize:11,color:T.emptyText}}>Belum ada data device…</div>
                  )}
                </div>

                {/* Tabel log */}
                <div style={{...S.card,flex:1,minHeight:0,display:'flex',flexDirection:'column'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexShrink:0}}>
                    <div style={S.secTitle}>Log Sampel ({compSamples.length})</div>
                    {compSamples.length>0 && (
                      <button style={{...S.btnPrimary,padding:'4px 10px',fontSize:11}}
                        onClick={()=>{
                          const header = 'No,Waktu,Modul Lat,Modul Lng,Device Lat,Device Lng,Error (m)\n';
                          const rows = compSamples.map((s,i)=>
                            `${i+1},${s.time},${s.modLat.toFixed(6)},${s.modLng.toFixed(6)},${s.devLat.toFixed(6)},${s.devLng.toFixed(6)},${s.error.toFixed(4)}`
                          ).join('\n');
                          const a = document.createElement('a');
                          a.href = URL.createObjectURL(new Blob([header+rows],{type:'text/csv'}));
                          a.download = `gps_comparison_${Date.now()}.csv`;
                          a.click();
                        }}>
                        ⬇ CSV
                      </button>
                    )}
                  </div>
                  <div style={{flex:1,overflowY:'auto',minHeight:0}}>
                    {compSamples.length===0 && (
                      <div style={{color:T.emptyText,fontSize:11,textAlign:'center',paddingTop:16}}>
                        Belum ada sampel…
                      </div>
                    )}
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:10,fontFamily:FMONO}}>
                      <thead>
                        <tr style={{color:T.textMuted,borderBottom:`1px solid ${T.border}`}}>
                          {['#','Waktu','Mod Lat','Mod Lng','Dev Lat','Dev Lng','Error'].map(h=>(
                            <th key={h} style={{padding:'4px 6px',textAlign:'left',fontWeight:600,
                              position:'sticky',top:0,background:T.surface}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...compSamples].reverse().map((s,i)=>(
                          <tr key={s.id} style={{borderBottom:`1px solid ${T.border}`,
                            color: s.error<5?'#22c55e':s.error<15?'#f59e0b':'#ef4444'}}>
                            <td style={{padding:'4px 6px',color:T.textMuted}}>{compSamples.length-i}</td>
                            <td style={{padding:'4px 6px',color:T.textMuted}}>{s.time}</td>
                            <td style={{padding:'4px 6px'}}>{s.modLat.toFixed(5)}</td>
                            <td style={{padding:'4px 6px'}}>{s.modLng.toFixed(5)}</td>
                            <td style={{padding:'4px 6px'}}>{s.devLat.toFixed(5)}</td>
                            <td style={{padding:'4px 6px'}}>{s.devLng.toFixed(5)}</td>
                            <td style={{padding:'4px 6px',fontWeight:700}}>{s.error.toFixed(2)}m</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>;
            })()}

          </div>
        </aside>

        {/* ── Map ── */}
        {/* ── Map ── */}
        <div style={S.mapWrap}>
          <div style={{
            height:'100%', width:'100%',
            filter: T.isDark ? 'invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9)' : 'none',
            borderRadius:12, overflow:'hidden'
          }}>

          <MapContainer center={mapCenter} zoom={13} style={{height:'100%',width:'100%',borderRadius:12}}>
            <TileLayer key={T.tile} url={T.tile}
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
              maxZoom={19} />
            
            {trailLatLngs.length>1 && <Polyline positions={trailLatLngs} color="#3b82f6" weight={2} opacity={0.7} />}

            {position && (
              <Marker position={[position.lat,position.lng]} icon={gpsIcon}>
                <Popup><b>Posisi GPS</b><br/>Lat: {fmtCoord(position.lat)}<br/>Lng: {fmtCoord(position.lng)}</Popup>
              </Marker>
            )}

            {/* Device marker — tampil saat komparasi aktif */}
            {compActive && devicePos && (
              <Marker position={[devicePos.lat,devicePos.lng]} icon={deviceIcon}>
                <Popup>
                  <b>Posisi Device</b><br/>
                  Lat: {fmtCoord(devicePos.lat)}<br/>
                  Lng: {fmtCoord(devicePos.lng)}<br/>
                  {compSamples.length>0 && (
                    <>Error terakhir: <b>{compSamples[compSamples.length-1].error.toFixed(2)} m</b></>
                  )}
                </Popup>
              </Marker>
            )}

            {/* Saved geofences */}
            {geofences.map(f => f.points.length>=3 && (
              <React.Fragment key={f.id}>
                <Polygon positions={f.points.map(p=>[p.lat,p.lng])} pathOptions={{
                  color:f.color, fillColor:f.color,
                  fillOpacity:f.active?.12:.04,
                  opacity:f.active?.8:.3,
                  weight:f.active?2:1,
                  dashArray:f.active?null:'6,4',
                }}/>
                {activeTab==='geo' && f.points.map((pt,i)=>(
                  <DraggableVertex key={`${f.id}-${i}`} position={pt} icon={savedIcon}
                    onDrag={(np) => dragFenceVertex(f.id, i, np)} />
                ))}
              </React.Fragment>
            ))}

            {isDrawing && draftPoints.length>=2 && (
              <Polygon positions={draftPoints.map(p=>[p.lat,p.lng])}
                pathOptions={{color:'#f59e0b',fillColor:'#f59e0b',fillOpacity:.1,weight:2,dashArray:'6,4'}}/>
            )}
            {isDrawing && draftPoints.map((pt,i)=>(
              <DraggableVertex key={i} position={pt} icon={draftIcon}
                onDrag={(np) => dragDraftVertex(i, np)} />
            ))}

            <GeofenceDrawer active={isDrawing} onAdd={addVertex} />
            {position && !isDrawing && <MapUpdater lat={position.lat} lng={position.lng} />}
          </MapContainer>
          </div>

          {/* Koordinat overlay */}
          <div style={S.mapOverlay}>
            <div style={S.label}>Titik terakhir</div>
            <div style={{fontFamily:FMONO,color:position?'#60a5fa':T.textFaint,fontSize:12}}>
              {position?`${fmtCoord(position.lat)}, ${fmtCoord(position.lng)}`:'Menunggu sinyal…'}
            </div>
          </div>

          {/* Drawing hint */}
          {isDrawing && (
            <div style={{position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',zIndex:999,
              background:'rgba(245,158,11,.15)',border:'1px solid rgba(245,158,11,.4)',borderRadius:8,
              padding:'8px 16px',backdropFilter:'blur(4px)',color:'#fbbf24',fontSize:12,
              fontWeight:700,whiteSpace:'nowrap',fontFamily:FUI}}>
              🖱 Klik peta · {draftPoints.length} titik{draftPoints.length>=3?' · Klik "Selesai" di sidebar':''}
            </div>
          )}

          {/* No signal */}
          {!position && !isDrawing && (
            <div style={S.noSignal}>
              <div style={{fontSize:36,marginBottom:8}}>📡</div>
              <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>
                {connStatus==='connected'?'Menunggu data GPS…':'Tidak terhubung ke broker'}
              </div>
              <div style={{fontSize:12,color:T.textMuted}}>
                {connStatus==='connected'?`Subscribe ke "${config.topicData}"`:'Klik "Hubungkan" untuk memulai'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
