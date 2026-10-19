/* Ordered input edges survive render frames with no physics tick and sub-frame taps. */
const HAIShotInput = (()=>{
 class ShotInputBuffer {
  constructor(){this.sources=new Map();this.edges=[];this.held=false;}
  set(source,pressed){
   this.sources.set(source,!!pressed);
   const next=[...this.sources.values()].some(Boolean);
   if(next!==this.held){this.edges.push(next?'down':'up');if(this.edges.length>32)this.edges.shift();}
   this.held=next;
  }
  peekDown(){return this.edges[0]==='down';}
  pull(){const edge=this.edges.shift();return {shootDown:edge==='down',shootUp:edge==='up',shootHeld:edge?edge==='down':this.held};}
  clear(){this.sources.clear();this.edges=[];this.held=false;}
 }
 return {ShotInputBuffer};
})();
