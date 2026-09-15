/* Surface sampling and breathing motion from the supplied gyroid.html.
   Shared canvas, camera, and transitions remain owned by the homepage. */
window.createGyroidShape = function (NPT) {
  const GB=9.4, LEVEL=.85, TAU=Math.PI*2;
  let rsd=0x6d2b79f5;
  const rnd=()=>{ rsd^=rsd<<13; rsd^=rsd>>>17; rsd^=rsd<<5; rsd|=0; return ((rsd>>>0)%1000003)/1000003; };

  // ---- seed the surface --------------------------------------------------
  // Random points in the ball, pulled onto f = 0 by Newton along the gradient.
  // Far cheaper than marching a lattice, and it hands back exactly N points.
  const SW = 1/GB;                                   // gyroid units -> world
  const PX=new Float32Array(NPT*3), PN=new Float32Array(NPT*3), PG=new Float32Array(NPT);
  const ORDER=new Uint32Array(NPT);
  (function(){
    let n=0, guard=0;
    while(n<NPT && guard<NPT*40){
      guard++;
      let x,y,z,d2;
      do{ x=rnd()*2-1; y=rnd()*2-1; z=rnd()*2-1; d2=x*x+y*y+z*z; }while(d2>1);
      x*=GB; y*=GB; z*=GB;

      let gx=0, gy=0, gz=0, g2=1;
      for(let it=0; it<6; it++){
        const sx=Math.sin(x), cx=Math.cos(x);
        const sy=Math.sin(y), cy=Math.cos(y);
        const sz=Math.sin(z), cz=Math.cos(z);
        const f = sx*cy + sy*cz + sz*cx;
        gx = cx*cy - sz*sx;
        gy = -sx*sy + cy*cz;
        gz = -sy*sz + cz*cx;
        g2 = gx*gx+gy*gy+gz*gz;
        if(g2 < 1e-4) break;
        const k=f/g2;
        x-=gx*k; y-=gy*k; z-=gz*k;
        if(f*f < 1e-8) break;
      }
      if(g2 < 1e-3) continue;                        // degenerate gradient
      if(x*x+y*y+z*z > GB*GB) continue;              // wandered out of the ball

      const sx=Math.sin(x), cx=Math.cos(x);
      const sy=Math.sin(y), cy=Math.cos(y);
      const sz=Math.sin(z), cz=Math.cos(z);
      if(Math.abs(sx*cy + sy*cz + sz*cx) > 0.04) continue;
      gx = cx*cy - sz*sx; gy = -sx*sy + cy*cz; gz = -sy*sz + cz*cx;
      const gl=Math.sqrt(gx*gx+gy*gy+gz*gz);

      const p=n*3;
      PX[p]=x*SW; PX[p+1]=y*SW; PX[p+2]=z*SW;
      PN[p]=gx/gl; PN[p+1]=gy/gl; PN[p+2]=gz/gl;
      PG[n]=SW/gl;                                   // world shift per unit of level
      ORDER[n]=n;
      n++;
    }
    let seed=0x9e3779b9;
    const r2=()=>{ seed=Math.imul(seed^(seed>>>15),0x2545f491); return ((seed>>>0)%1000000)/1000000; };
    for(let i=NPT-1;i>0;i--){ const j=(r2()*(i+1))|0; const t=ORDER[i]; ORDER[i]=ORDER[j]; ORDER[j]=t; }
  })();


  const points=new Float32Array(NPT*3);
  let ft=0, previous=0;
  const lfo=(t,p1,p2,ph)=>Math.max(0,Math.min(1,.5+.5*(.68*Math.sin(t*TAU/p1+ph)+.32*Math.sin(t*TAU/p2+ph*1.7))));
  const shape={points,normals:PN,glow:1,flowTime:0,density:1,
    prepare(time){
      const cyc=time*1.25;
      const level=(lfo(cyc,41,23.9,5.2)*2-1)*LEVEL;
      const flow=.25+1.20*lfo(cyc,59,37.1,3.4);
      ft+=Math.min(.05,Math.max(0,time-previous))*.45*flow; previous=time;
      shape.flowTime=ft;
      shape.glow=.6+.7*(.30+.70*lfo(cyc,47,29.3,0));
      shape.density=.45+.55*(.40+.60*lfo(cyc,31,19.7,1.9));
      for(let i=0;i<NPT;i++){
        const p=i*3,d=level*PG[i];
        points[p]=(PX[p]+PN[p]*d)*(.42/.41);
        points[p+1]=(PX[p+1]+PN[p+1]*d)*(.42/.41);
        points[p+2]=(PX[p+2]+PN[p+2]*d)*(.42/.41);
      }
    }
  };
  return shape;
};
