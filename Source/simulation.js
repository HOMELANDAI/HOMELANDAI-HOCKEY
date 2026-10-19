const HAIHockey = (()=>{
/* HomelandAI Studios - Frozen Paws web prototype v0.3.0.
 * Browser-native adaptation of the supplied v0.1.0 C# hockey simulation.
 * Pure deterministic game logic, independent of WebGL, DOM and headset APIs.
 * Prototype rules: no offsides, icing, penalties, powers, draft UI or networking.
 */
const Mode = Object.freeze({ MATCH:'match', STATIONARY:'stationary', GOALIE:'goalie', FULL:'full-rink' });
const View = Object.freeze({ BEHIND:'behind', GOALIE:'goalie-fpv', AERIAL:'aerial' });
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*clamp(t,0,1);
const v=(x=0,z=0)=>({x,z});
const add=(a,b)=>v(a.x+b.x,a.z+b.z);
const sub=(a,b)=>v(a.x-b.x,a.z-b.z);
const mul=(a,s)=>v(a.x*s,a.z*s);
const len=a=>Math.hypot(a.x,a.z);
const norm=a=>len(a)>1e-7?mul(a,1/len(a)):v();
const dot=(a,b)=>a.x*b.x+a.z*b.z;
const dist=(a,b)=>len(sub(a,b));
const limit=(a,n=1)=>len(a)>n?mul(norm(a),n):v(a.x,a.z);
const toward=(a,b,d)=>dist(a,b)<=d?v(b.x,b.z):add(a,mul(norm(sub(b,a)),d));
function segment(a,b,p){const d=sub(b,a);const t=dot(d,d)<1e-9?0:clamp(dot(sub(p,a),d)/dot(d,d),0,1);return {d:dist(add(a,mul(d,t)),p),t};}
function rotate(a,b,r){if(len(b)<1e-6)return a;let x=Math.atan2(a.x,a.z),y=Math.atan2(b.x,b.z);x+=clamp(Math.atan2(Math.sin(y-x),Math.cos(y-x)),-r,r);return v(Math.sin(x),Math.cos(x));}
const defaults=Object.freeze({rinkHalfWidth:14.5,rinkHalfLength:29,goalLine:25,goalHalfWidth:1.9,goalHeight:1.65,puckRadius:.12,periodSeconds:120,periodCount:3,skatersPerTeam:5,trainingStartZ:-24,trainingReleaseZ:18,shotChargeSeconds:1.2,faceoffSeconds:2,emptyNetTraining:true,aiSkill:.6,seed:211,swapKits:false});
const command=()=>({move:v(),aim:v(0,1),aimHeight:.65,shootDown:false,shootHeld:false,shootUp:false,pass:false,switchPlayer:false,check:false,sprint:false,quickShot:false});
const isGoalie=id=>id==='atlas'||id==='master_sniff';
function validGoal(a,ha,b,h,s,c=defaults){const plane=c.goalLine+c.puckRadius;let p=a.z*s,q=b.z*s;if(p>plane||q<=plane||q<=p)return false;let t=(plane-p)/(q-p),x=lerp(a.x,b.x,t),y=lerp(ha,h,t);return Math.abs(x)<=c.goalHalfWidth-c.puckRadius&&y>=c.puckRadius-.0001&&y+c.puckRadius<=c.goalHeight;}
class HockeySimulation {
 constructor(roster,config={}){
  this.c={...defaults,...config};this.defs=new Map();
  for(const a of roster){if(!a.id||!a.base_attributes||this.defs.has(a.id))throw Error('Invalid or duplicate roster record');this.defs.set(a.id,a);}
  if(![3,5].includes(this.c.skatersPerTeam)||this.c.periodSeconds<=0)throw Error('Invalid match settings');
  this.athletes=[];this.events=[];this.randomState=this.c.seed;this.paused=false;
 }
 get player(){return this.athletes[this.controlled];}
 get training(){return this.mode!==Mode.MATCH;}
 get firstPerson(){return this.training||this.view===View.GOALIE;}
 sign(t){return (t===0?1:-1)*(this.mode===Mode.MATCH&&this.period%2===0?-1:1);}
 random(){let s=this.randomState>>>0;s^=s<<13;s^=s>>>17;s^=s<<5;this.randomState=s>>>0;return (s&0xffffff)/16777216;}
 emit(kind,message,team=-1){this.message=message;this.messageTime=3;this.events.push({kind,message,team});if(this.events.length>64)this.events.shift();}
 add(id,team,slot,goalie=false){let d=this.defs.get(id);if(!d)throw Error('Required character missing: '+id);let r=d.base_attributes;this.athletes.push({definition:d,team,slot,positionName:goalie?'G':['C','LW','RW','LD','RD'][slot],jerseyNumber:{rocky:9,crash:17,kefla:24,billy:44,koda:28,atlas:30,crimson_emperor:77,razor:13,nova:88,penny:7,slash:55,master_sniff:1,shockwave:19,sparkplug:11,pixy:8}[id]||0,kitVariant:this.c.swapKits?'reverse':'standard',goalie,active:true,position:v(),velocity:v(),facing:v(0,1),home:v(),stamina:1,cooldown:0,saveTimer:0,saveAim:0,decision:0,kick:0,radius:goalie?.60:lerp(.38,.55,r.pwr/100),speed:4.8+r.spd*.055,acceleration:3+r.acc*.12});return this.athletes.length-1;}
 start(mode=Mode.MATCH,view=View.AERIAL,athlete='rocky'){
  if(!Object.values(Mode).includes(mode)||!Object.values(View).includes(view))throw Error('Unknown game mode/view');
  this.mode=mode;this.view=view;this.athletes=[];this.score=[0,0];this.period=1;this.remaining=this.c.periodSeconds;this.events=[];this.paused=false;this.randomState=this.c.seed;
  this.matchStats={shots:[0,0],saves:[0,0],passes:[0,0]};this.lastShot=null;this.stats={earlyShots:0,completedRuns:0,attempts:0,goals:0,saves:0,onTarget:0,misses:0,elapsed:0,carriedDistance:0,bestFullRinkSeconds:0,result:'Ready'};
  if(!this.defs.has(athlete))athlete='rocky';
  if(mode===Mode.MATCH){const home=['rocky','crash','kefla','billy','koda'],away=['crimson_emperor','razor','nova','penny','slash'];
   home.slice(0,this.c.skatersPerTeam).forEach((id,i)=>this.add(id,0,i));this.add('atlas',0,5,true);
   away.slice(0,this.c.skatersPerTeam).forEach((id,i)=>this.add(id,1,i));this.add('master_sniff',1,5,true);
   this.remembered=0;this.controlled=view===View.GOALIE?this.findGoalie(0):0;this.faceoff();
  }else if(mode===Mode.GOALIE){this.controlled=this.add(isGoalie(athlete)?athlete:'atlas',0,5,true);this.add('razor',1,0);this.resetAttempt();}
  else{this.controlled=this.add(isGoalie(athlete)?'rocky':athlete,0,0);this.add('master_sniff',1,5,true);this.athletes[1].active=!this.c.emptyNetTraining;this.resetAttempt();}
  this.cancel(true);return this;
 }
 findGoalie(team){return this.athletes.findIndex(a=>a.goalie&&a.team===team);}
 cancel(block=false){this.charge=0;this.charging=false;this.block=block;}
 pause(p){this.paused=p;this.cancel(true);}
 setView(view){if(this.mode!==Mode.MATCH)return;if(!this.paused)throw Error('Pause before changing view or role');if(!this.player.goalie)this.remembered=this.controlled;this.view=view;this.controlled=view===View.GOALIE?this.findGoalie(0):this.remembered;this.cancel(true);}
 nextAttempt(){if(this.training){this.resetAttempt();this.cancel(true);}}
 resetActor(a,p){a.position=v(p.x,p.z);a.home=v(p.x,p.z);a.velocity=v();a.facing=v(0,this.sign(a.team));a.stamina=1;a.cooldown=a.saveTimer=a.decision=a.kick=0;}
 resetPuck(p,owner=-1){this.puck={position:v(p.x,p.z),velocity:v(),height:this.c.puckRadius,vy:0,pickupLock:.15,trail:[],owner,lastTouch:owner,lastTeam:owner>=0?this.athletes[owner].team:-1};this.shotLive=false;this.shotAge=0;this.shotOnTarget=false;}
 faceoff(){for(const a of this.athletes){let s=this.sign(a.team),p=a.goalie?v(0,-s*(this.c.goalLine-1.05)):a.slot===0?v(0,-s*1.7):a.slot<=2?v(a.slot===1?-6:6,-s*5):v(a.slot===3?-4:4,-s*11);this.resetActor(a,p);}this.resetPuck(v());this.phase='faceoff';this.phaseTime=this.c.faceoffSeconds;this.cancel(true);this.emit('faceoff','FACE-OFF');}
 resetAttempt(){this.stats.elapsed=this.stats.carriedDistance=this.travel=0;this.stats.result='Ready';this.runReady=false;this.shotQualified=true;this.lastShot=null;this.delivered=false;this.feedTime=2.5;
  if(this.mode===Mode.GOALIE){this.resetActor(this.player,v(0,-this.c.goalLine+1.05));this.resetActor(this.athletes[1],v((this.random()-.5)*10,-this.c.goalLine+15));this.resetPuck(this.athletes[1].position,1);}
  else{this.resetActor(this.player,v(0,this.mode===Mode.FULL?this.c.trainingStartZ:this.c.goalLine-12));this.resetActor(this.athletes[1],v(0,this.c.goalLine-1.05));this.resetPuck(this.player.position,this.controlled);}
  this.phase='playing';this.phaseTime=0;this.emit('ready',this.mode===Mode.FULL?'SKATE TO THE FAR SHOOTING ZONE':'READY');
 }
 step(dt,input=command()){
  if(this.paused||!this.player||this.phase==='finished'||this.phase==='result')return;
  if(dt<=0||dt>.05)throw Error('Use fixed simulation steps <= .05 seconds');
  const c={...command(),...input};this.messageTime-=dt;if(this.messageTime<=0)this.message='';
  if(this.block){if(c.shootDown||c.quickShot){this.block=false;}else{let released=!c.shootHeld&&!c.pass&&!c.check;c.shootDown=c.shootUp=c.shootHeld=c.pass=c.check=false;if(released)this.block=false;}}
  if(this.phase!=='playing'){this.phaseTime-=dt;if(this.phaseTime<=0){if(this.phase==='faceoff'){this.phase='playing';this.emit('start','PLAY');}else if(this.phase==='goal')this.faceoff();else if(this.phase==='period'){this.remaining=this.c.periodSeconds;this.faceoff();}}return;}
  if(c.switchPlayer&&!this.player.goalie){this.switchPlayer();c.shootDown=c.shootUp=c.shootHeld=false;}
  this.human(dt,c);const chasers=[this.nearest(0),this.nearest(1)];
  for(let i=0;i<this.athletes.length;i++){let a=this.athletes[i];a.cooldown=Math.max(0,a.cooldown-dt);a.saveTimer=Math.max(0,a.saveTimer-dt);a.kick=Math.max(0,a.kick-3*dt);if(!a.active)continue;if(i!==this.controlled)this.ai(i,dt,chasers[a.team]);this.integrate(i,dt);}
  this.separate();if(this.training)this.stats.elapsed+=dt;this.stepPuck(dt);
  if(this.shotLive){this.shotAge+=dt;if(this.training&&this.shotAge>5)this.resolve('MISS',false,false);}
  if(this.mode===Mode.GOALIE&&!this.delivered){this.feedTime-=dt;if(this.feedTime<=0)this.feed();}
  if(this.mode===Mode.MATCH&&this.phase==='playing'){this.remaining=Math.max(0,this.remaining-dt);if(this.remaining<=0){this.cancel(true);this.shotLive=false;if(this.period>=this.c.periodCount){this.phase='finished';this.emit('final',this.score[0]===this.score[1]?'FINAL - DRAW':this.score[0]>this.score[1]?'IRON PAW WINS':'CRIMSON DRAFT WINS');}else{this.period++;this.phase='period';this.phaseTime=3;this.emit('period','PERIOD '+this.period);}}}
 }
 human(dt,c){let a=this.player,direction=limit(c.move);if(this.mode===Mode.STATIONARY)direction=v();this.move(a,direction,c.sprint,dt);
  if(a.goalie){a.facing=v(0,this.sign(a.team));if(c.shootDown&&a.cooldown<=0){a.saveTimer=.42;a.cooldown=a.definition.id==='atlas'?.82:.64;a.saveAim=clamp(c.aim.x*3,-1,1);a.kick=1;this.emit('save-action','SAVE');}if(c.pass&&this.puck.owner===this.controlled)this.pass(this.controlled,c.aim);return;}
  if(c.pass&&this.mode===Mode.MATCH&&this.puck.owner===this.controlled){this.pass(this.controlled,c.aim);this.cancel(true);}
  if(c.check||(c.shootDown&&this.puck.owner!==this.controlled))this.check(this.controlled);
  // The release MUST never depend on reaching a training-zone gate.
  // Qualification is recorded separately; an early shot still visibly leaves the stick.
  if(c.quickShot&&this.puck.owner===this.controlled){
   this.shoot(this.controlled,c.aim,c.aimHeight,this.charging?this.charge:.48);this.cancel();return;
  }
  if(c.shootDown&&this.puck.owner===this.controlled&&!this.charging){this.charging=true;this.charge=0;}
  if(this.charging&&c.shootHeld)this.charge=clamp(this.charge+dt/this.c.shotChargeSeconds,0,1);
  // Level-state fallback recovers when a browser/runtime omits the release edge.
  if(this.charging&&(c.shootUp||(!c.shootHeld&&!c.shootDown))){
   this.shoot(this.controlled,c.aim,c.aimHeight,this.charge);this.cancel();
  }
  if(this.puck.owner!==this.controlled){this.charge=0;this.charging=false;}
 }

 move(a,input,sprint,dt){let r=a.definition.base_attributes,speed=a.goalie?(a.definition.id==='atlas'?3.7:4.8):a.speed;if(this.puck.owner>=0&&this.athletes[this.puck.owner]===a)speed*=.91+r.hnd*.0006;let boost=sprint&&a.stamina>.12&&!a.goalie&&len(input)>.25;speed*=boost?1.2:1;speed*=.65+.35*a.stamina;a.velocity=toward(a.velocity,mul(input,speed),(len(input)<.08?6:a.acceleration)*dt);if(len(input)>.12&&!a.goalie)a.facing=rotate(a.facing,norm(input),(2+r.agi*.045)*dt);a.stamina=clamp(a.stamina+dt*(boost?-.20*(1.25-r.sta*.006):.075),0,1);}
 integrate(i,dt){let a=this.athletes[i],old=a.position;a.position=add(a.position,mul(a.velocity,dt));a.position.x=clamp(a.position.x,-this.c.rinkHalfWidth+a.radius,this.c.rinkHalfWidth-a.radius);a.position.z=clamp(a.position.z,-this.c.rinkHalfLength+a.radius,this.c.rinkHalfLength-a.radius);if(a.goalie){let s=this.sign(a.team);a.position.x=clamp(a.position.x,-2.8,2.8);a.position.z=clamp(a.position.z*s,-this.c.goalLine+.35,-this.c.goalLine+3.1)*s;}if(this.mode===Mode.STATIONARY&&i===this.controlled){a.position=v(a.home.x,a.home.z);a.velocity=v();}if(this.mode===Mode.FULL&&i===this.controlled&&this.puck.owner===i){a.position.z=Math.min(a.position.z,this.c.goalLine-2.1);this.travel+=dist(old,a.position);this.stats.carriedDistance=this.travel;if(!this.runReady&&a.position.z>=this.c.trainingReleaseZ&&this.travel>=this.c.trainingReleaseZ-this.c.trainingStartZ-1){this.runReady=true;this.emit('zone','FULL RUN COMPLETE - RELEASE TO SHOOT');}}}
 separate(){for(let i=0;i<this.athletes.length;i++)for(let j=i+1;j<this.athletes.length;j++){let a=this.athletes[i],b=this.athletes[j];if(!a.active||!b.active)continue;let delta=sub(b.position,a.position),m=a.radius+b.radius;if(len(delta)>=m)continue;let n=len(delta)<.001?v(1,0):norm(delta),d=m-len(delta);if(a.goalie||(this.mode===Mode.STATIONARY&&i===this.controlled))b.position=add(b.position,mul(n,d));else if(b.goalie)a.position=sub(a.position,mul(n,d));else{a.position=sub(a.position,mul(n,d*.5));b.position=add(b.position,mul(n,d*.5));}}}
 nearest(team){let best=-1,d=Infinity;this.athletes.forEach((a,i)=>{if(!a.active||a.goalie||a.team!==team)return;let n=dist(a.position,this.puck.position);if(n<d){best=i;d=n;}});return best;}
 switchPlayer(){if(this.mode!==Mode.MATCH||this.view===View.GOALIE)return;let n=this.nearest(0);if(n===this.controlled){let pool=this.athletes.map((a,i)=>({a,i})).filter(o=>o.a.team===0&&!o.a.goalie&&o.i!==n).sort((a,b)=>dist(a.a.position,this.puck.position)-dist(b.a.position,this.puck.position));if(pool.length)n=pool[0].i;}if(n>=0){this.controlled=this.remembered=n;this.cancel(true);}}
 ai(i,dt,chaser){let a=this.athletes[i],s=this.sign(a.team),p=this.puck;a.decision-=dt;if(this.mode===Mode.GOALIE&&!a.goalie){a.velocity=v();return;}
  if(a.goalie){let target=v(clamp(p.position.x*.72,-1.35,1.35),-s*(this.c.goalLine-1.05));this.move(a,limit(mul(sub(target,a.position),2.5)),false,dt);a.facing=v(0,s);if(p.owner===i&&a.decision<=0&&this.mode===Mode.MATCH){this.pass(i,v(0,s));a.decision=.4;}if(this.shotLive&&p.velocity.z*s< -1&&dist(p.position,a.position)<9&&a.cooldown<=0&&a.decision<=0){a.decision=.12+(1-this.c.aiSkill)*.17;if(this.random()<.6+this.c.aiSkill*.25){a.saveTimer=.48;a.saveAim=clamp((p.position.x-a.position.x)*.4,-1,1);a.cooldown=a.definition.id==='atlas'?.95:.70;}}return;}
  if(this.training)return;let target;
  if(p.owner===i){target=v(a.position.x*.45,s*(this.c.goalLine-7));let gap=this.c.goalLine-a.position.z*s;if(a.decision<=0){a.decision=.4+(100-a.definition.base_attributes.iq)*.007;if(gap<17&&gap>1.5&&Math.abs(a.position.x)<11){let goal=v((this.random()-.5)*this.c.goalHalfWidth*1.6,s*this.c.goalLine);this.shoot(i,norm(sub(goal,a.position)),lerp(.18,1.15,this.random()),.3+this.random()*.6);}else if(this.athletes.some(b=>b.active&&b.team!==a.team&&dist(a.position,b.position)<2.4)&&this.random()<a.definition.base_attributes.iq/120)this.pass(i,v(0,s));}}
  else if(i===chaser&&(p.owner<0||this.athletes[p.owner].team!==a.team)){target=add(p.position,mul(p.velocity,.12));if(p.owner>=0&&this.athletes[p.owner].team!==a.team)this.check(i);}
  else{let attack=p.owner>=0&&this.athletes[p.owner].team===a.team,lane=[0,-6,6,-4,4][a.slot],offset=a.slot>=3?-9:attack?4:-5;target=v(lane,clamp(p.position.z+s*offset,-this.c.goalLine+4,this.c.goalLine-4));}
  this.move(a,limit(mul(sub(target,a.position),.8)),false,dt);
 }
 check(i){let a=this.athletes[i],p=this.puck;if(a.cooldown>0||p.owner<0||this.athletes[p.owner].team===a.team)return;let carrier=this.athletes[p.owner];if(dist(a.position,carrier.position)>1.55||carrier.goalie)return;a.cooldown=.9;p.owner=-1;p.velocity=mul(norm(sub(carrier.position,a.position)),5.5);p.pickupLock=.25;this.shotLive=false;a.kick=1;this.emit('check',a.definition.name+' - POKE CHECK',a.team);}
 pass(i,aim){let p=this.puck;if(p.owner!==i)return;if(this.mode===Mode.MATCH)this.matchStats.passes[this.athletes[i].team]++;let a=this.athletes[i],direction=len(aim)>.1?norm(aim):a.facing,best=-1,score=-Infinity;this.athletes.forEach((b,j)=>{if(j===i||!b.active||b.team!==a.team||b.goalie)return;let delta=sub(b.position,a.position);if(len(delta)>32)return;let n=dot(norm(delta),direction)*4-len(delta)*.07;if(n>score){score=n;best=j;}});if(best>=0)direction=norm(sub(add(this.athletes[best].position,mul(this.athletes[best].velocity,.25)),p.position));p.owner=-1;p.lastTouch=i;p.lastTeam=a.team;p.pickupLock=.2;p.velocity=mul(direction,12.8);p.vy=0;p.height=this.c.puckRadius;this.shotLive=false;a.kick=1;this.emit('pass',a.definition.name+' - PASS',a.team);}
 shoot(i,aim,height,charge){let p=this.puck;if(p.owner!==i)return;let a=this.athletes[i],s=this.sign(a.team),d=len(aim)>.01?norm(aim):a.facing,spread=(this.random()-.5)*(100-a.definition.base_attributes.sht)*.0016;d=norm(v(d.x+spread,d.z));p.position=add(a.position,mul(d,1));p.owner=-1;p.lastTouch=i;p.lastTeam=a.team;p.pickupLock=.32;p.velocity=mul(d,13+clamp(charge,0,1)*18+a.definition.base_attributes.sht*.035);p.height=this.c.puckRadius;p.trail=[];let t=Math.abs(p.velocity.z)>.01?(s*this.c.goalLine-p.position.z)/p.velocity.z:-1;p.vy=t>.05&&t<3?(clamp(height,this.c.puckRadius,this.c.goalHeight-this.c.puckRadius)-p.height+4.905*t*t)/t:0;this.targetSign=s;this.shotLive=true;this.shotAge=0;this.shotOnTarget=this.projected();this.shotQualified=this.mode!==Mode.FULL||this.runReady;this.lastShot={speed:len(p.velocity),charge:clamp(charge,0,1),origin:{...p.position},qualified:this.shotQualified,athlete:a.definition.id};if(this.mode===Mode.MATCH)this.matchStats.shots[a.team]++;a.kick=1;if(this.training){this.stats.attempts++;if(this.shotOnTarget)this.stats.onTarget++;if(!this.shotQualified)this.stats.earlyShots++;}this.emit('shot',this.shotQualified?a.definition.name+' - SHOT':'EARLY SHOT - FULL RUN NOT COMPLETE',a.team);}
 projected(){let p=this.puck;if(Math.abs(p.velocity.z)<.001)return false;let t=(this.targetSign*(this.c.goalLine+this.c.puckRadius)-p.position.z)/p.velocity.z;if(t<=0)return false;let x=p.position.x+p.velocity.x*t,h=Math.max(this.c.puckRadius,p.height+p.vy*t-4.905*t*t);return Math.abs(x)<=this.c.goalHalfWidth-this.c.puckRadius&&h+this.c.puckRadius<=this.c.goalHeight;}
 feed(){this.delivered=true;let a=this.athletes[1],x=(this.random()-.5)*(this.random()<.2?6.5:2.9);this.shoot(1,norm(sub(v(x,-this.c.goalLine),a.position)),.18+this.random(),.15+this.c.aiSkill*.6);}
 stepPuck(dt){let p=this.puck,c=this.c;p.pickupLock=Math.max(0,p.pickupLock-dt);if(p.owner>=0){p.trail=[];let a=this.athletes[p.owner],old=p.position;p.position=add(add(a.position,mul(a.facing,.95)),mul(v(a.facing.z,-a.facing.x),.2));p.position.x=clamp(p.position.x,-c.rinkHalfWidth+c.puckRadius,c.rinkHalfWidth-c.puckRadius);p.position.z=clamp(p.position.z,-c.rinkHalfLength+c.puckRadius,c.rinkHalfLength-c.puckRadius);p.height=c.puckRadius;p.velocity=v(a.velocity.x,a.velocity.z);p.vy=0;if(this.mode===Mode.MATCH)for(let s of [-1,1])if(validGoal(old,c.puckRadius,p.position,c.puckRadius,s,c)){this.goal(s);break;}return;}
  p.trail.push({x:p.position.x,z:p.position.z,h:p.height});if(p.trail.length>12)p.trail.shift();
  let steps=clamp(Math.ceil(len(p.velocity)*dt/.10),1,20),subdt=dt/steps;
  for(let k=0;k<steps;k++){let old=p.position,hy=p.height;p.position=add(p.position,mul(p.velocity,subdt));p.height+=p.vy*subdt-4.905*subdt*subdt;p.vy-=9.81*subdt;if(p.height<c.puckRadius){p.height=c.puckRadius;p.vy=Math.abs(p.vy)<1?0:-p.vy*.25;p.velocity=mul(p.velocity,Math.max(0,1-subdt*.13));}
   this.posts(old,hy);if(this.collide(old,hy))return;for(let s of [-1,1])if(validGoal(old,hy,p.position,p.height,s,c)){this.goal(s);return;}
   if(Math.abs(p.position.x)>c.rinkHalfWidth-c.puckRadius){p.position.x=clamp(p.position.x,-c.rinkHalfWidth+c.puckRadius,c.rinkHalfWidth-c.puckRadius);p.velocity.x*=-.78;}
   if(Math.abs(p.position.z)>c.rinkHalfLength-c.puckRadius){p.position.z=clamp(p.position.z,-c.rinkHalfLength+c.puckRadius,c.rinkHalfLength-c.puckRadius);p.velocity.z*=-.78;if(this.training&&this.shotLive){this.resolve('MISS',false,false);return;}}
  }
 }
 posts(old,hy){let p=this.puck,c=this.c;for(let s of [-1,1])for(let side of [-1,1]){let post=v(side*c.goalHalfWidth,s*c.goalLine),hit=segment(old,p.position,post),h=lerp(hy,p.height,hit.t);if(hit.d<c.puckRadius+.07&&h<c.goalHeight+c.puckRadius){let n=norm(sub(old,post));if(len(n)<.01)n=v(0,-s);p.position=add(post,mul(n,c.puckRadius+.075));let along=dot(p.velocity,n);if(along<0)p.velocity=sub(p.velocity,mul(n,along*1.75));}}
  for(let s of [-1,1]){let dz=p.position.z-old.z;if(Math.abs(dz)<.00001)continue;let t=(s*c.goalLine-old.z)/dz;if(t<0||t>1)continue;let h=lerp(hy,p.height,t),x=lerp(old.x,p.position.x,t);if(Math.abs(x)<=c.goalHalfWidth&&Math.abs(h-c.goalHeight)<c.puckRadius+.07){p.position=v(old.x,old.z);p.velocity.z*=-.72;}}
 }
 collide(old,hy){let p=this.puck;for(let i=0;i<this.athletes.length;i++){let a=this.athletes[i];if(!a.active||(i===p.lastTouch&&p.pickupLock>0))continue;let reach=a.radius+(a.goalie&&a.saveTimer>0?.52:0),center=v(a.position.x,a.position.z);if(a.goalie&&a.saveTimer>0)center.x+=a.saveAim*.42;let hit=segment(old,p.position,center),height=lerp(hy,p.height,hit.t),maxH=a.goalie?(a.saveTimer>0?1.50:1):.70;if(hit.d>reach+this.c.puckRadius||height>maxH)continue;
   if(len(p.velocity)<(a.goalie?4.2:13)&&height<.42&&p.pickupLock<=0){p.owner=i;p.lastTouch=i;p.lastTeam=a.team;if(this.training&&this.shotLive)this.resolve('PUCK COVERED',false,a.goalie&&this.shotOnTarget);else this.shotLive=false;return true;}
   let n=norm(sub(old,center));if(len(n)<.01)n=a.facing;p.position=add(center,mul(n,reach+this.c.puckRadius+.02));let along=dot(p.velocity,n);if(along<0)p.velocity=sub(p.velocity,mul(n,along*1.55));p.velocity=mul(p.velocity,a.goalie?.48:.80);p.lastTouch=i;p.lastTeam=a.team;p.pickupLock=.12;if(a.goalie&&this.shotLive){if(this.training)this.resolve(this.shotOnTarget?'SAVED':'WIDE SHOT BLOCKED',false,this.shotOnTarget);else{this.matchStats.saves[a.team]++;this.emit('save',a.definition.name+' - SAVE',a.team);this.shotLive=false;}return true;}
  }return false;
 }
 goal(s){let team=s===this.sign(0)?0:1;if(this.mode===Mode.MATCH){this.score[team]++;this.phase='goal';this.phaseTime=3;this.puck.velocity=v();this.puck.vy=0;this.shotLive=false;this.cancel(true);this.emit('goal','GOAL!',team);}else this.resolve(team===0?'GOAL!':'GOAL ALLOWED',true,false);}
 resolve(result,goal,save){if(this.phase==='result'||!this.shotLive)return;this.shotLive=false;this.phase='result';if(this.mode===Mode.FULL&&!this.shotQualified){result='EARLY SHOT - COMPLETE THE SKATE';goal=false;save=false;}this.stats.result=result;if(goal)this.stats.goals++;else if(save)this.stats.saves++;else this.stats.misses++;if(goal&&!this.shotOnTarget)this.stats.onTarget++;if(this.mode===Mode.FULL&&this.shotQualified)this.stats.completedRuns++;if(this.mode===Mode.FULL&&goal&&(!this.stats.bestFullRinkSeconds||this.stats.elapsed<this.stats.bestFullRinkSeconds))this.stats.bestFullRinkSeconds=this.stats.elapsed;this.cancel(true);this.emit(goal?'goal':save?'save':'miss',result);}
}

return {HockeySimulation,Mode,View,defaults,command,v,clamp,len,norm,sub,validGoal};
})();
