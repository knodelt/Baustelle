const YELLOW = '#f2aa08';
const YELLOW_LIGHT = '#ffc943';
const ORANGE = '#dc7900';
const METAL = '#727b80';
const DARK = '#171b1e';

let renderer = null;

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
}

function polygon(ctx, points, fill, stroke = null, lineWidth = 1) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index][0], points[index][1]);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function line(ctx, x1, y1, x2, y2, color, width = 1, dash = []) {
  ctx.beginPath();
  ctx.setLineDash(dash);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.setLineDash([]);
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

class ConstructionRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.texture = null;
    this.state = { active: false, progress: 0, scene: 'earth' };
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  setState(job, progress = 0) {
    this.state = {
      active: Boolean(job),
      progress: Math.max(0, Math.min(1, progress)),
      scene: job?.scene || 'earth'
    };
    if (this.reducedMotion) this.draw(performance.now());
  }

  resize() {
    const box = this.canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = Math.round(box.width);
    this.height = Math.round(box.height);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.texture = this.buildTexture();
    this.draw(performance.now());
  }

  buildTexture() {
    const texture = document.createElement('canvas');
    texture.width = Math.max(1, Math.round(this.width * this.dpr));
    texture.height = Math.max(1, Math.round(this.height * this.dpr));
    const ctx = texture.getContext('2d');
    ctx.scale(this.dpr, this.dpr);
    const random = seededRandom(94721 + this.width * 7 + this.height);
    for (let index = 0; index < Math.round(this.width * this.height / 900); index += 1) {
      const alpha = .025 + random() * .035;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(random() * this.width, random() * this.height, random() * 1.8 + .3, random() * 1.8 + .3);
    }
    return texture;
  }

  frame(time) {
    if (!document.hidden && !this.reducedMotion) this.draw(time);
    requestAnimationFrame(this.frame);
  }

  draw(time) {
    const ctx = this.ctx;
    const width = this.width;
    const height = this.height;
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.drawSky(ctx, width, height);
    this.drawTerrain(ctx, width, height);
    this.drawFoundation(ctx, width, height, this.state.progress);
    this.drawContainer(ctx, width, height);
    if (width > 560) this.drawCrane(ctx, width, height, time);
    if (width > 720) this.drawTruck(ctx, width, height, time);
    this.drawExcavator(ctx, width, height, time);
    this.drawForeground(ctx, width, height, time);

    if (this.texture) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = .55;
      ctx.drawImage(this.texture, 0, 0, width, height);
      ctx.restore();
    }
    this.drawGrade(ctx, width, height);
  }

  drawSky(ctx, width, height) {
    const horizon = height * .36;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#202a30');
    sky.addColorStop(.58, '#34434a');
    sky.addColorStop(1, '#8b8170');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizon + 2);

    const glow = ctx.createRadialGradient(width * .72, height * .11, 0, width * .72, height * .11, width * .42);
    glow.addColorStop(0, 'rgba(255,198,107,.16)');
    glow.addColorStop(1, 'rgba(255,198,107,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, horizon);

    polygon(ctx, [[0,horizon],[0,horizon*.7],[width*.16,horizon*.51],[width*.31,horizon*.74],[width*.48,horizon*.46],[width*.67,horizon*.7],[width*.82,horizon*.42],[width,horizon*.69],[width,horizon]], '#242d30');
    polygon(ctx, [[0,horizon],[0,horizon*.84],[width*.15,horizon*.67],[width*.32,horizon*.88],[width*.55,horizon*.65],[width*.74,horizon*.86],[width,horizon*.61],[width,horizon]], '#1c2326');

    ctx.save();
    ctx.globalAlpha = .4;
    const base = horizon;
    const buildingColor = '#141b1e';
    const buildings = [
      [.03,.1,.14,.45], [.17,.11,.09,.31], [.79,.1,.12,.4], [.91,.06,.08,.27]
    ];
    for (const [x,y,w,h] of buildings) {
      ctx.fillStyle = buildingColor;
      ctx.fillRect(width*x, base-height*h, width*w, height*h);
      ctx.fillStyle = 'rgba(188,204,208,.06)';
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          ctx.fillRect(width*x+10+col*18, base-height*h+12+row*17, 7, 3);
        }
      }
    }
    ctx.restore();
  }

  drawTerrain(ctx, width, height) {
    const horizon = height * .35;
    const ground = ctx.createLinearGradient(0, horizon, 0, height);
    ground.addColorStop(0, '#70583f');
    ground.addColorStop(.48, '#4d3c2d');
    ground.addColorStop(1, '#252526');
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, width, height - horizon);

    polygon(ctx, [
      [0,height*.67], [width*.45,height*.46], [width,height*.57], [width,height], [0,height]
    ], '#5a4330');
    polygon(ctx, [
      [0,height*.69], [width*.47,height*.49], [width,height*.59], [width,height*.64], [width*.47,height*.55], [0,height*.75]
    ], 'rgba(158,112,65,.24)');

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon, width, height-horizon);
    ctx.clip();
    for (let index = 0; index < 18; index += 1) {
      const y = horizon + (index / 18) * (height - horizon);
      line(ctx, 0, y, width, y + width * .07, 'rgba(217,175,124,.055)', 1);
    }
    for (let index = -8; index < 18; index += 1) {
      line(ctx, width*.5, horizon, index*width*.09, height, 'rgba(217,175,124,.04)', 1);
    }
    ctx.restore();

    polygon(ctx, [
      [width*.52,height*.66], [width*.72,height*.58], [width,height*.72], [width,height], [width*.67,height]
    ], '#282d2e');
    line(ctx, width*.61,height*.7,width*.98,height*.83,'rgba(191,197,199,.24)',2,[18,16]);
    line(ctx, width*.58,height*.77,width*.91,height*.91,'rgba(191,197,199,.13)',2,[18,16]);

    this.drawFence(ctx, width, height);
  }

  drawFence(ctx, width, height) {
    const startY = height * .56;
    const endY = height * .68;
    const endX = width * .34;
    line(ctx, 0,startY,endX,endY,'#90989b',3);
    line(ctx, 0,startY+17,endX,endY+17,'#737b7e',2);
    line(ctx, 0,startY+6,endX,endY+6,YELLOW,5);
    for (let index = 0; index < 6; index += 1) {
      const t = index / 5;
      const x = endX * t;
      const y = startY + (endY-startY)*t;
      line(ctx,x,y-7,x,y+35,'#8e9598',3);
    }
  }

  drawFoundation(ctx, width, height, progress) {
    const centerX = width < 560 ? width * .48 : width * .53;
    const centerY = height * (width < 560 ? .46 : .59);
    const size = Math.min(width, height * 1.55);
    const halfW = size * .21;
    const halfH = size * .095;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 13;
    polygon(ctx, [
      [centerX-halfW,centerY], [centerX,centerY-halfH], [centerX+halfW,centerY], [centerX,centerY+halfH]
    ], '#292a27');
    ctx.restore();

    const pit = ctx.createLinearGradient(centerX,centerY-halfH,centerX,centerY+halfH);
    pit.addColorStop(0,'#2b2721');
    pit.addColorStop(1,'#171717');
    polygon(ctx, [
      [centerX-halfW*.88,centerY], [centerX,centerY-halfH*.75], [centerX+halfW*.88,centerY], [centerX,centerY+halfH*.75]
    ], pit, '#8e7d68', 2);

    if (progress > .16) {
      const slabAlpha = Math.min(1, (progress-.16)/.32);
      ctx.save();
      ctx.globalAlpha = slabAlpha;
      polygon(ctx, [
        [centerX-halfW*.76,centerY], [centerX,centerY-halfH*.62], [centerX+halfW*.76,centerY], [centerX,centerY+halfH*.62]
      ], this.state.scene === 'asphalt' ? '#343839' : '#a9afb0', '#d8dcdd', 2);
      ctx.restore();
    }

    if (progress > .55) {
      const frameAlpha = Math.min(1, (progress-.55)/.3);
      ctx.save();
      ctx.globalAlpha = frameAlpha;
      const left = centerX-halfW*.6;
      const right = centerX+halfW*.6;
      const top = centerY-halfH*.38;
      const bottom = centerY+halfH*.38;
      line(ctx,left,top,left,top-size*.12,'#c8ced0',8);
      line(ctx,right,top,right,top-size*.12,'#c8ced0',8);
      line(ctx,left,bottom,left,bottom-size*.12,'#aab1b4',8);
      line(ctx,right,bottom,right,bottom-size*.12,'#aab1b4',8);
      line(ctx,left,top-size*.12,centerX,top-size*.17,'#d5dadb',7);
      line(ctx,centerX,top-size*.17,right,top-size*.12,'#d5dadb',7);
      ctx.restore();
    }
  }

  drawContainer(ctx, width, height) {
    const scale = Math.max(.58, Math.min(1, width / 1050));
    const x = width < 560 ? width * .7 : width * .79;
    const y = height * (width < 560 ? .39 : .54);
    const w = 174*scale;
    const h = 85*scale;
    const depth = 35*scale;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.48)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 12;
    polygon(ctx, [[x-w/2,y],[x+w/2,y],[x+w/2,y+h],[x-w/2,y+h]], '#bac0c2');
    polygon(ctx, [[x-w/2,y],[x-w/2+depth,y-depth*.42],[x+w/2+depth,y-depth*.42],[x+w/2,y]], '#e2e5e5');
    polygon(ctx, [[x+w/2,y],[x+w/2+depth,y-depth*.42],[x+w/2+depth,y+h-depth*.42],[x+w/2,y+h]], '#838e92');
    ctx.restore();
    const doorW = 43*scale;
    ctx.fillStyle = '#253039';
    ctx.fillRect(x-w*.34,y+h*.27,doorW,h*.73);
    const windowGradient = ctx.createLinearGradient(x,y,x+w*.28,y+h*.6);
    windowGradient.addColorStop(0,'#9fb4bd');
    windowGradient.addColorStop(1,'#43525a');
    ctx.fillStyle = windowGradient;
    ctx.fillRect(x+w*.08,y+h*.28,w*.25,h*.34);
    ctx.fillStyle = YELLOW;
    ctx.fillRect(x-w*.44,y+h*.2,w*.23,5*scale);
    ctx.fillRect(x-w*.44,y+h*.34,w*.23,5*scale);
  }

  drawCrane(ctx, width, height, time) {
    const scale = Math.min(1.05, width / 1120);
    const baseX = width * .79;
    const baseY = height * .52;
    const towerH = height * .42;
    const towerW = 42*scale;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.36)';
    ctx.shadowBlur = 14;
    line(ctx,baseX-towerW/2,baseY,baseX-towerW*.14,baseY-towerH,YELLOW,8*scale);
    line(ctx,baseX+towerW/2,baseY,baseX+towerW*.14,baseY-towerH,YELLOW,8*scale);
    for (let index = 0; index < 6; index += 1) {
      const t1 = index/6;
      const t2 = (index+1)/6;
      const y1 = baseY-towerH*t1;
      const y2 = baseY-towerH*t2;
      const xL1 = baseX-towerW/2*(1-t1*.7);
      const xR1 = baseX+towerW/2*(1-t1*.7);
      const xL2 = baseX-towerW/2*(1-t2*.7);
      const xR2 = baseX+towerW/2*(1-t2*.7);
      line(ctx,xL1,y1,xR2,y2,ORANGE,3*scale);
      line(ctx,xR1,y1,xL2,y2,ORANGE,3*scale);
    }
    const pivotY = baseY-towerH;
    line(ctx,baseX-width*.08,pivotY,baseX+width*.18,pivotY,YELLOW,9*scale);
    line(ctx,baseX,pivotY,baseX+width*.13,pivotY+height*.1,ORANGE,4*scale);
    line(ctx,baseX,pivotY,baseX-width*.065,pivotY+height*.085,ORANGE,4*scale);
    ctx.fillStyle = '#32393c';
    ctx.fillRect(baseX-15,pivotY-11,30,18);
    const hookX = baseX+width*.13;
    const sway = this.state.active ? Math.sin(time/1100)*3 : 0;
    line(ctx,hookX,pivotY,hookX+sway,pivotY+height*.19,'#c0c7c9',2);
    ctx.fillStyle = '#697277';
    ctx.fillRect(hookX+sway-10,pivotY+height*.19,20,20);
    ctx.restore();
  }

  drawTruck(ctx, width, height, time) {
    const travel = this.state.active ? Math.sin(time/5200)*width*.025 : 0;
    const scale = Math.min(1, width/1100);
    const x = width*.17+travel;
    const y = height*.72;
    const w = 190*scale;
    const h = 61*scale;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.5)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 10;
    roundedRect(ctx,x-w*.53,y-h*.16,w*.58,h*.5,4);
    const bed = ctx.createLinearGradient(x-w*.5,y,x,y+h*.3);
    bed.addColorStop(0,'#8e979a');
    bed.addColorStop(1,'#50595d');
    ctx.fillStyle = bed;
    ctx.fill();
    polygon(ctx, [[x+w*.02,y-h*.28],[x+w*.31,y-h*.28],[x+w*.5,y+h*.05],[x+w*.5,y+h*.34],[x+w*.02,y+h*.34]], YELLOW, '#f8c241', 2);
    polygon(ctx, [[x+w*.13,y-h*.2],[x+w*.29,y-h*.2],[x+w*.4,y],[x+w*.13,y]], '#34464e');
    ctx.restore();
    for (const wheelX of [x-w*.34,x+w*.29]) {
      ctx.fillStyle = '#15191b';
      ctx.beginPath(); ctx.arc(wheelX,y+h*.32,19*scale,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#657075';
      ctx.beginPath(); ctx.arc(wheelX,y+h*.32,9*scale,0,Math.PI*2); ctx.fill();
    }
  }

  drawExcavator(ctx, width, height, time) {
    const mobile = width < 560;
    const scale = mobile ? Math.max(.65,width/510) : Math.min(1.2,width/1050);
    const x = mobile ? width*.47 : width*.46;
    const y = mobile ? height*.59 : height*.75;
    const motion = this.state.active ? Math.sin(time/950) : 0;

    ctx.save();
    ctx.translate(x,y);
    ctx.scale(scale,scale);
    ctx.fillStyle = 'rgba(5,7,8,.5)';
    ctx.beginPath(); ctx.ellipse(12,38,116,24,0,0,Math.PI*2); ctx.fill();

    roundedRect(ctx,-98,6,196,39,18);
    ctx.fillStyle = '#1c2225'; ctx.fill();
    ctx.strokeStyle = '#4e595e'; ctx.lineWidth = 6; ctx.stroke();
    for (let index = -76; index <= 76; index += 19) line(ctx,index,13,index+6,37,'#677277',4);
    for (const wheelX of [-68,-23,23,68]) {
      ctx.fillStyle = '#566166'; ctx.beginPath(); ctx.arc(wheelX,25,12,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#252b2e'; ctx.beginPath(); ctx.arc(wheelX,25,5,0,Math.PI*2); ctx.fill();
    }

    ctx.fillStyle = '#3b4245';
    ctx.fillRect(-60,-5,122,20);

    const baseX = 35;
    const baseY = -51;
    const angle1 = -.82 + motion*.055;
    const jointX = baseX + Math.cos(angle1)*103;
    const jointY = baseY + Math.sin(angle1)*103;
    const angle2 = .68 + motion*.09;
    const bucketX = jointX + Math.cos(angle2)*85;
    const bucketY = jointY + Math.sin(angle2)*85;
    ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 8;
    line(ctx,baseX,baseY,jointX,jointY,'#9c5a00',25);
    line(ctx,baseX,baseY-4,jointX,jointY-4,YELLOW,18);
    line(ctx,jointX,jointY,bucketX,bucketY,'#9c5a00',21);
    line(ctx,jointX,jointY-3,bucketX,bucketY-3,YELLOW,14);
    line(ctx,baseX+4,baseY-9,jointX-4,jointY-12,'#d8dfe1',4);
    line(ctx,jointX-3,jointY-9,bucketX-8,bucketY-7,'#aeb6ba',4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#22282b';
    ctx.beginPath(); ctx.arc(baseX,baseY,9,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(jointX,jointY,8,0,Math.PI*2); ctx.fill();
    polygon(ctx, [[bucketX-9,bucketY-8],[bucketX+29,bucketY+1],[bucketX+20,bucketY+29],[bucketX-15,bucketY+18]], '#535c60', '#202527', 3);

    const body = ctx.createLinearGradient(-72,-82,65,-6);
    body.addColorStop(0,YELLOW_LIGHT);
    body.addColorStop(.55,YELLOW);
    body.addColorStop(1,ORANGE);
    roundedRect(ctx,-78,-74,139,74,10);
    ctx.fillStyle = body; ctx.fill();
    ctx.fillStyle = '#d68b00';
    roundedRect(ctx,-83,-32,55,32,12); ctx.fill();
    polygon(ctx, [[-20,-100],[37,-100],[59,-28],[-20,-28]], '#26353c', '#9fb0b6', 3);
    const glass = ctx.createLinearGradient(-13,-95,44,-37);
    glass.addColorStop(0,'#67828f'); glass.addColorStop(1,'#1c2a31');
    polygon(ctx, [[-12,-94],[29,-94],[47,-36],[-12,-36]], glass);
    line(ctx,8,-94,8,-36,'rgba(220,233,236,.28)',2);
    ctx.fillStyle = '#252b2e'; ctx.beginPath(); ctx.arc(38,-51,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#292f32'; ctx.fillRect(-64,-61,29,5); ctx.fillRect(-64,-50,29,5);
    ctx.fillStyle = '#f6ca56'; ctx.fillRect(-73,-17,25,4);
    ctx.restore();
  }

  drawForeground(ctx, width, height, time) {
    const coneX = width*.9;
    const coneY = height*.84;
    polygon(ctx, [[coneX,coneY-43],[coneX+18,coneY+5],[coneX-18,coneY+5]], '#d78900');
    ctx.fillStyle = '#e7ebeb'; ctx.fillRect(coneX-11,coneY-18,22,5);
    ctx.fillStyle = '#202426'; ctx.fillRect(coneX-25,coneY+4,50,7);

    if (!this.state.active) return;
    const random = seededRandom(Math.floor(time/180));
    ctx.save();
    for (let index = 0; index < 7; index += 1) {
      const life = random();
      const x = width*(.36 + random()*.13);
      const y = height*(.78 - life*.1);
      ctx.fillStyle = `rgba(202,164,115,${.08+life*.18})`;
      ctx.beginPath(); ctx.arc(x,y,2+random()*5,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  drawGrade(ctx, width, height) {
    const vignette = ctx.createRadialGradient(width*.5,height*.46,width*.1,width*.5,height*.5,width*.72);
    vignette.addColorStop(.45,'rgba(4,6,7,0)');
    vignette.addColorStop(1,'rgba(4,6,7,.48)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0,0,width,height);
    const bottom = ctx.createLinearGradient(0,height*.65,0,height);
    bottom.addColorStop(0,'rgba(10,12,13,0)');
    bottom.addColorStop(1,'rgba(10,12,13,.32)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0,height*.65,width,height*.35);
  }
}

export function updateConstructionScene(job, progress = 0) {
  const canvas = document.querySelector('#site-canvas');
  if (!canvas) return;
  renderer ||= new ConstructionRenderer(canvas);
  renderer.setState(job, progress);
}
