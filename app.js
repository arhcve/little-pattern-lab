const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const state = { game:null, round:0, sound:localStorage.getItem('pattern-lab-sound') !== 'off', stars:Number(localStorage.getItem('pattern-lab-stars')||0), buildStep:0 };
const COLORS = {red:'#ef493d',blue:'#1388d4',yellow:'#ffd33d',green:'#55a649',black:'#141414'};

const MATCH = [
  {answer:{kind:'triangle',color:'red',rotation:90},decoys:[{kind:'triangle',color:'red',rotation:0},{kind:'triangle',color:'blue',rotation:90}],note:'The red triangle points right.'},
  {answer:{kind:'half',color:'blue',rotation:180},decoys:[{kind:'half',color:'blue',rotation:0},{kind:'circle',color:'blue',rotation:0}],note:'The blue curve faces down.'},
  {answer:{kind:'diamond',color:'yellow',rotation:0},decoys:[{kind:'square',color:'yellow',rotation:0},{kind:'diamond',color:'green',rotation:0}],note:'The yellow diamond has four sloping sides.'},
  {answer:{kind:'chevron',color:'green',rotation:180},decoys:[{kind:'chevron',color:'green',rotation:0},{kind:'triangle',color:'green',rotation:180}],note:'The green arrow points left.'},
  {answer:{kind:'star',color:'red',rotation:18},decoys:[{kind:'star',color:'yellow',rotation:18},{kind:'star',color:'red',rotation:0}],note:'The red star has the same small turn.'}
];
const PATTERNS = [
  {seq:[['circle','blue'],['square','yellow'],['circle','blue']],answer:{kind:'square',color:'yellow'},decoys:[{kind:'circle',color:'yellow'},{kind:'square',color:'blue'}],note:'Blue circle, yellow square—then repeat.'},
  {seq:[['triangle','red'],['triangle','red'],['circle','green']],answer:{kind:'triangle',color:'red'},decoys:[{kind:'circle',color:'green'},{kind:'triangle',color:'green'}],note:'Two red triangles begin the group again.'},
  {seq:[['diamond','yellow'],['circle','blue'],['diamond','yellow']],answer:{kind:'circle',color:'blue'},decoys:[{kind:'diamond',color:'blue'},{kind:'circle',color:'yellow'}],note:'Yellow diamond and blue circle take turns.'},
  {seq:[['chevron','green'],['chevron','red'],['chevron','green']],answer:{kind:'chevron',color:'red'},decoys:[{kind:'chevron',color:'green'},{kind:'triangle',color:'red'}],note:'The arrow stays the same while its color alternates.'},
  {seq:[['star','yellow'],['circle','blue'],['circle','blue']],answer:{kind:'star',color:'yellow'},decoys:[{kind:'circle',color:'blue'},{kind:'star',color:'blue'}],note:'One star, two circles—then the group starts again.'}
];
const BUILD_ORDERS = [
  ['body','tail','head','eye'],['tail','body','eye','head'],['head','eye','body','tail'],['eye','head','tail','body'],['body','head','eye','tail']
];
const ROTATE = [
  {target:{kind:'lshape',color:'blue'},answer:{kind:'lshape',color:'blue',rotation:90},decoys:[{kind:'lmirror',color:'blue',rotation:90},{kind:'notch',color:'blue',rotation:90}],note:'It is the same blue shape after a quarter turn.'},
  {target:{kind:'notch',color:'red'},answer:{kind:'notch',color:'red',rotation:180},decoys:[{kind:'notchmirror',color:'red',rotation:180},{kind:'lshape',color:'red',rotation:180}],note:'The corners line up after a half turn.'},
  {target:{kind:'boot',color:'green'},answer:{kind:'boot',color:'green',rotation:270},decoys:[{kind:'bootmirror',color:'green',rotation:270},{kind:'notch',color:'green',rotation:270}],note:'The green boot shape is the same after turning.'},
  {target:{kind:'hook',color:'yellow'},answer:{kind:'hook',color:'yellow',rotation:90},decoys:[{kind:'hookmirror',color:'yellow',rotation:90},{kind:'lshape',color:'yellow',rotation:90}],note:'You kept the shape the same and changed only its direction.'},
  {target:{kind:'zig',color:'blue'},answer:{kind:'zig',color:'blue',rotation:180},decoys:[{kind:'zigmirror',color:'blue',rotation:180},{kind:'chevron',color:'blue',rotation:180}],note:'The blue zig shape matches after a half turn.'}
];
const SWITCH = [
  {rule:'color',card:{kind:'triangle',color:'blue'},bins:['blue','yellow'],answer:'blue',note:'Color rule: the blue triangle belongs in the blue box.'},
  {rule:'color',card:{kind:'circle',color:'yellow'},bins:['blue','yellow'],answer:'yellow',note:'Color rule: its round shape does not matter.'},
  {rule:'shape',card:{kind:'circle',color:'blue'},bins:['circle','triangle'],answer:'circle',note:'New shape rule: the blue color does not matter now.'},
  {rule:'shape',card:{kind:'triangle',color:'yellow'},bins:['circle','triangle'],answer:'triangle',note:'Shape rule: the yellow triangle goes with triangles.'},
  {rule:'shape',card:{kind:'circle',color:'yellow'},bins:['circle','triangle'],answer:'circle',note:'You held the new rule in mind: sort by shape.'}
];
const PART_LABEL = {body:'blue curved body',tail:'red triangle tail',head:'yellow circle head',eye:'small black circle eye'};

function shapeHTML(s, small=false){
  return `<span class="shape ${s.kind}${small?' small':''}" style="--fill:${COLORS[s.color]};--rotation:${s.rotation||0}deg" aria-hidden="true"></span>`;
}
function sameShape(a,b){return a.kind===b.kind&&a.color===b.color&&(a.rotation||0)===(b.rotation||0)}
function shuffleStable(answer,decoys,round){const list=[answer,...decoys];return round%2?[list[1],list[0],list[2]]:round%3===2?[list[2],list[1],list[0]]:list}

function tone(good=true){
  if(!state.sound)return;const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  const c=new C(),o=c.createOscillator(),g=c.createGain(),n=c.currentTime;o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.setValueAtTime(good?520:190,n);if(good)o.frequency.exponentialRampToValueAtTime(780,n+.16);g.gain.setValueAtTime(.055,n);g.gain.exponentialRampToValueAtTime(.001,n+.22);o.start();o.stop(n+.24);
}
function show(el){[$('#homeScreen'),$('#gameScreen'),$('#finishScreen')].forEach(x=>x.classList.add('hidden'));el.classList.remove('hidden');$('#backButton').classList.toggle('hidden',el===$('#homeScreen'));window.scrollTo(0,0)}
function home(){state.game=null;show($('#homeScreen'))}
function start(game){state.game=game;state.round=0;state.buildStep=0;show($('#gameScreen'));render()}
function gameInfo(){return {match:['Experiment 01','Match','Find the exact fit.','Choose the piece with the same shape, color and direction.'],pattern:['Experiment 02','Sequence','What comes next?','Find the rule, then choose the next piece.'],build:['Experiment 03','Compose','Build a little fish.','Look at the request, then choose that exact part.'],rotate:['Experiment 04','Rotate','Turn it in your mind.','Find the same shape after it turns. Reflections do not count.'],switch:['Experiment 05','Switch','What is the rule now?','Sort the card using the rule shown in the black label.']}[state.game]}

function render(){
  $('#feedback').classList.add('hidden');const [num,type,title,instruction]=gameInfo();$('#gameNumber').textContent=num;$('#gameType').textContent=type;$('#gameTitle').textContent=title;$('#gameInstruction').textContent=instruction;$('#roundLabel').textContent=`Round ${state.round+1} / 5`;
  $$('.progress i').forEach((x,i)=>{x.className=i<state.round?'done':i===state.round?'current':''});
  if(state.game==='match')renderMatch();if(state.game==='pattern')renderPattern();if(state.game==='build')renderBuild();if(state.game==='rotate')renderRotate();if(state.game==='switch')renderSwitch();
}
function renderChoices(items){
  return `<div class="choice-panel"><p>Choose one exact answer</p><div class="choices">${items.map((s,i)=>`<button class="choice" data-shape='${JSON.stringify(s)}' aria-label="Choice ${i+1}: ${s.color} ${s.kind}${s.rotation?`, turned ${s.rotation} degrees`:''}"><b>0${i+1}</b>${shapeHTML(s)}</button>`).join('')}</div></div>`;
}
function renderMatch(){
  const d=MATCH[state.round],items=shuffleStable(d.answer,d.decoys,state.round);
  $('#gameStage').innerHTML=`<div class="board"><span class="board-note">Find the duplicate in this 2 × 2 study</span><div class="match-grid"><span class="match-cell">${shapeHTML({kind:'circle',color:'blue'},true)}</span><span class="match-cell">${shapeHTML({kind:'square',color:'yellow'},true)}</span><span class="match-cell">${shapeHTML(d.answer,true)}</span><span class="match-cell target"></span></div></div>${renderChoices(items)}`;
  bindShapeChoices(d.answer,d.note);
}
function renderPattern(){
  const d=PATTERNS[state.round],items=shuffleStable(d.answer,d.decoys,state.round);
  $('#gameStage').innerHTML=`<div class="board"><span class="board-note">Read from left to right</span><div class="sequence-board">${d.seq.map(s=>`<span class="sequence-item">${shapeHTML({kind:s[0],color:s[1]},true)}</span>`).join('')}<span class="sequence-item blank">?</span></div></div>${renderChoices(items)}`;
  bindShapeChoices(d.answer,d.note);
}
function bindShapeChoices(answer,note){
  $$('.choice[data-shape]').forEach(b=>b.addEventListener('click',()=>{const picked=JSON.parse(b.dataset.shape);if(sameShape(picked,answer))correct(note);else wrong(b,'Look again: shape, color and direction must all match.')}));
}
function partVisual(p){return `<span class="choice-part part-${p}" aria-hidden="true"></span>`}
function renderBuild(){
  state.buildStep=0;const order=BUILD_ORDERS[state.round];
  $('#gameStage').innerHTML=`<div class="board"><span class="board-note">Assemble four exact parts</span><div class="fish-canvas"><span class="fish-part" data-part="tail">tail</span><span class="fish-part" data-part="body">body</span><span class="fish-part" data-part="head">head</span><span class="fish-part" data-part="eye">eye</span></div><span class="request-chip" id="requestChip">Find the ${PART_LABEL[order[0]]}</span></div><div class="choice-panel"><p>Choose the requested part</p><div class="choices">${['body','tail','head','eye'].map((p,i)=>`<button class="choice" data-part-choice="${p}" aria-label="Choice ${i+1}: ${PART_LABEL[p]}"><b>0${i+1}</b>${partVisual(p)}</button>`).join('')}</div></div>`;
  $$('[data-part-choice]').forEach(b=>b.addEventListener('click',()=>pickPart(b,order)));
}
function pickPart(button,order){
  const expected=order[state.buildStep],picked=button.dataset.partChoice;if(picked!==expected){wrong(button,`That is the ${PART_LABEL[picked]}. Find the ${PART_LABEL[expected]}.`);return}
  const slot=$(`.fish-part[data-part="${picked}"]`);slot.classList.add('filled');button.disabled=true;button.style.opacity='.25';tone(true);state.buildStep++;
  if(state.buildStep===4){setTimeout(()=>correct('Four exact parts make one complete fish.'),180)}else $('#requestChip').textContent=`Now find the ${PART_LABEL[order[state.buildStep]]}`;
}
function renderRotate(){
  const d=ROTATE[state.round],items=shuffleStable(d.answer,d.decoys,state.round);
  $('#gameStage').innerHTML=`<div class="board"><span class="board-note">Turning is allowed · flipping is not</span><div class="rotation-study"><span class="rotation-target">${shapeHTML(d.target)}</span><span class="turn-arrow">↻</span><span class="rotation-question">?</span></div></div>${renderChoices(items)}`;
  $$('.choice[data-shape]').forEach(b=>b.addEventListener('click',()=>{const picked=JSON.parse(b.dataset.shape);if(picked.kind===d.answer.kind&&picked.color===d.answer.color)correct(d.note);else wrong(b,'That shape is different. Imagine turning the original without flipping it.')}));
}
function binVisual(rule,id){
  if(rule==='color')return `<span class="color-bin" style="--bin:${COLORS[id]}"></span>`;
  return shapeHTML({kind:id,color:'black'},true);
}
function renderSwitch(){
  const d=SWITCH[state.round],changed=state.round===2;
  $('#gameStage').innerHTML=`<div class="board"><span class="board-note">One card · one active rule</span><div class="switch-study"><span class="rule-chip">${changed?'New rule · ':''}Sort by ${d.rule}</span><span class="switch-card">${shapeHTML(d.card)}</span><span class="card-caption">${d.card.color} ${d.card.kind}</span></div></div><div class="choice-panel"><p>Choose the correct box</p><div class="choices switch-choices">${d.bins.map((id,i)=>`<button class="choice" data-bin="${id}" aria-label="${id} box"><b>0${i+1}</b>${binVisual(d.rule,id)}<strong>${id}</strong></button>`).join('')}</div></div>`;
  $$('[data-bin]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.bin===d.answer)correct(d.note);else wrong(b,`Use the ${d.rule} rule. Ignore the ${d.rule==='color'?'shape':'color'} this time.`)}));
}
function wrong(button,message){tone(false);button.classList.remove('wrong');requestAnimationFrame(()=>button.classList.add('wrong'));$('#gameInstruction').textContent=message}
function correct(message){tone(true);$('.progress i:nth-child('+(state.round+1)+')').className='done';$('#feedbackTitle').textContent=state.game==='pattern'?'Rule found.':state.game==='build'?'Picture complete.':state.game==='rotate'?'Turn confirmed.':state.game==='switch'?'Sorted by the rule.':'Exact match.';$('#feedbackText').textContent=message;$('#feedback').classList.remove('hidden')}
function next(){if(state.round<4){state.round++;state.buildStep=0;render()}else finish()}
function finish(){state.stars+=5;localStorage.setItem('pattern-lab-stars',String(state.stars));$('#totalStars').textContent=state.stars;show($('#finishScreen'));tone(true)}

$$('[data-start]').forEach(b=>b.addEventListener('click',()=>start(b.dataset.start)));
$('#nextButton').addEventListener('click',next);$('#chooseButton').addEventListener('click',home);$('#restartButton').addEventListener('click',()=>start(state.game));$('#backButton').addEventListener('click',home);$('#homeLink').addEventListener('click',e=>{e.preventDefault();home()});
$('#researchLink')?.addEventListener('click',e=>{e.preventDefault();home();requestAnimationFrame(()=>$('#evidence')?.scrollIntoView({behavior:'smooth'}))});
$('#soundButton').addEventListener('click',()=>{state.sound=!state.sound;localStorage.setItem('pattern-lab-sound',state.sound?'on':'off');$('#soundButton').textContent=state.sound?'Sound on':'Sound off';$('#soundButton').setAttribute('aria-pressed',String(state.sound));$('#soundButton').setAttribute('aria-label',state.sound?'Turn sound off':'Turn sound on');if(state.sound)tone(true)});
$('#totalStars').textContent=state.stars;$('#soundButton').textContent=state.sound?'Sound on':'Sound off';

function initRippleField(){
  const canvas=$('#rippleCanvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  const palette=['#ef493d','#1388d4','#ffd33d','#55a649'];
  let width=0,height=0,dpr=1,frame=0,lastRipple=performance.now();
  let ripples=[];

  function resize(){
    const box=canvas.getBoundingClientRect();width=Math.max(1,box.width);height=Math.max(1,box.height);dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw(performance.now());
  }
  function addRipple(x,y,automatic=false){
    if(reduce.matches)return;ripples.push({x,y,born:performance.now(),automatic});if(ripples.length>5)ripples.shift();lastRipple=performance.now();
  }
  function drawCreature(x,y,size,color,turn,lift,scale,alpha){
    ctx.save();ctx.translate(x,y+lift);ctx.rotate(turn);ctx.scale(scale,scale);ctx.globalAlpha=alpha;ctx.fillStyle=color;
    ctx.beginPath();ctx.moveTo(-.52*size,-.32*size);ctx.lineTo(-.12*size,-.32*size);ctx.lineTo(-.12*size,-.55*size);ctx.lineTo(.14*size,-.32*size);ctx.lineTo(.52*size,-.32*size);ctx.lineTo(.27*size,0);ctx.lineTo(.52*size,.32*size);ctx.lineTo(.08*size,.32*size);ctx.lineTo(.08*size,.53*size);ctx.lineTo(-.18*size,.32*size);ctx.lineTo(-.52*size,.32*size);ctx.lineTo(-.28*size,0);ctx.closePath();ctx.fill();
    ctx.globalAlpha=Math.min(1,alpha+.12);ctx.fillStyle='#141414';ctx.beginPath();ctx.arc(.22*size,-.14*size,Math.max(1.6,size*.035),0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function draw(now){
    if(!width||!height)return;ctx.clearRect(0,0,width,height);
    ctx.strokeStyle='rgba(72,111,135,.16)';ctx.lineWidth=1;const paper=18;
    for(let x=0;x<width;x+=paper){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke()}
    for(let y=0;y<height;y+=paper){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke()}
    ripples=ripples.filter(r=>(now-r.born)<4300);
    const step=width<500?52:66,size=step*.82,cols=Math.ceil(width/step)+2,rows=Math.ceil(height/step)+2;
    for(let row=-1;row<rows;row++)for(let col=-1;col<cols;col++){
      const x=col*step+(row%2?step*.5:0),y=row*step;let energy=0,turn=0;
      for(const r of ripples){const age=(now-r.born)/1000,dist=Math.hypot(x-r.x,y-r.y),front=age*185,delta=dist-front;const ring=Math.exp(-(delta*delta)/(2*34*34))*Math.exp(-age*.22);energy+=ring;turn+=ring*(col%2?-.46:.46)}
      const base=((row+col)%4)*Math.PI/2,lift=-Math.min(1,energy)*13,scale=1+Math.min(.16,energy*.1);
      drawCreature(x,y,size,palette[Math.abs(row*3+col)%palette.length],base+turn,lift,scale,.72+Math.min(.22,energy*.18));
    }
    if(!reduce.matches){if(now-lastRipple>3300)addRipple(width*(.25+Math.random()*.5),height*(.25+Math.random()*.5),true);frame=requestAnimationFrame(draw)}
  }
  canvas.addEventListener('pointerdown',event=>{const box=canvas.getBoundingClientRect();addRipple(event.clientX-box.left,event.clientY-box.top);canvas.setPointerCapture?.(event.pointerId)});
  reduce.addEventListener?.('change',()=>{cancelAnimationFrame(frame);ripples=[];draw(performance.now())});
  new ResizeObserver(resize).observe(canvas);resize();
}

initRippleField();
