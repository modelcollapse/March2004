let letters = [];
let hourHand, minuteHand, secondHand;

let textToDisplay = "MARCH2004";
let repetitions = 2;

let clockCenterX, clockCenterY, clockRadius;
let textPlacementRadius, letterFontSize;
let clockFaceStrokeWeight = 5;

let bgColor, clockFaceStrokeColor, clockFaceFillColor, letterOnClockColor;
let logoTextColor, hourMinuteHandColor, secondHandColor;

let timeStep = 1/60;
let gravity = 900, restitution = 0.01, friction = 0.7;
let angularDamping = 0.96, linearDamping = 0.98;
let initialPushForce = 5, letterMass = 1, physicsSubSteps = 8;

let handRestitution = 0.005, handFrictionCoefficient = 0.85;
let maxVelocity = 200, maxAngularVelocity;

let logoTextLine1 = "MARCH 2004";
let logoTextLine2 = "MARCH 2004";
let logoX, logoYLine1, logoYLine2, logoFontSize;
let logoPadding = 10;
let logoURL = "http://march2004.com";

function setup() {
  createCanvas(600, 600);
  frameRate(60);
  smooth();

  clockCenterX = width/2;
  clockCenterY = height/2;
  clockRadius  = min(width, height) * 0.4;
  textPlacementRadius = clockRadius * 0.8;
  letterFontSize = clockRadius * 0.28;

  bgColor               = color(0);
  clockFaceStrokeColor  = color(0);
  clockFaceFillColor    = color(255);
  letterOnClockColor    = color(0);
  logoTextColor         = color(255);
  hourMinuteHandColor   = color(0);
  secondHandColor       = color(255,0,0);

  maxAngularVelocity = PI * 0.7;

  // Logo positioning
  logoFontSize = clockRadius * 0.07;
  textSize(logoFontSize);
  textFont('Helvetica');
  textAlign(LEFT, BOTTOM);
  let singleLineHeight = textAscent() + textDescent();
  logoX      = logoPadding;
  logoYLine2 = height - logoPadding - singleLineHeight;
  logoYLine1 = logoYLine2 - singleLineHeight * 0.02;

  resetAnimation();
}

function resetAnimation() {
  hourHand   = new ClockHand(clockRadius*0.5, 7, hourMinuteHandColor, 'h', 9, 0);
  minuteHand = new ClockHand(clockRadius*0.75,5, hourMinuteHandColor, 'm', 0, 0);
  secondHand = new ClockHand(clockRadius*0.9, 3, secondHandColor,       's', 0, 0);

  letters = [];
  let fullText = "";
  for (let i=0; i<repetitions; i++) fullText += textToDisplay;

  let spacing = TWO_PI / fullText.length;
  let angle   = -HALF_PI;

  textSize(letterFontSize);
  textAlign(CENTER, CENTER);

  for (let c of fullText) {
    let x = clockCenterX + textPlacementRadius * cos(angle);
    let y = clockCenterY + textPlacementRadius * sin(angle);
    letters.push(new Letter(c, createVector(x,y), angle+HALF_PI));
    angle += spacing;
  }
}

function draw() {
  background(bgColor);

  // clock face
  stroke(clockFaceStrokeColor);
  strokeWeight(clockFaceStrokeWeight);
  fill(clockFaceFillColor);
  ellipse(clockCenterX, clockCenterY, clockRadius*2, clockRadius*2);

  // physics sub‐steps
  let dt = timeStep / physicsSubSteps;
  for (let k=0; k<physicsSubSteps; k++) {
    // letter & hand interactions
    for (let L of letters) {
      if (!L.isFalling) {
        if (secondHand.justTickedThisFrame && L.isCollidingWithHand(secondHand)) {
          L.startFalling(secondHand);
        }
      } else {
        L.applyGravity();
        if (L.isCollidingWithHand(secondHand)) {
          L.resolveHandCollision(secondHand, dt);
        }
      }
    }
    // letter/letter collisions
    for (let i=0; i<letters.length; i++) {
      for (let j=i+1; j<letters.length; j++) {
        let A = letters[i], B = letters[j];
        if (A.isFalling && B.isFalling) {
          A.collideWithLetter(B, dt);
        }
      }
    }
    // update positions
    for (let L of letters) {
      if (L.isFalling) {
        L.updatePosition(dt);
        L.collideWithClockBoundary(dt);
      }
    }
  }

  // draw letters
  textSize(letterFontSize);
  textAlign(CENTER, CENTER);
  for (let L of letters) L.display();

  // update & draw hands
  hourHand.update();   hourHand.display();
  minuteHand.update(); minuteHand.display();
  secondHand.update(); secondHand.display();

  // logo lines
  textSize(logoFontSize);
  textFont('Helvetica');
  fill(logoTextColor);
  textAlign(LEFT, BOTTOM);

  // normal top line
  text(logoTextLine1, logoX, logoYLine1);

  // flipped bottom line
  let w = textWidth(logoTextLine2);
  push();
    translate(logoX + w, logoYLine2);
    scale(-1, -1);
    text(logoTextLine2, 0, 0);
  pop();
}

function mousePressed() {
  // detect click in logo area
  textSize(logoFontSize);
  textFont('Helvetica');
  textAlign(LEFT, BOTTOM);

  let w     = textWidth(logoTextLine1);
  let asc   = textAscent();
  let top   = logoYLine1 - asc;
  let bot   = logoYLine2 + asc;
  let left  = logoX;
  let right = logoX + w;

  if (mouseX>=left && mouseX<=right && mouseY>=top && mouseY<=bot) {
    resetAnimation();
    window.open(logoURL, '_blank');
  }
}


// ——— Letter class ———————————————————————————————————————————————
class Letter {
  constructor(ch, pos, ang) {
    this.character = ch;
    this.position  = pos.copy();
    this.prevPosition = pos.copy();
    this.acceleration = createVector(0,0);
    this.initialDisplayAngle = ang;
    this.isFalling = false;
    this.rotation = 0;
    this.angularVelocity = 0;

    textSize(letterFontSize);
    textAlign(CENTER, CENTER);
    this.letterWidth  = textWidth(ch);
    this.letterHeight = textAscent() + textDescent();
    this.effectiveRadius = max(this.letterWidth, this.letterHeight)/2 * 0.7;
    this.momentOfInertia = letterMass * (this.effectiveRadius*this.effectiveRadius*2)/12;
    if (this.momentOfInertia===0) this.momentOfInertia = 0.001;
  }

  startFalling(hand) {
    if (!this.isFalling) {
      this.isFalling = true;
      this.angularVelocity = 0;
      this.rotation = this.initialDisplayAngle;
      let dir = hand.getEffectiveTipVelocity().copy().normalize();
      if (dir.magSq()===0) dir.set(0,1);
      this.applyForce(dir.mult(initialPushForce));
    }
  }

  applyForce(force) {
    let f = p5.Vector.div(force, letterMass);
    this.acceleration.add(f);
  }

  applyGravity() {
    this.applyForce(createVector(0, gravity*letterMass));
  }

  getHandVelocityAtPoint(hand, pt) {
    let base = createVector(clockCenterX, clockCenterY);
    let r_contact = p5.Vector.sub(pt, base);
    let frac = hand.len===0 ? 1 : constrain(r_contact.mag()/hand.len, 0,1);
    return hand.getEffectiveTipVelocity().copy().mult(frac);
  }

  resolveHandCollision(hand, dt) {
    let base = createVector(clockCenterX, clockCenterY);
    let tip  = hand.getTipPosition();
    let hv   = p5.Vector.sub(tip, base);
    let toPos = p5.Vector.sub(this.position, base);
    let norm = (hv.magSq()>0.0001) ? hv.copy().normalize() : createVector(1,0);
    let proj = toPos.dot(norm);
    let closest;
    if (proj<0) {
      closest = base.copy();
    } else if (hv.magSq()===0 || proj>hv.mag()) {
      closest = tip.copy();
    } else {
      closest = p5.Vector.add(base, norm.mult(proj));
    }
    let normalVec = p5.Vector.sub(this.position, closest);
    let distToSurface = normalVec.mag();
    let minSep = this.effectiveRadius + hand.weight/2 + 2;

    if (distToSurface<minSep && distToSurface>0.0001) {
      let n = normalVec.copy().normalize();
      let pen = minSep - distToSurface;
      this.position.add(n.mult(pen*1.05));

      let vLetter = p5.Vector.sub(this.position, this.prevPosition).div(dt);
      let vHand   = this.getHandVelocityAtPoint(hand, closest);
      let relVel  = p5.Vector.sub(vLetter, vHand);
      let relNormVel = relVel.dot(n);

      if (relNormVel<0) {
        let jNorm = -(1+handRestitution)*relNormVel;
        jNorm /= (1/letterMass);
        let Jn = n.copy().mult(jNorm);
        vLetter.add(p5.Vector.div(Jn, letterMass));

        let tang = createVector(-n.y, n.x);
        let relTanVel = relVel.dot(tang);
        let jTan = -relTanVel * handFrictionCoefficient;
        let maxJT = abs(jNorm * handFrictionCoefficient);
        jTan = constrain(jTan, -maxJT, maxJT);
        let Jt = tang.copy().normalize().mult(jTan);
        vLetter.add(p5.Vector.div(Jt, letterMass));

        this.prevPosition = p5.Vector.sub(this.position, vLetter.mult(dt));

        let r_contact = p5.Vector.sub(closest, this.position);
        let cp = p5.Vector.cross(r_contact, Jt);
        this.angularVelocity += cp.z / this.momentOfInertia;
      }
    }
  }

  updatePosition(dt) {
    if (!this.isFalling) return;
    let vel = p5.Vector.sub(this.position, this.prevPosition).mult(linearDamping);
    let maxStep = maxVelocity * dt;
    if (vel.magSq() > maxStep*maxStep) {
      vel.normalize().mult(maxStep);
    }
    if (abs(this.angularVelocity)>maxAngularVelocity) {
      this.angularVelocity = this.angularVelocity>0?maxAngularVelocity:-maxAngularVelocity;
    }
    this.prevPosition.set(this.position);
    this.position.add(vel).add(p5.Vector.mult(this.acceleration, dt*dt));
    this.acceleration.set(0,0);
    this.rotation += this.angularVelocity * dt;
    this.angularVelocity *= angularDamping;

    if (!isFinite(this.position.x) || !isFinite(this.position.y) || isNaN(this.rotation)) {
      this.position.set(clockCenterX, clockCenterY+clockRadius+this.effectiveRadius+20);
      this.prevPosition.set(this.position);
      this.acceleration.set(0,0);
      this.angularVelocity = 0;
      this.isFalling = true;
    }
  }

  collideWithClockBoundary(dt) {
    let containR = clockRadius - clockFaceStrokeWeight/2;
    let fromCenter = p5.Vector.sub(this.position, createVector(clockCenterX, clockCenterY));
    let d = fromCenter.mag();
    if (d + this.effectiveRadius > containR) {
      fromCenter.normalize();
      this.position = p5.Vector.add(createVector(clockCenterX, clockCenterY),
                                     fromCenter.mult(containR - this.effectiveRadius));
      let disp = p5.Vector.sub(this.position, this.prevPosition);
      let normal = fromCenter.mult(-1);
      let vn = disp.dot(normal);
      if (vn>0) return;
      disp.add(normal.mult(-(1+restitution)*vn));
      let tang = createVector(-normal.y, normal.x);
      let vt = disp.dot(tang);
      let j = abs(vt*friction);
      if (j>abs(vt)) j = abs(vt);
      disp.sub(tang.copy().normalize().mult(vt>0?j:-j));
      this.prevPosition = p5.Vector.sub(this.position, disp);
      this.angularVelocity += (vt/dt*0.001)/this.momentOfInertia * (random()<0.5?1:-1);
    }
  }

  collideWithLetter(other, dt) {
    let axis = p5.Vector.sub(this.position, other.position);
    let dist = axis.mag();
    let r = this.effectiveRadius + other.effectiveRadius;
    if (dist>0.0001 && dist<r) {
      axis.normalize();
      let overlap = r - dist;
      let corr = axis.copy().mult(overlap*0.51);
      this.position.add(corr);
      other.position.sub(corr);
      this.prevPosition.add(corr);
      other.prevPosition.sub(corr);

      let d1 = p5.Vector.sub(this.position, this.prevPosition);
      let d2 = p5.Vector.sub(other.position, other.prevPosition);
      let rd = p5.Vector.sub(d1, d2);
      let vn = rd.dot(axis);
      if (vn>0) return;

      let j = -(1+restitution)*vn/2;
      let J = axis.copy().mult(j);
      this.prevPosition.sub(J);
      other.prevPosition.add(J);

      let tang = createVector(-axis.y, axis.x);
      let vt = rd.dot(tang);
      let jt = abs(vt*friction/2);
      if (jt>abs(vt/2)) jt = abs(vt/2);
      let Jt = tang.copy().normalize().mult(vt>0?-jt:jt);
      this.prevPosition.sub(Jt);
      other.prevPosition.add(Jt);

      let rif = 0.002;
      this.angularVelocity -= (vt/dt*rif)/this.momentOfInertia;
      other.angularVelocity += (vt/dt*rif)/other.momentOfInertia;
    }
  }

  isCollidingWithHand(hand) {
    let d = distPointSegment(
      this.position.x, this.position.y,
      clockCenterX, clockCenterY,
      hand.getTipPosition().x, hand.getTipPosition().y
    );
    return d < (this.effectiveRadius + hand.weight/2 + 2);
  }

  display() {
    textSize(letterFontSize);
    textAlign(CENTER, CENTER);
    fill(letterOnClockColor);
    noStroke();
    push();
      translate(this.position.x, this.position.y);
      rotate(this.isFalling ? this.rotation : this.initialDisplayAngle);
      text(this.character, 0, 0);
    pop();
  }
}

// helper: distance from point to segment
function distPointSegment(px,py, x1,y1, x2,y2) {
  let vx = x2-x1, vy = y2-y1;
  let wx = px-x1, wy = py-y1;
  let c1 = vx*wx + vy*wy;
  if (c1<=0) return dist(px,py, x1,y1);
  let c2 = vx*vx + vy*vy;
  if (c2<=c1) return dist(px,py, x2,y2);
  let b = c1/c2;
  let bx = x1 + b*vx;
  let by = y1 + b*vy;
  return dist(px,py, bx,by);
}


// ——— ClockHand class —————————————————————————————————————————————
class ClockHand {
  constructor(l, w, col, t, i1, i2) {
    this.len     = l;
    this.weight  = w;
    this.handColor = col;
    this.type    = t;
    this.tipPosition = createVector();
    this.prevTipPosition = createVector();
    this.effectiveTipVelocity = createVector();
    this.lastIntValue = -1;

    if (t==='h') {
      this.currentAngle = map((i1%12)+(i2/60),0,12,0,TWO_PI) - HALF_PI;
      this.lastIntValue = i1%12;
    } else if (t==='m') {
      this.currentAngle = map(i1+(i2/60),0,60,0,TWO_PI) - HALF_PI;
      this.lastIntValue = i1;
    } else {
      this.currentAngle = map(i1,0,60,0,TWO_PI)-HALF_PI;
      this.lastIntValue = i1;
    }

    this.currentAngle = (this.currentAngle + TWO_PI) % TWO_PI;
    this.prevAngle = this.currentAngle;
    this.updateTip();
    this.prevTipPosition.set(this.tipPosition);
    this.justTickedThisFrame = false;
  }

  updateTip() {
    this.tipPosition.set(
      clockCenterX + this.len*cos(this.currentAngle),
      clockCenterY + this.len*sin(this.currentAngle)
    );
  }

  getTipPosition() { return this.tipPosition.copy(); }
  getEffectiveTipVelocity() { return this.effectiveTipVelocity.copy(); }

  update() {
    this.prevTipPosition.set(this.tipPosition);
    let actualSec = second() + (millis()%1000)/1000;
    let target = this.currentAngle;

    if (this.type==='s') {
      let si = second();
      if (si!==this.lastIntValue) {
        this.justTickedThisFrame = true;
        this.lastIntValue = si;
      }
      target = map(si,0,60,0,TWO_PI)-HALF_PI;

    } else if (this.type==='m') {
      let mf = minute() + actualSec/60;
      target = map(mf,0,60,0,TWO_PI)-HALF_PI;

    } else {
      let hf = (hour()%12) + minute()/60 + second()/3600;
      target = map(hf,0,12,0,TWO_PI)-HALF_PI;
    }

    this.currentAngle = (target + TWO_PI)%TWO_PI;
    this.updateTip();
    let vel = p5.Vector.sub(this.tipPosition, this.prevTipPosition).div(1.0/frameRate());
    this.effectiveTipVelocity.set(vel);
  }

  display() {
    stroke(this.handColor);
    strokeWeight(this.weight);
    line(clockCenterX, clockCenterY, this.tipPosition.x, this.tipPosition.y);
  }
}
