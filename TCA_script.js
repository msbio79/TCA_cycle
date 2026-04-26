const canvas = document.getElementById('sim-canvas');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('canvas-wrapper');

// State
let width, height;
let camera = { x: 0, y: 0, zoom: 1.5 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let currentStep = 0;
let animationProgress = 0;
let isAnimating = false;
let animationReq;
let animationTriggers = [];

// Molecules definitions
const COLORS = {
    carbon: '#222',
    oxygen: '#e74c3c',
    atp: '#f1c40f',
    adp: '#b3b6b7',
    nadph: '#9b59b6', // Use for NADH
    nadp: '#7f8c8d', // Use for NAD+
    fadh2: '#3498db',
    fad: '#bdc3c7',
    coa: '#2ecc71',
    text: '#fff',
    bond: '#7f8c8d'
};

class Particle {
    constructor(x, y, color, label, radius = 15) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.label = label;
        this.radius = radius;
    }
    draw(ctx) {
        ctx.beginPath();
        if (this.label === 'CoA') {
            // Draw hexagon for CoA
            for(let i=0; i<6; i++) {
                let a = i * Math.PI / 3;
                if(i===0) ctx.moveTo(this.x + Math.cos(a)*this.radius, this.y + Math.sin(a)*this.radius);
                else ctx.lineTo(this.x + Math.cos(a)*this.radius, this.y + Math.sin(a)*this.radius);
            }
            ctx.closePath();
        } else {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        }
        
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000';
        ctx.stroke();

        if (this.label) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Noto Sans KR';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.label, this.x, this.y);
        }
    }
}

class Molecule {
    constructor(type, id, x, y) {
        this.type = type;
        this.id = id;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.opacity = 1;
        this.targetOpacity = 1;
        this.scale = 1;
        
        // For animations
        this.startX = x;
        this.startY = y;
        this.animStart = 0;
        this.animEnd = 1;
    }

    setTarget(x, y, animStart = 0, animEnd = 1) {
        this.startX = this.x;
        this.startY = this.y;
        this.targetX = x;
        this.targetY = y;
        this.animStart = animStart;
        this.animEnd = animEnd;
    }

    update(progress) {
        let p = (progress - this.animStart) / (this.animEnd - this.animStart);
        if (p < 0) p = 0;
        if (p > 1) p = 1;
        if (isNaN(p)) p = 1;

        // Easing easeInOutCubic
        const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        this.x = this.startX + (this.targetX - this.startX) * ease;
        this.y = this.startY + (this.targetY - this.startY) * ease;

        if (this.targetOpacity === 0) {
            this.opacity = 1 - p;
        } else {
            this.opacity = 1;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        ctx.globalAlpha = this.opacity;

        ctx.lineWidth = 3;
        ctx.strokeStyle = COLORS.bond;
        
        const drawBond = (x1, y1, x2, y2) => {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        };

        const cRad = 14;

        if (this.type === 'Pyruvate') {
            for(let i=0; i<2; i++) drawBond(-25 + i*25, 0, 0 + i*25, 0);
            for(let i=0; i<3; i++) new Particle(-25 + i*25, 0, COLORS.carbon, 'C', cRad).draw(ctx);
            this.drawLabel(ctx, '피루브산(3C)');
        }
        else if (this.type === 'AcetylCoA') {
            drawBond(-35, 0, -10, 0);
            drawBond(-10, 0, 15, 0);
            new Particle(-35, 0, COLORS.coa, 'CoA', 18).draw(ctx);
            new Particle(-10, 0, COLORS.carbon, 'C', cRad).draw(ctx);
            new Particle(15, 0, COLORS.carbon, 'C', cRad).draw(ctx);
            this.drawLabel(ctx, '아세틸 CoA(2C)');
        }
        else if (this.type === 'Oxaloacetate') {
            for(let i=0; i<3; i++) drawBond(-37.5 + i*25, 0, -12.5 + i*25, 0);
            for(let i=0; i<4; i++) new Particle(-37.5 + i*25, 0, COLORS.carbon, 'C', cRad).draw(ctx);
            this.drawLabel(ctx, '옥살아세트산(4C)');
        }
        else if (this.type === 'Citrate') {
            for(let i=0; i<5; i++) drawBond(-62.5 + i*25, 0, -37.5 + i*25, 0);
            for(let i=0; i<6; i++) new Particle(-62.5 + i*25, 0, COLORS.carbon, 'C', cRad).draw(ctx);
            this.drawLabel(ctx, '시트르산(6C)');
        }
        else if (this.type === 'AlphaKG') {
            for(let i=0; i<4; i++) drawBond(-50 + i*25, 0, -25 + i*25, 0);
            for(let i=0; i<5; i++) new Particle(-50 + i*25, 0, COLORS.carbon, 'C', cRad).draw(ctx);
            this.drawLabel(ctx, 'α-케토글루타르산(5C)');
        }
        else if (this.type === 'Succinate') {
            for(let i=0; i<3; i++) drawBond(-37.5 + i*25, 0, -12.5 + i*25, 0);
            for(let i=0; i<4; i++) new Particle(-37.5 + i*25, 0, COLORS.carbon, 'C', cRad).draw(ctx);
            this.drawLabel(ctx, '숙신산(4C)');
        }
        else if (this.type === 'CO2') {
            drawBond(-20, -3, 0, -3); drawBond(-20, 3, 0, 3);
            drawBond(0, -3, 20, -3); drawBond(0, 3, 20, 3);
            new Particle(-22, 0, COLORS.oxygen, 'O', 10).draw(ctx);
            new Particle(0, 0, COLORS.carbon, 'C', cRad).draw(ctx);
            new Particle(22, 0, COLORS.oxygen, 'O', 10).draw(ctx);
            this.drawLabel(ctx, 'CO₂');
        }
        else if (this.type === 'CoA') {
            new Particle(0, 0, COLORS.coa, 'CoA', 18).draw(ctx);
        }
        else if (this.type === 'ATP') this.drawPill(ctx, COLORS.atp, 'ATP');
        else if (this.type === 'ADP') this.drawPill(ctx, COLORS.adp, 'ADP');
        else if (this.type === 'NADH') this.drawPill(ctx, COLORS.nadph, 'NADH');
        else if (this.type === 'NAD+') this.drawPill(ctx, COLORS.nadp, 'NAD⁺');
        else if (this.type === 'FADH2') this.drawPill(ctx, COLORS.fadh2, 'FADH₂');
        else if (this.type === 'FAD') this.drawPill(ctx, COLORS.fad, 'FAD');

        ctx.restore();
    }

    drawPill(ctx, color, text) {
        ctx.beginPath();
        ctx.roundRect(-30, -15, 60, 30, 15);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
        
        ctx.fillStyle = COLORS.text;
        if(color === COLORS.atp || color === COLORS.adp) ctx.fillStyle = '#000';
        ctx.font = 'bold 14px Noto Sans KR';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, 0);
    }

    drawLabel(ctx, text, yOffset = 30) {
        ctx.fillStyle = '#fff';
        ctx.font = '14px Noto Sans KR';
        ctx.textAlign = 'center';
        ctx.fillText(text, 0, yOffset);
    }
}

// Scene setup
let molecules = [];

const stepsData = [
    {
        title: "1. 피루브산 산화",
        desc: "해당 과정에서 생성된 피루브산(3C)이 미토콘드리아 기질로 들어와 아세틸 CoA(2C)로 전환됩니다. 이때 1분자의 CO₂가 방출되고 NAD⁺가 NADH로 환원됩니다."
    },
    {
        title: "2. 시트르산 합성",
        desc: "아세틸 CoA(2C)가 옥살아세트산(4C)과 결합하여 시트르산(6C)을 합성하며, 조효소 A(CoA)는 떨어져 나갑니다."
    },
    {
        title: "3. α-케토글루타르산 생성",
        desc: "시트르산(6C)이 산화 및 탈탄산 과정을 거쳐 α-케토글루타르산(5C)이 됩니다. 이 과정에서 CO₂ 1분자가 방출되고 NADH가 생성됩니다."
    },
    {
        title: "4. 숙신산 생성",
        desc: "α-케토글루타르산(5C)이 다시 산화 및 탈탄산되어 숙신산(4C)이 됩니다. CO₂ 1분자 방출, NADH 생성, 그리고 기질 수준 인산화로 ATP(또는 GTP) 1분자가 생성됩니다."
    },
    {
        title: "5. 옥살아세트산 재생",
        desc: "숙신산(4C)이 일련의 산화 과정을 거쳐 옥살아세트산(4C)으로 다시 재생됩니다. 이 과정에서 FADH₂와 NADH가 각각 1분자씩 생성됩니다."
    }
];

function initStep(step) {
    molecules = [];
    animationTriggers = [];
    animationProgress = 0;
    isAnimating = false;
    
    if (step === 0) {
        molecules.push(new Molecule('Pyruvate', 'pyr', 400, 400));
        molecules.push(new Molecule('CoA', 'coa', 200, 250));
        molecules.push(new Molecule('NAD+', 'nad', 600, 250));
    }
    else if (step === 1) {
        molecules.push(new Molecule('AcetylCoA', 'acoa', 300, 400));
        molecules.push(new Molecule('Oxaloacetate', 'oaa', 600, 400));
    }
    else if (step === 2) {
        molecules.push(new Molecule('Citrate', 'cit', 400, 400));
        molecules.push(new Molecule('NAD+', 'nad', 600, 250));
    }
    else if (step === 3) {
        molecules.push(new Molecule('AlphaKG', 'akg', 400, 400));
        molecules.push(new Molecule('NAD+', 'nad', 600, 250));
        molecules.push(new Molecule('ADP', 'adp', 600, 550));
    }
    else if (step === 4) {
        molecules.push(new Molecule('Succinate', 'suc', 400, 400));
        molecules.push(new Molecule('FAD', 'fad', 600, 200));
        molecules.push(new Molecule('NAD+', 'nad', 600, 300));
    }

    updateSidebar();
    draw();
}

function startAnimation() {
    if(isAnimating) return;
    isAnimating = true;
    animationProgress = 0;
    animationTriggers = [];
    
    if (currentStep === 0) {
        // CoA and NAD+ move to Pyruvate
        molecules.forEach(m => {
            if(m.type === 'CoA') m.setTarget(350, 400, 0, 0.4);
            if(m.type === 'NAD+') m.setTarget(450, 400, 0, 0.4);
        });

        animationTriggers.push({
            progress: 0.4,
            triggered: false,
            action: () => {
                molecules = [];
                // Morph to Acetyl-CoA, CO2, NADH
                let acoa = new Molecule('AcetylCoA', 'acoa', 400, 400);
                acoa.setTarget(350, 400, 0.4, 1.0);
                molecules.push(acoa);
                
                let co2 = new Molecule('CO2', 'co2', 400, 400);
                co2.setTarget(600, 550, 0.4, 1.0);
                molecules.push(co2);
                
                let nadh = new Molecule('NADH', 'nadh', 400, 400);
                nadh.setTarget(600, 250, 0.4, 1.0);
                molecules.push(nadh);
            }
        });
    }
    else if (currentStep === 1) {
        // Acetyl-CoA moves to Oxaloacetate
        molecules.forEach(m => {
            if(m.type === 'AcetylCoA') m.setTarget(500, 400, 0, 0.4);
        });

        animationTriggers.push({
            progress: 0.4,
            triggered: false,
            action: () => {
                molecules = [];
                let cit = new Molecule('Citrate', 'cit', 550, 400);
                cit.setTarget(450, 400, 0.4, 1.0);
                molecules.push(cit);
                
                let coa = new Molecule('CoA', 'coa', 500, 400);
                coa.setTarget(200, 550, 0.4, 1.0);
                coa.targetOpacity = 0; // leaves
                molecules.push(coa);
            }
        });
    }
    else if (currentStep === 2) {
        // NAD+ moves to Citrate
        molecules.forEach(m => {
            if(m.type === 'NAD+') m.setTarget(450, 400, 0, 0.4);
        });

        animationTriggers.push({
            progress: 0.4,
            triggered: false,
            action: () => {
                molecules = [];
                let akg = new Molecule('AlphaKG', 'akg', 450, 400);
                akg.setTarget(350, 400, 0.4, 1.0);
                molecules.push(akg);
                
                let co2 = new Molecule('CO2', 'co2', 450, 400);
                co2.setTarget(600, 550, 0.4, 1.0);
                molecules.push(co2);
                
                let nadh = new Molecule('NADH', 'nadh', 450, 400);
                nadh.setTarget(600, 250, 0.4, 1.0);
                molecules.push(nadh);
            }
        });
    }
    else if (currentStep === 3) {
        molecules.forEach(m => {
            if(m.type === 'NAD+') m.setTarget(400, 400, 0, 0.4);
            if(m.type === 'ADP') m.setTarget(400, 400, 0, 0.4);
        });

        animationTriggers.push({
            progress: 0.4,
            triggered: false,
            action: () => {
                molecules = [];
                let suc = new Molecule('Succinate', 'suc', 400, 400);
                suc.setTarget(300, 400, 0.4, 1.0);
                molecules.push(suc);
                
                let co2 = new Molecule('CO2', 'co2', 400, 400);
                co2.setTarget(600, 650, 0.4, 1.0);
                molecules.push(co2);
                
                let nadh = new Molecule('NADH', 'nadh', 400, 400);
                nadh.setTarget(600, 250, 0.4, 1.0);
                molecules.push(nadh);

                let atp = new Molecule('ATP', 'atp', 400, 400);
                atp.setTarget(600, 450, 0.4, 1.0);
                molecules.push(atp);
            }
        });
    }
    else if (currentStep === 4) {
        molecules.forEach(m => {
            if(m.type === 'FAD') m.setTarget(400, 400, 0, 0.4);
            if(m.type === 'NAD+') m.setTarget(400, 400, 0, 0.4);
        });

        animationTriggers.push({
            progress: 0.4,
            triggered: false,
            action: () => {
                molecules = [];
                let oaa = new Molecule('Oxaloacetate', 'oaa', 400, 400);
                oaa.setTarget(350, 400, 0.4, 1.0);
                molecules.push(oaa);
                
                let fadh2 = new Molecule('FADH2', 'fadh2', 400, 400);
                fadh2.setTarget(600, 200, 0.4, 1.0);
                molecules.push(fadh2);
                
                let nadh = new Molecule('NADH', 'nadh', 400, 400);
                nadh.setTarget(600, 350, 0.4, 1.0);
                molecules.push(nadh);
            }
        });
    }

    animate();
}

function animate() {
    animationProgress += 0.005; // Slow animation
    
    if (animationProgress >= 1) {
        animationProgress = 1;
        isAnimating = false;
        
        // Final cleanup
        molecules.forEach(m => {
            if(m.targetOpacity === 0) m.opacity = 0;
        });
        molecules = molecules.filter(m => m.opacity > 0);
        
        document.getElementById('play-btn').innerText = '다시 재생';
        draw();
        return;
    }

    molecules.forEach(m => m.update(animationProgress));
    
    // Trigger phase events
    animationTriggers.forEach(t => {
        if (!t.triggered && animationProgress >= t.progress) {
            t.triggered = true;
            t.action();
        }
    });

    draw();
    animationReq = requestAnimationFrame(animate);
}

// Rendering
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(canvas.width/2 + camera.x, canvas.height/2 + camera.y);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-500, -400); // Center logic coordinates (1000x800)

    molecules.forEach(m => m.draw(ctx));

    ctx.restore();
}

// UI & Interaction
function resize() {
    const rect = wrapper.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    draw();
}

window.addEventListener('resize', resize);

// Pan & Zoom
canvas.addEventListener('mousedown', e => {
    isDragging = true;
    dragStart = { x: e.clientX - camera.x, y: e.clientY - camera.y };
});

window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    camera.x = e.clientX - dragStart.x;
    camera.y = e.clientY - dragStart.y;
    draw();
});

window.addEventListener('mouseup', () => isDragging = false);

canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const zoomAmount = 0.1;
    if (e.deltaY < 0) camera.zoom = Math.min(3, camera.zoom + zoomAmount);
    else camera.zoom = Math.max(0.5, camera.zoom - zoomAmount);
    draw();
});

// Touch support for mobile
let lastTouch = null;
let initialPinchDist = null;

canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
        isDragging = true;
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
        isDragging = false;
        initialPinchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    }
});

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - lastTouch.x;
        const dy = e.touches[0].clientY - lastTouch.y;
        camera.x += dx;
        camera.y += dy;
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        draw();
    } else if (e.touches.length === 2 && initialPinchDist) {
        const currentDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        const ratio = currentDist / initialPinchDist;
        camera.zoom = Math.min(3, Math.max(0.5, camera.zoom * ratio));
        initialPinchDist = currentDist;
        draw();
    }
});

canvas.addEventListener('touchend', () => {
    isDragging = false;
    lastTouch = null;
    initialPinchDist = null;
});

// Controls
document.getElementById('zoom-in').addEventListener('click', () => { camera.zoom = Math.min(3, camera.zoom + 0.2); draw(); });
document.getElementById('zoom-out').addEventListener('click', () => { camera.zoom = Math.max(0.5, camera.zoom - 0.2); draw(); });
document.getElementById('zoom-reset').addEventListener('click', () => { camera.x = 0; camera.y = 0; camera.zoom = 1.5; draw(); });

const stepList = document.querySelectorAll('#step-list li');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const playBtn = document.getElementById('play-btn');

function setStep(step) {
    if(isAnimating) return;
    currentStep = step;
    
    stepList.forEach(li => li.classList.remove('active'));
    stepList[step].classList.add('active');
    
    prevBtn.disabled = step === 0;
    nextBtn.disabled = step === 4;
    playBtn.disabled = false;
    playBtn.innerText = '재생';
    
    // Reset camera slightly for nice effect
    camera.x = 0; camera.y = 0; camera.zoom = 1.5;
    
    initStep(step);
}

stepList.forEach((li, index) => {
    li.addEventListener('click', () => setStep(index));
});

prevBtn.addEventListener('click', () => {
    if(currentStep > 0) setStep(currentStep - 1);
});

nextBtn.addEventListener('click', () => {
    if(currentStep < 4) setStep(currentStep + 1);
});

playBtn.addEventListener('click', () => {
    if(isAnimating) return;
    if(animationProgress >= 1) {
        initStep(currentStep);
        playBtn.innerText = '재생';
        setTimeout(() => startAnimation(), 300);
    } else {
        startAnimation();
    }
});

function updateSidebar() {
    const data = stepsData[currentStep];
    document.getElementById('info-title').innerText = data.title;
    document.getElementById('info-text').innerText = data.desc;
}

// Init
setTimeout(() => {
    resize();
    setStep(0);
}, 100);
