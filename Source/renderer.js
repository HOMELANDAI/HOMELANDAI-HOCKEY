const HAIGraphics = (()=>{
/* Small dependency-free WebGL 1 renderer. All meshes are authored procedural
 * prototype visuals. No network libraries, fonts, models, or CDN requests. */
const V={add:(a,b)=>a.map((n,i)=>n+b[i]),sub:(a,b)=>a.map((n,i)=>n-b[i]),scale:(a,s)=>a.map(n=>n*s),dot:(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>{let l=Math.hypot(...a);return l>1e-8?a.map(n=>n/l):[0,0,0];}};
const M={
 identity:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
 mul:(a,b)=>{let o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;},
 perspective:(fov,aspect,near=.05,far=250)=>{let f=1/Math.tan(fov/2),d=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*d,-1,0,0,2*far*near*d,0]);},
 lookAt:(eye,target,up=[0,1,0])=>{let z=V.norm(V.sub(eye,target)),x=V.norm(V.cross(up,z)),y=V.cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-V.dot(x,eye),-V.dot(y,eye),-V.dot(z,eye),1]);},
 pose:(p,yaw=0)=>{let c=Math.cos(yaw),s=Math.sin(yaw);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,...p,1]);},
 inverseRigid:a=>{let o=new Float32Array([a[0],a[4],a[8],0,a[1],a[5],a[9],0,a[2],a[6],a[10],0,0,0,0,1]);o[12]=-(o[0]*a[12]+o[4]*a[13]+o[8]*a[14]);o[13]=-(o[1]*a[12]+o[5]*a[13]+o[9]*a[14]);o[14]=-(o[2]*a[12]+o[6]*a[13]+o[10]*a[14]);return o;},
 point:(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]],
 dir:(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2],m[1]*p[0]+m[5]*p[1]+m[9]*p[2],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]],
 project:(m,p)=>{let q=M.point(m,p),w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];return [q[0]/w,q[1]/w,q[2]/w,w];}
};
function color(hex){return [((hex>>16)&255)/255,((hex>>8)&255)/255,(hex&255)/255];}
class Geometry{
 constructor(){this.data=[];this.transform=null;}
 tri(a,b,c,col){if(this.transform){a=M.point(this.transform,a);b=M.point(this.transform,b);c=M.point(this.transform,c);}let n=V.norm(V.cross(V.sub(b,a),V.sub(c,a)));for(let p of [a,b,c])this.data.push(...p,...n,...col);}
 quad(a,b,c,d,col){this.tri(a,b,c,col);this.tri(a,c,d,col);}
 box(x,y,z,w,h,d,col){let a=[x-w/2,y-h/2,z-d/2],b=[x+w/2,y-h/2,z-d/2],c=[x+w/2,y+h/2,z-d/2],e=[x-w/2,y+h/2,z-d/2],f=[x-w/2,y-h/2,z+d/2],g=[x+w/2,y-h/2,z+d/2],i=[x+w/2,y+h/2,z+d/2],j=[x-w/2,y+h/2,z+d/2];this.quad(a,e,c,b,col);this.quad(f,g,i,j,col);this.quad(e,j,i,c,col);this.quad(a,b,g,f,col);this.quad(a,f,j,e,col);this.quad(b,c,i,g,col);}
 cone(x,y,z,r,h,col,n=7,rTop=0){for(let i=0;i<n;i++){let a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,p=[x+Math.cos(a)*r,y,z+Math.sin(a)*r],q=[x+Math.cos(b)*r,y,z+Math.sin(b)*r],t=[x+Math.cos(a)*rTop,y+h,z+Math.sin(a)*rTop],u=[x+Math.cos(b)*rTop,y+h,z+Math.sin(b)*rTop];this.quad(p,t,u,q,col);this.tri([x,y,z],p,q,col);if(rTop)this.tri([x,y+h,z],u,t,col);}}
 sphere(x,y,z,rx,ry,rz,col,seg=9,rings=5){let p=(a,b)=>[x+rx*Math.sin(b)*Math.cos(a),y+ry*Math.cos(b),z+rz*Math.sin(b)*Math.sin(a)];for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){let a=i/seg*Math.PI*2,b=(i+1)/seg*Math.PI*2,c=j/rings*Math.PI,d=(j+1)/rings*Math.PI;this.quad(p(a,c),p(a,d),p(b,d),p(b,c),col);}}
 bar(a,b,width,col){let d=V.sub(b,a),n=V.norm(V.cross(d,Math.abs(d[1])<.9*Math.hypot(...d)?[0,1,0]:[1,0,0])),q=V.norm(V.cross(d,n));n=V.scale(n,width/2);q=V.scale(q,width/2);let corners=p=>[V.add(V.add(p,n),q),V.add(V.sub(p,n),q),V.sub(V.sub(p,n),q),V.sub(V.add(p,n),q)],A=corners(a),B=corners(b);for(let i=0;i<4;i++)this.quad(A[i],A[(i+1)%4],B[(i+1)%4],B[i],col);this.quad(...A,col);this.quad(...B,col);}
 ring(x,y,z,r,w,col,n=36){for(let i=0;i<n;i++){let a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;this.quad([x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],[x+Math.cos(b)*(r+w),y,z+Math.sin(b)*(r+w)],[x+Math.cos(a)*(r+w),y,z+Math.sin(a)*(r+w)],col);}}
}
function program(gl,vs,fs){let p=gl.createProgram();for(let [t,s] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){let sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));gl.attachShader(p,sh);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
const VS=`attribute vec3 aPos;attribute vec3 aNormal;attribute vec3 aColor;uniform mat4 uVP;uniform vec3 uEye;varying vec3 vColor;varying float vFog;void main(){float lighting=.57+.35*max(0.,dot(normalize(aNormal),normalize(vec3(-.4,.9,.3))))+.16*max(0.,dot(normalize(aNormal),normalize(vec3(.8,.3,-.5))));vColor=aColor*lighting;vFog=clamp((distance(aPos,uEye)-32.)/135.,0.,.84);gl_Position=uVP*vec4(aPos,1.);}`;
const FS=`precision mediump float;varying vec3 vColor;varying float vFog;void main(){gl_FragColor=vec4(mix(vColor,vec3(.055,.13,.18),vFog),1.);}`;
const TVS=`attribute vec3 aPos;attribute vec2 aUV;uniform mat4 uVP;varying vec2 vUV;void main(){vUV=aUV;gl_Position=uVP*vec4(aPos,1.);}`;
const TFS=`precision mediump float;varying vec2 vUV;uniform sampler2D uTex;uniform float uAlpha;void main(){vec4 c=texture2D(uTex,vUV);gl_FragColor=vec4(c.rgb,c.a*uAlpha);}`;
class Graphics{
 constructor(canvas){this.canvas=canvas;let gl=this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false,xrCompatible:true});if(!gl)throw Error('WebGL is unavailable. Enable hardware acceleration and reload.');this.p=program(gl,VS,FS);this.t=program(gl,TVS,TFS);this.buf=gl.createBuffer();this.dynamic=gl.createBuffer();this.texbuf=gl.createBuffer();this.environment=null;this.decals=[];this.clear=[.035,.09,.135,1];gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);this.vp=M.identity();this.eye=[0,0,0];}
 upload(geo){let gl=this.gl,b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(geo.data),gl.STATIC_DRAW);return {buffer:b,count:geo.data.length/9};}
 update(geo,mesh){let gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(geo.data),gl.DYNAMIC_DRAW);mesh.count=geo.data.length/9;}
 texture(source){let gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
 updateTexture(t,source){let gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);}
 begin(proj,view,eye,viewport=null,framebuffer=null,clear=true){let gl=this.gl;this.vp=M.mul(proj,view);this.eye=eye;gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.viewport(...(viewport||[0,0,this.canvas.width,this.canvas.height]));if(clear){gl.clearColor(...this.clear);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);}gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);}
 draw(mesh){if(!mesh?.count)return;let gl=this.gl,p=this.p;gl.useProgram(p);gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);for(let [n,size,off] of [['aPos',3,0],['aNormal',3,3],['aColor',3,6]]){let a=gl.getAttribLocation(p,n);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,36,off*4);}gl.uniformMatrix4fv(gl.getUniformLocation(p,'uVP'),false,this.vp);gl.uniform3fv(gl.getUniformLocation(p,'uEye'),this.eye);gl.drawArrays(gl.TRIANGLES,0,mesh.count);}
 textured(texture,corners,alpha=1,overlay=false){let gl=this.gl,p=this.t;gl.useProgram(p);gl.bindBuffer(gl.ARRAY_BUFFER,this.texbuf);let d=[],uv=[[0,0],[1,0],[1,1],[0,1]];for(let i of [0,1,2,0,2,3])d.push(...corners[i],...uv[i]);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(d),gl.DYNAMIC_DRAW);for(let [n,size,off] of [['aPos',3,0],['aUV',2,3]]){let a=gl.getAttribLocation(p,n);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,20,off*4);}gl.uniformMatrix4fv(gl.getUniformLocation(p,'uVP'),false,this.vp);gl.uniform1f(gl.getUniformLocation(p,'uAlpha'),alpha);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(gl.getUniformLocation(p,'uTex'),0);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);if(overlay)gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.drawArrays(gl.TRIANGLES,0,6);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);}
 resize(scale=1){let d=Math.min(window.devicePixelRatio||1,1.6)*scale,w=Math.round(this.canvas.clientWidth*d),h=Math.round(this.canvas.clientHeight*d);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}}
}
const C={snow:color(0x7597a6),blue:color(0x122f3d),pine:color(0x14323c),pine2:color(0x245060),gold:color(0xf2bc68),white:color(0xdaedf3),post:color(0xb54449),dark:color(0x121c26),silver:color(0x9caeb6)};
function makeEnvironment(c){let g=new Geometry();g.box(0,-.65,0,250,1,260,C.snow);g.box(0,-.21,0,c.rinkHalfWidth*2+.5,.35,c.rinkHalfLength*2+.5,color(0x16465b));let hw=c.rinkHalfWidth,hl=c.rinkHalfLength;
 for(let s of [-1,1]){g.box(s*(hw+.25),.55,0,.45,1.1,hl*2+1,C.white);g.box(s*(hw+.25),.16,0,.49,.23,hl*2+1,C.gold);g.box(s*(hw+.25),1.1,0,.51,.12,hl*2+1,C.blue);g.box(0,.55,s*(hl+.25),hw*2+1,1.1,.45,C.white);g.box(0,.15,s*(hl+.25),hw*2+1,.23,.49,C.gold);g.box(0,1.1,s*(hl+.25),hw*2+1,.12,.51,C.blue);}
 // Mesh goals, including rear frame and visible individual net strings.
 for(let sign of [-1,1]){let z=-sign*c.goalLine,back=z-sign*1.35,w=c.goalHalfWidth,h=c.goalHeight;for(let x of [-w,w]){g.bar([x,0,z],[x,h,z],.13,C.post);g.bar([x,h,z],[x*.87,h*.78,back],.07,C.post);g.bar([x*.87,0,back],[x*.87,h*.78,back],.07,C.post);g.bar([x,0,z],[x*.87,0,back],.07,C.post);}g.bar([-w,h,z],[w,h,z],.13,C.post);g.bar([-w*.87,h*.78,back],[w*.87,h*.78,back],.06,C.post);for(let x=-w*.87;x<=w*.87;x+=.21)g.bar([x,0,back],[x,h*.78,back],.013,color(0xc2e4ef));for(let y=.12;y<=h*.78;y+=.18)g.bar([-w*.87,y,back],[w*.87,y,back],.013,color(0xc2e4ef));for(let x=-w;x<w;x+=.25)g.bar([x,h,z],[x*.87,h*.78,back],.013,C.white);for(let s of [-1,1])for(let y=.12;y<h;y+=.20)g.bar([s*w,y,z],[s*w*.87,y*.78,back],.015,C.white);}
 let seed=23411,random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<190;i++){let x=(random()-.5)*175,z=(random()-.5)*205;if(Math.abs(x)<hw+5&&Math.abs(z)<hl+7){i--;continue;}let h=5+random()*15,r=1.1+h*.13;g.box(x,h*.26,z,.3,h*.53,.3,C.blue);for(let j=0;j<3;j++){let y=.8+j*h*.18,rj=r*(1-j*.23),hj=h*(.5-j*.075);g.cone(x,y,z,rj,hj,j%2?C.pine:C.pine2,7);g.cone(x,y+hj*.19,z,rj*.8,hj*.82,color(j%2?0x446672:0x527681),7);}}
 for(let s of [-1,1])for(let z of [-26,-9,9,26]){let x=s*(hw+3);g.box(x,4.25,z,.18,8.5,.18,C.silver);g.box(x,8.4,z,1.95,1.05,.26,C.blue);for(let row=0;row<2;row++)for(let col=0;col<4;col++)g.box(x+(col-1.5)*.4,8.2+row*.43,z+.16,.26,.27,.09,C.gold);g.box(x,.12,z,1,.24,1,C.blue);}
 // End-rink banner poles.
 g.box(-7,4,hl+4,.16,8,.16,C.silver);g.box(7,4,hl+4,.16,8,.16,C.silver);g.box(0,6.3,hl+4,14,2.2,.25,C.blue);
 return g;
}
function iceCanvas(c){let canvas=document.createElement('canvas');canvas.width=1024;canvas.height=2048;let x=canvas.getContext('2d'),w=canvas.width,h=canvas.height,hw=c.rinkHalfWidth,hl=c.rinkHalfLength;let P=(a,b)=>[(a+hw)/(hw*2)*w,(hl-b)/(hl*2)*h];let grad=x.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#437182');grad.addColorStop(.45,'#598c9b');grad.addColorStop(1,'#244f68');x.fillStyle=grad;x.fillRect(0,0,w,h);let s=5351,r=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};for(let i=0;i<1900;i++){let a=r()*w,b=r()*h;x.strokeStyle=`rgba(214,240,243,${.015+r()*.06})`;x.lineWidth=.3+r();x.beginPath();x.moveTo(a,b);x.lineTo(a+(r()-.5)*95,b+(r()-.5)*140);x.stroke();}
 let line=(z,col,width)=>{let q=P(0,z);x.fillStyle=col;x.fillRect(0,q[1]-width/2,w,width);};line(0,'rgba(201,101,107,.88)',8);for(let z of [-9,9])line(z,'rgba(24,61,108,.86)',15);for(let z of [-c.goalLine,c.goalLine])line(z,'rgba(184,62,66,.86)',6);
 const ring=(a,b,r,col)=>{let p=P(a,b);x.strokeStyle=col;x.lineWidth=4;x.beginPath();x.ellipse(p[0],p[1],r/(hw*2)*w,r/(hl*2)*h,0,0,Math.PI*2);x.stroke();x.fillStyle=col;x.beginPath();x.arc(p[0],p[1],5,0,7);x.fill();};ring(0,0,4.5,'rgba(12,50,95,.9)');for(let z of [-18,18])for(let a of [-7.2,7.2])ring(a,z,3.5,'rgba(156,61,69,.85)');
 for(let s of [-1,1]){let p=P(0,s*(c.goalLine-1.2));x.fillStyle='rgba(100,196,217,.5)';x.beginPath();x.ellipse(p[0],p[1],2.5/(hw*2)*w,1.75/(hl*2)*h,0,0,7);x.fill();}
 let q=P(0,0);x.save();x.translate(q[0],q[1]);x.fillStyle='#183e59';x.strokeStyle='#e8c891';x.lineWidth=7;x.beginPath();x.moveTo(-65,-90);x.lineTo(65,-90);x.lineTo(75,22);x.lineTo(0,82);x.lineTo(-75,22);x.closePath();x.fill();x.stroke();x.fillStyle='#e8c891';x.font='bold 120px Georgia';x.textAlign='center';x.fillText('H',0,20);x.font='bold 28px Arial';x.fillText('HOMELANDAI',0,127);x.restore();
 for(let z of [-26,-9,9,26])for(let s of [-1,1]){let p=P(s*(hw-1.5),z),g=x.createRadialGradient(p[0],p[1],0,p[0],p[1],140);g.addColorStop(0,'rgba(255,209,130,.24)');g.addColorStop(1,'rgba(255,209,130,0)');x.fillStyle=g;x.fillRect(p[0]-140,p[1]-140,280,280);}
 return canvas;
}
const LOOKS={rocky:[0xc49353,0xefd0a3,0xd7a52e],atlas:[0xb2a18c,0xf1e9da,0x1e5689],billy:[0x9d7f66,0xdbc5a0,0xe4ac4b],crash:[0x25343c,0xebeff0,0x1563bb],kefla:[0xe1e4e0,0x313842,0x268c75],koda:[0x597281,0xe5edf0,0x7cccdf],crimson_emperor:[0x8f4c34,0xb2714c,0xa72735],razor:[0x302c31,0x9d6146,0xb72242],nova:[0xba8d64,0xe5bd89,0x864bbc],penny:[0xe1a450,0xf1d7a3,0xef992f],slash:[0x71818b,0xc9d2d7,0x728ea6],shockwave:[0xcf8150,0xebc590,0xf0a631],sparkplug:[0xc1a07c,0x514744,0xe3b842],master_sniff:[0x945739,0xba8751,0xd5a65c],pixy:[0xb28b91,0xe4c6d1,0xad5493]};

const HELMET_NAMES={rocky:'RADIANT CAPTAIN',atlas:'GLACIER FORTRESS',crash:'STORM STRATEGIST',nova:'CELESTIAL ORACLE',penny:'FIRECRACKER',razor:'VOID ASSASSIN',slash:'PHANTOM GHOST',sparkplug:'GIGAVOLT WILD CARD',koda:'BLIZZARD ENFORCER',crimson_emperor:'INFERNO EMPEROR',billy:'THUNDER GOLD',kefla:'EMERALD SURGE',shockwave:'SOLAR BLAZE',master_sniff:'AMBER HARMONY',pixy:'PRISMATIC PINK'};
const helmetName=id=>HELMET_NAMES[id]||'HAI SKATER';
const DIGITS={0:'abcedf',1:'bc',2:'abged',3:'abgcd',4:'fgbc',5:'afgcd',6:'afgecd',7:'abc',8:'abcdefg',9:'abfgcd'};
function jerseyDigit(g,n,x,y,z,size,col){const seg={a:[-.055,.14,.055,.14],b:[.055,.14,.055,0],c:[.055,0,.055,-.14],d:[-.055,-.14,.055,-.14],e:[-.055,-.14,-.055,0],f:[-.055,0,-.055,.14],g:[-.055,0,.055,0]};for(const k of DIGITS[n]||''){let q=seg[k];g.bar([(x+q[0])*size,(y+q[1])*size,z*size],[(x+q[2])*size,(y+q[3])*size,z*size],.022*size,col);}}
function helmetGeometry(g,a,size,squat,teamTrim){
 const id=a.definition.id,L=LOOKS[id]||LOOKS.rocky,light=a.team===0?a.kitVariant==='reverse':a.kitVariant!=='reverse';
 const shell=color(light?0xe6e8e0:L[2]),accent=color(L[2]),gold=C.gold,dark=C.dark,silver=C.silver;
 const B=(x,y,z,w,h,d,c)=>g.box(x*size,(y-squat)*size,z*size,w*size,h*size,d*size,c);
 const P=(x,y,z)=>[x*size,(y-squat)*size,z*size];
 const S=(x,y,z,rx,ry,rz,c)=>g.sphere(x*size,(y-squat)*size,z*size,rx*size,ry*size,rz*size,c,9,4);
 const bar=(p,q,w,c)=>g.bar(P(...p),P(...q),w*size,c);
 S(0,1.85,.015,.405,.235,.365,shell);
 for(let side of [-1,1]){B(side*.342,1.72,.055,.095,.26,.32,shell);bar([side*.30,1.84,-.2],[side*.39,1.73,.14],.035,accent);B(side*.392,1.73,.05,.012,.18,.14,teamTrim);B(side*.40,1.73,.05,.013,.10,.025,dark);B(side*.402,1.73,.05,.015,.019,.085,dark);}
 // Common HAI forehead plate: physically built letters, no generated logo text.
 B(0,1.845,-.331,.24,.115,.024,gold);B(0,1.845,-.347,.216,.09,.01,dark);
 for(let x of [-.072,-.032])B(x,1.845,-.356,.011,.062,.012,C.white);
 B(-.052,1.845,-.357,.051,.012,.014,C.white);
 bar([-.006,1.814,-.357],[.014,1.874,-.357],.01,C.white);bar([.014,1.874,-.357],[.034,1.814,-.357],.01,C.white);B(.014,1.835,-.357,.027,.009,.012,C.white);B(.066,1.845,-.357,.01,.062,.014,C.white);
 const cage=a.goalie||id==='rocky';
 if(cage){for(const y of [1.35,1.48,1.62])bar([-.30,y,-.58],[.30,y,-.58],.021,gold);for(const x of [-.30,-.15,0,.15,.30])bar([x,1.33,-.58],[x,1.72,-.50],.019,gold);bar([-.31,1.33,-.58],[.31,1.33,-.58],.03,shell);}
 else{B(0,1.69,-.348,.60,.045,.035,silver);for(const side of [-1,1])bar([side*.31,1.71,-.33],[side*.28,1.52,-.42],.017,silver);bar([-.28,1.52,-.42],[.28,1.52,-.42],.016,silver);}
 if(id==='rocky'){
  S(0,1.985,-.035,.145,.095,.10,gold);
  for(let k=0;k<8;k++){const t=k*Math.PI/4;bar([Math.cos(t)*.14,1.96+Math.sin(t)*.035,-.025],[Math.cos(t)*.23,1.96+Math.sin(t)*.09,-.025],.035,gold);}
 }else if(['crash','sparkplug','shockwave'].includes(id)){
  const c=color(id==='crash'?0x55beff:0xffdc39);
  for(const side of [-1,1]){bar([side*.10,2.065,.18],[side*.23,1.98,-.02],.041,c);bar([side*.23,1.98,-.02],[side*.10,1.99,-.075],.038,c);bar([side*.10,1.99,-.075],[side*.25,1.86,-.29],.032,c);}
 }else if(id==='nova'){
  const c=gold;for(let k=0;k<5;k++){let t=k*Math.PI*2/5;bar([0,2.01,-.19],[Math.sin(t)*.15,2.01+Math.cos(t)*.13,-.19],.026,c);}for(const side of [-1,1])bar([side*.10,2.00,.17],[side*.33,1.84,-.13],.03,c);
 }else if(id==='penny'){
  for(let k=0;k<8;k++){let t=k*Math.PI/4;bar([.13,1.985,-.17],[.13+Math.cos(t)*.16,1.985+Math.sin(t)*.10,-.17],.028,k%2?color(0x277dd0):C.white);}
 }else if(id==='koda'||id==='atlas'){
  for(const side of [-1,1])for(let k=0;k<3;k++){
   const x=side*(.13+k*.075),z=.13-k*.15;
   g.tri(P(x-.06,1.96,z),P(x+.065,1.96,z+.12),P(x,2.17-k*.045,z+.04),color(k%2?0x7fddf6:0xe4faff));
   g.tri(P(x-.06,1.96,z),P(x,2.17-k*.045,z+.04),P(x,1.97,z+.14),accent);
  }
 }else if(id==='crimson_emperor'){
  for(const side of [-1,1])for(let k=0;k<3;k++){let x=side*(.10+k*.08);g.tri(P(x-.055,1.96,-.11+k*.12),P(x+.055,1.96,-.03+k*.12),P(x,2.24-k*.025,.03+k*.08),k%2?gold:color(0xea3f40));}
 }else if(id==='razor'||id==='slash'){
  const c=color(id==='razor'?0xb673ed:0xa1dcf1);
  for(const side of [-1,1]){g.tri(P(side*.08,1.98,-.22),P(side*.30,1.92,.17),P(side*.26,2.12,.10),accent);bar([side*.1,1.99,-.20],[side*.27,1.86,-.3],.024,c);bar([side*.36,1.79,-.07],[side*.36,1.62,.20],.027,c);}
 }else{for(const side of [-1,1])bar([side*.11,2.04,.12],[side*.25,1.9,-.20],.034,accent);}
}
function dog(g,a,time,firstPersonHidden=false){if(!a.active||firstPersonHidden)return;let p=a.position,theta=-Math.atan2(a.facing.x,a.facing.z);g.transform=M.pose([p.x,0,-p.z],theta);let r=a.definition.base_attributes,id=a.definition.id,L=LOOKS[id]||LOOKS.rocky,fur=color(L[0]),muzzle=color(L[1]),helm=color(L[2]),kit=color(a.team===0?(a.kitVariant==='reverse'?0xebf0ec:0x235999):(a.kitVariant==='reverse'?0x331e28:0xf0e9da)),trim=color(a.team===0?0xe5b85c:0xa93445),size=a.goalie?1.12:id==='penny'?.78:id==='nova'?1.05:.92;let b=(x,y,z,w,h,d,c)=>g.box(x*size,y*size,z*size,w*size,h*size,d*size,c),sphere=(x,y,z,rx,ry,rz,c)=>g.sphere(x*size,y*size,z*size,rx*size,ry*size,rz*size,c,8,4);let speed=Math.hypot(a.velocity.x,a.velocity.z),stride=Math.sin(time*9)*Math.min(.25,speed*.032),squat=a.goalie&&a.saveTimer>0?.2:0;
 b(0,.98-squat,0,.76,.61,.47,kit);b(0,.70-squat,.0,.77,.12,.48,trim);b(0,.81-squat,0,.774,.036,.484,C.white);b(0,1.245-squat,0,.78,.065,.48,trim);b(0,.54-squat,0,.69,.30,.42,C.dark);b(0,1.30-squat,0,.4,.16,.38,fur);
 for(let s of [-1,1]){let zz=s*stride;b(s*.23,.29,zz,.24,.44,.25,kit);b(s*.23,.31,zz,.246,.07,.256,trim);b(s*.23,.10,zz-.05,.26,.18,.50,C.dark);b(s*.23,.01,zz-.05,.065,.08,.58,C.silver);if(a.goalie)b(s*.25,.44,zz-.19,.39,.68,.17,trim);b(s*.47,1.10-squat,s*.09,.29,.39,.3,kit);b(s*.47,1.02-squat,s*.09,.30,.06,.31,trim);b(s*.47,.96-squat,s*.09,.303,.025,.315,C.white);sphere(s*.50,.82-squat,-.18,.17,.16,.18,trim);}
 // Dog muzzle, visible ears, helmet, visor and short tail.
 sphere(0,1.64-squat,0,.35,.34,.32,fur);sphere(0,1.51-squat,-.32,.27,.16,.27,muzzle);sphere(0,1.53-squat,-.56,.12,.085,.07,C.dark);for(let s of [-1,1]){b(s*.16,1.65-squat,-.295,.09,.065,.034,C.dark);if(['koda','razor','crash','penny','shockwave'].includes(id))g.cone(s*.29*size,(1.80-squat)*size,.06*size,.14*size,.38*size,fur,4);else sphere(s*.33,1.49-squat,.05,.13,.34,.20,fur);}
 helmetGeometry(g,a,size,squat,trim);
 // Two-digit jersey numbers remain visible from behind-player and overhead cameras.
 const num=String(a.jerseyNumber||9).padStart(2,'0');jerseyDigit(g,num[0],-.09,1.04-squat,.247,size,trim);jerseyDigit(g,num[1],.09,1.04-squat,.247,size,trim);
 if(id==='kefla')for(let k=0;k<5;k++)sphere((k%2?1:-1)*.18,1.48+(k%3)*.065,-.17,.06,.045,.05,C.dark);
 sphere(0,.63,.39,.10,.13,.31,fur);let kick=a.kick*.35;g.bar([.45*size,(.89-squat)*size,-.2*size],[.65*size,.12,-(1.20+kick)*size],.055,C.dark);b(.45,.075,-1.23-kick,.47,.10,.09,trim);
 // Chest shield and H crossbars, deliberately HAI-only branding.
 b(0,1.04-squat,-.245,.27,.30,.025,trim);b(-.055,1.04-squat,-.264,.025,.18,.018,kit);b(.055,1.04-squat,-.264,.025,.18,.018,kit);b(0,1.04-squat,-.266,.11,.025,.020,kit);g.transform=null;
}
function gameplayGeometry(sim,time){let g=new Geometry(),c=sim.c;for(let i=0;i<sim.athletes.length;i++){let a=sim.athletes[i];dog(g,a,time,sim.firstPerson&&i===sim.controlled);if(a.active)g.ring(a.position.x,.024,-a.position.z,a.radius,.025,color(a.team===0?0x468ccc:0xd98383),18);}
 let a=sim.player,p=sim.puck;if(!sim.firstPerson)g.ring(a.position.x,.035,-a.position.z,.82,.09,C.gold,28);
 if(p.owner<0&&p.trail&&Math.hypot(p.velocity.x,p.velocity.z)>5)for(let k=1;k<p.trail.length;k++){let q=p.trail[k-1],r=p.trail[k];g.bar([q.x,Math.max(.04,q.h),-q.z],[r.x,Math.max(.04,r.h),-r.z],.018+.035*k/p.trail.length,color(0xf0c67d));}
 g.cone(p.position.x,Math.max(.04,p.height)-.05,-p.position.z,.18,.125,C.dark,12,.18);g.ring(p.position.x,.028,-p.position.z,.29,.05,color(0xffdc91),22);
 if(sim.mode==='full-rink'){g.box(0,.013,-c.trainingReleaseZ,c.rinkHalfWidth*2,.024,.18,color(sim.runReady?0x6ad4b4:0xe9c66e));}
 return g;
}
function panelCorners(pose,w,h,z=-3,cy=0){return [[-w/2,cy-h/2,z],[w/2,cy-h/2,z],[w/2,cy+h/2,z],[-w/2,cy+h/2,z]].map(p=>M.point(pose,p));}

return {Graphics,Geometry,M,V,color,makeEnvironment,iceCanvas,gameplayGeometry,panelCorners,dog,helmetName,HELMET_NAMES,LOOKS};
})();
