// Hero wallpaper: the eye in a drifting, dithered panel field. From Ori_Wall.html.
(() => {
  const cv = document.getElementById('wallpaper');
  if(!cv) return;
  const ctx = cv.getContext('2d');
  const off = document.createElement('canvas');
  const octx = off.getContext('2d');

  // ---- held parameters ---------------------------------------------------
  const BLOCK  = 2;       // dither block size in CSS pixels
  const CSTEP  = 4;       // cloud is sampled every CSTEP shading cells

  // Dither blocks per shading cell. The dither always runs at BLOCK, so the
  // grain never changes; this only trades geometric detail for speed, and it
  // self-tunes to the screen and the machine.
  let   RSCALE   = 3;
  const RS_MIN   = 2, RS_MAX = 5;
  const BUDGET   = 12;    // target frame cost in ms

  const SIZE   = 0.42;    // figure radius vs the short side; bands reach 1.12x
  const FIG    = 0.90;    // how present the figure is
  const EYE_GAIN  = 1.55; // the eyeball, relative to the bands
  const IRIS_GAIN = 0.78; // the iris, relative to the sclera. An eye reads
                          // as an eye when sclera > iris > pupil, in that order.
  const FACE_FLOOR= 0.35; // lifts the sphere's unlit faces out of the dark
  const FIELD  = 0.26;    // brightness of the panel field on its own
  const FIELD_OVER = 0.30;// how much field shows THROUGH the figure. The field
                          // must not simply add on top of it, or the pupil and
                          // the shadowed side fill in and the eye goes flat.
  const SPIN   = 0.055;   // the whole assembly, very slow
  const BAND_RATE = 1.0;  // how fast the rings tumble, as a multiplier

  // ---- gaze --------------------------------------------------------------
  // It does not drift: it fixates, jumps, and fixates again. And it does not
  // do that constantly. Most of the time it rests, almost still; now and then
  // it wakes into a bout of scanning and works over a region, then settles.
  const SCAN    = 0.30;                   // how wide it ranges when scanning
  const FIX_MIN = 0.14, FIX_MAX = 0.80;   // seconds held between jumps
  const REGION  = 2.2;                    // seconds before it moves on
  const REST    = 9.0, REST_VAR = 13.0;   // seconds of stillness between bouts
  const BOUT    = 2.6, BOUT_VAR = 4.0;    // seconds a scanning bout lasts
  const RATE   = 0.55;    // cycle rate of the churn
  const EYE_R  = 0.55;

  // 'chroma' = the full split: all three channels run on equal footing and
  //            resolve to pure R/G/B, so mid tones fracture into colour.
  // 'red'    = R clears its threshold first and G/B lag, so the field reads
  //            red and the chroma only leaks through where it is bright.
  const PALETTE = 'chroma';
  const P = PALETTE==='red'
    ? {CR:236, CG:94,  CB:116, GW:0.30, BW:0.24, OFF:0.20}
    : {CR:255, CG:255, CB:255, GW:1.00, BW:1.00, OFF:0.20};
  const {CR,CG,CB,GW,BW,OFF}=P;

  // ---- the drifting panels ----------------------------------------------
  // sized in CSS pixels, so they stay put when BLOCK changes
  const PANEL_PX  = 55;
  const PANEL_PY  = 40;
  const PANEL_AMT = 0.38;  // how hard they modulate the figure
  const PANEL_RATE= 0.085; // how fast each panel breathes
  const PANEL_DX  = 2.6;   // drift, CSS pixels per second
  const PANEL_DY  = -1.1;

  // ---- the cloud ---------------------------------------------------------
  const CLOUD_PX    = 0.0055; // cloud frequency, per CSS pixel
  const CLOUD_DRIFT = 0.0052;
  const CLOUD_BIAS  = 0.38;   // lower keeps more of the figure intact
  const CLOUD_HARD  = 1.35;
  const VIGNETTE    = 1.25;

  // ---- blooms ------------------------------------------------------------
  const BLOOMS = [
    {r:0.34, a:0.72, p1:0.021, p2:0.013, ph:0.0},
    {r:0.26, a:0.58, p1:0.016, p2:0.024, ph:2.3},
    {r:0.44, a:0.40, p1:0.011, p2:0.009, ph:4.1}
  ];

  const A = {amp:.3, den:.6, flow:.6, turb:1};

  let gw=0, gh=0, img=null, buf32=null, buf8=null;      // dither grid
  let rw=0, rh=0, depth=null, val=null, chb=null, fieldB=null;  // shading grid
  let cw=0, ch=0, cbuf=null;                            // coarse cloud grid
  let R=0, cxg=0, cyg=0, G=70;

  // ---- 8x8 Bayer ---------------------------------------------------------
  // three pre-rotated copies, so the dither loop does three plain array reads
  // instead of recomputing the rotated indices per pixel per channel
  const TR=new Float32Array(64), TG=new Float32Array(64), TB=new Float32Array(64);
  (function(){
    const m=[0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,
             60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,
             15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
    const B=new Float32Array(64);
    for(let i=0;i<64;i++) B[i]=(m[i]+0.5)/64;
    for(let i=0;i<64;i++){ TR[i]=B[i]; TG[i]=B[(i+21)&63]; TB[i]=B[(i+42)&63]; }
  })();

  // gamma as a lookup: at a fine BLOCK this runs on every pixel, and Math.pow
  // there costs more than everything else in the frame put together
  const GAM=new Float32Array(1025);
  for(let i=0;i<=1024;i++) GAM[i]=Math.pow(i/1024, 0.90);

  // ---- value noise -------------------------------------------------------
  function h3(i,j,k){
    let n = Math.imul(i|0,374761393) ^ Math.imul(j|0,668265263) ^ Math.imul(k|0,1442695041);
    n = Math.imul(n ^ (n>>>13), 1274126177);
    return ((n ^ (n>>>16))>>>0) * 2.3283064365386963e-10;
  }
  function noise3(x,y,z){
    const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
    let fx=x-xi, fy=y-yi, fz=z-zi;
    fx=fx*fx*(3-2*fx); fy=fy*fy*(3-2*fy); fz=fz*fz*(3-2*fz);
    const c000=h3(xi,yi,zi),     c100=h3(xi+1,yi,zi),
          c010=h3(xi,yi+1,zi),   c110=h3(xi+1,yi+1,zi),
          c001=h3(xi,yi,zi+1),   c101=h3(xi+1,yi,zi+1),
          c011=h3(xi,yi+1,zi+1), c111=h3(xi+1,yi+1,zi+1);
    const x00=c000+(c100-c000)*fx, x10=c010+(c110-c010)*fx,
          x01=c001+(c101-c001)*fx, x11=c011+(c111-c011)*fx;
    const y0=x00+(x10-x00)*fy, y1=x01+(x11-x01)*fy;
    return y0+(y1-y0)*fz;
  }
  function fbm(x,y,z){
    let v=noise3(x,y,z)*0.5;
    v+=noise3(x*2.03+7.1, y*2.03-3.4, z*2.03+1.7)*0.29;
    v+=noise3(x*4.11-5.3, y*4.11+9.2, z*4.11-2.6)*0.15;
    return v*1.064;
  }

  // ---- eyeball shell -----------------------------------------------------
  // Sized to roughly cover the visible hemisphere's cells at the shading
  // resolution. More than that is paid for every frame and never seen.
  const NPT=46000;
  const PT=new Float32Array(NPT*3), ORDER=new Uint32Array(NPT);
  // The two fbm lookups per point are the most expensive thing in the frame,
  // so each point's fluid value is cached and half of them are refreshed per
  // frame. The churn moves far too slowly for a one-frame lag to show.
  const FCACHE=new Float32Array(NPT);
  let fslice=0, fwarm=3;
  (function(){
    const ga=Math.PI*(3-Math.sqrt(5));
    for(let i=0;i<NPT;i++){
      const y=1-2*(i+0.5)/NPT, r=Math.sqrt(Math.max(0,1-y*y)), th=i*ga;
      PT[i*3]=Math.cos(th)*r; PT[i*3+1]=y; PT[i*3+2]=Math.sin(th)*r;
      ORDER[i]=i;
    }
    let seed=0x9e3779b9;
    const rnd=()=>{ seed=Math.imul(seed^(seed>>>15),0x2545f491); return ((seed>>>0)%1000000)/1000000; };
    for(let i=NPT-1;i>0;i--){ const j=(rnd()*(i+1))|0; const t=ORDER[i]; ORDER[i]=ORDER[j]; ORDER[j]=t; }
  })();

  // ---- the bands ---------------------------------------------------------
  // type 0 = smooth twisting ribbon, 1 = ribbon carrying a braided lattice.
  // seg and wid are not listed: they are derived from the voxel scale each
  // frame, so the straps stay solid at any grid size.
  // rx/ry/rz are each band's own tumble rate about the three axes. They are
  // mutually incommensurate, so the seven never fall into step with one
  // another and the weave never repeats.
  const BANDS = [
    {r:0.74, w:0.085, type:0, twist:1.0, ph:0.0, rx:0.061, ry:0.043, rz:0.028, a:0.4,b:1.1,c:0.2, nd:0},
    {r:0.80, w:0.060, type:1, twist:2.0, ph:0.9, rx:0.035, ry:0.070, rz:0.049, a:1.9,b:0.3,c:1.4, nd:52},
    {r:0.88, w:0.095, type:0, twist:1.0, ph:2.1, rx:0.074, ry:0.026, rz:0.058, a:2.7,b:1.8,c:0.6, nd:0},
    {r:0.94, w:0.058, type:1, twist:3.0, ph:1.3, rx:0.024, ry:0.062, rz:0.081, a:0.8,b:2.4,c:2.9, nd:58},
    {r:1.00, w:0.080, type:0, twist:2.0, ph:3.0, rx:0.067, ry:0.055, rz:0.019, a:1.2,b:0.7,c:1.9, nd:0},
    {r:1.06, w:0.055, type:1, twist:2.0, ph:0.4, rx:0.047, ry:0.033, rz:0.072, a:2.2,b:2.9,c:0.9, nd:62},
    {r:1.12, w:0.070, type:0, twist:1.0, ph:1.7, rx:0.030, ry:0.078, rz:0.040, a:0.1,b:1.5,c:2.4, nd:0}
  ];
  const BM = BANDS.map(()=>new Float32Array(9));
  function buildBandMatrix(o,a,b,c){
    const ca=Math.cos(a), sa=Math.sin(a), cb=Math.cos(b), sb=Math.sin(b),
          cc=Math.cos(c), sc=Math.sin(c);
    o[0]=cc*cb; o[1]=cc*sb*sa-sc*ca; o[2]=cc*sb*ca+sc*sa;
    o[3]=sc*cb; o[4]=sc*sb*sa+cc*ca; o[5]=sc*sb*ca-cc*sa;
    o[6]=-sb;   o[7]=cb*sa;          o[8]=cb*ca;
  }

  // ---- layout ------------------------------------------------------------
  let CELL_PX=BLOCK*RSCALE;                 // shading cell, in CSS pixels
  let TXW=new Float32Array(RSCALE);
  function setScale(n){
    RSCALE=n; CELL_PX=BLOCK*RSCALE;
    TXW=new Float32Array(RSCALE);
    for(let i=0;i<RSCALE;i++) TXW[i]=i/RSCALE;
    resize();
  }
  function resize(){
    const W=cv.clientWidth||innerWidth, H=cv.clientHeight||innerHeight;
    cv.width=W; cv.height=H;
    gw=Math.max(8,Math.ceil(W/BLOCK));
    gh=Math.max(8,Math.ceil(H/BLOCK));
    off.width=gw; off.height=gh;
    img=octx.createImageData(gw,gh);
    const ab=new ArrayBuffer(gw*gh*4);
    buf32=new Uint32Array(ab); buf8=new Uint8ClampedArray(ab);

    rw=Math.ceil(gw/RSCALE)+2; rh=Math.ceil(gh/RSCALE)+2;
    depth=new Float32Array(rw*rh); val=new Float32Array(rw*rh);
    chb=new Float32Array(rw*rh); fieldB=new Float32Array(rw*rh);

    cw=Math.ceil(rw/CSTEP)+2; ch=Math.ceil(rh/CSTEP)+2;
    cbuf=new Float32Array(cw*ch);
    ctx.imageSmoothingEnabled=false;
  }
  addEventListener('resize', resize);

  // one fixed, slightly off-axis view that turns far too slowly to watch
  const M=new Float32Array([1,0,0, 0,1,0, 0,0,1]);
  function rotX(a){
    const c=Math.cos(a), s=Math.sin(a);
    const a3=M[3],a4=M[4],a5=M[5], a6=M[6],a7=M[7],a8=M[8];
    M[3]=c*a3-s*a6; M[4]=c*a4-s*a7; M[5]=c*a5-s*a8;
    M[6]=s*a3+c*a6; M[7]=s*a4+c*a7; M[8]=s*a5+c*a8;
  }
  function rotY(a){
    const c=Math.cos(a), s=Math.sin(a);
    const a0=M[0],a1=M[1],a2=M[2], a6=M[6],a7=M[7],a8=M[8];
    M[0]=c*a0+s*a6; M[1]=c*a1+s*a7; M[2]=c*a2+s*a8;
    M[6]=-s*a0+c*a6; M[7]=-s*a1+c*a7; M[8]=-s*a2+c*a8;
  }
  rotX(-0.16); rotY(0.28);

  const TAU=Math.PI*2;
  function lfo(t,p1,p2,ph){
    const v=0.5+0.5*(0.68*Math.sin(t*TAU/p1+ph)+0.32*Math.sin(t*TAU/p2+ph*1.7));
    return v<0?0:(v>1?1:v);
  }
  const LX=-0.44, LY=0.55, LZ=0.71;

  // ---- gaze: fixations and saccades --------------------------------------
  // A real eye holds still, then jumps. Between jumps it only tremors. It also
  // works over one region for a while before moving on, which is what reads as
  // examining something rather than merely looking around.
  const SAC={x:0,y:0, fx:0,fy:0, tx:0,ty:0, t0:-9, dur:0.06,
             hold:0, rx:0,ry:0, rhold:0, pupil:1, awake:0, until:4, dil:1};
  function gazeStep(t,dt){
    // wake into a scanning bout, then settle back into stillness
    if(t>=SAC.until){
      SAC.awake^=1;
      SAC.until = t + (SAC.awake ? BOUT+Math.random()*BOUT_VAR
                                 : REST+Math.random()*REST_VAR);
      if(SAC.awake) SAC.rhold=0;            // choose something to look at
    }
    const on=SAC.awake;

    if(on && t>=SAC.rhold){                 // pick something new to examine
      SAC.rx=(Math.random()*2-1)*SCAN;
      SAC.ry=(Math.random()*2-1)*SCAN*0.78;
      SAC.rhold=t+REGION+Math.random()*REGION*1.9;
    }
    if(t>=SAC.hold){                        // launch the next saccade
      SAC.fx=SAC.x; SAC.fy=SAC.y;
      if(on){
        const big=Math.random()<0.18 ? 2.2 : 1;
        SAC.tx=SAC.rx+(Math.random()*2-1)*SCAN*0.38*big;
        SAC.ty=SAC.ry+(Math.random()*2-1)*SCAN*0.30*big;
      } else {                              // at rest, only microsaccades
        SAC.tx=SAC.x+(Math.random()*2-1)*0.012;
        SAC.ty=SAC.y+(Math.random()*2-1)*0.012;
      }
      const amp=Math.hypot(SAC.tx-SAC.fx, SAC.ty-SAC.fy);
      SAC.dur=0.035+amp*0.22;               // a longer jump takes longer
      SAC.t0=t;
      SAC.hold = on ? t+SAC.dur+FIX_MIN+Math.random()*(FIX_MAX-FIX_MIN)
                    : t+SAC.dur+1.6+Math.random()*4.0;
      SAC.pupil=on?0.86:0.95;               // constricts on the jump
    }
    // minimum jerk: the velocity profile of a real ballistic eye movement
    let u=(t-SAC.t0)/SAC.dur; u=u<0?0:(u>1?1:u);
    const e=u*u*u*(10-15*u+6*u*u);
    SAC.x=SAC.fx+(SAC.tx-SAC.fx)*e;
    SAC.y=SAC.fy+(SAC.ty-SAC.fy)*e;
    // the pupil opens a little while it is alert and closes as it settles
    const want=SAC.awake?1.10:0.96;
    SAC.dil+=(want-SAC.dil)*Math.min(1,dt*0.9);
    SAC.pupil+=(SAC.dil-SAC.pupil)*Math.min(1,dt*2.6);
  }

  function splat(wx,wy,wz,v,cm){
    const X=Math.round(wx*G)/G, Y=Math.round(wy*G)/G, Z=Math.round(wz*G)/G;
    // X*R is a whole number give or take float error, so round it; truncating
    // dropped any row or column where the error landed just above the integer.
    const xx=(cxg|0)+Math.round(X*R), yy=(cyg|0)-Math.round(Y*R);
    if(xx<0||xx>=rw||yy<0||yy>=rh) return;
    const idx=yy*rw+xx;
    if(Z>depth[idx]){ depth[idx]=Z; val[idx]=v; chb[idx]=cm; }
  }

  // On wide screens the eye sits right of centre, leaving the left for the copy.
  function eyeX(){ return innerWidth>980 && rw>rh*1.2 ? 0.68 : 0.5; }

  // ---- the field: panels, cloud, blooms, vignette -----------------------
  // Everything that is not the figure, on the shading grid. It does double
  // duty: it is drawn on its own, and it multiplies the figure, so the panels
  // visibly wash over the eye as they drift.
  function buildField(t){
    const d1=t*CLOUD_DRIFT, d2=t*CLOUD_DRIFT*0.61;
    const cx=rw*eyeX(), cy=rh*0.5, hd=1/Math.hypot(cx,cy);
    const cs=CLOUD_PX*CELL_PX;              // cloud frequency per shading cell

    // --- the cloud, on the coarse grid only
    for(let j=0,q=0; j<ch; j++){
      const sy=j*CSTEP*cs;
      for(let i=0; i<cw; i++, q++){
        const sx=i*CSTEP*cs;
        const a=fbm(sx+d1, sy-d1*0.7, d1*1.6);
        const b=fbm(sx*0.42-d2, sy*0.42+d2, 11.3+d2*0.8);
        const cl=0.5+((a*0.62+b*0.52)-CLOUD_BIAS)*CLOUD_HARD;
        cbuf[q]=cl<0?0:(cl>1?1:cl);
      }
    }

    // panel lattice, in shading cells, derived from the CSS-pixel sizes.
    // A panel's brightness is the same across the whole panel, so it is
    // computed once per panel rather than once per cell: that is a few hundred
    // sines a frame instead of a few hundred thousand.
    const pw=PANEL_PX/CELL_PX, phh=PANEL_PY/CELL_PX;
    const dx=t*PANEL_DX/CELL_PX, dy=t*PANEL_DY/CELL_PX;
    const pi0=Math.floor(dx/pw), pj0=Math.floor(dy/phh);
    const pn=Math.ceil(rw/pw)+3, pm=Math.ceil(rh/phh)+3;
    if(!buildField.tab || buildField.tab.length<pn*pm) buildField.tab=new Float32Array(pn*pm);
    const tab=buildField.tab;
    for(let j=0;j<pm;j++){
      for(let i=0;i<pn;i++){
        const seed=h3(pi0+i, pj0+j, 19);
        tab[j*pn+i]=(0.40+0.60*seed)
                   *(0.72+0.28*Math.sin(t*PANEL_RATE*TAU*(0.6+seed)+seed*TAU));
      }
    }

    // bloom centres wander on two incommensurate sines, so they never repeat
    const bn=BLOOMS.length;
    const bx=new Float64Array(bn), by=new Float64Array(bn),
          br=new Float64Array(bn), ba=new Float64Array(bn);
    for(let i=0;i<bn;i++){
      const B=BLOOMS[i];
      bx[i]=cx+Math.sin(t*B.p1+B.ph)*rw*0.42;
      by[i]=cy+Math.sin(t*B.p2+B.ph*1.7)*rh*0.40;
      br[i]=1/Math.max(2,B.r*Math.min(rw,rh));
      ba[i]=B.a;
    }

    const inv=1/CSTEP;
    for(let y=0,p=0; y<rh; y++){
      const ndy=(y-cy)*hd;
      const pv=(y+dy)/phh, pj=Math.floor(pv), fv=pv-pj;
      const prow=(pj-pj0)*pn;
      const cyf=y*inv, cj=cyf|0, ty=cyf-cj;
      const r0=cj*cw, r1=r0+cw;
      for(let x=0; x<rw; x++, p++){
        // --- panels: brightness from the table, edges softened per cell
        const pu=(x+dx)/pw, pi=Math.floor(pu), fu=pu-pi;
        let pan=tab[prow+(pi-pi0)];
        // soften the panel borders so the field reads as plates, not a grid
        const edge=Math.min(Math.min(fu,1-fu), Math.min(fv,1-fv))*4;
        pan *= 0.70 + 0.30*(edge<1 ? edge*edge*(3-2*edge) : 1);

        // --- cloud, bilinear from the coarse grid
        const cxf=x*inv, ci=cxf|0, tx=cxf-ci;
        const a0=cbuf[r0+ci], a1=cbuf[r0+ci+1];
        const b0=cbuf[r1+ci], b1=cbuf[r1+ci+1];
        const u0=a0+(a1-a0)*tx, u1=b0+(b1-b0)*tx;
        const cl=u0+(u1-u0)*ty;

        // --- blooms
        let bl=0;
        for(let i=0;i<bn;i++){
          const ddx=(x-bx[i])*br[i], ddy=(y-by[i])*br[i];
          const d2b=ddx*ddx+ddy*ddy;
          if(d2b<1){ const g=1-d2b; bl+=ba[i]*g*g; }
        }

        // --- vignette
        const ndx=(x-cx)*hd;
        let vg=1-Math.max(0, Math.sqrt(ndx*ndx+ndy*ndy)/VIGNETTE-0.55)*1.9;
        if(vg<0) vg=0;

        fieldB[p]=(pan*(0.55+0.65*cl)+bl)*vg;
      }
    }
  }

  // ---- shade: figure into the shading grid ------------------------------
  let gazeT=0;
  function shade(ft){
    cxg=rw*eyeX(); cyg=rh*0.5;
    R=Math.min(rw,rh)*SIZE;
    G=R;                                     // one voxel per shading cell
    const m0=M[0],m1=M[1],m2=M[2],m3=M[3],m4=M[4],m5=M[5],m6=M[6],m7=M[7],m8=M[8];
    const tw=1.7*A.turb, amp=A.amp*0.34, F=2.15;
    // enough points to cover the visible hemisphere's cells at this grid
    // size, and no more: the count tunes itself to resolution and RSCALE
    const er=EYE_R*G;
    const need=Math.min(NPT, Math.ceil(6.3*er*er*2.2));
    const active=Math.max(3000, Math.round(need*(0.60+0.40*A.den)));

    depth.fill(-1e9);

    // the gaze, plus the ocular tremor that never stops even in fixation
    let gx=SAC.x+0.0030*Math.sin(gazeT*47.3)+0.0016*Math.sin(gazeT*83.1);
    let gy=SAC.y+0.0030*Math.sin(gazeT*61.7+1.3)+0.0016*Math.sin(gazeT*97.9);
    let gz=1;
    const gl=Math.hypot(gx,gy,gz); gx/=gl; gy/=gl; gz/=gl;
    let e1x=-gy, e1y=gx, e1z=0;
    const e1l=Math.hypot(e1x,e1y,e1z)||1; e1x/=e1l; e1y/=e1l; e1z/=e1l;
    const e2x=gy*e1z-gz*e1y, e2y=gz*e1x-gx*e1z, e2z=gx*e1y-gy*e1x;
    const COS_P=Math.cos(0.40*SAC.pupil), COS_I=Math.cos(0.78);
    let hx=gx-0.42, hy=gy+0.46, hz=gz+0.10;
    const hl=Math.hypot(hx,hy,hz); hx/=hl; hy/=hl; hz/=hl;

    // ---- eyeball ---------------------------------------------------------
    for(let k=0;k<active;k++){
      const pi=ORDER[k], i=pi*3;
      const dx=PT[i], dy=PT[i+1], dz=PT[i+2];
      const nx=m0*dx+m1*dy+m2*dz, ny=m3*dx+m4*dy+m5*dz, nz=m6*dx+m7*dy+m8*dz;
      if(nz < -0.28) continue;                 // cull before paying for noise

      let f;
      if(fwarm>0 || (pi&1)===fslice){
        const sx=dx*F, sy=dy*F, sz=dz*F;
        const q=fbm(sx,sy,sz+ft*0.3);
        f=fbm(sx+tw*q, sy+tw*q*0.8+ft*0.15, sz-tw*q);
        f=f*f*(3-2*f);
        FCACHE[pi]=f;
      } else f=FCACHE[pi];
      const rr=EYE_R*(1+amp*(f-0.5)*2);

      const ax=nx<0?-nx:nx, ay=ny<0?-ny:ny, az=nz<0?-nz:nz;
      let face;
      if(az>=ax&&az>=ay) face=1.00;
      else if(ay>=ax)    face=ny>0?0.86:0.30;
      else               face=nx>0?0.60:0.46;
      // the per-face steps were built for chunky voxels; at this grain they
      // mostly just sink the sphere into the dark, so lift their floor
      face=FACE_FLOOR+(1-FACE_FLOOR)*face;
      const lam=Math.max(0, nx*LX+ny*LY+nz*LZ);
      const e=1-az, e2=e*e;
      const rim=e2*e2*e*0.80;          // integer powers: multiply, never pow

      let v, cm;
      const c=nx*gx+ny*gy+nz*gz;
      if(c > COS_P){
        v=0.03+0.05*f; cm=-0.5;                        // pupil
      } else if(c > COS_I){
        const tt=(c-COS_I)/(COS_P-COS_I);
        const p1=nx*e1x+ny*e1y+nz*e1z, p2=nx*e2x+ny*e2y+nz*e2z;
        const fib=h3(Math.round(Math.atan2(p2,p1)*46), 3, 9);
        v=(0.10+0.62*fib)*(0.35+0.75*(1-tt))*(0.5+0.7*f)*IRIS_GAIN;
        cm=0.55-tt*0.5;                                // iris fibres
      } else {
        v=face*(0.16+0.92*lam)*(0.34+0.95*f)+rim;      // sclera
        cm=(f-0.5)+(lam-0.5)*0.35;
      }
      v*=EYE_GAIN;
      if(nx*hx+ny*hy+nz*hz > 0.988) v=1.6;             // glint

      v*=0.62+0.38*(nz*rr+1.3)/2.6;
      splat(nx*rr, ny*rr, nz*rr, v, cm);
    }

    // ---- bands -----------------------------------------------------------
    for(let bi=0; bi<BANDS.length; bi++){
      const B=BANDS[bi], O=BM[bi];
      const t0=m0*O[0]+m1*O[3]+m2*O[6], t1=m0*O[1]+m1*O[4]+m2*O[7], t2=m0*O[2]+m1*O[5]+m2*O[8];
      const t3=m3*O[0]+m4*O[3]+m5*O[6], t4=m3*O[1]+m4*O[4]+m5*O[7], t5=m3*O[2]+m4*O[5]+m5*O[8];
      const t6=m6*O[0]+m7*O[3]+m8*O[6], t7=m6*O[1]+m7*O[4]+m8*O[7], t8=m6*O[2]+m7*O[5]+m8*O[8];

      // just enough samples to lay down one voxel per step along the path, and
      // one across the strap, whatever the grid size is. Oversampling here is
      // paid for on every segment of every band.
      const hw=B.w;
      const seg=Math.max(220, Math.min(1200, Math.round(TAU*G*B.r)+8));
      const wid=Math.max(4, Math.min(20, Math.round(hw*2*G)+2));

      for(let a=0;a<seg;a++){
        const th=a/seg*TAU;
        const ct=Math.cos(th), st=Math.sin(th);
        const bx=ct*B.r, by=st*B.r;
        const tw2=B.twist*th+B.ph;
        const cw2=Math.cos(tw2), sw=Math.sin(tw2);
        const dxl=sw*ct, dyl=sw*st, dzl=cw2;
        const tx=-st, ty=ct;
        let nxl=ty*dzl, nyl=-tx*dzl, nzl=tx*dyl-ty*dxl;
        const nl=Math.hypot(nxl,nyl,nzl)||1; nxl/=nl; nyl/=nl; nzl/=nl;

        const NX=t0*nxl+t1*nyl+t2*nzl, NY=t3*nxl+t4*nyl+t5*nzl, NZ=t6*nxl+t7*nyl+t8*nzl;
        const lam=Math.abs(NX*LX+NY*LY+NZ*LZ);         // straps are two-sided
        const azn=NZ<0?-NZ:NZ;

        for(let w=0;w<wid;w++){
          const s=(w/(wid-1))*2-1;
          const px=bx+dxl*hw*s, py=by+dyl*hw*s, pz=dzl*hw*s;
          const X=t0*px+t1*py+t2*pz, Y=t3*px+t4*py+t5*pz, Z=t6*px+t7*py+t8*pz;

          let v=0.16+0.95*lam;
          v*=0.72+0.34*Math.cos(s*1.35);                // rounded across the strap
          let cm=(lam-0.5)*0.7;

          if(B.type===1){                               // braided lattice
            const u=th/TAU*B.nd, uu=u+s*0.75, vv=u-s*0.75;
            const fu=uu-Math.floor(uu), fv=vv-Math.floor(vv);
            const line=Math.min(Math.min(fu,1-fu), Math.min(fv,1-fv));
            v *= line<0.085 ? 0.42 : 0.92+0.30*line;
            cm+=0.25;
          }
          v*=0.66+0.34*(Z+1.4)/2.8;
          const ea=1-azn, ea3=ea*ea*ea;
          v+=ea3*ea3*0.55;
          splat(X,Y,Z, v, cm);
        }
      }
    }

    // ---- compose, still on the shading grid ------------------------------
    // Folding the field into val here means the dither pass only has to carry
    // two numbers up to the fine grid. Gamma is applied here too, on the
    // coarse grid, where it costs a quarter of what it would per pixel.
    for(let p=0, n=rw*rh; p<n; p++){
      const fl=fieldB[p];
      let v, cm;
      if(depth[p] > -1e8){
        // the panels still wash over the figure, but the field only bleeds
        // through it faintly: its darks have to stay dark
        v = val[p]*FIG*(1-PANEL_AMT+PANEL_AMT*fl) + fl*FIELD*FIELD_OVER;
        cm = chb[p];
      } else { v=fl*FIELD; cm=0.10; }
      v = v<0 ? 0 : (v>1 ? 1 : v);
      val[p]=GAM[(v*1024)|0];
      chb[p]=cm*OFF;
    }
  }

  // ---- dither: shading grid up to the fine grid -------------------------
  // The x walk uses a counter rather than a divide, the chroma offset is taken
  // nearest rather than interpolated (it is a sub-pixel nudge either way), and
  // there is no early-out: a value below every threshold already writes 0.
  function dither(){
    const inv=1/RSCALE;
    for(let y=0,p=0; y<gh; y++){
      const brow=(y&7)<<3;
      const ryf=y*inv, rj=ryf|0, ty=ryf-rj;
      const r0=rj*rw, r1=r0+rw;
      let ri=0, sub=0;
      for(let x=0; x<gw; x++, p++){
        const tx=TXW[sub];
        const i00=r0+ri, i10=r1+ri;

        // bilinear so gradients stay smooth under a fine dither
        const va=val[i00], vb=val[i00+1], vc=val[i10], vd=val[i10+1];
        const v0=va+(vb-va)*tx, v1=vc+(vd-vc)*tx;
        const v=v0+(v1-v0)*ty;
        const o=chb[i00];
        if(++sub===RSCALE){ sub=0; ri++; }

        const bi=brow|(x&7);
        const r=(v+o      > TR[bi]) ? CR : 0;
        const g=(v*GW     > TG[bi]) ? CG : 0;
        const b=((v-o)*BW > TB[bi]) ? CB : 0;
        buf32[p] = (r|g|b) ? (0xff000000|(b<<16)|(g<<8)|r) : 0;
      }
    }
    img.data.set(buf8);
    octx.putImageData(img,0,0);
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(off,0,0,cv.width,cv.height);
  }

  // ---- loop --------------------------------------------------------------
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cyc=0, ftAcc=0, t=0, last=performance.now();
  let ema=BUDGET, cool=30;
  let onScreen=true;
  if(window.IntersectionObserver) new IntersectionObserver(([e])=>{onScreen=e.isIntersecting;}).observe(cv);

  function loop(now){
    if(!onScreen){ last=now; requestAnimationFrame(loop); return; }
    const dt=Math.min(0.05,(now-last)/1000); last=now;
    if(!reduce){
      t+=dt; cyc+=dt*RATE;
      A.amp  = 0.08 + 0.64*lfo(cyc, 47, 29.3, 0.0);
      A.den  = 0.30 + 0.70*lfo(cyc, 31, 19.7, 1.9);
      A.flow = 0.20 + 1.25*lfo(cyc, 59, 37.1, 3.4);
      A.turb = 0.45 + 1.40*lfo(cyc, 41, 23.9, 5.2);
      ftAcc += dt*0.40*A.flow;
      gazeT += dt; gazeStep(gazeT, dt);
      fslice ^= 1;                    // alternate which half of the fluid refreshes
      if(fwarm>0) fwarm--;
      for(let i=0;i<BANDS.length;i++){
        const B=BANDS[i];
        B.a+=dt*B.rx*BAND_RATE; B.b+=dt*B.ry*BAND_RATE; B.c+=dt*B.rz*BAND_RATE;
        buildBandMatrix(BM[i], B.a, B.b, B.c);
      }
      rotY(dt*SPIN);
    }
    const t0=performance.now();
    buildField(t);
    shade(ftAcc);
    dither();

    // hold the frame budget by trading shading detail for speed. The dither
    // grain is never touched, so the look holds; only the figure gets coarser.
    ema += ((performance.now()-t0) - ema)*0.12;
    if(--cool<=0){
      if(ema > BUDGET*1.35 && RSCALE < RS_MAX){ setScale(RSCALE+1); cool=45; ema=BUDGET; }
      else if(ema < BUDGET*0.50 && RSCALE > RS_MIN){ setScale(RSCALE-1); cool=45; ema=BUDGET; }
      else cool=10;
    }
    requestAnimationFrame(loop);
  }

  for(let i=0;i<BANDS.length;i++) buildBandMatrix(BM[i], BANDS[i].a, BANDS[i].b, BANDS[i].c);
  setScale(RSCALE);
  requestAnimationFrame(loop);
})();
