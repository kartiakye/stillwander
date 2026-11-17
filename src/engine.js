// The world, its art and its sound: the original Stillwander web engine, lightly adapted.
// Game rules live in ./core and are attached through `hooks` (see game.js).
import * as MAP from './map.js';
if(!window.THREE){document.getElementById('err').hidden=false;throw new Error('WebGL unavailable');}
export const hooks={update(){},timeScale(){return 1},speed(){return 1},face(){return null},key(){},pointer(){},awaken(){},chime(){},begin(){}};
const T=THREE,PI=Math.PI,TAU=PI*2;
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const sstep=(a,b,x)=>{x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x)};
const backOut=t=>{const c=1.70158;t-=1;return 1+(c+1)*t*t*t+c*t*t};
const hex=h=>[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255];
const mix3=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const SEED=7,CH=16,R=2,CELL=280,RS=110,WATER=-0.18;

/* ---------- noise ---------- */
function hash2(x,z,s){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul((s|0)+SEED*131,1442695041);h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296}
function vnoise(x,z,s){const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);
  const a=hash2(xi,zi,s),b=hash2(xi+1,zi,s),c=hash2(xi,zi+1,s),d=hash2(xi+1,zi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function fbm(x,z,s,o){let a=.5,f=1,t=0,n=0;for(let i=0;i<o;i++){t+=a*vnoise(x*f,z*f,s+i*17);n+=a;a*=.5;f*=2}return t/n}
function RNG(seed){let a=seed|0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ---------- biomes ---------- */
const B=[
 {name:'Pampas Plain',top:hex(0xc6cf98),top2:hex(0xe4d9a2),ca:hex(0xe8d2b0),cb:hex(0xa8848c),base:1.4,amp:2.0,bloom:[0xffffff,0xfff2c0,0xd9c8ff],acc:hex(0xe0483a),glyph:'#e9dcb4',part:0xfff6d8},
 {name:'Golden Wood',top:hex(0xf0c860),top2:hex(0xf7dc7c),ca:hex(0xd9a05a),cb:hex(0x8a4a52),base:1.6,amp:2.4,bloom:[0xffd24a,0xff9a3a,0xffffff],acc:hex(0xc8402f),glyph:'#f5c542',part:0xffd24a},
 {name:'Bamboo Hollow',top:hex(0x7fb57c),top2:hex(0x5f9f78),ca:hex(0x4f8a78),cb:hex(0x2c4f66),base:1.6,amp:3.0,bloom:[0xffffff,0xa8e890,0xfff2a0],acc:hex(0xe0483a),glyph:'#6fc27a',part:0xd8ffb0},
 {name:'Snow Crest',top:hex(0xf4f8fd),top2:hex(0xdfeaf7),ca:hex(0xb3cdee),cb:hex(0x6c86c9),base:2.6,amp:5.5,bloom:[0xbfe6ff,0xffffff,0xd9c8ff],acc:hex(0xe0525a),glyph:'#bfe1ff',part:0xffffff},
 {name:'Heron Marsh',top:hex(0xd9e2b4),top2:hex(0xc4d6a0),ca:hex(0xcdb9a0),cb:hex(0x8f7a90),base:-0.35,amp:2.6,bloom:[0x8f7ae8,0xffffff,0xff9fc0],acc:hex(0xf2684e),glyph:'#5fd4d6',part:0xdffcff},
 {name:'Crimson Vale',top:hex(0xd8604e),top2:hex(0xee8a5c),ca:hex(0xb84a5c),cb:hex(0x5a2a5e),base:2.4,amp:4.6,bloom:[0xe8302a,0xff7a4a,0xffd0a0],acc:hex(0x3f4f8a),glyph:'#e8503e',part:0xff6a4a},
 {name:'Blossom Field',top:hex(0xf6d9e2),top2:hex(0xecc3d6),ca:hex(0xbfa3dc),cb:hex(0x756bb8),base:1.4,amp:2.2,bloom:[0xff9ec4,0xffffff,0xe8302a],acc:hex(0xe0483a),glyph:'#ffa9cc',part:0xffc4dc},
];
const S={h:0,b:0,w:new Float32Array(7),site:0},_w=new Float32Array(7);
// Lands come from the hand-drawn map: each point belongs to the nearest region
// centre, blended over a belt so borders are felt over a stretch of walking.
const BELT=45;
function weights(x,z,w){
  const wx=x+(fbm(x/42,z/42,11,2)-.5)*40,wz=z+(fbm(x/42,z/42,23,2)-.5)*40;
  let dmin=Infinity;const best=_best;best.fill(Infinity);
  for(const r of MAP.REGIONS)for(const [cx,cz] of r.at){const d=Math.hypot(wx-cx,wz-cz);if(d<best[r.land])best[r.land]=d;if(d<dmin)dmin=d}
  let sum=0;w.fill(0);
  for(let i=0;i<7;i++){let k=1-(best[i]-dmin)/BELT;if(k<=0)continue;k=k*k;w[i]=k;sum+=k}
  for(let i=0;i<7;i++)w[i]/=sum}
const _best=new Float32Array(7);
function rawH(x,z,w){
  const n=fbm(x/36,z/36,1,4),n2=fbm(x/11,z/11,2,2);let base=0,amp=0;
  for(let i=0;i<7;i++){base+=w[i]*MAP.ELEVATION[i].base;amp+=w[i]*MAP.ELEVATION[i].rise}
  let h=base+(n-.5)*2.4*amp+(n2-.5)*amp*.4;
  if(w[5]>.05){const tq=Math.round(h/2)*2;h+=(tq-h)*Math.min(1,w[5]*1.4)}
  if(w[3]>.05)h+=w[3]*Math.pow(Math.abs(n2-.5)*2,1.3)*3;
  for(const hl of MAP.HILLS){const d=Math.hypot(x-hl.x,z-hl.z);if(d<hl.r)h+=hl.h*sstep(hl.r,hl.r*.25,d)}
  // the shore: low lands slope into the sea, high lands end in cliffs
  const c=MAP.coastDistance(x+(fbm(x/30,z/30,71,2)-.5)*24,z+(fbm(x/30,z/30,73,2)-.5)*24),cliff=clamp(w[3]+w[5],0,1);
  h=lerp(-2.5,h,sstep(0,lerp(26,5,cliff),c));
  // rivers and lakes cut down to their beds, so high ground becomes a canyon
  const rd=MAP.riverDistance(x,z);if(rd<7)h=lerp(-1.2,h,sstep(0,7,rd));
  return h}
const dom=w=>{let b=0,m=0;for(let i=0;i<7;i++)if(w[i]>m){m=w[i];b=i}return b};
const sites=new Map();
// Shrines stand where the map puts them; a square with none gets a site far out of reach.
function siteAt(rx,rz){const key=rx+','+rz;let s=sites.get(key);if(s)return s;
  const m=MAP.SHRINES.find(q=>Math.floor(q.x/RS)===rx&&Math.floor(q.z/RS)===rz);
  if(!m){s={x:1e9,z:1e9,key,h:0,b:0,none:true};sites.set(key,s);return s}
  weights(m.x,m.z,_w);s={x:m.x,z:m.z,key,name:m.name,main:!!m.main,h:Math.max(1,Math.round(rawH(m.x,m.z,_w)*2)/2),b:dom(_w)};sites.set(key,s);return s}
const lmH=new Map();
function landmarkHeight(l){let h=lmH.get(l);if(h===undefined){weights(l.x,l.z,_w);h=Math.max(.5,Math.round(rawH(l.x,l.z,_w)*2)/2);lmH.set(l,h)}return h}
function sample(x,z){
  const st=siteAt(Math.floor(x/RS),Math.floor(z/RS));
  weights(x,z,S.w);let h=rawH(x,z,S.w);S.site=0;
  const d0=Math.hypot(x+.5,z+.5);if(d0<14)h=lerp(1.5,h,sstep(4,14,d0));
  const ds=Math.hypot(x-st.x,z-st.z);
  if(ds<9){h=lerp(st.h,h,sstep(4.2,9,ds));if(ds<3.6)S.site=1;if(ds<2.4){h=st.h+.5;S.site=2}}
  S.lm=null;S.clear=0;S.road=0;S.bridge=0;
  const lm=MAP.landmarkAt(x+.5,z+.5);
  if(lm){const d=Math.hypot(x+.5-lm.x,z+.5-lm.z);if(lm.flat)h=lerp(landmarkHeight(lm),h,sstep(lm.r*.7,lm.r,d));if(d<lm.r*.85){S.clear=1;if(lm.pave)S.lm=lm}}
  if(!S.site&&MAP.roadDistance(x+.5,z+.5)<1.6){S.road=1;S.clear=1;if(h<.5){h=.5;S.bridge=1}}
  h=Math.round(h*2)/2;if(h<-2.5)h=-2.5;S.h=h;S.b=dom(S.w);S.st=st}
const cream=hex(0xfbf3e4),cream2=hex(0xf1dfc8),gold=hex(0xf6c453),dark=hex(0x4a3a6a),trunk=hex(0x8b5d5a),white=[1,1,1];
function tileCols(x,z,Ct,Ca,Cb,o){
  const w=S.w,v=fbm(x/7,z/7,31,2);let t=[0,0,0],a=[0,0,0],b=[0,0,0];
  for(let i=0;i<7;i++){const k=w[i];if(k<.001)continue;const bi=B[i];
    for(let c=0;c<3;c++){t[c]+=k*(bi.top[c]+(bi.top2[c]-bi.top[c])*v);a[c]+=k*bi.ca[c];b[c]+=k*bi.cb[c]}}
  t=mix3(t,white,clamp(S.h/14,0,1)*.3);
  if(S.h<0)t=mix3(t,[.42,.80,.80],clamp(-S.h/2.5,0,1)*.75+.1);
  if(S.bridge){t=(x+z)&1?[.66,.49,.38]:[.6,.44,.34];a=[.55,.4,.32];b=[.4,.3,.28]}
  else if(S.road)t=mix3(t,[.9,.83,.68],.62);
  else if(S.lm)t=(x+z)&1?cream:mix3(cream,B[S.lm.land].acc,.16);
  else if(S.h>=0&&S.h<=1&&MAP.coastDistance(x,z)<16)t=mix3(t,[.95,.89,.72],.7);
  if(S.site){const ac=B[S.st.b].acc;t=S.site===2?((x+z)&1?cream:mix3(cream,ac,.22)):mix3(t,cream,.55);a=cream2;b=mix3(cream2,ac,.8)}
  else if((x+z)&1)t=[t[0]*.972,t[1]*.972,t[2]*.972];
  for(let c=0;c<3;c++){Ct[o+c]=t[c];Ca[o+c]=a[c];Cb[o+c]=b[c]}}

/* ---------- geometry builder ---------- */
const _v=new T.Vector3(),_n=new T.Vector3(),_m3=new T.Matrix3(),_m4=new T.Matrix4(),_q=new T.Quaternion(),_e=new T.Euler(),_s=new T.Vector3(),_p=new T.Vector3();
function M(x,y,z,sx=1,sy=sx,sz=sx,ry=0,rx=0,rz=0){_e.set(rx,ry,rz,'YXZ');_q.setFromEuler(_e);return _m4.compose(_p.set(x,y,z),_q,_s.set(sx,sy,sz))}
function tp(g){g=g.index?g.toNonIndexed():g;g.computeVertexNormals();const p=g.attributes.position.array,n=g.attributes.normal.array;let y0=1e9,y1=-1e9;
  for(let i=1;i<p.length;i+=3){if(p[i]<y0)y0=p[i];if(p[i]>y1)y1=p[i]}return{p,n,y0,y1}}
const TP={
  box:tp(new T.BoxGeometry(1,1,1).translate(0,.5,0)),
  cyl6:tp(new T.CylinderGeometry(.5,.5,1,6).translate(0,.5,0)),
  cyl8:tp(new T.CylinderGeometry(.5,.5,1,8).translate(0,.5,0)),
  cyl12:tp(new T.CylinderGeometry(.5,.5,1,12).translate(0,.5,0)),
  cone4:tp(new T.ConeGeometry(.5,1,4).rotateY(PI/4).translate(0,.5,0)),
  cone6:tp(new T.ConeGeometry(.5,1,6).translate(0,.5,0)),
  cone8:tp(new T.ConeGeometry(.5,1,8).translate(0,.5,0)),
  frus:tp(new T.CylinderGeometry(.3,.5,1,8).translate(0,.5,0)),
  robe:tp(new T.CylinderGeometry(.1,.32,.7,10).translate(0,.35,0)),
  ico:tp(new T.IcosahedronGeometry(.5,0)),
  ico1:tp(new T.IcosahedronGeometry(.5,1)),
  dome:tp(new T.SphereGeometry(.5,10,4,0,TAU,0,PI/2)),
  octa:tp(new T.OctahedronGeometry(.5)),
  arch:tp(new T.TorusGeometry(.5,.09,4,12,PI)),
};
class Geo{
  constructor(){this.p=[];this.n=[];this.c=[]}
  add(t,m,c1,c2){const P=t.p,N=t.n,n=P.length,dy=t.y1-t.y0;_m3.getNormalMatrix(m);
    for(let i=0;i<n;i+=3){_v.set(P[i],P[i+1],P[i+2]);const ty=c2?(P[i+1]-t.y0)/dy:0;_v.applyMatrix4(m);
      _n.set(N[i],N[i+1],N[i+2]).applyMatrix3(_m3).normalize();
      this.p.push(_v.x,_v.y,_v.z);this.n.push(_n.x,_n.y,_n.z);
      if(c2)this.c.push(c1[0]+(c2[0]-c1[0])*ty,c1[1]+(c2[1]-c1[1])*ty,c1[2]+(c2[2]-c1[2])*ty);else this.c.push(c1[0],c1[1],c1[2])}}
  quad(a,b,c,d,n,C0,o0,C1,o1){ // a,b take colour 0; c,d colour 1
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const f=(uy*vz-uz*vy)*n[0]+(uz*vx-ux*vz)*n[1]+(ux*vy-uy*vx)*n[2];
    const vs=f>=0?[a,b,c,a,c,d]:[a,c,b,a,d,c],cs=f>=0?[0,0,1,0,1,1]:[0,1,0,0,1,1];
    for(let i=0;i<6;i++){const v=vs[i];this.p.push(v[0],v[1],v[2]);this.n.push(n[0],n[1],n[2]);
      if(cs[i])this.c.push(C1[o1],C1[o1+1],C1[o1+2]);else this.c.push(C0[o0],C0[o0+1],C0[o0+2])}}
  build(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));
    g.setAttribute('normal',new T.Float32BufferAttribute(this.n,3));g.setAttribute('color',new T.Float32BufferAttribute(this.c,3));return g}
}

/* ---------- renderer, sky, shared shader patch ---------- */
const canvas=$('c');let renderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})}catch(e){$('err').hidden=false;throw e}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene();
const U={uSkyT:{value:new T.Color()},uSkyB:{value:new T.Color()},uSunCol:{value:new T.Color()},uRes:{value:new T.Vector2(1,1)},
  uSunPos:{value:new T.Vector2(.84,.82)},uTime:{value:0},uNight:{value:0},uAurora:{value:0},uCenter:{value:new T.Vector3()},uFade:{value:new T.Vector2(12,20)}};
const SKY=`
uniform vec3 uSkyT,uSkyB,uSunCol;uniform vec2 uRes,uSunPos;uniform float uTime,uNight,uAurora;
float skh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 skyColor(vec2 fc){
  vec2 uv=fc/uRes;float asp=uRes.x/uRes.y;
  vec3 c=mix(uSkyB,uSkyT,smoothstep(0.0,1.0,uv.y));
  vec2 sp=(uv-uSunPos)*vec2(asp,1.0);float d=length(sp);
  c+=uSunCol*(0.22*exp(-d*d*7.0)+0.35*exp(-d*d*90.0));
  c=mix(c,mix(uSunCol,vec3(1.0),0.65),smoothstep(0.050,0.046,d)*0.95);
  vec2 gp=vec2(uv.x*asp,uv.y)*64.0;vec2 id=floor(gp);vec2 f=fract(gp)-0.5;float h=skh(id);
  vec2 jo=(vec2(skh(id+3.1),skh(id+7.7))-0.5)*0.6;
  float st=step(0.90,h)*smoothstep(0.11,0.0,length(f+jo))*(0.55+0.45*sin(uTime*1.7+h*90.0));
  c+=vec3(0.9,0.95,1.0)*st*uNight;
  if(uAurora>0.001){float a=sin(uv.x*6.0+uTime*0.3+sin(uv.x*13.0-uTime*0.2)*0.8);
    float band=exp(-pow((uv.y-0.74-0.07*a)*8.0,2.0))+0.6*exp(-pow((uv.y-0.2+0.05*a)*9.0,2.0));
    c+=band*uAurora*0.55*mix(vec3(0.3,1.0,0.75),vec3(0.85,0.45,1.0),0.5+0.5*sin(uv.x*4.0+uTime*0.2));}
  return c;}`;
function patch(mat){mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
  sh.vertexShader='varying vec3 vWPos;\n'+sh.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
  vec4 wp4=vec4(transformed,1.0);
  #ifdef USE_INSTANCING
  wp4=instanceMatrix*wp4;
  #endif
  vWPos=(modelMatrix*wp4).xyz;`);
  sh.fragmentShader='varying vec3 vWPos;\nuniform vec3 uCenter;uniform vec2 uFade;\n'+SKY+sh.fragmentShader.replace('#include <fog_fragment>',
   `float fd=smoothstep(uFade.x,uFade.y,length(vWPos.xz-uCenter.xz));
    if(fd>0.001)gl_FragColor.rgb=mix(gl_FragColor.rgb,skyColor(gl_FragCoord.xy),fd);`)};return mat}
const sky=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({uniforms:U,depthTest:false,depthWrite:false,
  vertexShader:'void main(){gl_Position=vec4(position.xy,1.0,1.0);}',
  fragmentShader:SKY+'void main(){gl_FragColor=vec4(skyColor(gl_FragCoord.xy),1.0);}'}));
sky.frustumCulled=false;sky.renderOrder=-1000;scene.add(sky);

const worldMat=patch(new T.MeshLambertMaterial({vertexColors:true}));
const hemi=new T.HemisphereLight(0xffffff,0xc9a9c9,.66);scene.add(hemi);
const sun=new T.DirectionalLight(0xfff1dc,.55);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
const sc=sun.shadow.camera;sc.left=-34;sc.right=34;sc.top=34;sc.bottom=-34;sc.near=1;sc.far=200;sun.shadow.bias=-.0006;sun.shadow.normalBias=.03;
scene.add(sun,sun.target);
const SUN_DIR=new T.Vector3(-.55,.8,.42).normalize();
const lamp=new T.PointLight(0xffd9a0,0,10,1.6);scene.add(lamp);
const cam=new T.OrthographicCamera(-1,1,1,-1,.1,500);
let view=19,az=PI/4,azT=PI/4;const EL=Math.atan(1/Math.SQRT2),camT=new T.Vector3(.5,2,.5);

/* day cycle */
const KC=(t,sT,sB,su,sI,hs,hg,hI,n,wa,wb)=>({t,sT:new T.Color(sT),sB:new T.Color(sB),su:new T.Color(su),sI,hs:new T.Color(hs),hg:new T.Color(hg),hI,n,wa:new T.Color(wa),wb:new T.Color(wb)});
const DAY=[0x86c8e2,0xfbe8cf,0xfff1dc,.55,0xffffff,0xc9a9c9,.66,0,0x6fd3d0,0xb4f0e4],
      DUSK=[0x5d4b9c,0xff9f8a,0xff9a6b,.5,0xf5c8da,0x8d6bb0,.62,.15,0x6f8fd0,0xffb7a6],
      NIGHT=[0x0f1433,0x34407a,0x8fa8ff,.34,0x8494e0,0x3a3f7a,.62,1,0x2c4a96,0x6fa0d8],
      DAWN=[0x8aa6e0,0xffcdb8,0xffc9a3,.5,0xffe6ee,0xb99ac4,.64,.2,0x7fbfd8,0xffd9c8];
const KEYS=[KC(0,...DAY),KC(.4,...DAY),KC(.5,...DUSK),KC(.6,...NIGHT),KC(.84,...NIGHT),KC(.93,...DAWN),KC(1,...DAY)];
let tod=.08;const DAYLEN=300,waterA=new T.Color(),waterB=new T.Color();
function applyTime(){let i=0;while(i<KEYS.length-2&&tod>=KEYS[i+1].t)i++;const a=KEYS[i],b=KEYS[i+1],k=sstep(0,1,(tod-a.t)/(b.t-a.t));
  U.uSkyT.value.copy(a.sT).lerp(b.sT,k);U.uSkyB.value.copy(a.sB).lerp(b.sB,k);U.uSunCol.value.copy(a.su).lerp(b.su,k);
  sun.color.copy(U.uSunCol.value);sun.intensity=lerp(a.sI,b.sI,k);hemi.color.copy(a.hs).lerp(b.hs,k);hemi.groundColor.copy(a.hg).lerp(b.hg,k);
  hemi.intensity=lerp(a.hI,b.hI,k);U.uNight.value=lerp(a.n,b.n,k);waterA.copy(a.wa).lerp(b.wa,k);waterB.copy(a.wb).lerp(b.wb,k);
  lamp.intensity=U.uNight.value*1.3}

/* water */
const water=new T.Mesh(new T.PlaneGeometry(140,140).rotateX(-PI/2),new T.ShaderMaterial({transparent:true,depthWrite:false,
  uniforms:Object.assign({uWA:{value:waterA},uWB:{value:waterB}},U),
  vertexShader:'varying vec3 vWPos;void main(){vWPos=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWPos,1.0);}',
  fragmentShader:'varying vec3 vWPos;uniform vec3 uCenter,uWA,uWB;uniform vec2 uFade;'+SKY+`
  void main(){vec2 p=vWPos.xz;float t=uTime;
    float w=sin(p.x*1.3+t*0.8+sin(p.y*0.9+t*0.5)*1.5)*0.5+0.5;
    float w2=sin(p.y*1.7-t*0.6+sin(p.x*1.1-t*0.4)*1.3)*0.5+0.5;
    vec3 c=mix(uWA,uWB,w*w2);c+=smoothstep(0.80,0.98,w*w2)*0.22;
    float fd=smoothstep(uFade.x,uFade.y,length(p-uCenter.xz));
    c=mix(c,skyColor(gl_FragCoord.xy),fd);gl_FragColor=vec4(c,0.74);}`}));
water.position.y=WATER;water.renderOrder=1;scene.add(water);

/* textures */
function glowTex(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.85)');g.addColorStop(.55,'rgba(255,255,255,.22)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,64,64);return new T.CanvasTexture(c)}
const GT=glowTex();
const orbMat=new T.SpriteMaterial({map:GT,color:0xfff3c4,depthWrite:false,transparent:true});
const haloMat=new T.SpriteMaterial({map:GT,color:0xffe9a8,depthWrite:false,transparent:true,blending:T.AdditiveBlending});

/* ---------- static props ---------- */
const G1=hex(0x8fd08a),G2=hex(0xc9eaa0),J1=hex(0x237a78),J2=hex(0x6fd0a8),PK1=hex(0xf08fb5),PK2=hex(0xffd6e4),
  SAND=hex(0xe9a27e),ROCK=hex(0xd9b7a6),ICE1=hex(0x8fc6f0),ICE2=hex(0xf2fbff),CG1=hex(0x3f9d86),CG2=hex(0x8fdcae),
  MES1=hex(0x7a3a70),MES2=hex(0xf0906e),LILY=hex(0x5fbf96),PALM=hex(0x3fae8a),PALM2=hex(0xa6e3a0),PTR=hex(0xc98a70),WARM=hex(0xffe9a8);
const ROOF=hex(0x343a62),ROOF2=hex(0x5f679a),VERM=hex(0xe0483a),VERM2=hex(0xf2684e),WOOD=hex(0x5a3a3e),STONE=hex(0xbdb7b2),BAM1=hex(0x4f9d5a),BAM2=hex(0xb4dc78);
const Pr={
  roundTree(g,x,y,z,r,c1,c2){const s=.8+r()*.6;g.add(TP.cyl6,M(x,y,z,.18*s,1.1*s,.18*s),trunk);
    g.add(TP.ico1,M(x,y+1.5*s,z,1.5*s,1.45*s,1.5*s,r()*3),c1,c2);
    if(r()<.6)g.add(TP.ico,M(x+.5*s,y+1.05*s,z+.25*s,.8*s,.8*s,.8*s,r()*3),c1,c2)},
  poplar(g,x,y,z,r,c1,c2){const s=.9+r()*.5;g.add(TP.cyl6,M(x,y,z,.14,.6*s,.14),trunk);g.add(TP.cone8,M(x,y+.5*s,z,.8*s,2.8*s,.8*s),c1,c2)},
  pine(g,x,y,z,r,c1,c2,tip){const s=.8+r()*.7;g.add(TP.cyl6,M(x,y,z,.16*s,.5*s,.16*s),trunk);
    for(let i=0;i<3;i++){const k=1-i*.24;g.add(TP.cone6,M(x,y+(.35+i*.52)*s,z,1.2*k*s,.95*s,1.2*k*s,r()*3),i===2&&tip?tip:c1,i===2&&tip?white:c2)}},
  palm(g,x,y,z,r){const a=r()*TAU,ca=Math.cos(a),sa=Math.sin(a);let tx=x,tz=z;
    for(let i=0;i<4;i++){tx=x+ca*i*i*.06;tz=z+sa*i*i*.06;g.add(TP.cyl6,M(tx,y+i*.55,tz,.2-.025*i,.6,.2-.025*i),PTR)}
    for(let k=0;k<6;k++)g.add(TP.cone4,M(tx,y+2.2,tz,.16,1.5,.55,k/6*TAU+a,0,-1.9),PALM,PALM2)},
  cactus(g,x,y,z,r){const h=1.2+r()*1.1;g.add(TP.cyl8,M(x,y,z,.42,h,.42),CG1,CG2);g.add(TP.dome,M(x,y+h,z,.42,.3,.42),CG2);
    if(r()<.7){const d=r()<.5?1:-1;g.add(TP.box,M(x+d*.33,y+h*.45,z,.45,.2,.2),CG1);g.add(TP.cyl8,M(x+d*.5,y+h*.45,z,.22,.55,.22),CG1,CG2)}},
  rock(g,x,y,z,r,c,s){g.add(TP.ico,M(x,y+.22*s,z,s*(.8+r()*.5),s*(.6+r()*.4),s*(.8+r()*.5),r()*3,r()*.4),c)},
  hoodoo(g,x,y,z,r){let yy=y;const n=3+Math.floor(r()*3);for(let i=0;i<n;i++){const w=(i%2?.95:.62)-i*.05,h=i%2?.28:.55+r()*.5;
    g.add(TP.box,M(x,yy,z,w,h,w,r()*.6),mix3(MES1,MES2,i/n),mix3(MES1,MES2,(i+1)/n));yy+=h}},
  arch(g,x,y,z,r,c1,c2){g.add(TP.arch,M(x,y-.15,z,3.0,3.6,3.0,r()<.5?0:PI/2),c1,c2)},
  ice(g,x,y,z,r){const n=3+Math.floor(r()*3);for(let i=0;i<n;i++){const s=.6+r()*.9;
    g.add(TP.octa,M(x+(r()-.5)*.7,y+.55*s,z+(r()-.5)*.7,.42*s,1.7*s,.42*s,r()*3,(r()-.5)*.6,(r()-.5)*.6),ICE1,ICE2)}},
  flower(g,x,y,z,r,cols){const n=1+Math.floor(r()*3);for(let i=0;i<n;i++){const ox=(r()-.5)*.7,oz=(r()-.5)*.7,h=.22+r()*.22;
    g.add(TP.box,M(x+ox,y,z+oz,.035,h,.035),G1);g.add(TP.octa,M(x+ox,y+h+.05,z+oz,.17,.17,.17,r()*3),hex(cols[Math.floor(r()*cols.length)]))}},
  grass(g,x,y,z,r,c1,c2){for(let i=0;i<3;i++){const w=.32+r()*.18;g.add(TP.dome,M(x+(r()-.5)*.6,y,z+(r()-.5)*.6,w,.5+r()*.35,w,r()*3),c1,c2)}},
  mush(g,x,y,z,r,c){const s=.5+r()*.6;g.add(TP.cyl6,M(x,y,z,.14*s,.4*s,.14*s),cream);g.add(TP.dome,M(x,y+.36*s,z,.7*s,.42*s,.7*s),c)},
  lily(g,x,z,r){const s=.6+r()*.3;g.add(TP.cyl12,M(x,WATER+.01,z,s,.04,s,r()*3),LILY);
    if(r()<.55){g.add(TP.cone6,M(x,WATER+.24,z,.3,-.2,.3),PK2);g.add(TP.octa,M(x,WATER+.2,z,.14),WARM)}},
  reed(g,x,y,z,r){for(let i=0;i<3;i++){const h=.6+r()*.6,ox=(r()-.5)*.5,oz=(r()-.5)*.5;g.add(TP.box,M(x+ox,y,z+oz,.04,h,.04),G1);g.add(TP.box,M(x+ox,y+h,z+oz,.08,.22,.08),trunk)}},
  lantern(g,x,y,z){g.add(TP.box,M(x,y,z,.42,.14,.42),dark);g.add(TP.box,M(x,y+.14,z,.13,.8,.13),dark);g.add(TP.box,M(x,y+.94,z,.4,.4,.4),WARM);g.add(TP.cone4,M(x,y+1.34,z,.85,.3,.85),hex(0x5a55b0))},
  dead(g,x,y,z,r){g.add(TP.box,M(x,y,z,.16,1.5,.16,r()),MES1);g.add(TP.box,M(x,y+.9,z,.1,.8,.1,r()*3,0,.9),MES1);g.add(TP.box,M(x,y+1.2,z,.08,.6,.08,r()*3,0,-.8),MES1)},
  // Pampas: a low fountain of arching blades, with one or two soft plumes nodding out of it.
  pampas(g,x,y,z,r){const s=.6+r()*.35,base=r()*TAU;
    g.add(TP.dome,M(x,y,z,.85*s,.4*s,.85*s,base),hex(0x9f9e62),hex(0xc9c288));
    for(let i=0;i<7;i++){const a=base+i*TAU/7+(r()-.5)*.5,lean=.85+r()*.4,len=(.55+r()*.25)*s;
      g.add(TP.octa,M(x+Math.cos(a)*.18*s,y+.08*s+Math.cos(lean)*len*.5,z-Math.sin(a)*.18*s,.13*s,len,.03,a,0,-lean),hex(0xb3ad70),hex(0xe2d79c))}
    const n=1+(r()<.45?1:0);for(let i=0;i<n;i++){const a=base+i*2.6+(r()-.5)*.8,l=.35+r()*.3,h=(.6+r()*.3)*s,
      tx=x+Math.cos(a)*Math.sin(l)*h,tz=z-Math.sin(a)*Math.sin(l)*h,ty=y+Math.cos(l)*h;
      g.add(TP.box,M(x+Math.cos(a)*Math.sin(l)*h*.5,y,z-Math.sin(a)*Math.sin(l)*h*.5,.025,h*.9,.025,a,0,-l),hex(0xc2b07a));
      g.add(TP.ico1,M(tx,ty,tz,.3*s,.36*s,.3*s,a,0,-l),hex(0xe6d6aa),hex(0xf8f0d8));
      g.add(TP.ico1,M(tx+Math.cos(a)*Math.sin(l)*.14,ty+.14*s,tz-Math.sin(a)*Math.sin(l)*.14,.2*s,.26*s,.2*s,a,0,-l),hex(0xf0e4c0),hex(0xfffbee))}},
  leaves(g,x,y,z,r,c1,c2){for(let i=0;i<4;i++)g.add(TP.octa,M(x+(r()-.5)*.9,y+.02,z+(r()-.5)*.9,.22,.03,.15,r()*3),r()<.5?c1:c2)},
  bamboo(g,x,y,z,r,small){const n=small?2:2+Math.floor(r()*2);for(let i=0;i<n;i++){const ox=(r()-.5)*.7,oz=(r()-.5)*.7,h=small?.9+r()*.8:3+r()*2.2,w=small?.05:.1,l=(r()-.5)*.12;
    g.add(TP.cyl6,M(x+ox,y,z+oz,w,h,w,0,l,l),BAM1,BAM2);
    for(let k=0;k<(small?2:4);k++)g.add(TP.cone4,M(x+ox,y+h*(.72+k*.07),z+oz,.1,.8,.34,r()*TAU,0,-1.75-r()*.4),BAM1,BAM2)}},
  matsu(g,x,y,z,r){const a=r()*TAU,ca=Math.cos(a),sa=Math.sin(a),s=.9+r()*.5;let tx=x,tz=z;
    for(let i=0;i<4;i++){tx=x+ca*i*.22*s;tz=z+sa*i*.22*s;g.add(TP.cyl6,M(tx,y+i*.5*s,tz,.22-.03*i,.62*s,.22-.03*i),hex(0x5a4048))}
    const c1=hex(0x2f6a5a),c2=hex(0x6fae7a);g.add(TP.ico,M(tx,y+2.2*s,tz,2.0*s,.5*s,2.0*s,r()*3),c1,c2);
    g.add(TP.ico,M(tx-ca*.9*s,y+1.6*s,tz-sa*.9*s,1.4*s,.4*s,1.4*s,r()*3),c1,c2);g.add(TP.ico,M(tx+ca*.7*s,y+2.7*s,tz+sa*.7*s,1.2*s,.4*s,1.2*s,r()*3),c1,c2)},
  toro(g,x,y,z){g.add(TP.cyl6,M(x,y,z,.6,.14,.6),STONE);g.add(TP.cyl6,M(x,y+.14,z,.2,.75,.2),STONE);g.add(TP.cyl6,M(x,y+.89,z,.55,.1,.55),STONE);
    g.add(TP.box,M(x,y+.99,z,.36,.34,.36),WARM);g.add(TP.cone4,M(x,y+1.33,z,.95,.34,.95),hex(0x8f8a90),STONE);g.add(TP.ico,M(x,y+1.72,z,.14),STONE)},
  stump(g,x,y,z,kind){if(kind===1){g.add(TP.cyl6,M(x-.12,y,z+.08,.1,.22,.1),BAM1,BAM2);g.add(TP.cyl6,M(x+.15,y,z-.1,.1,.14,.1),BAM1,BAM2)}
    else{g.add(TP.cyl6,M(x,y,z,.36,.2,.36),trunk);g.add(TP.cyl6,M(x,y+.2,z,.3,.03,.3),hex(0xe8c9a0))}},
  // follies
  torii(g,x,y,z,r,acc){const a=r()<.5?0:PI/2,ux=Math.cos(a),uz=-Math.sin(a);
    for(const d of[-1,1]){g.add(TP.cyl8,M(x+d*ux,y,z+d*uz,.4,.3,.4),WOOD);g.add(TP.cyl8,M(x+d*ux,y+.3,z+d*uz,.28,2.6,.28),VERM,VERM2)}
    g.add(TP.box,M(x,y+2.25,z,2.8,.18,.2,a),VERM);g.add(TP.box,M(x,y+2.85,z,3.1,.22,.32,a),VERM);g.add(TP.box,M(x,y+3.07,z,3.6,.16,.46,a),ROOF);
    g.add(TP.box,M(x,y+2.43,z,.3,.42,.12,a),WOOD);return a?[[0,-1],[0,1]]:[[-1,0],[1,0]]},
  pagoda(g,x,y,z,r,acc){const n=3+Math.floor(r()*3);let yy=y+.3,w=1.7;g.add(TP.box,M(x,y,z,2.5,.3,2.5),STONE);
    for(let i=0;i<n;i++){const h=i?.75:1.15;g.add(TP.box,M(x,yy,z,w,h,w),i%2?VERM:cream2,i%2?VERM2:cream);
      for(let k=0;k<4;k++){const b=k*PI/2;g.add(TP.box,M(x+Math.sin(b)*(w/2+.01),yy+.12,z+Math.cos(b)*(w/2+.01),w*.3,h*.6,.05,b),dark)}
      yy+=h;g.add(TP.cone4,M(x,yy-.06,z,w*2.25,.5,w*2.25),ROOF,ROOF2);yy+=.22;w*=.8}
    g.add(TP.cyl6,M(x,yy+.2,z,.07,1.1,.07),gold);g.add(TP.ico,M(x,yy+1.35,z,.2),gold)},
  shrine(g,x,y,z,r,acc){const a=Math.floor(r()*4)*PI/2;g.add(TP.box,M(x,y,z,2.6,.35,2.6),STONE);g.add(TP.box,M(x,y+.35,z,1.7,1.25,1.7),cream2,cream);
    for(const[dx,dz]of[[1,1],[1,-1],[-1,1],[-1,-1]])g.add(TP.box,M(x+dx*.86,y+.35,z+dz*.86,.16,1.3,.16),VERM);
    g.add(TP.box,M(x+Math.sin(a)*.86,y+.35,z+Math.cos(a)*.86,.7,.95,.05,a),dark);
    g.add(TP.cone4,M(x,y+1.55,z,4.1,1.1,4.1),ROOF,ROOF2);g.add(TP.box,M(x,y+2.5,z,.9,.12,.22,a),gold)},
  bell(g,x,y,z,r,acc){g.add(TP.box,M(x,y,z,2.2,.25,2.2),STONE);for(const[dx,dz]of[[1,1],[1,-1],[-1,1],[-1,-1]])g.add(TP.box,M(x+dx*.8,y+.25,z+dz*.8,.18,1.9,.18),VERM);
    g.add(TP.cone4,M(x,y+2.1,z,3.6,.9,3.6),ROOF,ROOF2);g.add(TP.frus,M(x,y+1.0,z,.8,.9,.8),hex(0x6f8f7a),hex(0xb8c8a0));g.add(TP.box,M(x,y+1.9,z,.06,.3,.06),WOOD)},
};
const FOLLY=['torii','pagoda','shrine','torii','bell','pagoda'];

/* interactive chime shapes, one per biome */
const chimeGeo=B.map((bi,i)=>{const g=new Geo(),a=bi.acc;
  if(i===0){g.add(TP.cyl6,M(0,0,0,.1,1.9,.1),WOOD);g.add(TP.box,M(.2,1.85,0,.5,.08,.08),WOOD);g.add(TP.dome,M(.45,1.3,0,.6,.5,.6),hex(0xa8d8f0),hex(0xeaf8ff));g.add(TP.box,M(.45,.75,0,.14,.5,.02),VERM);g.add(TP.ico,M(.45,1.28,0,.12),gold)}
  if(i===1){for(const d of[-1,1])g.add(TP.box,M(d*.55,0,0,.14,1.7,.14),VERM);g.add(TP.box,M(0,1.7,0,1.5,.14,.2),ROOF);g.add(TP.frus,M(0,.55,0,.75,1.05,.75),hex(0x8a6a3a),hex(0xe8c060));g.add(TP.box,M(0,1.5,0,.05,.25,.05),WOOD)}
  if(i===2){for(let k=0;k<4;k++)g.add(TP.cyl8,M(-.42+k*.28,0,0,.22,1.0+k*.45,.22),BAM1,BAM2);g.add(TP.box,M(0,.5,0,1.3,.08,.3),WOOD)}
  if(i===3){const r=RNG(5);for(let k=0;k<6;k++){const s=.6+r()*1.1;g.add(TP.octa,M((r()-.5)*.8,.6*s,(r()-.5)*.8,.4*s,1.8*s,.4*s,r()*3,(r()-.5)*.7,(r()-.5)*.7),hex(0x7fc4f5),hex(0xffffff))}}
  if(i===4){g.add(TP.cyl12,M(0,0,0,1.5,.08,1.5),LILY);for(let k=0;k<8;k++){const t=k/8*TAU;g.add(TP.octa,M(Math.cos(t)*.34,.42,Math.sin(t)*.34,.34,.9,.2,-t,0,-.5),hex(0xff8fb0),hex(0xfff0f4))}g.add(TP.ico1,M(0,.4,0,.36),gold)}
  if(i===5){for(const d of[-1,1])g.add(TP.box,M(0,0,d*.3,.9,.5,.1),WOOD);g.add(TP.cyl12,M(0,1.0,-.45,1.05,.9,1.05,0,PI/2),VERM,VERM2);g.add(TP.cyl12,M(0,1.0,.44,.92,.03,.92,0,PI/2),cream)}
  if(i===6){g.add(TP.box,M(0,0,0,.5,.16,.5),dark);g.add(TP.box,M(0,.16,0,.12,1.3,.12),dark);g.add(TP.box,M(.28,1.42,0,.7,.08,.08),dark);g.add(TP.cyl6,M(.55,1.1,0,.03,.3,.03),dark);g.add(TP.ico1,M(.55,.85,0,.55,.65,.55),hex(0xffb0c8),hex(0xffe9a8))}
  return g.build()});

/* ---------- world chunks ---------- */
const chunks=new Map(),things=[];
const collected=new Set(),awake=new Set(),awakeBiomes=new Set(),felled=new Set();
function tileH(x,z){const ch=chunks.get((x>>4)+','+(z>>4));if(ch)return ch.H[(x&15)+(z&15)*CH];sample(x,z);return S.h}
const effH=(x,z)=>{const h=tileH(x,z);return h<0?0:h};
function blockedAt(fx,fz){const x=Math.floor(fx),z=Math.floor(fz),ch=chunks.get((x>>4)+','+(z>>4));if(tileH(x,z)<=-2)return true;return ch?ch.blk[(x&15)+(z&15)*CH]===1:false}
const octaG=new T.OctahedronGeometry(.24),moteMat=patch(new T.MeshBasicMaterial({color:0xffd866}));
function addMote(ch,x,z,h){const key=x+','+z;if(collected.has(key))return;const grp=new T.Group(),m=new T.Mesh(octaG,moteMat),sp=new T.Sprite(orbMat);
  sp.scale.setScalar(1.5);grp.add(sp,m);grp.position.set(x+.5,h+.95,z+.5);scene.add(grp);
  const th={type:0,x:x+.5,z:z+.5,y:h+.95,obj:grp,key,ph:hash2(x,z,3)*TAU,ch,pull:false};things.push(th);ch.things.push(th)}
function addChime(ch,x,z,h,b){const m=new T.Mesh(chimeGeo[b],worldMat);m.castShadow=true;m.position.set(x+.5,h,z+.5);m.rotation.y=hash2(x,z,9)*TAU;scene.add(m);
  const th={type:1,x:x+.5,z:z+.5,y:h,obj:m,b,note:Math.floor(hash2(x,z,8)*5),s:0,v:0,inside:false,cool:0,delay:-1,ch};things.push(th);ch.things.push(th)}
const boxG=new T.BoxGeometry(1,1,1).translate(0,.5,0),bigOcta=new T.OctahedronGeometry(.42);
const beamG=(()=>{const g=new T.CylinderGeometry(.34,.5,26,14,1,true).translate(0,13,0),p=g.attributes.position,c=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const k=1-p.getY(i)/26;c[i*3]=1*k*.5;c[i*3+1]=.9*k*.5;c[i*3+2]=.62*k*.5}g.setAttribute('color',new T.BufferAttribute(c,3));return g})();
const beamMat=new T.MeshBasicMaterial({vertexColors:true,transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});
function addSanctum(ch,st){const acc=B[st.b].acc,grp=new T.Group();grp.position.set(st.x+.5,st.h+.5,st.z+.5);
  const dims=[[.85,1.5,cream],[.6,1.3,acc],[.38,1.1,cream]],segs=dims.map(d=>{const g=new Geo();g.add(TP.box,M(0,0,0,d[0],d[1],d[0]),mix3(d[2],acc,.25),d[2]);g.add(TP.cone4,M(0,d[1]-.14,0,d[0]*2.5,.44,d[0]*2.5),ROOF,ROOF2);
    const m=new T.Mesh(g.build(),worldMat);m.castShadow=true;m.userData.h=d[1];grp.add(m);return m});
  const cmat=patch(new T.MeshBasicMaterial({color:0xb8b0cf})),cry=new T.Mesh(bigOcta,cmat);cry.scale.set(1,1.5,1);grp.add(cry);
  const glow=new T.Sprite(haloMat);glow.scale.setScalar(0);grp.add(glow);
  const beam=new T.Mesh(beamG,beamMat);beam.scale.set(1,.001,1);beam.visible=false;grp.add(beam);scene.add(grp);
  const on=awake.has(st.key),th={type:2,x:st.x+.5,z:st.z+.5,y:st.h+.5,obj:grp,st,segs,cry,cmat,glow,beam,awake:on,t:on?99:0,hintT:0,ch};things.push(th);ch.things.push(th)}

/* ---------- landmarks: every building on the island, placed from the map ---------- */
function house(g,x,y,z,a,s,acc){const c=Math.cos(a),n=Math.sin(a),at=(u,v)=>[x+u*c+v*n,z-u*n+v*c];
  g.add(TP.box,M(x,y,z,2.7*s,.22,2.3*s,a),STONE);
  g.add(TP.box,M(x,y+.22,z,2.2*s,1.3,1.8*s,a),cream2,cream);
  for(const[u,v]of[[1,1],[1,-1],[-1,1],[-1,-1]]){const[px,pz]=at(u*1.08*s,v*.88*s);g.add(TP.box,M(px,y+.22,pz,.14,1.32,.14,a),dark)}
  {const[px,pz]=at(0,.91*s);g.add(TP.box,M(px,y+.22,pz,.6,.95,.06,a),dark)}
  {const[px,pz]=at(.62*s,.91*s);g.add(TP.box,M(px,y+.8,pz,.42,.34,.06,a),WARM)}
  g.add(TP.cone4,M(x,y+1.5,z,3.5*s,1.05,3.0*s,a),ROOF,ROOF2);
  g.add(TP.box,M(x,y+2.5,z,1.2*s,.12,.16,a),acc)}
function toriiAt(g,x,y,z,a){const ux=Math.cos(a),uz=-Math.sin(a);
  for(const d of[-1,1]){g.add(TP.cyl8,M(x+d*ux,y,z+d*uz,.4,.3,.4),WOOD);g.add(TP.cyl8,M(x+d*ux,y+.3,z+d*uz,.28,2.6,.28),VERM,VERM2)}
  g.add(TP.box,M(x,y+2.25,z,2.8,.18,.2,a),VERM);g.add(TP.box,M(x,y+2.85,z,3.1,.22,.32,a),VERM);g.add(TP.box,M(x,y+3.07,z,3.6,.16,.46,a),ROOF);
  g.add(TP.box,M(x,y+2.43,z,.3,.42,.12,a),WOOD)}
function buildItem(g,it,y){const r=RNG(hash2(Math.floor(it.x*7),Math.floor(it.z*7),88)*1e9),acc=B[it.land].acc;
  switch(it.kind){
    case 'house':house(g,it.x,y,it.z,it.a,it.s||1,acc);break;
    case 'toro':Pr.toro(g,it.x,y,it.z);break;
    case 'torii':toriiAt(g,it.x,y,it.z,it.a);break;
    case 'pagoda':Pr.pagoda(g,it.x,y,it.z,r,acc);break;
    case 'shrine':Pr.shrine(g,it.x,y,it.z,r,acc);break;
    case 'bell':Pr.bell(g,it.x,y,it.z,r,acc);break;
    case 'well':g.add(TP.cyl8,M(it.x,y,it.z,1.1,.6,1.1),STONE);g.add(TP.cyl8,M(it.x,y+.58,it.z,.8,.04,.8),hex(0x6fb8c8));
      for(const d of[-1,1])g.add(TP.box,M(it.x+d*.5,y,it.z,.1,1.5,.1),WOOD);g.add(TP.box,M(it.x,y+1.5,it.z,1.3,.1,.14),WOOD);break;
    case 'wall':g.add(TP.box,M(it.x,y,it.z,1.05,it.h||1.6,.7,it.a),STONE,cream2);g.add(TP.box,M(it.x,y+(it.h||1.6),it.z,1.2,.18,.9,it.a),ROOF);break;
    case 'pier':g.add(TP.box,M(it.x,.15,it.z,1.6,.16,1.05),hex(0x8a6450),hex(0xa87a5e));for(const d of[-.7,.7])g.add(TP.cyl6,M(it.x+d,-1.4,it.z,.16,1.6,.16),WOOD);break;
    case 'bigBamboo':{const h=8+r()*4,w=.32+r()*.12;g.add(TP.cyl8,M(it.x,y,it.z,w,h,w,0,(r()-.5)*.08,(r()-.5)*.08),BAM1,BAM2);
      for(let k=0;k<5;k++)g.add(TP.cone4,M(it.x,y+h*(.7+k*.06),it.z,.2,1.8,.6,r()*TAU,0,-1.75-r()*.4),BAM1,BAM2);break}
  }}
const ITEMS=(()=>{const out=[],rr=RNG(424242);
  const add=(kind,x,z,o={})=>out.push(Object.assign({kind,x,z,foot:{house:1.4,toro:.5,pagoda:1.6,shrine:1.6,bell:1.3,well:.6,wall:.5,bigBamboo:.5}[kind]||0},o));
  for(const l of MAP.LANDMARKS){const land=l.land,L=(kind,x,z,o={})=>add(kind,x,z,Object.assign({land},o));
    const ring=(n,rad,kind,o={})=>{for(let i=0;i<n;i++){const a=i/n*TAU+(o.turn||0);L(kind,l.x+Math.cos(a)*rad,l.z+Math.sin(a)*rad,Object.assign({a:-a-PI/2},o))}};
    if(l.kind==='waystation'){L('toro',-3.5,4.5);L('toro',3.5,4.5)}
    else if(l.kind==='yard'){ring(8,9.5,'toro');L('bell',l.x,l.z-7)}
    else if(l.kind==='hamlet'){ring(l.houses,l.r*.58,'house',{turn:rr()});L('well',l.x,l.z);L('toro',l.x+2.5,l.z+2.5)}
    else if(l.kind==='town'){const inner=Math.ceil(l.houses/3);ring(inner,l.r*.42,'house',{turn:.3});ring(l.houses-inner,l.r*.78,'house',{turn:.1});
      L('pagoda',l.x,l.z);for(const[a,b]of[[3,3],[-3,3],[3,-3],[-3,-3]])L('toro',l.x+a,l.z+b);
      if(l.name==='The Last Village')for(let k=0;k<14;k++)L('pier',l.x-2,l.z+l.r*.95+k*1.05,{y:0})}
    else if(l.kind==='steps'){L('pagoda',l.x,l.z);L('toro',l.x+4,l.z+4);L('toro',l.x-4,l.z-4);
      for(let k=0;k<7;k++){const t=.42+k*.07;L('torii',300+92*t,-58-92*t,{a:-PI/4})}}
    else if(l.kind==='cathedral'){ring(22,11,'bigBamboo');ring(12,7.5,'bigBamboo',{turn:.13});L('shrine',l.x,l.z)}
    else if(l.kind==='drowned'){for(let k=-2;k<=2;k++)L('torii',l.x+k*5,l.z+k*5,{a:PI/4})}
    else if(l.kind==='dojo'){L('pagoda',l.x,l.z);L('bell',l.x+6,l.z+6);L('toro',l.x-6,l.z+6);
      for(let k=-8;k<=8;k++){if(Math.abs(k)<2||(k>3&&k<6))continue;L('wall',l.x+k,l.z-8.5,{a:0,h:1.2+((k*7)%5)*.15});L('wall',l.x-8.5,l.z+k,{a:PI/2,h:1.1+((k*5)%4)*.2})}}
    else if(l.kind==='pass'){L('torii',l.x,l.z,{a:-1.43});
      for(const side of[-1,1])for(let k=3;k<=9;k++)L('wall',l.x+side*k*.145,l.z+side*k*.99,{a:-1.43,h:2.4});L('toro',l.x+3,l.z-1);L('toro',l.x-3,l.z+1)}
    else if(l.kind==='monastery'){L('pagoda',l.x,l.z);L('shrine',l.x+6.5,l.z);L('bell',l.x-6.5,l.z);ring(6,9,'toro')}
  }
  return out})();

function genChunk(cx,cz){
  const x0=cx*CH,z0=cz*CH,N=CH+2,Hh=new Float32Array(N*N),Bb=new Uint8Array(N*N),Sf=new Uint8Array(N*N),Cl=new Uint8Array(N*N),Ct=new Float32Array(N*N*3),Ca=new Float32Array(N*N*3),Cb=new Float32Array(N*N*3),Cm=new Float32Array(3);
  let site=null;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=x0+i-1,z=z0+j-1,k=i+j*N;sample(x,z);Hh[k]=S.h;Bb[k]=S.b;Sf[k]=S.site;Cl[k]=S.clear;tileCols(x,z,Ct,Ca,Cb,k*3);
    if(S.st.x===x&&S.st.z===z&&i>0&&j>0&&i<=CH&&j<=CH)site=S.st}
  const ch={cx,cz,H:new Float32Array(CH*CH),blk:new Uint8Array(CH*CH),things:[],cuts:[],extra:[],mesh:null},g=new Geo();
  const blk=(i,j)=>{if(i>=1&&j>=1&&i<=CH&&j<=CH)ch.blk[(i-1)+(j-1)*CH]=1};
  // cuttable props: baked into the chunk mesh, with their vertex range remembered so the sword can lift them out
  const cutp=(kind,solid,i,j,x,z,h,fn)=>{const key=x+','+z;if(felled.has(key)){if(solid)Pr.stump(g,x+.5,h,z+.5,kind);return}
    const v0=g.p.length/3;fn();ch.cuts.push({key,kind,solid,hp:solid&&kind===0?2:1,x:x+.5,z:z+.5,h,v0,v1:g.p.length/3,idx:(i-1)+(j-1)*CH,ch,m:null,st:0,live:false});if(solid)blk(i,j)};
  const flat8=(i,j)=>{const h=Hh[i+j*N];for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++)if(Hh[i+a+(j+b)*N]!==h||Sf[i+a+(j+b)*N])return false;return true};
  for(let j=1;j<=CH;j++)for(let i=1;i<=CH;i++){const k=i+j*N,h=Hh[k],x=x0+i-1,z=z0+j-1,o=k*3;ch.H[(i-1)+(j-1)*CH]=h;
    g.quad([x,h,z],[x,h,z+1],[x+1,h,z+1],[x+1,h,z],[0,1,0],Ct,o,Ct,o);
    const side=(nh,a,b,c,d,n)=>{const t=Math.min(1,(h-nh)/3.5);Cm[0]=lerp(Ca[o],Cb[o],t);Cm[1]=lerp(Ca[o+1],Cb[o+1],t);Cm[2]=lerp(Ca[o+2],Cb[o+2],t);g.quad(a,b,c,d,n,Ca,o,Cm,0)};
    let nh=Hh[k+1];if(nh<h)side(nh,[x+1,h,z],[x+1,h,z+1],[x+1,nh,z+1],[x+1,nh,z],[1,0,0]);
    nh=Hh[k-1];if(nh<h)side(nh,[x,h,z],[x,h,z+1],[x,nh,z+1],[x,nh,z],[-1,0,0]);
    nh=Hh[k+N];if(nh<h)side(nh,[x,h,z+1],[x+1,h,z+1],[x+1,nh,z+1],[x,nh,z+1],[0,0,1]);
    nh=Hh[k-N];if(nh<h)side(nh,[x,h,z],[x+1,h,z],[x+1,nh,z],[x,nh,z],[0,0,-1])}
  // landmarks: built where the map puts them
  let fi=-9,fj=-9;
  for(const it of ITEMS){const ii=Math.floor(it.x)-x0+1,jj=Math.floor(it.z)-z0+1;
    if(ii<-3||jj<-3||ii>CH+4||jj>CH+4)continue;
    const fr=Math.ceil(it.foot||0);for(let b=-fr;b<=fr;b++)for(let a=-fr;a<=fr;a++)if(Math.hypot(a,b)<=(it.foot||0))blk(ii+a,jj+b);
    if(ii<1||jj<1||ii>CH||jj>CH)continue;
    buildItem(g,it,it.y!==undefined?it.y:Hh[ii+jj*N])}
  // shrine statics
  if(site){const acc=B[site.b].acc,sx=site.x+.5,sz=site.z+.5;
    for(const[dx,dz]of[[3,0],[-3,0],[0,3],[0,-3]]){const px=sx+dx,pz=sz+dz,y=site.h;
      g.add(TP.cyl8,M(px,y,pz,.7,.2,.7),cream2);g.add(TP.cyl8,M(px,y+.2,pz,.32,2.0,.32),VERM,VERM2);g.add(TP.box,M(px,y+2.2,pz,.56,.46,.56),WARM);g.add(TP.cone4,M(px,y+2.66,pz,1.35,.45,1.35),ROOF,ROOF2);g.add(TP.ico,M(px,y+3.16,pz,.16),gold);
      blk(site.x-x0+1+dx,site.z-z0+1+dz)}
    g.add(TP.box,M(sx,site.h+.5,sz,1.15,.6,1.15),acc,mix3(acc,cream,.5));blk(site.x-x0+1,site.z-z0+1);addSanctum(ch,site)}
  // scatter
  for(let j=1;j<=CH;j++)for(let i=1;i<=CH;i++){const k=i+j*N;if(Sf[k]||Cl[k])continue;
    const h=Hh[k],b=Bb[k],x=x0+i-1,z=z0+j-1,X=x+.5,Z=z+.5;if(Math.hypot(X,Z)<5)continue;
    // Things grow in groves with open ground between: thin the chance outside them.
    const grove=.06+.72*Math.max(MAP.forestAt(X,Z),.4*sstep(.5,.62,fbm(X/40,Z/40,57,2))),r=RNG(hash2(x,z,13)*1e9),p=h<0?r():r()/grove,bi=B[b];
    if(h<0){if(b===4||b===0||b===6){if(p<.11)Pr.lily(g,X,Z,r)}else if(b===3){if(p<.07)g.add(TP.cyl6,M(X,WATER-.1,Z,.8+r()*.5,.22,.8+r()*.5,r()*3),ICE2)}else if(p<.05)Pr.lily(g,X,Z,r);
      if(h===-.5&&p>.93)Pr.reed(g,X,h,Z,r);continue}
    const flat=Hh[k+1]===h&&Hh[k-1]===h&&Hh[k+N]===h&&Hh[k-N]===h;
  const ct=(kind,solid,fn)=>cutp(kind,solid,i,j,x,z,h,fn);
  switch(b){
    case 0:if(p<.018)ct(0,1,()=>Pr.matsu(g,X,h,Z,r));else if(p<.42)ct(2,0,()=>Pr.pampas(g,X,h,Z,r));else if(p<.5)ct(2,0,()=>Pr.grass(g,X,h,Z,r,hex(0xa9b87a),hex(0xe6dca0)));else if(p<.51){Pr.rock(g,X,h,Z,r,STONE,.9);blk(i,j)}else if(p<.56)Pr.flower(g,X,h,Z,r,bi.bloom);break;
    case 1:if(p<.12)ct(0,1,()=>Pr.roundTree(g,X,h,Z,r,hex(0xe39a1c),hex(0xffe270)));else if(p<.34)Pr.leaves(g,X,h,Z,r,hex(0xffd84a),hex(0xf2a030));else if(p<.36){Pr.rock(g,X,h,Z,r,STONE,1);blk(i,j)}else if(p<.375&&flat){Pr.toro(g,X,h,Z);blk(i,j)}else if(p<.42)Pr.flower(g,X,h,Z,r,bi.bloom);break;
    case 2:if(p<.2)ct(1,1,()=>Pr.bamboo(g,X,h,Z,r));else if(p<.3)ct(1,0,()=>Pr.bamboo(g,X,h,Z,r,1));else if(p<.4)ct(2,0,()=>Pr.grass(g,X,h,Z,r,hex(0x3f8a5a),hex(0xa8e08a)));else if(p<.415){Pr.rock(g,X,h,Z,r,hex(0x7fa08a),1);blk(i,j)}else if(p<.43&&flat){Pr.toro(g,X,h,Z);blk(i,j)}else if(p<.46)Pr.flower(g,X,h,Z,r,bi.bloom);break;
    case 3:if(p<.05)ct(0,1,()=>Pr.pine(g,X,h,Z,r,hex(0x4f8fa8),hex(0xb8e0ee),ICE2));else if(p<.085){Pr.ice(g,X,h,Z,r);blk(i,j)}else if(p<.11){Pr.rock(g,X,h,Z,r,ICE2,1.1);blk(i,j)}else if(p<.125&&flat){Pr.toro(g,X,h,Z);blk(i,j)}break;
    case 4:if(p<.07)ct(0,1,()=>Pr.matsu(g,X,h,Z,r));else if(p<.2)ct(2,0,()=>Pr.reed(g,X,h,Z,r));else if(p<.22){Pr.rock(g,X,h,Z,r,STONE,.9);blk(i,j)}else if(p<.32)Pr.flower(g,X,h,Z,r,bi.bloom);break;
    case 5:if(p<.1)ct(0,1,()=>Pr.roundTree(g,X,h,Z,r,hex(0xb8242c),hex(0xff8a4a)));else if(p<.3)Pr.leaves(g,X,h,Z,r,hex(0xe8402e),hex(0xffa050));else if(p<.32){Pr.rock(g,X,h,Z,r,hex(0x8a5a6a),1);blk(i,j)}else if(p<.37)ct(2,0,()=>Pr.grass(g,X,h,Z,r,hex(0xa8405a),hex(0xf6a070)));else if(p<.4)Pr.flower(g,X,h,Z,r,bi.bloom);break;
    case 6:if(p<.07)ct(0,1,()=>Pr.roundTree(g,X,h,Z,r,PK1,PK2));else if(p<.085&&flat){Pr.toro(g,X,h,Z);blk(i,j)}else if(p<.27)Pr.flower(g,X,h,Z,r,bi.bloom);else if(p<.33)Pr.leaves(g,X,h,Z,r,PK2,PK1);else if(p<.37)ct(2,0,()=>Pr.grass(g,X,h,Z,r,hex(0xc9a0d8),PK2));break}}
// interactive
  const mr=RNG(hash2(cx,cz,91)*1e9);
  const spot=()=>{const i=1+Math.floor(mr()*CH),j=1+Math.floor(mr()*CH),k=i+j*N;if(Hh[k]<.5||Sf[k]||ch.blk[(i-1)+(j-1)*CH])return null;return{i,j,k,x:x0+i-1,z:z0+j-1,h:Hh[k]}};
  if(mr()<.85){const s=spot();if(s)addMote(ch,s.x,s.z,s.h)}
  for(let n=0;n<2;n++){const s=spot();if(s&&Math.hypot(s.x,s.z)>6){addChime(ch,s.x,s.z,s.h,Bb[s.k]);blk(s.i,s.j)}}
  if(cx===0&&cz===0){addMote(ch,5,3,ch.H[5+3*CH]);addMote(ch,2,8,ch.H[2+8*CH]);addChime(ch,6,7,ch.H[6+7*CH],0);ch.blk[6+7*CH]=1}
  if(cx===-1&&cz===-1)addMote(ch,-5,-4,ch.H[11+12*CH]);
  ch.mesh=new T.Mesh(g.build(),worldMat);ch.mesh.castShadow=ch.mesh.receiveShadow=true;scene.add(ch.mesh);chunks.set(cx+','+cz,ch)}
function dropThing(th){scene.remove(th.obj);const i=things.indexOf(th);if(i>=0)things.splice(i,1)}
function updateChunks(all){const pcx=Math.floor(P.x)>>4,pcz=Math.floor(P.z)>>4;let best=null,bd=1e9;
  for(let dz=-R;dz<=R;dz++)for(let dx=-R;dx<=R;dx++){const k=(pcx+dx)+','+(pcz+dz);if(!chunks.has(k)){if(all)genChunk(pcx+dx,pcz+dz);else{const d=dx*dx+dz*dz;if(d<bd){bd=d;best=[pcx+dx,pcz+dz]}}}}
  if(best)genChunk(best[0],best[1]);
  for(const[k,ch]of chunks)if(Math.abs(ch.cx-pcx)>R+1||Math.abs(ch.cz-pcz)>R+1){scene.remove(ch.mesh);ch.mesh.geometry.dispose();for(const t of ch.things.slice())dropThing(t);for(const m of ch.extra){scene.remove(m);m.geometry.dispose()}chunks.delete(k)}}

/* ---------- player ---------- */
const P={x:.5,z:.5,y:1.5,face:PI/4,walk:0,hop:0,motes:0,target:null,stuck:0,lastTile:''};
const pg=(()=>{const g=new Geo(),ind=hex(0x2c3152),ind2=hex(0x53608f);
  g.add(TP.robe,M(0,0,0),ind,ind2);g.add(TP.cyl12,M(0,.3,0,.5,.07,.5),VERM);g.add(TP.ico1,M(0,.82,0,.28),cream);
  g.add(TP.cone8,M(0,.88,0,1.0,.24,1.0),hex(0xcfae6a),hex(0xf2dfa0));g.add(TP.box,M(0,.6,-.14,.3,.1,.14),VERM);return g.build()})();
const player=new T.Group(),pbody=new T.Mesh(pg,worldMat);pbody.castShadow=true;player.add(pbody);
const porb=new T.Sprite(orbMat);porb.scale.setScalar(.5);porb.position.set(.42,.7,.1);player.add(porb);scene.add(player);
const trail=[];for(let i=0;i<10;i++){const s=new T.Sprite(orbMat);s.scale.setScalar(0);s.position.set(.5,2,.5);scene.add(s);trail.push(s)}

/* stepping stones that rise from water */
const STN=40,stoneMesh=new T.InstancedMesh(new T.CylinderGeometry(.47,.42,2.4,6).translate(0,-1.2,0),patch(new T.MeshLambertMaterial({color:0xf6ecd9})),STN);
stoneMesh.castShadow=stoneMesh.receiveShadow=true;stoneMesh.frustumCulled=false;scene.add(stoneMesh);
const stones=[];for(let i=0;i<STN;i++){stones.push({k:null,x:0,z:0,t:0});stoneMesh.setMatrixAt(i,M(0,-50,0,0))}
function updStones(dt){const px=Math.floor(P.x),pz=Math.floor(P.z);
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const tx=px+dx,tz=pz+dz;if(Math.hypot(tx+.5-P.x,tz+.5-P.z)>1.9||tileH(tx,tz)>=0||tileH(tx,tz)<=-2)continue;
    const k=tx+','+tz;if(stones.some(s=>s.k===k))continue;const s=stones.find(s=>s.k===null);if(s){s.k=k;s.x=tx;s.z=tz;s.t=0;if(A.ctx&&Math.random()<.5)pluck(48+SCALE[(tx+tz&3)],{vol:.05,dur:.8})}}
  for(let i=0;i<STN;i++){const s=stones[i];if(s.k===null)continue;const up=Math.hypot(s.x+.5-P.x,s.z+.5-P.z)<2.5;s.t=clamp(s.t+(up?3:-1.4)*dt,0,1);
    if(s.t<=0&&!up){s.k=null;stoneMesh.setMatrixAt(i,M(0,-50,0,0))}else stoneMesh.setMatrixAt(i,M(s.x+.5,-1.3*(1-sstep(0,1,s.t)),s.z+.5,1,1,1,(s.x*7+s.z*3)%6*.3))}
  stoneMesh.instanceMatrix.needsUpdate=true}

/* blooms */
const BL=360,flowerG=(()=>{const g=new Geo();for(let k=0;k<5;k++){const a=k/5*TAU;g.add(TP.octa,M(Math.cos(a)*.14,.14,Math.sin(a)*.14,.24,.07,.14,-a,0,.35),white)}g.add(TP.ico,M(0,.17,0,.12),[1,.93,.55]);g.add(TP.box,M(0,0,0,.03,.14,.03),[.6,.85,.6]);return g.build()})();
const bloomMesh=new T.InstancedMesh(flowerG,patch(new T.MeshLambertMaterial({vertexColors:true})),BL);bloomMesh.frustumCulled=false;bloomMesh.receiveShadow=true;scene.add(bloomMesh);
const blooms=[],_col=new T.Color();let bi=0;for(let i=0;i<BL;i++){blooms.push({live:false});bloomMesh.setMatrixAt(i,M(0,-50,0,0));bloomMesh.setColorAt(i,_col.set(0xffffff))}
function bloom(x,y,z,c,delay=0,s=1){const i=bi++%BL;blooms[i]={live:true,x,y,z,t:-delay,s,r:Math.random()*TAU};bloomMesh.setColorAt(i,_col.set(c));bloomMesh.instanceColor.needsUpdate=true}
function updBlooms(dt){let ch=false;for(let i=0;i<BL;i++){const b=blooms[i];if(!b.live)continue;b.t+=dt*1.8;if(b.t<0)continue;const e=backOut(Math.min(1,b.t))*b.s;bloomMesh.setMatrixAt(i,M(b.x,b.y,b.z,e,e,e,b.r));ch=true;if(b.t>=1)b.live=false}
  if(ch)bloomMesh.instanceMatrix.needsUpdate=true}
function bloomRing(x,z,r0,r1,n,b){for(let i=0;i<n;i++){const a=Math.random()*TAU,d=lerp(r0,r1,Math.sqrt(Math.random())),bx=x+Math.cos(a)*d,bz=z+Math.sin(a)*d,tx=Math.floor(bx),tz=Math.floor(bz),h=tileH(tx,tz);
  if(h<0||blockedAt(bx,bz))continue;const c=B[b].bloom;bloom(bx,h,bz,c[i%c.length],d*.12,.9+Math.random()*.7)}}

/* pulses & sparkles */
const ringG=new T.RingGeometry(.93,1,56).rotateX(-PI/2),pulses=[];
for(let i=0;i<10;i++){const m=new T.Mesh(ringG,new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false}));m.visible=false;m.renderOrder=2;scene.add(m);pulses.push({m,t:1,dur:1,r:1})}
let pi_=0;function pulse(x,y,z,r,dur=1.2,col=0xffffff){const p=pulses[pi_++%10];p.m.position.set(x,y+.07,z);p.m.material.color.set(col);p.t=0;p.dur=dur;p.r=r;p.m.visible=true}
const sparks=[];for(let i=0;i<70;i++){const s=new T.Sprite(orbMat);s.scale.setScalar(0);s.visible=false;scene.add(s);sparks.push({s,l:0,vx:0,vy:0,vz:0})}
let si=0;function burst(x,y,z,n,sp=2.4){for(let i=0;i<n;i++){const k=sparks[si++%70],a=Math.random()*TAU;k.s.position.set(x,y,z);k.vx=Math.cos(a)*sp*Math.random();k.vz=Math.sin(a)*sp*Math.random();k.vy=1+Math.random()*2.4;k.l=1;k.s.visible=true}}
function updFx(dt){for(const p of pulses){if(p.t>=1)continue;p.t+=dt/p.dur;const e=1-Math.pow(1-Math.min(1,p.t),3);p.m.scale.setScalar(.3+e*p.r);p.m.material.opacity=(1-p.t)*.85;if(p.t>=1)p.m.visible=false}
  for(const k of sparks){if(k.l<=0)continue;k.l-=dt*.9;k.vy-=dt*2.2;k.s.position.x+=k.vx*dt;k.s.position.y+=k.vy*dt;k.s.position.z+=k.vz*dt;k.s.scale.setScalar(Math.max(0,k.l)*.34);if(k.l<=0)k.s.visible=false}}

/* ambient motes in the air */
const PN=240,pgeo=new T.BufferGeometry(),ppos=new Float32Array(PN*3),pseed=new Float32Array(PN);
for(let i=0;i<PN;i++){ppos[i*3]=(Math.random()-.5)*44;ppos[i*3+1]=Math.random()*11;ppos[i*3+2]=(Math.random()-.5)*44;pseed[i]=Math.random()*TAU}
pgeo.setAttribute('position',new T.BufferAttribute(ppos,3));
const pmat=new T.PointsMaterial({map:GT,size:7*renderer.getPixelRatio(),sizeAttenuation:false,transparent:true,opacity:.75,depthWrite:false,color:0xfffbe0});
const wind={x:.35,z:.15,tx:.35,tz:.15};const points=new T.Points(pgeo,pmat);points.frustumCulled=false;scene.add(points);const pcolT=new T.Color(0xfffbe0);
function updPoints(dt,t){wind.x+=(wind.tx-wind.x)*dt*.6;wind.z+=(wind.tz-wind.z)*dt*.6;const fall=curB===3?-1.3:curB===5?.5:curB===2?.05:-.12;
  for(let i=0;i<PN;i++){const o=i*3,s=pseed[i];ppos[o]+=(wind.x+Math.sin(t*.5+s)*.4)*dt;ppos[o+1]+=(fall+Math.sin(t*.9+s*3)*.25)*dt;ppos[o+2]+=(wind.z+Math.cos(t*.4+s*2)*.4)*dt;
    if(ppos[o]-P.x>22)ppos[o]-=44;else if(ppos[o]-P.x<-22)ppos[o]+=44;if(ppos[o+2]-P.z>22)ppos[o+2]-=44;else if(ppos[o+2]-P.z<-22)ppos[o+2]+=44;
    const ry=ppos[o+1]-P.y;if(ry>11)ppos[o+1]-=11.5;else if(ry<-.5)ppos[o+1]+=11.5}
  pgeo.attributes.position.needsUpdate=true;pmat.color.lerp(pcolT,dt*.8);pmat.opacity=.55+U.uNight.value*.4}

/* paper birds */
const wingG=new T.BufferGeometry();wingG.setAttribute('position',new T.Float32BufferAttribute([0,0,-.3,0,0,.42,.95,0,-.05],3));wingG.computeVertexNormals();
const birdMat=patch(new T.MeshLambertMaterial({color:0xffffff,side:T.DoubleSide})),birds=[];
for(let i=0;i<7;i++){const g=new T.Group(),a=new T.Mesh(wingG,birdMat),b=new T.Mesh(wingG,birdMat);b.scale.x=-1;a.castShadow=b.castShadow=true;g.add(a,b);g.scale.setScalar(.62);scene.add(g);
  const row=Math.ceil(i/2),sd=i%2?1:-1;birds.push({g,a,b,ox:-row*1.25,oz:sd*row*1.05,ph:i*1.3})}
let flockA=0;function updBirds(dt,t){flockA+=dt*.16;const rad=10+Math.sin(t*.07)*5,cx=P.x+Math.cos(flockA)*rad,cz=P.z+Math.sin(flockA)*rad,hx=-Math.sin(flockA),hz=Math.cos(flockA);
  for(const b of birds){b.g.position.set(cx+hx*b.ox-hz*b.oz,P.y+7.5+Math.sin(t*.8+b.ph)*.5,cz+hz*b.ox+hx*b.oz);b.g.rotation.y=Math.atan2(hx,hz);const f=Math.sin(t*5.5+b.ph)*.6;b.a.rotation.z=f;b.b.rotation.z=-f}}

/* ---------- audio ---------- */
const A={ctx:null,on:true},SCALE=[0,2,4,7,9],midi=n=>440*Math.pow(2,(n-69)/12);
const CHORDS=[[48,55,64,67],[45,52,60,64],[41,48,57,60],[43,50,59,62]];
const INST=[{type:'sine',oct:0,dur:2.4},{type:'triangle',oct:-1,dur:2},{type:'sine',oct:0,dur:1.3},{type:'sine',oct:1,dur:3.2},{type:'sine',oct:0,dur:2.8},{type:'triangle',oct:-1,dur:1.7},{type:'sine',oct:1,dur:2.2}];
function initAudio(){const C=window.AudioContext||window.webkitAudioContext;if(!C||A.ctx)return;try{
  const ctx=A.ctx=new C();A.master=ctx.createGain();A.master.gain.value=.6;const comp=ctx.createDynamicsCompressor();A.master.connect(comp);comp.connect(ctx.destination);
  const len=Math.floor(ctx.sampleRate*3.2),ir=ctx.createBuffer(2,len,ctx.sampleRate);for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6)}
  A.rev=ctx.createConvolver();A.rev.buffer=ir;const rg=ctx.createGain();rg.gain.value=.5;A.rev.connect(rg);rg.connect(A.master);
  const pf=ctx.createBiquadFilter();pf.type='lowpass';pf.frequency.value=720;const pg=ctx.createGain();pg.gain.value=0;pg.gain.linearRampToValueAtTime(.05,ctx.currentTime+7);pf.connect(pg);pg.connect(A.rev);pg.connect(A.master);
  A.pad=[];for(let i=0;i<4;i++){const pair=[];for(const det of[-6,6]){const o=ctx.createOscillator();o.type=i%2?'triangle':'sine';o.detune.value=det;o.frequency.value=midi(CHORDS[0][i]);o.connect(pf);o.start();pair.push(o)}A.pad.push(pair)}
  const nb=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  const ns=ctx.createBufferSource();A.nb=nb;ns.buffer=nb;ns.loop=true;const nf=ctx.createBiquadFilter();nf.type='bandpass';nf.frequency.value=420;nf.Q.value=.6;const ng=ctx.createGain();ng.gain.value=.018;
  const lfo=ctx.createOscillator(),lg=ctx.createGain();lfo.frequency.value=.07;lg.gain.value=.012;lfo.connect(lg);lg.connect(ng.gain);lfo.start();ns.connect(nf);nf.connect(ng);ng.connect(A.master);ns.start();
  }catch(e){A.ctx=null}}
function setChord(i){if(!A.ctx)return;A.pad.forEach((pair,j)=>pair.forEach(o=>o.frequency.setTargetAtTime(midi(CHORDS[i][j]),A.ctx.currentTime,2.2)))}
function pluck(note,o={}){if(!A.ctx)return;const ctx=A.ctx,t=ctx.currentTime+(o.delay||0),vol=o.vol||.16,dur=o.dur||2.2,g=ctx.createGain();
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);g.connect(A.rev);g.connect(A.master);
  const o1=ctx.createOscillator();o1.type=o.type||'sine';o1.frequency.value=midi(note);o1.connect(g);o1.start(t);o1.stop(t+dur+.1);
  const g2=ctx.createGain();g2.gain.value=.22;g2.connect(g);const o2=ctx.createOscillator();o2.type='sine';o2.frequency.value=midi(note+12)*1.002;o2.connect(g2);o2.start(t);o2.stop(t+dur*.6)}
function noise(o){if(!A.ctx)return;const c=A.ctx,t=c.currentTime+(o.delay||0),s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=A.nb;s.loop=true;
  f.type=o.type||'bandpass';f.Q.value=o.q||.8;f.frequency.setValueAtTime(o.f0,t);f.frequency.exponentialRampToValueAtTime(o.f1||o.f0,t+o.dur);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(o.vol,t+(o.att||.02));g.gain.exponentialRampToValueAtTime(.0001,t+o.dur);
  s.connect(f);f.connect(g);g.connect(A.master);if(o.rev)g.connect(A.rev);s.start(t,Math.random());s.stop(t+o.dur+.05)}
function tone(o){if(!A.ctx)return;const c=A.ctx,t=c.currentTime+(o.delay||0),os=c.createOscillator(),g=c.createGain();os.type=o.type||'sine';
  os.frequency.setValueAtTime(o.f0,t);os.frequency.exponentialRampToValueAtTime(o.f1||o.f0,t+o.dur);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(o.vol,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+o.dur);
  os.connect(g);g.connect(A.master);if(o.rev)g.connect(A.rev);os.start(t);os.stop(t+o.dur+.05)}
let chordI=0,chordT=0,melT=3;
function updMusic(dt){if(!A.ctx)return;chordT+=dt;if(chordT>15){chordT=0;chordI=(chordI+1+Math.floor(Math.random()*2))%4;setChord(chordI)}
  melT-=dt;if(melT<=0){melT=2.2+Math.random()*4;const ins=INST[curB],n=60+ins.oct*12+SCALE[Math.floor(Math.random()*5)]+(Math.random()<.25?12:0);pluck(n,{type:ins.type,dur:ins.dur,vol:.07});
    if(Math.random()<.4)pluck(n+(Math.random()<.5?7:4),{type:ins.type,dur:ins.dur,vol:.05,delay:.28})}}

/* ---------- HUD ---------- */
const gl=$('glyphs');B.forEach((b,i)=>{const e=document.createElement('i');e.style.setProperty('--g',b.glyph);e.title=b.name;gl.appendChild(e)});
function hud(){$('mc').textContent=P.motes;[...gl.children].forEach((e,i)=>e.classList.toggle('on',awakeBiomes.has(i)));[...$('res').children].forEach((e,i)=>{e.firstChild.textContent=inv[i];e.classList.toggle('on',inv[i]>0)})}
let hintTimer=0;function say(t,d=6){const h=$('hint');h.textContent=t;h.classList.add('on');hintTimer=d}
let curB=0,biomeTimer=0,biomeCheck=0;function showBiome(n){const e=$('biome');e.textContent=n;e.classList.add('on');biomeTimer=4.5}
const seen={mote:false,chime:false,cut:false};

/* ---------- interactions ---------- */
function ringChime(th,delay=0){if(delay>0){th.delay=delay;return}th.v=7;th.cool=.5;hooks.chime(th);const ins=INST[th.b];
  pluck(60+ins.oct*12+SCALE[th.note],{type:ins.type,dur:ins.dur+.6,vol:.17});pluck(72+ins.oct*12+SCALE[(th.note+2)%5],{dur:1.6,vol:.06,delay:.12});
  pulse(th.x,th.y,th.z,3.2,1.3,0xffffff);burst(th.x,th.y+1.5,th.z,7);bloomRing(th.x,th.z,.7,2.4,6,th.b);
  if(!seen.chime){seen.chime=true;say('Press H to hum. Everything nearby answers.',7)}}
function collect(th){collected.add(th.key);dropThing(th);const i=th.ch.things.indexOf(th);if(i>=0)th.ch.things.splice(i,1);P.motes++;hud();
  burst(th.x,th.obj.position.y,th.z,9);pluck(72+SCALE[P.motes%5],{vol:.14,dur:1.6});pluck(79+SCALE[P.motes%5],{vol:.09,dur:1.8,delay:.11});
  if(!seen.mote){seen.mote=true;say('Light follows you. Carry three to a sleeping shrine. The wind and the diamond at the edge point the way.',10)}
  else if(P.motes===3)say('You carry enough light to wake a shrine.',6)}
function awaken(th){hooks.awaken(th);th.awake=true;th.t=0;awake.add(th.st.key);P.motes-=3;const first=!awakeBiomes.has(th.st.b);awakeBiomes.add(th.st.b);hud();
  [0,4,7,12,16,19,24].forEach((n,i)=>pluck(60+n,{delay:i*.16,vol:.15,dur:3.4}));pluck(36,{vol:.2,dur:5,type:'triangle'});
  pulse(th.x,th.y,th.z,13,3,0xfff3c4);pulse(th.x,th.y,th.z,7,2,0xffffff);burst(th.x,th.y+2,th.z,30,4);bloomRing(th.x,th.z,2.6,10,90,th.st.b);
  showBiome('Shrine of the '+B[th.st.b].name);
  if(awakeBiomes.size===7&&first){say('All seven lands are singing. Wander as long as you like.',14);[0,7,12,16,19,24,28,31].forEach((n,i)=>pluck(48+n,{delay:1.5+i*.22,vol:.13,dur:4}))}
  else say(first?awakeBiomes.size+' of 7 lands awake':'Another shrine wakes',6);save()}
function hum(){pulse(P.x,P.y,P.z,7.5,1.6,0xfff3c4);pluck(57,{vol:.12,dur:2.2,type:'triangle'});pluck(64,{vol:.09,dur:2.4,delay:.05});
  for(const th of things){const d=Math.hypot(th.x-P.x,th.z-P.z);if(d>8)continue;if(th.type===1)ringChime(th,.15+d*.11);else if(th.type===0)th.pull=true}
  bloomRing(P.x,P.z,.6,3,8,curB)}
function updThings(dt,t){
  for(let i=things.length-1;i>=0;i--){const th=things[i],dx=th.x-P.x,dz=th.z-P.z,d=Math.hypot(dx,dz);
    if(th.type===0){th.obj.position.y=th.y+Math.sin(t*1.6+th.ph)*.16;th.obj.rotation.y=t*1.2+th.ph;
      if(th.pull||d<2.4){const k=Math.min(1,dt*(th.pull?3.2:5));th.x-=dx*k;th.z-=dz*k;th.y+=(P.y+.9-th.y)*k;th.obj.position.x=th.x;th.obj.position.z=th.z}
      const fs=1-sstep(U.uFade.value.x,U.uFade.value.y,Math.hypot(th.x-camT.x,th.z-camT.z));th.obj.scale.setScalar(fs);
      if(d<.75)collect(th)}
    else if(th.type===1){if(th.delay>0){th.delay-=dt;if(th.delay<=0)ringChime(th)}th.cool-=dt;
      const ins=d<1.7;if(ins&&!th.inside&&th.cool<=0)ringChime(th);th.inside=ins;
      th.v+=(-60*th.s-5*th.v)*dt;th.s+=th.v*dt;th.obj.scale.set(1-th.s*.1,1+th.s*.22,1-th.s*.1);th.obj.rotation.z=th.s*.09}
    else{const up=th.awake;if(up)th.t+=dt;let top=.6;
      th.segs.forEach((m,k)=>{const e=up?backOut(clamp(th.t*.8-k*.45,0,1)):0;top+=m.userData.h*e;m.position.y=top-m.userData.h});
      const lift=up?sstep(0,2.2,th.t):0;th.cry.position.y=top+1.0+lift*.5+Math.sin(t*1.3)*.12;th.cry.rotation.y=t*(up?1.6:.3);
      th.cmat.color.setRGB(lerp(.72,1,lift),lerp(.69,.95,lift),lerp(.81,.66,lift));
      th.glow.position.y=th.cry.position.y;th.glow.scale.setScalar(lift*(3.4+Math.sin(t*2)*.3));
      th.beam.visible=up;th.beam.position.y=th.cry.position.y;th.beam.scale.set(1,Math.max(.001,sstep(.6,3,th.t)),1);
      if(!up&&d<2.9){if(P.motes>=3)awaken(th);else if(t-th.hintT>9){th.hintT=t;say('This shrine sleeps. It asks for three motes of light ('+P.motes+' of 3).',6);pluck(52,{vol:.08,dur:2})}}}}}

/* ---------- sword, cutting, materials ---------- */
const sword=(()=>{const g=new Geo();g.add(TP.box,M(0,-.03,.13,.06,.06,.26),dark);g.add(TP.box,M(0,-.05,.27,.15,.1,.035),gold);g.add(TP.box,M(0,-.035,.72,.045,.07,.86),hex(0xdfe6f2),white);
  const m=new T.Mesh(g.build(),worldMat);m.castShadow=true;return m})();
const qS=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),.6).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),PI/2)),qW=new T.Quaternion(),
  pS=new T.Vector3(-.22,.84,-.2),pW=new T.Vector3(0,.5,.05),_pv2=new T.Vector3();
sword.position.copy(pS);sword.quaternion.copy(qS);
const arcG=(()=>{const N=30,p=[],uv=[],pt=(a,r)=>[Math.sin(a)*r,0,Math.cos(a)*r];
  for(let i=0;i<N;i++){const u0=i/N,u1=(i+1)/N,a0=lerp(-1.5,1.5,u0),a1=lerp(-1.5,1.5,u1),A0=pt(a0,.4),B0=pt(a0,1.32),A1=pt(a1,.4),B1=pt(a1,1.32);
    p.push(...A0,...B0,...B1,...A0,...B1,...A1);uv.push(u0,0,u0,1,u1,1,u0,0,u1,1,u1,0)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));return g})();
const arcMat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{uH:{value:0},uA:{value:0}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`uniform float uH,uA;varying vec2 vUv;
  void main(){float tail=smoothstep(uH-0.62,uH,vUv.x)*step(vUv.x,uH+0.001);float r=vUv.y;
    float body=pow(r,2.4)*smoothstep(1.0,0.94,r);float rim=smoothstep(0.82,0.96,r)*smoothstep(1.0,0.96,r);
    float a=clamp(tail*tail*(body*0.75+rim*0.6),0.0,1.0)*uA;gl_FragColor=vec4(mix(vec3(1.0,0.93,0.74),vec3(1.0),tail),a);}`});
const arc=new T.Mesh(arcG,arcMat);arc.position.y=.52;arc.frustumCulled=false;arc.visible=false;arc.renderOrder=3;player.add(arc);
const SW={t:9,dir:-1,hit:true,chain:false,queued:false,aim:null},inv=[0,0,0],live=[],drops=[];let shake=0;
function eachCut(fn){const cx=Math.floor(P.x)>>4,cz=Math.floor(P.z)>>4;for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){const ch=chunks.get((cx+a)+','+(cz+b));if(!ch)continue;for(let i=ch.cuts.length-1;i>=0;i--)fn(ch.cuts[i])}}
function slash(noAim){if(!started)return;if(SW.t<.24){SW.queued=true;return}
  SW.chain=SW.t<.4;SW.t=0;SW.hit=false;SW.queued=false;SW.dir=-SW.dir;SW.aim=null;
  if(!noAim){let bd=2.3;eachCut(c=>{if(!c.solid)return;const dx=c.x-P.x,dz=c.z-P.z,d=Math.hypot(dx,dz);if(d<bd&&Math.abs(c.h-P.y)<1.6){bd=d;SW.aim=Math.atan2(dx,dz)}})}
  noise({f0:SW.dir>0?800:1050,f1:3400,dur:.2,vol:.085,q:1.1});if(!SW.chain)tone({f0:2500,f1:3300,dur:.3,vol:.012,rev:1})}
function updSword(dt){if(SW.t>1)return;SW.t+=dt;const t=SW.t;
  if(SW.aim!==null&&t<.14){let da=SW.aim-P.face;da=Math.atan2(Math.sin(da),Math.cos(da));P.face+=da*Math.min(1,dt*22);player.rotation.y=P.face}
  const d=Math.max(sstep(0,.07,t),SW.chain?1:0)*(1-sstep(.4,.66,t)),sw=1-Math.pow(1-clamp((t-.04)/.17,0,1),3),th=SW.dir*lerp(-1.5,1.5,sw);
  qW.setFromEuler(_e.set(-.1,th,SW.dir*.3,'YXZ'));sword.quaternion.copy(qS).slerp(qW,d);sword.position.lerpVectors(pS,pW,d);
  pbody.rotation.y=SW.dir*lerp(-.45,.45,sw)*d;
  arcMat.uniforms.uH.value=sw;arcMat.uniforms.uA.value=sstep(.04,.07,t)*(1-sstep(.17,.42,t));arc.visible=t>.04&&t<.42;arc.scale.x=SW.dir;
  if(!SW.hit&&t>=.1){SW.hit=true;doHit()}
  if(SW.queued&&t>=.24)slash()}
function doHit(){const fx=Math.sin(P.face),fz=Math.cos(P.face);let n=0;
  eachCut(c=>{const dx=c.x-P.x,dz=c.z-P.z,d=Math.hypot(dx,dz);if(d>(c.solid?2.15:1.8)||Math.abs(c.h-P.y)>1.6)return;if(d>.55&&(dx*fx+dz*fz)/d<.1)return;strike(c,dx/(d||1),dz/(d||1));n++});
  if(n&&!seen.cut){seen.cut=true;say('Trees take two strokes. What falls gathers to you.',6)}}
// lift a prop out of its chunk mesh so it can move on its own
function extract(c){const geo=c.ch.mesh.geometry,a=c.v0*3,b=c.v1*3,pa=geo.attributes.position,p=pa.array.slice(a,b),ca=geo.attributes.color.array,g=new T.BufferGeometry();let top=0,ti=0;
  for(let i=0;i<p.length;i+=3){p[i]-=c.x;p[i+1]-=c.h;p[i+2]-=c.z;if(p[i+1]>top){top=p[i+1];ti=i}}
  c.col=[ca[a+ti],ca[a+ti+1],ca[a+ti+2]];c.top=top;
  g.setAttribute('position',new T.BufferAttribute(p,3));g.setAttribute('normal',new T.BufferAttribute(geo.attributes.normal.array.slice(a,b),3));g.setAttribute('color',new T.BufferAttribute(ca.slice(a,b),3));
  pa.array.fill(0,a,b);pa.needsUpdate=true;
  const m=new T.Mesh(g,worldMat);m.castShadow=true;m.position.set(c.x,c.h,c.z);scene.add(m);c.ch.extra.push(m);c.m=m;c.ax=new T.Vector3(1,0,0);c.ws=0;c.wv=0}
function strike(c,dx,dz){if(!c.m)extract(c);c.ax.set(dz,0,-dx);
  if(c.solid&&c.kind===0){leafBurst(c.x,c.h+c.top*.75,c.z,8,c.col,1.7);leafBurst(c.x-dx*.3,c.h+.5,c.z-dz*.3,4,trunk,1.1);
    tone({f0:190,f1:92,dur:.17,vol:.22,type:'triangle'});noise({f0:1900,f1:500,dur:.07,vol:.1,type:'lowpass'});
    if(--c.hp>0){c.wv=10;c.st=1;if(!c.live){c.live=true;live.push(c)}return}
    noise({f0:260,f1:700,dur:.7,vol:.035,att:.35});fell(c,.85)}
  else if(c.solid){leafBurst(c.x,c.h+c.top*.7,c.z,7,c.col,1.5);tone({f0:640,f1:470,dur:.15,vol:.15,rev:1});tone({f0:960,f1:900,dur:.08,vol:.05});noise({f0:5200,f1:2400,dur:.06,vol:.06,type:'highpass'});fell(c,.6)}
  else{leafBurst(c.x,c.h+Math.min(.6,c.top*.6),c.z,5,c.col,1.4);noise({f0:4600,f1:2400,dur:.17,vol:.05,type:'highpass'});if(c.kind===1)tone({f0:760,f1:600,dur:.09,vol:.06,rev:1});fell(c,0)}}
function fell(c,dur){felled.add(c.key);const ch=c.ch,i=ch.cuts.indexOf(c);if(i>=0)ch.cuts.splice(i,1);c.ft=0;c.dur=dur;c.land=false;
  if(c.solid){ch.blk[c.idx]=0;const g=new Geo();Pr.stump(g,0,0,0,c.kind);const s=new T.Mesh(g.build(),worldMat);s.castShadow=s.receiveShadow=true;s.position.set(c.x,c.h,c.z);scene.add(s);ch.extra.push(s);c.st=2}
  else{spawnDrops(c,c.x,c.z);c.st=3}
  if(!c.live){c.live=true;live.push(c)}}
function spawnDrops(c,ox,oz){const n=c.kind===0?2+(Math.random()<.5?1:0):c.solid?2:c.kind===1?1:(Math.random()<.6?1:0);for(let i=0;i<n;i++)drop(c.kind,ox,c.h+.3,oz)}
function updCuts(dt){for(let i=live.length-1;i>=0;i--){const c=live[i],m=c.m;let done=false,gone=false;
  if(c.st===1){c.wv+=(-110*c.ws-8*c.wv)*dt;c.ws+=c.wv*dt;m.quaternion.setFromAxisAngle(c.ax,c.ws*.1);if(Math.abs(c.ws)<.004&&Math.abs(c.wv)<.06){m.quaternion.set(0,0,0,1);c.st=0;done=true}}
  else if(c.st===2){c.ft+=dt;const k=Math.min(1,c.ft/c.dur),dx=-c.ax.z,dz=c.ax.x;m.quaternion.setFromAxisAngle(c.ax,1.52*Math.pow(k,2.4)-(c.land?Math.sin(Math.min(1,(c.ft-c.dur)*5)*PI)*.05:0));
    if(k>=1&&!c.land){c.land=true;const L=c.top*.75,lx=c.x+dx*L,lz=c.z+dz*L;leafBurst(lx,c.h+.5,lz,c.kind===0?16:9,c.col,2.5);pulse(c.x+dx*L*.6,c.h,c.z+dz*L*.6,1.9,.7);spawnDrops(c,c.x+dx*L*.6,c.z+dz*L*.6);
      if(c.kind===0){shake=.11;tone({f0:86,f1:42,dur:.45,vol:.3});noise({f0:520,f1:120,dur:.3,vol:.12,type:'lowpass'})}
      else{shake=.04;tone({f0:330,f1:240,dur:.12,vol:.1,rev:1});tone({f0:410,f1:330,dur:.1,vol:.07,delay:.07,rev:1});noise({f0:3000,f1:1500,dur:.12,vol:.04,type:'highpass'})}}
    if(c.land){const s=1-sstep(.15,.6,c.ft-c.dur);m.scale.setScalar(Math.max(.001,s));if(s<=0)gone=true}}
  else if(c.st===3){c.ft+=dt;const k=Math.min(1,c.ft/.2);m.scale.set(1+k*.35,Math.max(.001,1-k),1+k*.35);if(k>=1)gone=true}
  else done=true;
  if(gone){scene.remove(m);m.geometry.dispose();const j=c.ch.extra.indexOf(m);if(j>=0)c.ch.extra.splice(j,1);done=true}
  if(done){c.live=false;live.splice(i,1)}}}
/* leaves and chips */
const LN=150,leafG=(()=>{const g=new Geo();g.add(TP.octa,M(0,0,0,.2,.035,.12),white);return g.build()})(),
  leafMesh=new T.InstancedMesh(leafG,patch(new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide})),LN),leaves=[];let li=0;
leafMesh.frustumCulled=false;scene.add(leafMesh);
for(let i=0;i<LN;i++){leaves.push({l:0});leafMesh.setMatrixAt(i,M(0,-50,0,0));leafMesh.setColorAt(i,_col.set(0xffffff))}
function leafBurst(x,y,z,n,c,sp=1.6){for(let k=0;k<n;k++){const i=li++%LN,a=Math.random()*TAU,v=sp*(.3+Math.random()*.7),L=leaves[i],j=.85+Math.random()*.3;
    L.l=.9+Math.random()*.6;L.x=x+(Math.random()-.5)*.5;L.y=y+(Math.random()-.5)*.5;L.z=z+(Math.random()-.5)*.5;L.vx=Math.cos(a)*v;L.vz=Math.sin(a)*v;L.vy=.8+Math.random()*2;L.r=Math.random()*TAU;L.s=.7+Math.random()*.8;
    leafMesh.setColorAt(i,_col.setRGB(Math.min(1,c[0]*j),Math.min(1,c[1]*j),Math.min(1,c[2]*j)))}leafMesh.instanceColor.needsUpdate=true}
function updLeaves(dt,t){let ch=false;for(let i=0;i<LN;i++){const L=leaves[i];if(L.l<=0)continue;ch=true;L.l-=dt;const dr=1-Math.min(1,dt*2.2);L.vx*=dr;L.vz*=dr;L.vy=Math.max(-1.1,L.vy-dt*4.5);
    L.x+=(L.vx+Math.sin(t*7+L.r)*.5)*dt;L.y+=L.vy*dt;L.z+=(L.vz+Math.cos(t*6+L.r)*.5)*dt;L.r+=dt*5;const s=L.l<=0?0:L.s*Math.min(1,L.l*3);
    if(s<=0)leafMesh.setMatrixAt(i,M(0,-50,0,0));else leafMesh.setMatrixAt(i,M(L.x,L.y,L.z,s,s,s,L.r,L.r*.7,L.r*.4))}if(ch)leafMesh.instanceMatrix.needsUpdate=true}
/* materials that hop out and gather to the wanderer */
const RESG=[(()=>{const g=new Geo();g.add(TP.cyl6,M(0,.11,-.21,.22,.42,.22,0,PI/2),hex(0x8f5f52),hex(0xd0a07c));return g.build()})(),
  (()=>{const g=new Geo();g.add(TP.cyl6,M(0,.08,-.23,.14,.46,.14,0,PI/2),BAM1,BAM2);return g.build()})(),
  (()=>{const g=new Geo();g.add(TP.cone4,M(0,0,0,.3,.46,.3),hex(0xd9c078),hex(0xfff3c0));g.add(TP.box,M(0,.1,0,.2,.05,.2,PI/4),VERM);return g.build()})()];
function drop(kind,x,y,z){const m=new T.Mesh(RESG[kind],worldMat);m.castShadow=true;m.visible=false;scene.add(m);const a=Math.random()*TAU,r=.45+Math.random()*.7,x1=x+Math.cos(a)*r,z1=z+Math.sin(a)*r;
  drops.push({m,kind,x0:x,y0:y,z0:z,x1,z1,y1:effH(Math.floor(x1),Math.floor(z1))+.04,t:-Math.random()*.14,sp:(Math.random()-.5)*9})}
function gain(k){inv[k]++;hud();const e=$('res').children[k];e.classList.add('bump');setTimeout(()=>e.classList.remove('bump'),170);
  pluck(64+SCALE[(inv[0]+inv[1]+inv[2])%5]+(k===1?12:k===2?7:0),{vol:.055,dur:.9});burst(P.x,P.y+.6,P.z,2,.7)}
function updDrops(dt){for(let i=drops.length-1;i>=0;i--){const d=drops[i],m=d.m;d.t+=dt;if(d.t<0)continue;m.visible=true;
  if(d.t<.5){const k=d.t/.5;m.position.set(lerp(d.x0,d.x1,k),lerp(d.y0,d.y1,k)+Math.sin(k*PI)*1.2,lerp(d.z0,d.z1,k));m.rotation.set(k*d.sp,k*d.sp*.7,0)}
  else if(d.t<.95){const k=(d.t-.5)/.45;m.position.set(d.x1,d.y1+Math.abs(Math.sin(k*PI*2))*.14*(1-k),d.z1);m.rotation.x*=1-Math.min(1,dt*12)}
  else{_pv2.set(P.x,P.y+.55,P.z);m.position.lerp(_pv2,Math.min(1,dt*(6+(d.t-.95)*16)));m.rotation.y+=dt*9;const dd=m.position.distanceTo(_pv2);m.scale.setScalar(clamp(dd*1.6,.35,1));
    if(dd<.3||d.t>4){scene.remove(m);drops.splice(i,1);gain(d.kind)}}}}

/* ---------- input ---------- */
const keys={},ptr={down:false,x:0,y:0,ids:new Map(),pinch:0};let started=false;
addEventListener('keydown',e=>{if(!started)return;const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
  if(e.repeat)return;keys[k]=true;if(k==='q')azT-=PI/2;if(k==='e')azT+=PI/2;if(k==='h')hum();if(k==='m')toggleSound();hooks.key(k)});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;ptr.down=false});
const _o=new T.Vector3(),_d=new T.Vector3();
function pick(cx,cy){const r=canvas.getBoundingClientRect();_o.set((cx-r.left)/r.width*2-1,-((cy-r.top)/r.height*2-1),-1).unproject(cam);cam.getWorldDirection(_d);
  let t=(_o.y-18)/(-_d.y);for(let i=0;i<420;i++){const px=_o.x+_d.x*t,py=_o.y+_d.y*t,pz=_o.z+_d.z*t;if(py<=effH(Math.floor(px),Math.floor(pz))+.02)return{x:px,z:pz};if(py<-1)break;t+=.14}return null}
function pickThing(cx,cy){const r=canvas.getBoundingClientRect();let best=null,bd=48;for(const th of things){if(th.type!==1)continue;_v.set(th.x,th.y+1,th.z).project(cam);
  const sx=(_v.x+1)/2*r.width+r.left,sy=(1-_v.y)/2*r.height+r.top,d=Math.hypot(sx-cx,sy-cy);if(d<bd){bd=d;best=th}}return best}
canvas.addEventListener('pointerdown',e=>{if(!started)return;canvas.focus();try{canvas.setPointerCapture(e.pointerId)}catch(_){}
  ptr.ids.set(e.pointerId,[e.clientX,e.clientY]);if(ptr.ids.size===2){ptr.down=false;const p=[...ptr.ids.values()];ptr.pinch=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);hooks.pointer('cancel',null);return}
  ptr.down=true;ptr.x=e.clientX;ptr.y=e.clientY;hooks.pointer('down',pick(ptr.x,ptr.y),e.button)});
canvas.addEventListener('pointermove',e=>{if(ptr.ids.has(e.pointerId))ptr.ids.set(e.pointerId,[e.clientX,e.clientY]);
  if(ptr.ids.size===2){const p=[...ptr.ids.values()],d=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);if(ptr.pinch>0)view=clamp(view*ptr.pinch/d,12,26);ptr.pinch=d;return}
  ptr.x=e.clientX;ptr.y=e.clientY});
const pup=e=>{ptr.ids.delete(e.pointerId);if(ptr.down)hooks.pointer('up',pick(ptr.x,ptr.y),e.button);ptr.down=false;ptr.pinch=0};canvas.addEventListener('pointerup',pup);canvas.addEventListener('pointercancel',pup);
canvas.addEventListener('wheel',e=>{e.preventDefault();view=clamp(view*(1+Math.sign(e.deltaY)*.08),12,26)},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function toggleSound(){A.on=!A.on;if(A.master)A.master.gain.setTargetAtTime(A.on?.6:0,A.ctx.currentTime,.2);$('bs').style.opacity=A.on?1:.45}
$('bl').onclick=()=>{azT-=PI/2};$('br').onclick=()=>{azT+=PI/2};$('bs').onclick=toggleSound;

/* ---------- save ---------- */
function save(){try{localStorage.setItem('stillwander-bow3',JSON.stringify({x:P.x,z:P.z,m:P.motes,c:[...collected].slice(-600),a:[...awake],g:[...awakeBiomes],t:tod,s:seen,f:[...felled].slice(-3000),r:inv}))}catch(e){}}
try{const d=JSON.parse(localStorage.getItem('stillwander-bow3')||'null');if(d&&isFinite(d.x)&&isFinite(d.z)){P.x=d.x;P.z=d.z;P.motes=d.m|0;(d.c||[]).forEach(k=>collected.add(k));(d.a||[]).forEach(k=>awake.add(k));(d.g||[]).forEach(k=>awakeBiomes.add(k));if(isFinite(d.t))tod=d.t;if(d.s)Object.assign(seen,d.s);(d.f||[]).forEach(k=>felled.add(k));if(Array.isArray(d.r))for(let i=0;i<3;i++)inv[i]=d.r[i]|0}}catch(e){}

/* ---------- loop ---------- */
function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;renderer.setSize(w,h,false);renderer.getDrawingBufferSize(U.uRes.value)}
addEventListener('resize',resize);resize();
function movePlayer(dt){let mx=0,mz=0;const fx=-Math.sin(az),fz=-Math.cos(az),rx=-fz,rz=fx;
  const u=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0),r=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);
  if(u||r){mx=fx*u+rx*r;mz=fz*u+rz*r;P.target=null}
  const l=Math.hypot(mx,mz);let moving=false,lev=false;
  if(l>.001){mx/=l;mz/=l;const sp=4.3*hooks.speed()*dt,nx=P.x+mx*sp,nz=P.z+mz*sp,nh=effH(Math.floor(nx+mx*.25),Math.floor(nz+mz*.25));
    if(nh-P.y>.8){P.y+=dt*5.5;lev=true;if(Math.random()<dt*14)burst(P.x,P.y+.1,P.z,1,.8)}
    else{const ox=P.x,oz=P.z;if(!blockedAt(nx+mx*.22,nz+mz*.22)){P.x=nx;P.z=nz}else if(!blockedAt(nx+Math.sign(mx)*.22,P.z)){P.x=nx}else if(!blockedAt(P.x,nz+Math.sign(mz)*.22)){P.z=nz}
      moving=Math.hypot(P.x-ox,P.z-oz)>sp*.2;if(!moving&&P.target){P.stuck+=dt;if(P.stuck>.5)P.target=null}else P.stuck=0}
    if(hooks.face()===null){let da=Math.atan2(mx,mz)-P.face;da=Math.atan2(Math.sin(da),Math.cos(da));P.face+=da*Math.min(1,dt*10)}}
  {const hf=hooks.face();if(hf!==null){let da=hf-P.face;da=Math.atan2(Math.sin(da),Math.cos(da));P.face+=da*Math.min(1,dt*18)}}
  const tx=Math.floor(P.x),tz=Math.floor(P.z),gh=effH(tx,tz);
  if(!lev){if(gh>P.y){const o=P.y;P.y=Math.min(gh,P.y+dt*7);if(gh-o>.3&&P.hop<=0)P.hop=1}else if(gh<P.y)P.y=Math.max(gh,P.y-dt*(4+(P.y-gh)*3))}
  P.hop=Math.max(0,P.hop-dt*3.4);P.walk+=(moving||lev?1:0)*dt*11;
  const key=tx+','+tz;if(key!==P.lastTile){P.lastTile=key;if(tileH(tx,tz)>=0&&Math.random()<.7){const c=B[curB].bloom;bloom(P.x+(Math.random()-.5)*.7,gh,P.z+(Math.random()-.5)*.7,c[Math.floor(Math.random()*c.length)],.15,.8+Math.random()*.5)}}
  const bob=moving?Math.abs(Math.sin(P.walk))*.07:Math.sin(performance.now()*.002)*.015;
  player.position.set(P.x,P.y+bob+Math.sin(P.hop*PI)*.2,P.z);player.rotation.y=P.face;pbody.rotation.x=moving?.1:0;pbody.scale.y=1+(moving?Math.sin(P.walk*2)*.03:0)}
const _pv=new T.Vector3();let last=performance.now(),time=0,saveT=0,arrowT=0,nearSite=null;
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000)*hooks.timeScale();last=now;time+=dt;U.uTime.value=time;
  tod=(tod+dt/DAYLEN)%1;applyTime();
  if(started){movePlayer(dt);hooks.update(dt,time)}updateChunks(false);updCuts(dt);updLeaves(dt,time);updDrops(dt);updStones(dt);updThings(dt,time);updBlooms(dt);updFx(dt);updPoints(dt,time);updBirds(dt,time);updMusic(dt);
  // trail
  for(let i=0;i<trail.length;i++){const s=trail[i],on=i<P.motes;const tg=i===0?_pv.set(P.x-Math.sin(P.face)*.5,P.y+1.1,P.z-Math.cos(P.face)*.5):trail[i-1].position;
    s.position.lerp(tg,Math.min(1,dt*(7-i*.35)));if(i>0&&s.position.distanceTo(tg)<.34)s.position.addScaledVector(_v.copy(s.position).sub(tg).normalize(),.01);
    s.position.y+=Math.sin(time*2.2+i)*.004;s.scale.setScalar(lerp(s.scale.x,on?.42-i*.02:0,Math.min(1,dt*5)))}
  // biome
  biomeCheck-=dt;if(biomeCheck<=0){biomeCheck=.4;weights(Math.floor(P.x),Math.floor(P.z),_w);const b=dom(_w);if(b!==curB&&_w[b]>.55){curB=b;if(started)showBiome(B[b].name);pcolT.set(B[b].part)}}
  if(biomeTimer>0){biomeTimer-=dt;if(biomeTimer<=0)$('biome').classList.remove('on')}
  if(hintTimer>0){hintTimer-=dt;if(hintTimer<=0)$('hint').classList.remove('on')}
  // camera
  az+=(azT-az)*Math.min(1,dt*4);camT.lerp(_pv.set(P.x,P.y+.8,P.z),Math.min(1,dt*3.5));
  const w=canvas.clientWidth||1,h=canvas.clientHeight||1,asp=w/h,vv=view*(asp<1?1.25:1),hh=vv/2;
  cam.left=-hh*asp;cam.right=hh*asp;cam.top=hh;cam.bottom=-hh;cam.updateProjectionMatrix();
  cam.position.set(camT.x+Math.sin(az)*Math.cos(EL)*150,camT.y+Math.sin(EL)*150,camT.z+Math.cos(az)*Math.cos(EL)*150);cam.lookAt(camT);if(shake>.002){cam.position.y+=Math.sin(time*70)*shake;shake*=Math.exp(-dt*9)}
  const fr=Math.max(vv,vv*asp*.62);U.uCenter.value.copy(camT);U.uFade.value.set(fr*.6,Math.min(31,fr*1.02));
  sun.target.position.set(Math.round(P.x),0,Math.round(P.z));sun.position.copy(sun.target.position).addScaledVector(SUN_DIR,90);
  lamp.position.set(P.x,P.y+1.6,P.z);water.position.x=Math.round(P.x);water.position.z=Math.round(P.z);
  U.uAurora.value=lerp(U.uAurora.value,awakeBiomes.size>=7?1:0,dt*.3);
  // shrine pointer
  arrowT-=dt;if(arrowT<=0){arrowT=.5;nearSite=null;let bd=1e9;const rx=Math.floor(P.x/RS),rz=Math.floor(P.z/RS);
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const s=siteAt(rx+dx,rz+dz);if(awake.has(s.key))continue;const d=Math.hypot(s.x-P.x,s.z-P.z);if(d<bd){bd=d;nearSite=s}}
    if(nearSite){const dx=nearSite.x-P.x,dz=nearSite.z-P.z,l=Math.hypot(dx,dz)||1;wind.tx=dx/l*1.5;wind.tz=dz/l*1.5}}
  const ar=$('arrow');if(nearSite&&started){_v.set(nearSite.x+.5,nearSite.h+2,nearSite.z+.5).project(cam);
    if(Math.abs(_v.x)<.86&&Math.abs(_v.y)<.8)ar.style.opacity=0;else{const m=Math.max(Math.abs(_v.x)/.9,Math.abs(_v.y)/.84);ar.style.opacity=P.motes>=3?1:.5;
      ar.style.transform='translate('+((_v.x/m+1)/2*innerWidth)+'px,'+((1-_v.y/m)/2*innerHeight)+'px) rotate(45deg) scale('+(1+Math.sin(time*3)*.12)+')'}}else ar.style.opacity=0;
  saveT+=dt;if(saveT>6&&started){saveT=0;save()}
  renderer.render(scene,cam)}

applyTime();updateChunks(true);P.y=effH(Math.floor(P.x),Math.floor(P.z));camT.set(P.x,P.y+.8,P.z);
weights(Math.floor(P.x),Math.floor(P.z),_w);curB=dom(_w);pcolT.set(B[curB].part);hud();
$('go').onclick=()=>{if(started)return;started=true;$('title').classList.add('off');initAudio();if(A.ctx&&A.ctx.state==='suspended')A.ctx.resume();canvas.focus();
  showBiome(B[curB].name);hooks.begin();say(seen.mote?'Welcome back. The world kept your place.':'W A S D to wander. Hold the mouse to draw the bow, release to loose.',10)};
requestAnimationFrame(frame);

/* ---------- what the game layer may use ---------- */
export const engine={B,survey(x,z){sample(x,z);return{h:S.h,b:S.b,road:S.road,bridge:S.bridge}},awake,siteAt,RS,keys,moveDir(){const fx=-Math.sin(az),fz=-Math.cos(az),rx=-fz,rz=fx;const u=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0),r=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);if(!u&&!r)return[-Math.cos(PI/2-P.face),-Math.sin(PI/2-P.face)];return[fx*u+rx*r,fz*u+rz*r]},T,scene,cam,canvas,P,player,pbody,worldMat,Geo,TP,M,hex,patch,tileH,effH,blockedAt,things,B,wind,inv,awakeBiomes,
  colours:{VERM,cream,gold,dark,white,WOOD,trunk},
  say,hud,pulse,burst,bloom,bloomRing,leafBurst,pluck,noise,tone,gain,eachCut,strike,hum,
  get land(){return curB},get started(){return started},get time(){return time},
  shake(v){shake=Math.max(shake,v)},
  pointer(){return ptr.x||ptr.y?pick(ptr.x,ptr.y):null}};
