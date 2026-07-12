'use strict';
const COLS=10, ROWS=20, CELL=32;
const SHAPES={
 I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
 O:[[1,1],[1,1]],
 T:[[0,1,0],[1,1,1],[0,0,0]],
 J:[[1,0,0],[1,1,1],[0,0,0]],
 L:[[0,0,1],[1,1,1],[0,0,0]],
 S:[[0,1,1],[1,1,0],[0,0,0]],
 Z:[[1,1,0],[0,1,1],[0,0,0]]
};
const TYPES=Object.keys(SHAPES);
const COLORS={I:'#55d8ff',O:'#ffd75d',T:'#d077ff',J:'#6389ff',L:'#ff9a4a',S:'#66e083',Z:'#ff6782'};
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const nextCanvas=document.getElementById('next'),nextCtx=nextCanvas.getContext('2d');
const holdCanvas=document.getElementById('hold'),holdCtx=holdCanvas.getContext('2d');
const scoreEl=document.getElementById('score'),levelEl=document.getElementById('level'),linesEl=document.getElementById('lines');
const overlay=document.getElementById('overlay'),overlayTitle=document.getElementById('overlayTitle'),overlayText=document.getElementById('overlayText');
const images={}; let loaded=0;
for(const type of TYPES){const im=new Image();im.src=`assets/poses/pose-${type}.png`;im.onload=()=>loaded++;images[type]=im;}
let board,player,nextType,holdType=null,canHold=true,score=0,lines=0,level=1,dropCounter=0,lastTime=0,playing=false,paused=false,bag=[];
function emptyBoard(){return Array.from({length:ROWS},()=>Array(COLS).fill(null));}
function cloneMatrix(m){return m.map(r=>r.slice());}
function rotate(m){return m[0].map((_,i)=>m.map(row=>row[i]).reverse());}
function randomType(){if(!bag.length)bag=TYPES.slice().sort(()=>Math.random()-.5);return bag.pop();}
function spawn(type=randomType()){const matrix=cloneMatrix(SHAPES[type]);return{type,matrix,x:Math.floor((COLS-matrix[0].length)/2),y:-1};}
function collide(p=player){for(let y=0;y<p.matrix.length;y++)for(let x=0;x<p.matrix[y].length;x++)if(p.matrix[y][x]){const bx=p.x+x,by=p.y+y;if(bx<0||bx>=COLS||by>=ROWS||(by>=0&&board[by][bx]))return true;}return false;}
function getOccupiedBounds(matrix){let minX=99,minY=99,maxX=-1,maxY=-1;matrix.forEach((r,y)=>r.forEach((v,x)=>{if(v){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}}));return{minX,minY,maxX,maxY,w:maxX-minX+1,h:maxY-minY+1};}
function merge(){const b=getOccupiedBounds(player.matrix);player.matrix.forEach((r,y)=>r.forEach((v,x)=>{if(v&&player.y+y>=0)board[player.y+y][player.x+x]={type:player.type,sx:x-b.minX,sy:y-b.minY,sw:b.w,sh:b.h};}));}
function clearLines(){let cleared=0;outer:for(let y=ROWS-1;y>=0;y--){for(let x=0;x<COLS;x++)if(!board[y][x])continue outer;board.splice(y,1);board.unshift(Array(COLS).fill(null));cleared++;y++;}if(cleared){const pts=[0,100,300,500,800][cleared]*level;score+=pts;lines+=cleared;level=Math.floor(lines/10)+1;updateStats();}}
function lock(){merge();clearLines();player=spawn(nextType);nextType=randomType();canHold=true;if(collide()){gameOver();}drawPreviews();}
function stepDown(){if(!playing||paused)return;player.y++;if(collide()){player.y--;lock();}else score+=1;updateStats();dropCounter=0;}
function hardDrop(){if(!playing||paused)return;let d=0;while(!collide({...player,y:player.y+1})){player.y++;d++;}score+=d*2;updateStats();lock();}
function move(dx){if(!playing||paused)return;player.x+=dx;if(collide())player.x-=dx;}
function turn(){if(!playing||paused)return;const old=player.matrix,oldX=player.x;player.matrix=rotate(player.matrix);for(const kick of [0,-1,1,-2,2]){player.x=oldX+kick;if(!collide())return;}player.matrix=old;player.x=oldX;}
function hold(){if(!playing||paused||!canHold)return;const current=player.type;if(holdType){player=spawn(holdType);holdType=current;}else{holdType=current;player=spawn(nextType);nextType=randomType();}canHold=false;drawPreviews();}
function drawGrid(){ctx.fillStyle='#090913';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='rgba(168,146,215,.18)';ctx.lineWidth=1;for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*CELL,0);ctx.lineTo(x*CELL,ROWS*CELL);ctx.stroke()}for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*CELL);ctx.lineTo(COLS*CELL,y*CELL);ctx.stroke()}}
function drawCell(cell,x,y){const img=images[cell.type];const sw=img.width/cell.sw,sh=img.height/cell.sh;ctx.save();ctx.beginPath();ctx.rect(x*CELL,y*CELL,CELL,CELL);ctx.clip();ctx.drawImage(img,cell.sx*sw,cell.sy*sh,sw,sh,x*CELL,y*CELL,CELL,CELL);ctx.restore();ctx.strokeStyle='rgba(255,255,255,.15)';ctx.strokeRect(x*CELL+.5,y*CELL+.5,CELL-1,CELL-1);}
function drawPiece(p,ghost=false){const b=getOccupiedBounds(p.matrix),img=images[p.type];const dx=(p.x+b.minX)*CELL,dy=(p.y+b.minY)*CELL,dw=b.w*CELL,dh=b.h*CELL;ctx.save();ctx.globalAlpha=ghost?.22:1;if(ghost){ctx.fillStyle=COLORS[p.type];p.matrix.forEach((r,y)=>r.forEach((v,x)=>v&&ctx.fillRect((p.x+x)*CELL,(p.y+y)*CELL,CELL,CELL)));}else{ctx.drawImage(img,dx,dy,dw,dh);ctx.strokeStyle='rgba(255,255,255,.3)';p.matrix.forEach((r,y)=>r.forEach((v,x)=>v&&ctx.strokeRect((p.x+x)*CELL+.5,(p.y+y)*CELL+.5,CELL-1,CELL-1)));}ctx.restore();}
function draw(){drawGrid();for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(board[y][x])drawCell(board[y][x],x,y);if(player){let gy=player.y;while(!collide({...player,y:gy+1}))gy++;drawPiece({...player,y:gy},true);drawPiece(player,false);}}
function preview(context,type,w,h){context.clearRect(0,0,w,h);if(!type)return;const img=images[type],size=Math.min(w-22,h-22);context.imageSmoothingEnabled=false;context.drawImage(img,(w-size)/2,(h-size)/2,size,size);}
function drawPreviews(){preview(nextCtx,nextType,nextCanvas.width,nextCanvas.height);preview(holdCtx,holdType,holdCanvas.width,holdCanvas.height);}
function updateStats(){scoreEl.textContent=score.toLocaleString('es-ES');levelEl.textContent=level;linesEl.textContent=lines;}
function start(){board=emptyBoard();score=0;lines=0;level=1;holdType=null;canHold=true;bag=[];nextType=randomType();player=spawn();playing=true;paused=false;overlay.classList.remove('visible');updateStats();drawPreviews();lastTime=performance.now();requestAnimationFrame(loop);}
function gameOver(){playing=false;overlayTitle.textContent='Fin de la partida';overlayText.textContent=`Has conseguido ${score.toLocaleString('es-ES')} puntos. ¡Mamá estaría orgullosa!`;document.getElementById('startBtn').textContent='Jugar otra vez';overlay.classList.add('visible');}
function togglePause(){if(!playing)return;paused=!paused;if(paused){overlayTitle.textContent='Pausa';overlayText.textContent='Respira un momento y continúa cuando quieras';document.getElementById('startBtn').textContent='Continuar';overlay.classList.add('visible');}else overlay.classList.remove('visible');}
function loop(t=0){if(!playing)return;const delta=t-lastTime;lastTime=t;if(!paused){dropCounter+=delta;if(dropCounter>Math.max(110,900-(level-1)*70))stepDown();draw();}requestAnimationFrame(loop);}
document.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' '].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')move(-1);else if(e.key==='ArrowRight')move(1);else if(e.key==='ArrowDown')stepDown();else if(e.key==='ArrowUp')turn();else if(e.key===' ')hardDrop();else if(e.key.toLowerCase()==='c'||e.key==='Shift')hold();else if(e.key.toLowerCase()==='p'||e.key==='Escape')togglePause();});
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('pointerdown',()=>({left:()=>move(-1),right:()=>move(1),rotate:turn,down:stepDown,drop:hardDrop,hold}[b.dataset.action]())));
document.getElementById('startBtn').addEventListener('click',()=>paused?togglePause():start());document.getElementById('restartBtn').addEventListener('click',start);document.getElementById('pauseBtn').addEventListener('click',togglePause);
board=emptyBoard();player=spawn('T');nextType='L';draw();drawPreviews();
