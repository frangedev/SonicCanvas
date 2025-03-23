let audio, mic, fft, amplitude;
let particles = [];
let shaderLayer, miniLayer;
let theShader;
let useMic = false;
let tempo = 0;
let beatCount = 0;
let lastBeatTime = 0;
let miniWindow, miniDragging = false, resizing = false;
let scriptLines = [];
let scriptIndex = 0;
let scriptRunning = false;
let globalSpeed = 1.0; // New: Global animation speed
let patternMode = 'SWIRL'; // New: Visual pattern mode
let spawnRate = 10; // New: Particle spawn rate
let pulseFactor = 0; // New: Pulsing effect

function preload() {
  theShader = loadShader('shader.vert', 'shader.frag');
}

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.parent('canvasContainer');
  shaderLayer = createGraphics(width, height, WEBGL);
  miniLayer = createGraphics(200, 150, WEBGL);
  miniLayer.parent('miniCanvas');
  
  fft = new p5.FFT(0.8, 64);
  amplitude = new p5.Amplitude();
  mic = new p5.AudioIn();
  
  select('#micToggle').changed(toggleMic);
  select('#audioInput').changed(loadAudio);
  select('#runScript').mousePressed(runScript);
  
  miniWindow = select('#miniWindow');
  miniWindow.position(50, 200);
  miniWindow.elt.addEventListener('mousedown', startDragging);
  select('#resizeHandle').elt.addEventListener('mousedown', startResizing);
  document.addEventListener('mousemove', handleMove);
  document.addEventListener('mouseup', stopInteraction);
}

function toggleMic() {
  useMic = !useMic;
  if (useMic) {
    mic.start();
    fft.input(mic);
    amplitude.input(mic);
    if (audio) audio.stop();
  } else {
    mic.stop();
    if (audio && !audio.isPlaying()) audio.loop();
  }
}

function loadAudio() {
  let file = this.elt.files[0];
  if (file && !useMic) {
    if (audio) audio.stop();
    audio = loadSound(URL.createObjectURL(file), () => {
      audio.loop();
      fft.input(audio);
      amplitude.input(audio);
    });
  }
}

function startDragging(e) {
  if (e.target.id === 'miniHeader') miniDragging = true;
}

function startResizing(e) {
  resizing = true;
}

function handleMove(e) {
  if (miniDragging) miniWindow.position(e.clientX - 50, e.clientY - 10);
  else if (resizing) {
    let newWidth = max(100, e.clientX - miniWindow.x);
    let newHeight = max(75, e.clientY - miniWindow.y);
    miniWindow.size(newWidth, newHeight);
    miniLayer.resizeCanvas(newWidth - 10, newHeight - 30);
  }
}

function stopInteraction() {
  miniDragging = resizing = false;
}

function runScript() {
  let scriptText = select('#scriptInput').value();
  scriptLines = scriptText.split('\n').map(line => line.trim());
  scriptIndex = 0;
  scriptRunning = true;
}

function interpretScript() {
  if (!scriptRunning || scriptIndex >= scriptLines.length) return;
  
  let line = scriptLines[scriptIndex];
  let parts = line.split(' ');
  let num = parseInt(parts[0]);
  let command = parts[1].toUpperCase();
  let value = parts.slice(2).join(' ');
  
  switch (command) {
    case 'COLOR':
      particles.forEach(p => p.hue = mapColor(value));
      break;
    case 'SIZE':
      select('#sizeSlider').value(parseFloat(value));
      break;
    case 'SWIRL':
      select('#swirlSlider').value(parseFloat(value));
      break;
    case 'SPEED':
      globalSpeed = parseFloat(value);
      break;
    case 'PATTERN':
      patternMode = value.toUpperCase(); // SWIRL, FRACTAL, PULSE, BURST
      break;
    case 'SPAWN':
      spawnRate = parseInt(value);
      break;
    case 'PULSE':
      pulseFactor = parseFloat(value);
      break;
    case 'ROTATE':
      particles.forEach(p => p.vel.rotate(radians(parseFloat(value))));
      break;
    case 'FADE':
      particles.forEach(p => p.lifespan -= parseFloat(value));
      break;
    case 'EXPLODE':
      particles.forEach(p => p.vel.mult(parseFloat(value)));
      break;
    case 'GOTO':
      scriptIndex = scriptLines.findIndex(l => parseInt(l.split(' ')[0]) === parseInt(value)) - 1;
      break;
    case 'STOP':
      scriptRunning = false;
      return;
  }
  scriptIndex++;
}

function mapColor(color) {
  color = color.toUpperCase();
  if (color === 'RED') return 0;
  if (color === 'GREEN') return 120;
  if (color === 'BLUE') return 240;
  if (color === 'RANDOM') return random(360);
  return parseFloat(color) || 0;
}

function draw() {
  background(0);
  
  let spectrum = fft.analyze();
  let level = amplitude.getLevel();
  let size = parseFloat(select('#sizeSlider').value());
  let swirl = parseFloat(select('#swirlSlider').value());
  
  // Tempo detection
  let bassEnergy = fft.getEnergy("bass");
  if (bassEnergy > 150 && millis() - lastBeatTime > 200) {
    beatCount++;
    let interval = millis() - lastBeatTime;
    tempo = round(60000 / interval);
    lastBeatTime = millis();
    select('#tempoDisplay').html(`${tempo} BPM`);
  }
  
  interpretScript();
  
  // Spawn particles with custom rate
  if (random() < level * spawnRate) {
    particles.push(new Particle(0, 0, spectrum, size, swirl));
  }
  
  // Update and draw particles (main canvas)
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(level);
    particles[i].display();
    if (particles[i].isFinished()) particles.splice(i, 1);
  }
  
  // Shader (main canvas)
  shaderLayer.shader(theShader);
  theShader.setUniform('u_resolution', [width, height]);
  theShader.setUniform('u_time', millis() / 1000.0);
  theShader.setUniform('u_amplitude', level);
  theShader.setUniform('u_tempo', tempo / 120.0);
  shaderLayer.rect(0, 0, width, height);
  image(shaderLayer, -width / 2, -height / 2);
  
  // Mini-window (projection preview)
  miniLayer.background(0);
  miniLayer.push();
  miniLayer.translate(-miniLayer.width / 2, -miniLayer.height / 2);
  for (let p of particles) {
    p.displayMini(miniLayer);
  }
  miniLayer.shader(theShader);
  theShader.setUniform('u_resolution', [miniLayer.width, miniLayer.height]);
  miniLayer.rect(0, 0, miniLayer.width, miniLayer.height);
  miniLayer.pop();
}

class Particle {
  constructor(x, y, spectrum, size, swirl) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(1, 3));
    this.acc = createVector(0, 0);
    this.lifespan = 255;
    this.size = size;
    this.hue = map(spectrum[0], 0, 255, 0, 360);
    this.swirl = swirl;
  }
  
  update(level) {
    let patternEffect = 0;
    if (patternMode === 'SWIRL') {
      this.acc = p5.Vector.fromAngle(frameCount * this.swirl).mult(0.1);
    } else if (patternMode === 'FRACTAL') {
      this.acc = p5.Vector.fromAngle(sin(frameCount * 0.1) * TWO_PI).mult(0.05);
    } else if (patternMode === 'PULSE') {
      this.size += sin(frameCount * 0.1) * pulseFactor;
    } else if (patternMode === 'BURST') {
      this.vel.mult(1 + level * 0.5);
    }
    this.vel.add(this.acc);
    this.vel.limit(5 * globalSpeed);
    this.pos.add(this.vel);
    this.lifespan -= 2;
  }
  
  display() {
    push();
    noStroke();
    fill(this.hue, 80, 100, this.lifespan);
    ellipse(this.pos.x, this.pos.y, this.size);
    pop();
  }
  
  displayMini(layer) {
    layer.push();
    layer.noStroke();
    layer.fill(this.hue, 80, 100, this.lifespan);
    layer.ellipse(this.pos.x * layer.width / width, this.pos.y * layer.height / height, this.size);
    layer.pop();
  }
  
  isFinished() {
    return this.lifespan <= 0 || abs(this.pos.x) > width / 2 || abs(this.pos.y) > height / 2;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  shaderLayer.resizeCanvas(width, height);
}