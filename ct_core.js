// ct_core.js — Celestus Tools Core (v1.3)
(() => {
    if (window.CT && window.CT.__ready) return;

    const CT = {};
    const ZBASE = 2147483000;
    let zcursor = ZBASE;

    // ---------- Utils ----------
    CT.num = { to(v){ if (v==null || v==='') return 0; const n=Number(String(v).replace(',', '.')); return Number.isFinite(n)?n:0; } };
    CT.units = { factor(u){ switch(String(u||'').trim()){ case'u':return 1; case'k':return 1e3; case'M':return 1e6; case'G':return 1e9; case'T':return 1e12; default:return 1; } } };
    CT.fmt = {
        abbr(n){ if(!Number.isFinite(n))return''; const sign=n<0?'-':''; n=Math.abs(n); const u=['','k','M','G','T']; let i=0; while(n>=1e3 && i<u.length-1){ n/=1e3; i++; }
            const v = n>=100?Math.round(n):(n>=10?Math.round(n*10)/10:Math.round(n*100)/100); return `${sign}${v}${u[i]}`; },
        pct(x){ return `${Math.round((x||0)*1000)/10}%`; },
        duration(ms){ ms=Math.max(0,Math.floor(ms||0)); const s=Math.floor(ms/1000); const d=Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60), ss=s%60;
            const p=[]; if(d)p.push(`${d}j`); if(h)p.push(`${h}h`); if(m)p.push(`${m}min`); p.push(`${ss}s`); return p.join(' '); }
    };

    // ---------- Assets ----------
    CT.ico = {
        M:'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResM.png',
        T:'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResT.png',
        P:'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResP.png',
        H:'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/ResH.png',
        TC:'https://horizon.celestus.fr/CelestusV2/Interface/Skin/Icones/TC.png'
    };
    CT.thumb = id => `https://horizon.celestus.fr/CelestusV2/Interface/Decors/Planetes/thumbnails/${id}.png`;

    // ---------- Storage ----------
    const NS='ct:';
    CT.store = {
        get(k, def=null){ try{ const v=localStorage.getItem(NS+k); return v==null?def:JSON.parse(v); }catch{ return def; } },
        set(k, val){ try{ localStorage.setItem(NS+k, JSON.stringify(val)); }catch{} }
    };

    // ---------- Export ----------
    CT.export = {
        csv(name, headers, rows, getter){
            const esc=s=>`"${String(s??'').replace(/"/g,'""')}"`;
            const keys=headers.map(h=>h.key);
            const head=headers.map(h=>esc(h.label||'')).join(';');
            const body=rows.map(r=>keys.map(k=>esc(getter(r,k))).join(';')).join('\n');
            const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([head+'\n'+body],{type:'text/csv'}));
            a.download=`${name||'export'}.csv`; a.click(); URL.revokeObjectURL(a.href);
        },
        json(name, obj){
            const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));
            a.download=`${name||'data'}.json`; a.click(); URL.revokeObjectURL(a.href);
        }
    };

    // ---------- Observe ----------
    CT.observe = function(getter, onChange, opts={}){
        const interval = Math.max(250, Number(opts.interval)||2000);
        const deep = opts.signature==='deep';
        const sigOf = v=>{
            try{
                if(!v) return 'null';
                if(deep) return JSON.stringify(v);
                const o={}; Object.keys(v).forEach(k=>{ const t=typeof v[k]; o[k]=(t==='object'||t==='function')?t:v[k]; });
                return JSON.stringify(o);
            }catch{ return String(v); }
        };
        let last = sigOf(getter());
        const id=setInterval(()=>{ const now=sigOf(getter()); if(now!==last){ last=now; try{ onChange(); }catch{} } }, interval);
        return ()=>clearInterval(id);
    };

    // ---------- Styles ----------
    const CORE_CSS = `
  .ct-win{position:fixed;background:#0f1422;color:#eaeefc;font:13px/1.3 system-ui,Segoe UI,Arial;z-index:${ZBASE};
    border:1px solid #263251;border-radius:12px;display:flex;flex-direction:column;resize:both;overflow:hidden;
    box-shadow:0 12px 40px rgba(0,0,0,.45)}
  .ct-head{background:#151c2f;padding:6px 8px;border-bottom:1px solid #263251;display:flex;justify-content:space-between;align-items:center}
  .ct-title{font-weight:700;letter-spacing:.2px}
  .ct-actions{display:flex;gap:6px;align-items:center}
  .ct-ibtn{width:24px;height:24px;border-radius:7px;background:#222b44;border:1px solid #2a365a;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
  .ct-ibtn:hover{background:#2a365a}
  .ct-ibtn svg{width:14px;height:14px;stroke:#fff}
  .ct-body{flex:1;overflow:auto;padding:10px}
  .ct-body::-webkit-scrollbar{width:8px;height:8px;background:transparent}
  .ct-body::-webkit-scrollbar-thumb{background:#1b2440;border-radius:8px}
  .ct-noscroll{overflow:hidden}

  /* helpers */
  .ct-row{display:flex;gap:10px;align-items:center;margin:8px 0}
  .ct-label{opacity:.9;font-size:12px;min-width:70px}

  /* group & button (look de tes captures) */
  .ct-igroup{display:flex;align-items:center;background:#0b1120;border:1px solid #223051;border-radius:12px;overflow:hidden;width:100%;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.04);}
  .ct-igroup input{flex:1;min-width:0;border:0;background:transparent;color:#eaeefc;padding:8px 12px;outline:none}
  .ct-igroup select{border:0;border-left:1px solid #223051;background:transparent;color:#eaeefc;padding:8px 10px;outline:none;width:54px;appearance:none;text-align:center}

  .ct-pill{display:inline-flex;align-items:center;gap:6px;background:#0b1120;border:1px solid #223051;border-radius:12px;padding:6px 10px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.04);}
  .ct-pill img{width:14px;height:14px}

  .ct-btn{border-radius:999px;border:1px solid #2a4b7a;padding:10px 16px;cursor:pointer}
  .ct-btn-primary{background:#243358;color:#eaeefc;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 1px 1px rgba(0,0,0,.2)}
  .ct-btn-primary:hover{background:#2a4b7a}
  `;
    const styleEl=document.createElement('style'); styleEl.textContent=CORE_CSS; document.head.appendChild(styleEl);

    // ---------- Icons ----------
    const SVG = {
        close:`<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>`,
        minimize:`<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
        refresh:`<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <polyline points="23 4 23 10 17 10"></polyline>
               <polyline points="1 20 1 14 7 14"></polyline>
               <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10"></path>
               <path d="M20.49 15a9 9 0 0 1-14.13 3.36L1 14"></path>
             </svg>`
    };

    // ---------- Window manager ----------
    CT.win = {
        create(opts){
            const w = Math.max(220, Number(opts?.size?.[0]||320));
            const h = Math.max(44,  Number(opts?.size?.[1]||180));
            const x = Number(opts?.pos?.[0]||40);
            const y = Number(opts?.pos?.[1]||40);

            const root=document.createElement('div'); root.className='ct-win';
            if (opts?.className) root.classList.add(opts.className);
            root.style.width=w+'px'; root.style.height=h+'px'; root.style.left=x+'px'; root.style.top=y+'px'; root.style.zIndex=++zcursor;

            const head=document.createElement('div'); head.className='ct-head';
            const title=document.createElement('div'); title.className='ct-title'; title.textContent=opts?.title||'Fenêtre';
            const actions=document.createElement('div'); actions.className='ct-actions';

            // minimize option
            let btnMin = null;
            if (opts?.minimize !== false){
                btnMin=document.createElement('button'); btnMin.className='ct-ibtn'; btnMin.title='Réduire'; btnMin.innerHTML=SVG.minimize;
                actions.append(btnMin);
            }
            const btnClose=document.createElement('button'); btnClose.className='ct-ibtn'; btnClose.title='Fermer'; btnClose.innerHTML=SVG.close;
            actions.append(btnClose); head.append(title, actions);

            const body=document.createElement('div'); body.className='ct-body'; if (opts?.scroll === 'hidden') body.classList.add('ct-noscroll');

            root.append(head, body); document.body.appendChild(root);

            // focus
            root.addEventListener('mousedown',()=>{ root.style.zIndex=++zcursor; });

            // drag
            let drag=false,dx=0,dy=0;
            head.addEventListener('mousedown',e=>{
                if(e.target.closest('button')) return;
                drag=true; const r=root.getBoundingClientRect(); dx=e.clientX-r.left; dy=e.clientY-r.top; e.preventDefault();
            });
            document.addEventListener('mousemove',e=>{
                if(!drag) return;
                const left=Math.min(window.innerWidth-root.offsetWidth-8, Math.max(8, e.clientX-dx));
                const top =Math.min(window.innerHeight-root.offsetHeight-8,Math.max(8, e.clientY-dy));
                root.style.left=left+'px'; root.style.top=top+'px';
            });
            document.addEventListener('mouseup',()=>drag=false);

            function clamp(){
                const r=root.getBoundingClientRect();
                const maxW=Math.max(240,window.innerWidth-r.left-8);
                const maxH=Math.max(140,window.innerHeight-r.top-8);
                if(r.width>maxW) root.style.width=`${maxW}px`;
                if(r.height>maxH) root.style.height=`${maxH}px`;
            }
            if(window.ResizeObserver){ new ResizeObserver(clamp).observe(root); }
            window.addEventListener('resize',clamp);

            // minimize/restore
            let minimized=false; const saved={w:'',h:'',l:'',t:''};
            function minimize(){
                if(minimized) return;
                const r=root.getBoundingClientRect();
                saved.w=root.style.width; saved.h=root.style.height; saved.l=root.style.left; saved.t=root.style.top;
                root.style.width='260px'; root.style.height='40px';
                root.style.left=Math.max(8,Math.min(r.left,window.innerWidth-268))+'px';
                root.style.top =Math.max(8,Math.min(r.top ,window.innerHeight-48))+'px';
                body.style.display='none'; minimized=true;
            }
            function restore(){
                if(!minimized) return;
                root.style.width=saved.w||''; root.style.height=saved.h||'';
                root.style.left=saved.l||'';  root.style.top=saved.t||'';
                body.style.display=''; minimized=false; clamp();
            }
            if (btnMin) btnMin.onclick = ()=> minimized ? restore() : minimize();

            // onClose hooks + API
            const closeHooks = [];
            function onClose(cb){ if (typeof cb === 'function') closeHooks.push(cb); }
            function close(){
                try{ closeHooks.forEach(fn=>{ try{ fn(); }catch{} }); }finally{ root.remove(); }
            }
            btnClose.onclick=close;

            function addButton(kind, title, onClick){
                const b=document.createElement('button'); b.className='ct-ibtn'; b.title=title||kind;
                b.innerHTML=(kind==='refresh')?SVG.refresh:SVG.minimize; b.onclick=onClick||null;
                actions.insertBefore(b, btnClose); return b;
            }

            function setSize(w,h){ root.style.width=w+'px'; root.style.height=h+'px'; }

            return { root, head, body, titleEl:title, actionsEl:actions, addButton, minimize, restore, close, onClose, setSize,
                bringToFront(){ root.style.zIndex=++zcursor; } };
        }
    };

    CT.__ready = true;
    window.CT = CT;
})();
