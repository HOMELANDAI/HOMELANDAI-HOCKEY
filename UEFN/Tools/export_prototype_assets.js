/* HomelandAI Studios. Exports authored procedural meshes, NOT reference-image reconstructions.
   Usage: node export_prototype_assets.js <renderer.js> <simulation.js> <roster.json> <Models-dir> */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const [rendererPath,corePath,rosterPath,out]=process.argv.slice(2);
if(!out)throw new Error('Expected renderer.js simulation.js roster.json output_directory');
const ctx=vm.createContext({console,Math,Float32Array,Map,Set});
vm.runInContext(fs.readFileSync(corePath,'utf8')+'\nglobalThis.core=HAIHockey;',ctx);
vm.runInContext(fs.readFileSync(rendererPath,'utf8')+'\nglobalThis.geo=HAIGraphics;',ctx);
const G=ctx.geo, C=ctx.core,roster=JSON.parse(fs.readFileSync(rosterPath,'utf8'));
fs.mkdirSync(out,{recursive:true});const palette=new Map(),manifest=[];
function material(c){const key=c.map(n=>Math.round(n*255)).join('_');if(!palette.has(key))palette.set(key,c);return 'HAI_'+key;}
function obj(name,geometry,extra={}){
 const d=geometry.data,verts=[],normals=[],faces=[],vertices=new Map();let discarded=0;
 function vertex(o){const p=[-d[o+2]*100,d[o]*100,d[o+1]*100],n=[-d[o+5],d[o+3],d[o+4]];if([...p,...n].some(x=>!Number.isFinite(x)))throw new Error('Non-finite mesh');
  const key=[...p,...n].map(x=>x.toFixed(6)).join(',');if(vertices.has(key))return vertices.get(key);const ix=verts.length+1;vertices.set(key,ix);verts.push(p);normals.push(n);return ix;}
 for(let o=0;o<d.length;o+=27){if(Math.hypot(d[o+3],d[o+4],d[o+5])<.001){discarded++;continue;}
  const m=material(d.slice(o+6,o+9));faces.push({indices:[vertex(o),vertex(o+18),vertex(o+9)],m});}
 let lines=['# HomelandAI Studios - prototype static mesh','\n# UNITS: centimetres. +X forward, +Y right, +Z up. Import scale 1.','mtllib FrozenPaws.mtl','o '+name];
 verts.forEach(p=>lines.push('v '+p.map(x=>x.toFixed(6)).join(' ')));normals.forEach(n=>lines.push('vn '+n.map(x=>x.toFixed(6)).join(' ')));
 let previous='';for(const f of faces){if(f.m!==previous){lines.push('usemtl '+f.m);previous=f.m;}lines.push('f '+f.indices.map(i=>i+'//'+i).join(' '));}
 fs.writeFileSync(path.join(out,name+'.obj'),lines.join('\n')+'\n');const min=[0,1,2].map(i=>Math.min(...verts.map(v=>v[i]))),max=[0,1,2].map(i=>Math.max(...verts.map(v=>v[i])));
 manifest.push({file:name+'.obj',vertices:verts.length,triangles:faces.length,discarded_degenerate_triangles:discarded,bounds_cm:{min,max},...extra});
}
const numbers={rocky:9,atlas:30,billy:44,crash:17,kefla:24,koda:28,crimson_emperor:77,razor:13,shockwave:19,slash:55,sparkplug:11,master_sniff:1,nova:88,penny:7,pixy:8};
for(const [index,d] of roster.characters.entries())for(const [kit,team,variant] of [['IronPawHome',0,'standard'],['IronPawAway',0,'reverse'],['CrimsonAway',1,'standard'],['CrimsonHome',1,'reverse']]){
 const a={definition:d,active:true,position:{x:0,z:0},facing:{x:0,z:1},velocity:{x:0,z:0},team,kitVariant:variant,goalie:['atlas','master_sniff'].includes(d.id),saveTimer:0,kick:0,jerseyNumber:numbers[d.id]};
 const mesh=new G.Geometry();G.dog(mesh,a,0);obj(d.id+'_'+kit,mesh,{canonical_index:index,character_id:d.id,kit,helmet_family:G.helmetName(d.id),skeletal:false,approved_final_art:false});
}
const env=G.makeEnvironment(C.defaults),w=C.defaults.rinkHalfWidth,l=C.defaults.rinkHalfLength;
for(const z of [-25,0,25])env.box(0,.012,-z,w*2,.015,.13,G.color(0xaa3b4c));
for(const z of [-9,9])env.box(0,.014,-z,w*2,.017,.24,G.color(0x2666a3));
for(const z of [-18,18])for(const x of [-7.2,7.2])env.ring(x,.025,-z,3.5,.04,G.color(0xaa3b4c));
env.ring(0,.025,0,4.5,.055,G.color(0x224d79));
env.box(-.90,.030,0,.30,.02,3.0,G.color(0xe8c891));env.box(.90,.030,0,.30,.02,3.0,G.color(0xe8c891));env.box(0,.032,0,2.0,.02,.30,G.color(0xe8c891));
obj('FrozenLake_Arena',env,{collision:'disabled on gameplay proxies; manually configured on visual floor if desired'});
const puck=new G.Geometry();puck.cone(0,-.05,0,.18,.125,G.color(0x121c26),16,.18);obj('Hockey_Puck',puck,{gameplay_radius_m:.12,visual_radius_m:.18});
const marker=new G.Geometry();marker.bar([-.20,0,0],[.20,0,0],.025,G.color(0xffdd88));marker.bar([0,-.20,0],[0,.20,0],.025,G.color(0xffdd88));obj('Aim_Marker',marker);
let mtl=['# HomelandAI prototype palette - no downloaded textures',''];for(const [key,c] of palette){mtl.push('newmtl HAI_'+key,'Ka 0.10 0.10 0.10','Kd '+c.map(x=>x.toFixed(6)).join(' '),'Ks 0.20 0.20 0.20','Ns 30','d 1','illum 2','');}
fs.writeFileSync(path.join(out,'FrozenPaws.mtl'),mtl.join('\n'));
fs.writeFileSync(path.join(out,'ASSET_MANIFEST.json'),JSON.stringify({format:'OBJ+MTL',units:'cm',forward:'+X',right:'+Y',up:'+Z',static_meshes:true,rigs_or_animations:false,material_count:palette.size,meshes:manifest},null,2));
console.log('Exported',manifest.length,'OBJ meshes,',palette.size,'materials');
