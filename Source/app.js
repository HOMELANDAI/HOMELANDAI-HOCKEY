(()=>{
const {HockeySimulation,Mode,View,defaults,command,v,clamp,len,norm,sub}=HAIHockey;
const {Graphics,Geometry,M,V,color,makeEnvironment,iceCanvas,gameplayGeometry,panelCorners}=HAIGraphics;

const VERSION='0.3.0', $=id=>document.getElementById(id), canvas=$('game');
const names={standard:'STANDARD HOCKEY',behind:'BEHIND PLAYER','goalie-fpv':'FPV GOALIE',aerial:'OVERHEAD AERIAL',stationary:'STATIONARY SHOOTING',goalie:'GOALIE TRAINING','full-rink':'FULL-LENGTH SKATE & SHOOT'};
const matches=['behind','goalie-fpv','aerial'];
let roster,graphics,environment,dynamic,ice,iceCorners,sim=null,selected='standard',matchView='aerial',screen='main',lastTime=0,accumulator=0,time=0,resultTimer=0,hudTimer=0,auto=true,ready=false,lookYaw=0,lookPitch=0,shotTarget={x:0,y:.65,z:25};
let xr=null,xrRef=null,xrCenter=null,xrRig=M.identity(),xrViewPose=M.identity(),xrMenuPose=null,xrHudPose=null,xrRay=null,xrSelect=false,xrTap=false,xrPadHeld=0,xrHoldFired=false,xrConsume=false,xrHovered='',xrController='No controller input source detected',xrProfile='';
let camEye=[0,34,26],camTarget=[0,0,-2],camPose=M.identity(),camView=M.identity(),fov=62*Math.PI/180,aimX=0,aimY=0;
const shotInput=new HAIShotInput.ShotInputBuffer();
let pending={pass:false,switchPlayer:false,check:false,quickShot:false},keys=new Set(),directions=new Set(),leftHeld=false,touchHeld=false,previousHeld=false,previousPad={},padAim={x:0,y:0},mouse={x:0,y:0},rightDrag=false;
let audioCtx=null,muted=false,vrPossible=false,touchMode=matchMedia('(pointer:coarse)').matches;
const resetInput=()=>{shotInput.clear();keys.clear();directions.clear();leftHeld=touchHeld=previousHeld=false;pending={pass:false,switchPlayer:false,check:false,quickShot:false};xrSelect=false;xrConsume=true;previousPad={};};
const setHidden=(id,hidden)=>{$(id).hidden=hidden;};

function setScreen(next){screen=next;for(let [id,state] of [['menu','main'],['pause','pause'],['result','result'],['helpModal','help']])setHidden(id,next!==state);setHidden('hud',!sim);setHidden('touch',!sim||next!=='none'||!touchMode);document.body.classList.toggle('playing',next!=='main');document.body.classList.toggle('touch-mode',touchMode);if(xr){xrMenuPose=null;updateXRUI(true);}}
function currentCode(){return sim?.mode===Mode.MATCH?sim.view:sim?.mode;}
function populateAthletes(){const goalie=selected==='goalie',old=$('athlete').value;$('athlete').replaceChildren();for(const d of roster.characters.filter(a=>goalie?['atlas','master_sniff'].includes(a.id):!['atlas','master_sniff'].includes(a.id))){const o=document.createElement('option');o.value=d.id;o.textContent=d.name+' / '+d.breed;$('athlete').append(o);}if([...$('athlete').options].some(o=>o.value===old))$('athlete').value=old;}
function selectMode(code){
 if(matches.includes(code)){matchView=code;code='standard';}
 selected=code;
 document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===code));
 document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('selected',b.dataset.camera===matchView));
 const match=code==='standard';
 setHidden('sizeWrap',!match);setHidden('athleteWrap',match);setHidden('emptyWrap',match||code==='goalie');setHidden('matchOptions',!match);setHidden('rosterSummary',!match);
 if(ready)populateAthletes();
 $('play').innerHTML=(match?'START STANDARD HOCKEY':'PLAY '+names[code])+' <span>&#8594;</span>';
}
function config(){return {skatersPerTeam:Number($('size').value),periodSeconds:Number($('periodLength').value),swapKits:$('kits').value==='reverse',emptyNetTraining:$('empty').checked,aiSkill:Number($('difficulty').value)};}
function start(code=selected){if(!ready)return;if(matches.includes(code)){matchView=code;code='standard';}selected=code;const match=code==='standard';sim=new HockeySimulation(roster.characters,config()).start(match?Mode.MATCH:code,match?matchView:View.BEHIND,$('athlete').value||'rocky');lookYaw=lookPitch=0;aimX=aimY=0;auto=$('auto').checked;resultTimer=0;resetInput();sim.cancel(true);lastTime=0;accumulator=0;setScreen('none');cameraDesired(true);unlockAudio();if(!xr)canvas.focus();updateHUD();}
function pause(){if(!sim||screen==='help')return;sim.pause(true);resetInput();setScreen('pause');setHidden('viewOptions',sim.training);$('pauseText').textContent=sim.training?'Take a break, restart the drill or return to the main menu.':'Switch your perspective without restarting the match.';document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',sim.view===b.dataset.view));}
function resume(){if(!sim)return;sim.pause(false);resetInput();setScreen('none');lastTime=0;if(!xr)canvas.focus();}
function mainMenu(){if(sim)sim.pause(true);sim=null;lookYaw=lookPitch=0;resetInput();setScreen('main');selectMode(selected);}
function nextAttempt(){if(!sim)return;if(sim.training)sim.nextAttempt();else sim.start(Mode.MATCH,sim.view);sim.pause(false);resultTimer=0;resetInput();setScreen('none');cameraDesired(true);if(!xr)canvas.focus();}
function changeView(view){if(!sim||sim.training)return;sim.pause(true);sim.setView(view);lookYaw=lookPitch=0;shotInput.clear();cameraDesired(true);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',view===b.dataset.view));xrMenuPose=null;}
let previousHelp='main';function help(){previousHelp=screen;if(sim)sim.pause(true);resetInput();setScreen('help');}function closeHelp(){if(previousHelp==='none')resume();else setScreen(previousHelp);}

for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>selectMode(b.dataset.mode));
for(const b of document.querySelectorAll('[data-camera]'))b.addEventListener('click',()=>selectMode(b.dataset.camera));
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>changeView(b.dataset.view));
$('releaseShot').onclick=()=>{if(sim&&screen==='none'){pending.quickShot=true;canvas.focus();}};
$('play').onclick=()=>start();$('pauseBtn').onclick=pause;$('resume').onclick=resume;$('home').onclick=mainMenu;$('reset').onclick=nextAttempt;$('next').onclick=nextAttempt;$('resultHome').onclick=mainMenu;
$('help').onclick=help;$('helpPause').onclick=help;$('closeHelp').onclick=closeHelp;$('vr').onclick=enterVR;
$('fullBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){if(sim)sim.emit('notice','Use the VIVERSE fullscreen control');}};
$('audio').onchange=()=>{muted=!$('audio').checked;};

function unlockAudio(){muted=!$('audio').checked;if(!muted){try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume().catch(()=>{});}catch{muted=true;}}}
function tone(kind){if(muted||!audioCtx||audioCtx.state!=='running')return;const ac=audioCtx,t=ac.currentTime;let hz=kind==='goal'?180:kind==='shot'?330:kind==='save'?230:kind==='faceoff'?820:140,dur=kind==='goal'?.6:kind==='faceoff'?.18:.09;for(let k=0;k<(kind==='goal'?2:1);k++){let o=ac.createOscillator(),g=ac.createGain();o.type=kind==='goal'?'triangle':'sine';o.frequency.setValueAtTime(hz*(1+k*.5),t);o.frequency.exponentialRampToValueAtTime(Math.max(40,hz*.4),t+dur);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.055,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+dur+.02);}}

window.addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)&&screen==='main')return;
 if(sim&&['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
 keys.add(e.code);if(e.code==='Space'&&sim&&screen==='none')shotInput.set('keyboard',true);if(e.repeat)return;
 if(e.code==='Escape'||e.code==='KeyP'){if(screen==='help')closeHelp();else if(screen==='pause')resume();else if(sim&&screen==='none')pause();return;}
 if(!sim||screen!=='none')return;
 if(e.code==='KeyX')pending.quickShot=true;if(e.code==='KeyF')pending.pass=true;if(e.code==='Tab')pending.switchPlayer=true;if(e.code==='KeyC')pending.check=true;if(e.code==='KeyR'&&sim.training)nextAttempt();
 if(sim.firstPerson&&(e.code==='KeyQ'||e.code==='KeyE')){lookYaw+=(e.code==='KeyQ'?-1:1)*Math.PI/6;cameraDesired(true);}
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space')shotInput.set('keyboard',false);});
window.addEventListener('blur',()=>{if(sim&&screen==='none'&&!xr)pause();resetInput();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(sim)sim.pause(true);resetInput();if(sim)setScreen('pause');}});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(!sim||screen!=='none')return;canvas.focus();canvas.setPointerCapture(e.pointerId);if(e.button===2){rightDrag=true;return;}if(e.pointerType!=='touch'){leftHeld=true;shotInput.set('mouse',true);}updateMouse(e);});
canvas.addEventListener('pointermove',e=>{if(rightDrag&&sim?.firstPerson){lookYaw+=e.movementX*.004;lookPitch=clamp(lookPitch-e.movementY*.003,-.65,.65);}else updateMouse(e);});
canvas.addEventListener('pointerup',e=>{if(e.button===2)rightDrag=false;else{leftHeld=false;shotInput.set('mouse',false);}});canvas.addEventListener('pointercancel',()=>{leftHeld=rightDrag=false;shotInput.set('mouse',false);});
window.addEventListener('pointerup',e=>{if(e.button===0&&leftHeld){leftHeld=false;shotInput.set('mouse',false);}});
canvas.addEventListener('lostpointercapture',()=>{leftHeld=false;shotInput.set('mouse',false);});
function updateMouse(e){const r=canvas.getBoundingClientRect();mouse.x=clamp((e.clientX-r.left)/r.width*2-1,-1,1);mouse.y=clamp(1-(e.clientY-r.top)/r.height*2,-1,1);aimX=mouse.x;aimY=mouse.y;}
for(const b of document.querySelectorAll('[data-dir]')){const stop=e=>{e.preventDefault();directions.delete(b.dataset.dir);};b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);directions.add(b.dataset.dir);});b.addEventListener('pointerup',stop);b.addEventListener('pointercancel',stop);}
$('touchShot').addEventListener('pointerdown',e=>{e.preventDefault();$('touchShot').setPointerCapture(e.pointerId);touchHeld=true;shotInput.set('touch',true);});for(let n of ['pointerup','pointercancel'])$('touchShot').addEventListener(n,()=>{touchHeld=false;shotInput.set('touch',false);});
$('touchPass').onclick=()=>pending.pass=true;$('touchSwitch').onclick=()=>pending.switchPlayer=true;

function getPad(){try{return [...(navigator.getGamepads?.()||[])].find(p=>p?.connected)||null;}catch{return null;}}
function dead(n){return Math.abs(n||0)<.15?0:n;}
function input(frame){let c=command(),x=Number(keys.has('KeyD')||keys.has('ArrowRight')||directions.has('right'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')||directions.has('left')),z=Number(keys.has('KeyW')||keys.has('ArrowUp')||directions.has('up'))-Number(keys.has('KeyS')||keys.has('ArrowDown')||directions.has('down'));let held=keys.has('Space')||leftHeld||touchHeld,sprint=keys.has('ShiftLeft')||keys.has('ShiftRight');
 if(xr){let source=[...xr.inputSources].find(s=>s.gamepad)||[...xr.inputSources][0];let gp=source?.gamepad;if(source){xrProfile=source.profiles?.join(', ')||source.targetRayMode;xrController=`${xrProfile}; axes=${gp?.axes?.length||0}, buttons=${gp?.buttons?.length||0}`;}else xrController='No controller input source detected';
  if(gp){let ax=gp.axes||[],tx=dead(ax[0]),ty=dead(ax[1]);if(ax.length>=4&&Math.hypot(ax[2],ax[3])>Math.hypot(tx,ty)){tx=dead(ax[2]);ty=dead(ax[3]);}x+=tx;z-=ty;held=held||!!gp.buttons[0]?.pressed||Number(gp.buttons[0]?.value||0)>.55;let click=!!(gp.buttons[2]?.pressed||(gp.buttons.length===2&&gp.buttons[1]?.pressed));if(click){xrPadHeld+=frame;if(xrPadHeld>1&&!xrHoldFired&&sim){xrHoldFired=true;pause();}}else{if(xrPadHeld>0&&!xrHoldFired&&screen==='none'){if(sim.puck.owner===sim.controlled)pending.pass=true;else pending.switchPlayer=true;}xrPadHeld=0;xrHoldFired=false;}}
  const trigger=gp&&gp.buttons&&gp.buttons.length?!!gp.buttons[0].pressed||Number(gp.buttons[0].value||0)>.55:xrSelect;shotInput.set('xr',trigger);held=held||trigger;
 }else{let gp=getPad();if(gp){x+=dead(gp.axes[0]);z-=dead(gp.axes[1]);let rx=dead(gp.axes[2]),ry=dead(gp.axes[3]);if(rx||ry){aimX=clamp(aimX+rx*frame*1.5,-1,1);aimY=clamp(aimY-ry*frame*1.5,-1,1);}const b=i=>!!gp.buttons[i]?.pressed;shotInput.set('gamepad',b(7)||Number(gp.buttons[7]?.value||0)>.55);held=held||b(7);sprint=sprint||b(5);if(b(0)&&!previousPad[0])pending.pass=true;if(b(3)&&!previousPad[3])pending.switchPlayer=true;if(b(2)&&!previousPad[2])pending.check=true;if(b(1)&&!previousPad[1]&&sim){if(screen==='pause')resume();else if(screen==='none')pause();}previousPad={0:b(0),1:b(1),2:b(2),3:b(3)};}else shotInput.set('gamepad',false);}
 shotInput.set('keyboard',keys.has('Space'));shotInput.set('mouse',leftHeld);shotInput.set('touch',touchHeld);c.shootDown=shotInput.peekDown();c.shootHeld=shotInput.held;previousHeld=held;
 if(xr&&xrConsume){c.shootDown=c.shootUp=c.shootHeld=false;shotInput.clear();if(!held)xrConsume=false;}
 let yaw=lookYaw+(sim?.sign(0)===-1?Math.PI:0);if(xr&&sim?.firstPerson){let f=M.dir(xrViewPose,[0,0,-1]);yaw=Math.atan2(f[0],-f[2]);}
 if(sim?.firstPerson&&!sim.player.goalie){c.move=v(x*Math.cos(yaw)+z*Math.sin(yaw),-x*Math.sin(yaw)+z*Math.cos(yaw));}else if(sim&&!sim.player.goalie&&sim.view===View.BEHIND)c.move=v(x*sim.sign(0),z*sim.sign(0));else c.move=v(x,z);
 c.sprint=sprint;c.pass=pending.pass;c.switchPlayer=pending.switchPlayer;c.check=pending.check;c.quickShot=pending.quickShot;pending={pass:false,switchPlayer:false,check:false,quickShot:false};
 let targetX=aimX*2.45,targetH=clamp((aimY+1)*.5*1.55,.12,1.53),targetZ=sim?.player.goalie?-defaults.goalLine*sim.sign(0):defaults.goalLine*(sim?.sign(0)||1);
 if(xrRay&&sim&&!sim.player.goalie){let {origin,direction}=xrRay;let worldZ=-targetZ,t=(worldZ-origin[2])/direction[2];if(t>0&&Number.isFinite(t)){targetX=clamp(origin[0]+direction[0]*t,-14,14);targetH=clamp(origin[1]+direction[1]*t,.12,1.53);}}
 if(sim?.player.goalie){c.aim=v(aimX*.4,1);if(xrRay)c.aim.x=clamp(xrRay.direction[0],-.4,.4);}else if(sim)c.aim=norm(sub(v(targetX,targetZ),sim.player.position));c.aimHeight=targetH;shotTarget={x:targetX,y:targetH,z:targetZ};return c;
}

function cameraDesired(snap=false){let eye,target;if(!sim){eye=[26,24,40];target=[0,0,-1];}
 else if(sim.firstPerson){let p=sim.player.position;eye=[p.x,sim.player.goalie?1.60:1.65,-p.z];let cp=Math.cos(lookPitch),yaw=lookYaw+(sim.sign(0)===-1?Math.PI:0);target=V.add(eye,[Math.sin(yaw)*cp,Math.sin(lookPitch)-.12,-Math.cos(yaw)*cp]);}
 else if(sim.view===View.AERIAL){let z=clamp(sim.puck.position.z*.35,-6,6);eye=[0,54,28-z];target=[0,0,-z];}
 else{let p=sim.player.position;eye=[p.x,3.5,-p.z+6.2*sim.sign(0)];target=[p.x,1,-p.z-6*sim.sign(0)];}
 if(snap||!sim||sim.firstPerson){camEye=eye;camTarget=target;}else{camEye=camEye.map((a,i)=>a+(eye[i]-a)*.13);camTarget=camTarget.map((a,i)=>a+(target[i]-a)*.15);}
 camView=M.lookAt(camEye,camTarget);camPose=M.inverseRigid(camView);
}
function tick(now){
 let dt=lastTime?Math.min((now-lastTime)/1000,.10):0;lastTime=now;time+=dt;let c=input(dt);
 if(xr&&c.shootDown&&xrHovered){activateXR(xrHovered);shotInput.clear();c.shootDown=c.shootHeld=false;xrConsume=true;}
 if(sim&&screen==='none'){
  accumulator+=dt;let first=true;
  while(accumulator+1e-9>=1/60){
   const cmd={...c,...shotInput.pull()};
   if(!first){cmd.pass=cmd.switchPlayer=cmd.check=cmd.quickShot=false;}
   sim.step(1/60,cmd);accumulator-=1/60;first=false;
  }
  if(first){pending.pass ||= c.pass;pending.switchPlayer ||= c.switchPlayer;pending.check ||= c.check;pending.quickShot ||= c.quickShot;}
  if(sim.phase==='result'||sim.phase==='finished'){resultTimer=0;setScreen('result');updateResult();}
 }else{
  accumulator=0;shotInput.clear();
  if(sim&&screen==='result'&&sim.training&&auto){resultTimer+=dt;$('autoStatus').textContent='Next puck in '+Math.max(0,Math.ceil(3-resultTimer))+'...';if(resultTimer>=3)nextAttempt();}
 }
 if(sim){for(const e of sim.events.splice(0)){if(['shot','goal','save','faceoff'].includes(e.kind))tone(e.kind);}}
 hudTimer+=dt;if(hudTimer>.09){hudTimer=0;updateHUD();if(xr)updateXRUI();}
 cameraDesired();buildDynamic();return dt;
}

function buildDynamic(){let g=sim?gameplayGeometry(sim,time):new Geometry();
 if(sim&&screen==='none'&&!sim.player.goalie){g.bar([shotTarget.x-.19,shotTarget.y,-shotTarget.z+.045],[shotTarget.x+.19,shotTarget.y,-shotTarget.z+.045],.028,color(0xffdc8d));g.bar([shotTarget.x,shotTarget.y-.19,-shotTarget.z+.045],[shotTarget.x,shotTarget.y+.19,-shotTarget.z+.045],.028,color(0xffdc8d));}
 if(sim?.firstPerson){let pose=xr?xrViewPose:camPose;g.transform=pose;g.box(.37,-.45,-.72,.17,.16,.18,color(0xd9b45e));g.bar([.39,-.45,-.72],[.57,-1.36,-1.28],.038,color(0x263949));g.box(.37,-1.36,-1.28,.42,.08,.075,color(0xe7c785));if(sim.player.goalie){g.box(-.42,-.46,-.69,.24,.24,.18,color(0xe7c785));if(sim.player.saveTimer>0)g.box(-.45,-.15,-.70,.28,.29,.18,color(0xffd98a));}g.transform=null;}
 if(xrRay){let end=V.add(xrRay.origin,V.scale(xrRay.direction,xrHovered?3:2));g.bar(xrRay.origin,end,.007,color(0x91e6e6));}
 graphics.update(g,dynamic);
}
function drawScene(proj,view,eye,viewport=null,fb=null,clear=true){graphics.begin(proj,view,eye,viewport,fb,clear);graphics.draw(environment);graphics.textured(ice,iceCorners);graphics.draw(dynamic);if(xr){if(xrHUDTexture&&xrHudPose)graphics.textured(xrHUDTexture,panelCorners(xrHudPose,1.65,.28,-2,.66),1,true);if(screen!=='none'&&xrMenuPose)graphics.textured(xrMenuTexture,panelCorners(xrMenuPose,2.3,1.66,-2.7),1,true);}}
function webFrame(now){requestAnimationFrame(webFrame);if(!ready||xr)return;graphics.resize(touchMode?.9:1);tick(now);let proj=M.perspective(fov,canvas.width/canvas.height,.05,250);drawScene(proj,camView,camEye);positionReticle();}
function positionReticle(){if(!sim||sim.player.goalie||screen!=='none'){$('goalReticle').hidden=true;return;}const p=M.project(graphics.vp,[shotTarget.x,shotTarget.y,-shotTarget.z]);const visible=p[3]>0&&Math.abs(p[0])<1&&Math.abs(p[1])<1;$('goalReticle').hidden=!visible;if(visible){$('goalReticle').style.left=(p[0]+1)*.5*canvas.clientWidth+'px';$('goalReticle').style.top=(1-p[1])*.5*canvas.clientHeight+'px';}}
function updateHUD(){if(!sim)return;const a=sim.player;$('homeScore').textContent=sim.score[0];$('awayScore').textContent=sim.score[1];$('period').textContent=sim.training?'PRACTICE':'PERIOD '+sim.period;let t=sim.training?sim.stats.elapsed:sim.remaining;$('clock').textContent=Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');$('modeName').textContent=sim.training?names[currentCode()]:`${sim.c.skatersPerTeam+1}v${sim.c.skatersPerTeam+1} | ${names[sim.view]}`;$('playerName').textContent=a.definition.name.toUpperCase();$('playerBreed').textContent=a.definition.breed;$('playerRole').textContent=a.goalie?'YOU ARE THE GOALIE':`YOU CONTROL | ${a.positionName} | #${a.jerseyNumber}`;$('playerEquipment').textContent=HAIGraphics.helmetName(a.definition.id)+' / '+(a.team===0?'IRON PAW':'CRIMSON DRAFT');$('stamina').style.width=a.stamina*100+'%';$('charge').style.width=sim.charge*100+'%';$('chargeLabel').textContent=a.goalie?(a.cooldown>0?'RECOVERING...':'PRESS SHOT TO SAVE'):sim.charging?'RELEASE TO SHOOT':sim.puck.owner===sim.controlled?'HOLD TO CHARGE / TAP TO SHOOT':sim.shotLive?'SHOT IN FLIGHT':'WIN THE PUCK / POKE CHECK';
 $('releaseShot').disabled=sim.player.goalie||sim.puck.owner!==sim.controlled||sim.phase!=='playing';
 $('shotStatus').textContent=sim.shotLive&&sim.lastShot?`PUCK RELEASED | ${Math.round(sim.lastShot.speed*3.6)} km/h${!sim.lastShot.qualified?' | EARLY RUN':''}`:sim.mode===Mode.FULL?(sim.runReady?'FULL RUN COMPLETE - SHOT QUALIFIES':'CARRY TO FAR LINE FOR FULL-RUN CREDIT'):'SPACE / TRIGGER RELEASE OR X QUICK SHOT';
 $('message').textContent=sim.message;setHidden('trainingHud',!sim.training);if(sim.training){let s=sim.stats;$('trainingName').textContent=sim.mode===Mode.FULL?'FULL-LENGTH RUN':sim.mode===Mode.GOALIE?'CREASE TRAINING':'SHOT LAB';$('trainingStats').textContent=sim.mode===Mode.GOALIE?`${s.saves} SAVES / ${s.onTarget} ON TARGET`:`${s.goals} GOALS / ${s.attempts} SHOTS${sim.mode===Mode.FULL?' | '+Math.round(Math.min(1,Math.max(0,(a.position.z-sim.c.trainingStartZ)/(sim.c.trainingReleaseZ-sim.c.trainingStartZ)))*100)+'% CARRY':''}`;}
 drawMap();}
function updateResult(){if(!sim)return;$('resultEyebrow').textContent=sim.training?'TRAINING RESULT':'FULL TIME';$('resultTitle').textContent=sim.training?sim.stats.result:sim.message;$('resultDetails').textContent=sim.training?sim.mode===Mode.GOALIE?`${sim.stats.saves} saves from ${sim.stats.onTarget} on-target attempts. Wide shots do not inflate save percentage.`:`${sim.stats.goals} goals from ${sim.stats.attempts} shots. Attempt time: ${sim.stats.elapsed.toFixed(1)} seconds.${sim.mode===Mode.FULL?' Early/incomplete runs: '+sim.stats.earlyShots+'.':''}`:`IRON PAW ${sim.score[0]} - ${sim.score[1]} CHALLENGERS`;$('next').textContent=sim.training?'NEXT ATTEMPT':'PLAY AGAIN';$('autoStatus').textContent=auto&&sim.training?'Next puck in 3...':'';try{localStorage.setItem('hai.frozenpaws.latest',JSON.stringify({version:VERSION,mode:sim.mode,score:sim.score,stats:sim.stats}));}catch{}}
function drawMap(){let cx=$('map').getContext('2d'),w=140,h=250;cx.clearRect(0,0,w,h);cx.fillStyle='#164055';cx.fillRect(7,7,w-14,h-14);cx.strokeStyle='#7295a7';cx.lineWidth=1;cx.strokeRect(7,7,w-14,h-14);cx.beginPath();cx.moveTo(7,h/2);cx.lineTo(w-7,h/2);cx.stroke();let point=p=>[7+(p.x+sim.c.rinkHalfWidth)/(sim.c.rinkHalfWidth*2)*(w-14),7+(sim.c.rinkHalfLength-p.z)/(sim.c.rinkHalfLength*2)*(h-14)];for(let [i,a] of sim.athletes.entries()){if(!a.active)continue;let p=point(a.position);cx.fillStyle=i===sim.controlled?'#ffdc8d':a.team===0?'#70baff':'#ee8291';cx.beginPath();cx.arc(...p,a.goalie?4:3,0,7);cx.fill();}let p=point(sim.puck.position);cx.fillStyle='#fff';cx.beginPath();cx.arc(...p,2,0,7);cx.fill();}

// Native WebXR: no plugin or cloud runtime is required. The browser must expose
// immersive-vr and the hosting iframe must allow xr-spatial-tracking.
let xrMenuCanvas=null,xrMenuTexture=null,xrHUDCanvas=null,xrHUDTexture=null,xrButtons=[];
async function checkVR(){if(!navigator.xr){$('vr').textContent='VR NOT AVAILABLE';$('vr').disabled=true;$('xrstatus').textContent='Use a WebXR-capable headset browser for immersive VR. Browser play is available now.';return;}try{vrPossible=await navigator.xr.isSessionSupported('immersive-vr');$('vr').disabled=!vrPossible;$('vr').textContent=vrPossible?'ENTER IMMERSIVE VR':'NO VR HEADSET DETECTED';$('xrstatus').textContent=vrPossible?'Immersive VR is available. Flow controller mapping still requires device testing.':'Browser play is ready. No immersive VR device is exposed by this browser.';}catch{$('vr').textContent='VR PERMISSION REQUIRED';$('vr').disabled=true;$('xrstatus').textContent='The host may need to allow xr-spatial-tracking. Browser play remains available.';}}
async function enterVR(){if(!ready||!vrPossible)return;try{const session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor']});xr=session;await graphics.gl.makeXRCompatible();session.updateRenderState({baseLayer:new XRWebGLLayer(session,graphics.gl,{alpha:false,depth:true,stencil:false,antialias:true,framebufferScaleFactor:.85}),depthNear:.05,depthFar:250});xrRef=await session.requestReferenceSpace('local-floor').catch(()=>session.requestReferenceSpace('local'));xrCenter=null;xrMenuPose=null;xrSelect=false;xrConsume=true;lastTime=0;document.body.classList.add('xr');start(selected);pause();session.addEventListener('selectstart',()=>{xrSelect=true;shotInput.set('xr',true);});session.addEventListener('selectend',()=>{xrSelect=false;shotInput.set('xr',false);});session.addEventListener('visibilitychange',()=>{if(session.visibilityState!=='visible'&&sim)pause();});session.addEventListener('inputsourceschange',()=>{xrSelect=false;xrPadHeld=0;xrConsume=true;});session.addEventListener('end',()=>{xr=null;xrRef=null;xrRay=null;xrCenter=null;document.body.classList.remove('xr');lastTime=0;resetInput();pause();});session.requestAnimationFrame(xrFrame);}catch(e){if(xr){await xr.end().catch(()=>{});xr=null;}document.body.classList.remove('xr');$('xrstatus').textContent='Could not enter VR: '+e.message;pause();}}
function xrFrame(now,frame){if(!xr)return;xr.requestAnimationFrame(xrFrame);let pose=frame.getViewerPose(xrRef);if(!pose){if(sim)sim.pause(true);return;}if(!xrCenter)xrCenter=M.inverseRigid(pose.transform.matrix);cameraDesired(true);xrRig=M.mul(camPose,xrCenter);xrViewPose=M.mul(xrRig,pose.transform.matrix);xrHudPose=xrViewPose;if(!xrMenuPose&&screen!=='none')xrMenuPose=xrViewPose.slice();
 let source=[...xr.inputSources].find(s=>s.gamepad)||[...xr.inputSources][0];if(source){let rp=frame.getPose(source.targetRaySpace,xrRef);if(rp){let m=M.mul(xrRig,rp.transform.matrix);xrRay={origin:[m[12],m[13],m[14]],direction:V.norm(M.dir(m,[0,0,-1]))};}else xrRay=null;}else xrRay=null;
 xrHovered=hitXR();tick(now);xrHudPose=xrViewPose;let gl=graphics.gl,layer=xr.renderState.baseLayer;gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.clearColor(...graphics.clear);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);for(const eye of pose.views){let vp=layer.getViewport(eye),world=M.mul(xrRig,eye.transform.matrix);drawScene(eye.projectionMatrix,M.inverseRigid(world),[world[12],world[13],world[14]],[vp.x,vp.y,vp.width,vp.height],layer.framebuffer,false);}}
function localHit(pose,w,h,z,cy=0){if(!xrRay||!pose)return null;let inv=M.inverseRigid(pose),o=M.point(inv,xrRay.origin),d=M.dir(inv,xrRay.direction);if(Math.abs(d[2])<1e-6)return null;let t=(z-o[2])/d[2];if(t<=0)return null;let x=o[0]+d[0]*t,y=o[1]+d[1]*t;if(Math.abs(x)>w/2||Math.abs(y-cy)>h/2)return null;return {x:(x/w+.5)*1024,y:(.5-(y-cy)/h)*740};}
function hitXR(){if(screen!=='none'){let p=localHit(xrMenuPose,2.3,1.66,-2.7);if(p)for(const b of xrButtons)if(p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)return b.id;}let p=localHit(xrHudPose,1.65,.28,-2,.66);if(p&&p.x<190)return 'menu';if(p&&p.x>835&&screen==='none'&&sim&&!sim.player.goalie)return 'quickshot';return '';}
function xrActionMode(code){if(sim?.mode===Mode.MATCH&&matches.includes(code)){changeView(code);resume();}else start(code);}
function activateXR(id){if(id==='menu'){pause();return;}if(id==='quickshot'){if(sim&&screen==='none')pending.quickShot=true;return;}if(id==='resume'){if(sim&&sim.phase==='result')nextAttempt();else resume();return;}if(id==='reset'){nextAttempt();return;}if(id==='exit'){xr?.end();return;}if(id==='auto'){auto=!auto;return;}if(names[id])xrActionMode(id);}
function updateXRUI(force=false){if(!graphics)return;if(!xrMenuCanvas){xrMenuCanvas=document.createElement('canvas');xrMenuCanvas.width=1024;xrMenuCanvas.height=740;xrMenuTexture=graphics.texture(xrMenuCanvas);xrHUDCanvas=document.createElement('canvas');xrHUDCanvas.width=1024;xrHUDCanvas.height=176;xrHUDTexture=graphics.texture(xrHUDCanvas);}
 const x=xrMenuCanvas.getContext('2d');x.fillStyle='#0b2232';x.fillRect(0,0,1024,740);x.strokeStyle='#d4b174';x.lineWidth=3;x.strokeRect(3,3,1018,734);x.textAlign='left';x.fillStyle='#f1c582';x.font='bold 25px Arial';x.fillText('ICE HOCKEY LAKE: FROZEN PAWS EDITION',38,50);x.fillStyle='#edf4f5';x.font='bold 37px Arial';x.fillText(screen==='result'?(sim?.stats.result||sim?.message||'RESULT'):'FROZEN PAWS / PAUSE MENU',38,108);x.fillStyle='#a8c4d3';x.font='18px Arial';x.fillText('Point at a button and press trigger. Mode buttons start or switch play.',38,141);xrButtons=[];
 function b(id,label,xx,yy,w=456,h=65){xrButtons.push({id,x:xx,y:yy,w,h});x.fillStyle=xrHovered===id?'#38566a':'#173a4e';x.fillRect(xx,yy,w,h);x.strokeStyle=xrHovered===id?'#f5d09a':'#496c80';x.lineWidth=2;x.strokeRect(xx,yy,w,h);x.fillStyle='#e9f0f3';x.font='bold 21px Arial';x.fillText(label,xx+18,yy+41);}
 b('resume',screen==='result'?'NEXT ATTEMPT':'RESUME',38,165);b('reset','RESTART / RESET',530,165);
 let modes=[['behind','HOCKEY 6v6 / BEHIND'],['goalie-fpv','HOCKEY 6v6 / GOALIE'],['aerial','HOCKEY 6v6 / AERIAL'],['stationary','TRAIN / STATIONARY SHOT'],['goalie','TRAIN / GOALIE'],['full-rink','TRAIN / FULL-LENGTH RUN']];modes.forEach(([id,n],i)=>b(id,n,i%2?530:38,251+Math.floor(i/2)*84));b('auto','AUTO-RESET: '+(auto?'ON':'OFF'),38,508);b('exit','EXIT IMMERSIVE VR',530,508);x.fillStyle='#abc1ce';x.font='18px Arial';x.fillText('Trackpad = skate. Trigger = shot/save. Tap pad = pass/switch.',38,611);x.fillText('Hold pad for one second = menu. Point at MENU at any time.',38,640);x.fillStyle='#dabf91';x.font='16px Arial';x.fillText('Experimental VR mapping / VIVE Flow device testing pending.',38,676);x.fillStyle='#8bb3c8';x.font='14px Arial';let info=xrController;while(x.measureText(info).width>944)info=info.slice(0,-4)+'...';x.fillText(info,38,709);graphics.updateTexture(xrMenuTexture,xrMenuCanvas);
 const h=xrHUDCanvas.getContext('2d');h.fillStyle='#0a2031ed';h.clearRect(0,0,1024,176);h.fillRect(0,0,1024,176);h.strokeStyle='#9fb8c2';h.strokeRect(1,1,1022,174);h.fillStyle=xrHovered==='menu'?'#f1c582':'#385469';h.fillRect(7,7,174,162);h.fillStyle=xrHovered==='menu'?'#112b3a':'#e5eef2';h.font='bold 30px Arial';h.fillText('MENU',44,101);h.fillStyle='#f1c582';h.font='bold 32px Arial';h.fillText(sim?.training?(names[currentCode()]||'TRAINING'):`IRON PAW ${sim?.score[0]||0}  -  ${sim?.score[1]||0} CHALLENGERS`,208,61);h.fillStyle='#d1e0e8';h.font='24px Arial';let text=sim?.training?`${sim.stats.goals} goals | ${sim.stats.saves} saves | ${sim.stats.attempts} attempts`:`Period ${sim?.period||1} | ${Math.ceil(sim?.remaining||0)} seconds`;h.fillText(text,208,106);h.font='21px Arial';h.fillText((sim?.message||'HOLD TRIGGER / RELEASE TO SHOOT').slice(0,43),208,145);if(screen==='none'&&sim&&!sim.player.goalie){h.fillStyle='#d5b075';h.fillRect(840,10,174,151);h.fillStyle='#0c2232';h.font='bold 22px Arial';h.fillText('SHOOT',878,88);h.font='16px Arial';h.fillText('tap to fire',875,115);}graphics.updateTexture(xrHUDTexture,xrHUDCanvas);
}

async function init(){try{if(!window.FrozenPawsRoster)throw Error('The bundled roster is missing. Upload the entire ZIP.');roster=JSON.parse(JSON.stringify(window.FrozenPawsRoster));graphics=new Graphics(canvas);environment=graphics.upload(makeEnvironment(defaults));dynamic=graphics.upload(new Geometry());ice=graphics.texture(iceCanvas(defaults));let w=defaults.rinkHalfWidth,l=defaults.rinkHalfLength;iceCorners=[[-w,.006,l],[w,.006,l],[w,.006,-l],[-w,.006,-l]];ready=true;populateAthletes();$('loadstate').textContent='RINK READY';$('play').disabled=false;selectMode(selected);cameraDesired(true);await checkVR();requestAnimationFrame(webFrame);window.FrozenPaws=Object.freeze({version:VERSION,runtime:'native-webgl-webxr',snapshot:()=>sim?{mode:sim.mode,view:sim.view,phase:sim.phase,score:[...sim.score],player:sim.player.definition.id,position:{...sim.player.position},puck:{...sim.puck.position,owner:sim.puck.owner,velocity:{...sim.puck.velocity},height:sim.puck.height},lastShot:sim.lastShot,runReady:!!sim.runReady,matchStats:sim.matchStats,stats:{...sim.stats},athletes:sim.athletes.length,controller:xrController}: {screen,ready:true}});if(new URLSearchParams(location.search).has('qa'))window.__frozenQA={get sim(){return sim;},get graphics(){return graphics;},start,pause,resume,changeView,nextAttempt,mainMenu,get shotInput(){return shotInput;},get core(){return HAIHockey;},get roster(){return roster;},get geometry(){return HAIGraphics;},tick,get camera(){return {eye:camEye,target:camTarget,pose:camPose};}};
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(sim)pause();window.frozenPawsError('The browser lost the graphics context. Reload the game to restore the rink.');});
 }catch(e){window.frozenPawsError(e);console.error(e);}}
init();

})();