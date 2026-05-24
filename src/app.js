(() => {
    'use strict';

    const canvas = document.getElementById('stage');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('overlay');

    const TAU = Math.PI * 2;
    const DPR_LIMIT = 2;

    const palette = {
        backgrounds: [
            ['#FFF7E8', '#FFD6BA', '#BDE7FF'],
            ['#FFF4D9', '#C8F7DC', '#DCCBFF'],
            ['#FFF0F3', '#BDE7FF', '#FFD6BA'],
            ['#F7FFF2', '#C8F7DC', '#FFD166'],
            ['#F8F2FF', '#DCCBFF', '#BDE7FF'],
        ],
        colors: ['#FF7A70', '#FFD166', '#32B7A8', '#7C83FD', '#FF9FCE', '#88D8B0'],
        accents: ['#FF7A70', '#FFD166', '#32B7A8', '#7C83FD', '#FF9FCE', '#BDE7FF'],
    };

    const keys = {
        top: new Set([
            'Digit1',
            'Digit2',
            'Digit3',
            'Digit4',
            'Digit5',
            'Digit6',
            'Digit7',
            'Digit8',
            'Digit9',
            'Digit0',
            'Minus',
            'Equal',
            'Backquote',
        ]),
        left: new Set(['KeyQ', 'KeyW', 'KeyE', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX', 'KeyC']),
        center: new Set(['KeyR', 'KeyT', 'KeyY', 'KeyF', 'KeyG', 'KeyH', 'KeyV', 'KeyB', 'KeyN']),
        right: new Set([
            'KeyU',
            'KeyI',
            'KeyO',
            'KeyP',
            'BracketLeft',
            'BracketRight',
            'KeyJ',
            'KeyK',
            'KeyL',
            'Semicolon',
            'Quote',
            'KeyM',
            'Comma',
            'Period',
            'Slash',
        ]),
        bottom: new Set([
            'ShiftLeft',
            'ShiftRight',
            'ControlLeft',
            'ControlRight',
            'AltLeft',
            'AltRight',
            'MetaLeft',
            'MetaRight',
            'CapsLock',
            'Tab',
            'Backspace',
            'Escape',
        ]),
    };

    const shapeKinds = ['circle', 'triangle', 'square', 'pentagon', 'diamond'];

    const state = {
        width: 1,
        height: 1,
        dpr: 1,
        running: false,
        lastTime: 0,
        quietTime: 0,
        bgIndex: 0,
        bgMix: 1,
        nextBgIndex: 1,
        activeZone: null,
        zonePulse: 0,
        shapes: [],
        particles: [],
        ripples: [],
        backgroundDots: [],
    };

    function resize() {
        state.dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
        state.width = Math.max(1, window.innerWidth);
        state.height = Math.max(1, window.innerHeight);

        canvas.width = Math.floor(state.width * state.dpr);
        canvas.height = Math.floor(state.height * state.dpr);
        canvas.style.width = `${state.width}px`;
        canvas.style.height = `${state.height}px`;
        ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

        makeBackgroundDots();

        if (!state.shapes.length) {
            createInitialShapes();
        } else {
            for (const shape of state.shapes) {
                shape.x = clamp(shape.x, shape.r * 1.2, state.width - shape.r * 1.2);
                shape.y = clamp(shape.y, shape.r * 1.2, state.height * 0.74);
            }
        }
    }

    function createInitialShapes() {
        const base = Math.min(state.width, state.height);
        const count = state.width < 720 ? 3 : 5;
        state.shapes = [];

        for (let i = 0; i < count; i += 1) {
            const x = state.width * (0.25 + (0.5 * i) / Math.max(1, count - 1));
            const y = state.height * (0.38 + Math.sin(i * 1.7) * 0.08);
            state.shapes.push(
                createShape({
                    x,
                    y,
                    r: clamp(base * random(0.075, 0.105), 48, 92),
                    kind: shapeKinds[i % shapeKinds.length],
                    colorIndex: i % palette.colors.length,
                }),
            );
        }
    }

    function createShape({ x, y, r, kind, colorIndex }) {
        return {
            x,
            y,
            vx: random(-18, 18),
            vy: random(-10, 10),
            r,
            targetR: r,
            kind,
            colorIndex,
            targetColorIndex: colorIndex,
            colorMix: 1,
            rotation: random(0, TAU),
            angularVelocity: random(-0.18, 0.18),
            organic: 0,
            targetOrganic: 0,
            squishX: 1,
            squishY: 1,
            phase: random(0, TAU),
            localPulse: 0,
            seedA: random(0, TAU),
            seedB: random(0, TAU),
            seedC: random(0, TAU),
        };
    }

    function makeBackgroundDots() {
        const count = state.width < 700 ? 18 : 32;
        state.backgroundDots = Array.from({ length: count }, (_, i) => ({
            x: random(0, state.width),
            y: random(0, state.height),
            r: random(10, 34),
            speed: random(0.03, 0.11),
            phase: random(0, TAU),
            color: palette.accents[i % palette.accents.length],
            alpha: random(0.04, 0.11),
        }));
    }

    function startPlay() {
        state.running = true;
        state.quietTime = 0;
        overlay.classList.add('hidden');

        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {
                // The toy still works without fullscreen.
            });
        }

        if (!state.lastTime) {
            state.lastTime = performance.now();
            requestAnimationFrame(tick);
        }
    }

    function pausePlay() {
        state.running = false;
        overlay.classList.remove('hidden');
    }

    function classifyKey(event) {
        if (event.code === 'F11') return 'parent';
        if (event.code === 'Space') return 'magic';
        if (event.code === 'Enter' || event.code === 'NumpadEnter') return 'reset';
        if (keys.top.has(event.code)) return 'color';
        if (keys.left.has(event.code)) return 'left';
        if (keys.center.has(event.code)) return 'center';
        if (keys.right.has(event.code)) return 'right';
        if (keys.bottom.has(event.code)) return 'bottom';
        if (event.code.startsWith('Numpad')) return 'center';
        return 'any';
    }

    function onKeyDown(event) {
        const action = classifyKey(event);

        if (action === 'parent') {
            return;
        }

        if (
            [
                'Space',
                'Tab',
                'Backspace',
                'Escape',
                'ArrowUp',
                'ArrowDown',
                'ArrowLeft',
                'ArrowRight',
            ].includes(event.code)
        ) {
            event.preventDefault();
        }

        if (!state.running) {
            startPlay();
        }

        trigger(action, event.repeat);
    }

    function onPointerDown() {
        if (!state.running) {
            startPlay();
        }

        trigger('magic', false);
    }

    function trigger(action, isRepeat) {
        const repeatFactor = isRepeat ? 0.52 : 1;
        const chosen = pickShapeForAction(action);

        state.quietTime = 0;
        state.activeZone = action;
        state.zonePulse = 1;

        if (action === 'reset') {
            createInitialShapes();
            addRipple(state.width * 0.5, state.height * 0.45, '#FFFFFF', 1.5);
            return;
        }

        if (action === 'magic') {
            for (const shape of state.shapes) {
                wakeShape(shape, 0.72);
                shape.vy -= random(150, 300);
                shape.vx += random(-160, 160);
                shape.angularVelocity += random(-1.2, 1.2);
            }

            if (state.shapes.length < 8) {
                const base = Math.min(state.width, state.height);
                state.shapes.push(
                    createShape({
                        x: state.width * 0.5 + random(-80, 80),
                        y: state.height * 0.45 + random(-50, 50),
                        r: clamp(base * random(0.055, 0.082), 38, 72),
                        kind: shapeKinds[Math.floor(Math.random() * shapeKinds.length)],
                        colorIndex: Math.floor(Math.random() * palette.colors.length),
                    }),
                );
            }

            addParticles(state.width * 0.5, state.height * 0.43, 22, 'burst');
            addRipple(
                state.width * 0.5,
                state.height * 0.43,
                palette.accents[Math.floor(Math.random() * palette.accents.length)],
                1.3,
            );
            return;
        }

        if (action === 'left') {
            wakeShape(chosen, 0.5);
            chosen.vx -= 390 * repeatFactor;
            chosen.vy += random(-90, 50);
            chosen.angularVelocity -= 0.7 * repeatFactor;
            addParticles(chosen.x + chosen.r * 0.7, chosen.y, 7, 'left');
        } else if (action === 'right') {
            wakeShape(chosen, 0.5);
            chosen.vx += 390 * repeatFactor;
            chosen.vy += random(-90, 50);
            chosen.angularVelocity += 0.7 * repeatFactor;
            addParticles(chosen.x - chosen.r * 0.7, chosen.y, 7, 'right');
        } else if (action === 'center') {
            wakeShape(chosen, 0.64);
            chosen.vy -= 300 * repeatFactor;
            chosen.squishX = 1.22;
            chosen.squishY = 0.82;
            chosen.localPulse = 1;
            addRipple(chosen.x, chosen.y, palette.colors[chosen.colorIndex], 0.95);
            addParticles(chosen.x, chosen.y + chosen.r * 0.6, 8, 'up');
        } else if (action === 'color') {
            wakeShape(chosen, 0.38);
            chosen.targetColorIndex =
                (chosen.targetColorIndex + 1 + Math.floor(Math.random() * 2)) %
                palette.colors.length;
            chosen.colorMix = 0;
            state.nextBgIndex =
                (state.bgIndex + 1 + Math.floor(Math.random() * (palette.backgrounds.length - 1))) %
                palette.backgrounds.length;
            state.bgMix = 0;
            addParticles(chosen.x, chosen.y, 12, 'burst');
        } else if (action === 'bottom') {
            wakeShape(chosen, 0.45);
            chosen.targetR = clamp(
                chosen.targetR + random(-10, 10),
                40,
                Math.min(state.width, state.height) * 0.14,
            );
            chosen.squishX = random(0.9, 1.18);
            chosen.squishY = random(0.9, 1.18);
            addRipple(chosen.x, chosen.y, '#FFFFFF', 0.95);
        } else {
            wakeShape(chosen, 0.4);
            chosen.vx += random(-200, 200);
            chosen.vy += random(-220, 60);
            chosen.angularVelocity += random(-0.7, 0.7);
            addParticles(chosen.x, chosen.y, 6, 'burst');
        }
    }

    function wakeShape(shape, amount) {
        shape.targetOrganic = clamp(shape.targetOrganic + amount, 0, 1);
        shape.organic = clamp(shape.organic + amount * 0.45, 0, 1);
        shape.localPulse = 1;
    }

    function pickShapeForAction(action) {
        if (!state.shapes.length) createInitialShapes();

        if (action === 'left') {
            return state.shapes.reduce(
                (best, item) => (item.x < best.x ? item : best),
                state.shapes[0],
            );
        }

        if (action === 'right') {
            return state.shapes.reduce(
                (best, item) => (item.x > best.x ? item : best),
                state.shapes[0],
            );
        }

        if (action === 'center') {
            const cx = state.width * 0.5;
            return state.shapes.reduce(
                (best, item) => (Math.abs(item.x - cx) < Math.abs(best.x - cx) ? item : best),
                state.shapes[0],
            );
        }

        return state.shapes[Math.floor(Math.random() * state.shapes.length)];
    }

    function addParticles(x, y, count, mode) {
        for (let i = 0; i < count; i += 1) {
            const angle =
                mode === 'left'
                    ? random(Math.PI * 0.68, Math.PI * 1.32)
                    : mode === 'right'
                      ? random(-Math.PI * 0.32, Math.PI * 0.32)
                      : mode === 'up'
                        ? random(-Math.PI * 0.95, -Math.PI * 0.05)
                        : random(0, TAU);

            const speed = random(55, mode === 'burst' ? 330 : 210);
            state.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                r: random(4, 14),
                life: 1,
                decay: random(0.85, 1.55),
                color: palette.accents[Math.floor(Math.random() * palette.accents.length)],
            });
        }

        if (state.particles.length > 170) {
            state.particles.splice(0, state.particles.length - 170);
        }
    }

    function addRipple(x, y, color, strength) {
        state.ripples.push({
            x,
            y,
            r: 8,
            max: random(110, 210) * strength,
            life: 1,
            color,
        });

        if (state.ripples.length > 18) {
            state.ripples.shift();
        }
    }

    function tick(now) {
        const dt = Math.min(0.033, (now - state.lastTime) / 1000 || 0.016);
        state.lastTime = now;

        update(dt, now / 1000);
        draw(now / 1000);

        requestAnimationFrame(tick);
    }

    function update(dt, t) {
        state.quietTime += dt;
        state.zonePulse = Math.max(0, state.zonePulse - dt * 1.7);

        state.bgMix = Math.min(1, state.bgMix + dt * 0.65);
        if (state.bgMix >= 1) {
            state.bgIndex = state.nextBgIndex;
            state.bgMix = 1;
        }

        for (const shape of state.shapes) {
            updateShape(shape, dt, t);
        }

        updateParticles(dt);
        updateRipples(dt);
    }

    function updateShape(shape, dt, t) {
        const quietRestore = state.quietTime > 0.35 ? 0.22 : 0.08;
        shape.targetOrganic = Math.max(0, shape.targetOrganic - dt * quietRestore);
        shape.organic += (shape.targetOrganic - shape.organic) * Math.min(1, dt * 3.2);

        shape.colorMix = Math.min(1, shape.colorMix + dt * 2.4);
        if (shape.colorMix >= 1) {
            shape.colorIndex = shape.targetColorIndex;
        }

        const geometryPull = 1 - shape.organic;
        const homeY = state.height * 0.44 + Math.sin(shape.phase) * state.height * 0.045;
        const homeX = state.width * 0.5 + Math.sin(shape.phase * 1.7) * state.width * 0.28;

        shape.vy += 150 * dt;
        shape.vx *= Math.pow(0.34, dt);
        shape.vy *= Math.pow(0.42, dt);

        shape.x += shape.vx * dt;
        shape.y += shape.vy * dt;

        shape.x += (homeX - shape.x) * dt * (0.12 + geometryPull * 0.16);
        shape.y += (homeY - shape.y) * dt * (0.1 + geometryPull * 0.18);

        const margin = shape.r * 1.15;
        const floor = state.height * 0.74;

        if (shape.x < margin) {
            shape.x = margin;
            shape.vx = Math.abs(shape.vx) * 0.36;
        } else if (shape.x > state.width - margin) {
            shape.x = state.width - margin;
            shape.vx = -Math.abs(shape.vx) * 0.36;
        }

        if (shape.y < margin) {
            shape.y = margin;
            shape.vy = Math.abs(shape.vy) * 0.28;
        } else if (shape.y > floor) {
            shape.y = floor;
            shape.vy = -Math.abs(shape.vy) * 0.2;
        }

        shape.r += (shape.targetR - shape.r) * Math.min(1, dt * 3.5);
        shape.squishX += (1 - shape.squishX) * Math.min(1, dt * 5.5);
        shape.squishY += (1 - shape.squishY) * Math.min(1, dt * 5.5);

        shape.localPulse = Math.max(0, shape.localPulse - dt * 1.55);
        shape.angularVelocity *= Math.pow(0.68, dt);
        shape.rotation += shape.angularVelocity * dt;

        if (shape.organic < 0.12) {
            const snapAngles = {
                triangle: TAU / 3,
                square: Math.PI / 2,
                diamond: Math.PI / 2,
                pentagon: TAU / 5,
                circle: TAU,
            };

            const step = snapAngles[shape.kind] || TAU;
            if (step < TAU) {
                const targetRotation = Math.round(shape.rotation / step) * step;
                shape.rotation += (targetRotation - shape.rotation) * dt * 0.7;
            }
        }
    }

    function updateParticles(dt) {
        for (let i = state.particles.length - 1; i >= 0; i -= 1) {
            const p = state.particles[i];
            p.life -= dt * p.decay;
            p.vy += 100 * dt;
            p.vx *= Math.pow(0.44, dt);
            p.vy *= Math.pow(0.62, dt);
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.life <= 0) {
                state.particles.splice(i, 1);
            }
        }
    }

    function updateRipples(dt) {
        for (let i = state.ripples.length - 1; i >= 0; i -= 1) {
            const ripple = state.ripples[i];
            ripple.life -= dt * 0.82;
            ripple.r += (ripple.max - ripple.r) * Math.min(1, dt * 2.6);
            if (ripple.life <= 0) {
                state.ripples.splice(i, 1);
            }
        }
    }

    function draw(t) {
        drawBackground(t);
        drawBackgroundDots(t);
        drawZoneGlow();
        drawRipples();
        drawParticles();
        drawShapes(t);
    }

    function drawBackground(t) {
        const current = palette.backgrounds[state.bgIndex];
        const next = palette.backgrounds[state.nextBgIndex];
        const mix = smoothstep(state.bgMix);

        const c0 = mixHex(current[0], next[0], mix);
        const c1 = mixHex(current[1], next[1], mix);
        const c2 = mixHex(current[2], next[2], mix);

        const gradient = ctx.createLinearGradient(0, 0, state.width, state.height);
        gradient.addColorStop(0, c0);
        gradient.addColorStop(0.5 + Math.sin(t * 0.1) * 0.04, c1);
        gradient.addColorStop(1, c2);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, state.width, state.height);
    }

    function drawBackgroundDots(t) {
        for (const dot of state.backgroundDots) {
            const x = dot.x + Math.cos(dot.phase + t * dot.speed) * 14;
            const y = dot.y + Math.sin(dot.phase * 1.4 + t * dot.speed) * 10;

            ctx.save();
            ctx.globalAlpha = dot.alpha;
            ctx.fillStyle = dot.color;
            ctx.beginPath();
            ctx.arc(x, y, dot.r, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawZoneGlow() {
        if (!state.activeZone || state.zonePulse <= 0) return;

        const zone = state.activeZone;
        const sourceX = zone === 'left' ? 0 : zone === 'right' ? state.width : state.width * 0.5;
        const sourceY =
            zone === 'color' ? 0 : zone === 'bottom' ? state.height : state.height * 0.5;
        const alpha = state.zonePulse * 0.14;

        const gradient = ctx.createRadialGradient(
            sourceX,
            sourceY,
            0,
            sourceX,
            sourceY,
            Math.max(state.width, state.height) * 0.78,
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        gradient.addColorStop(0.55, `rgba(255, 209, 102, ${alpha * 0.45})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, state.width, state.height);
    }

    function drawRipples() {
        for (const ripple of state.ripples) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, ripple.life) * 0.3;
            ctx.strokeStyle = ripple.color;
            ctx.lineWidth = 8 * ripple.life;
            ctx.beginPath();
            ctx.arc(ripple.x, ripple.y, ripple.r, 0, TAU);
            ctx.stroke();
            ctx.restore();
        }
    }

    function drawParticles() {
        for (const p of state.particles) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.translate(p.x, p.y);
            ctx.beginPath();
            ctx.arc(0, 0, p.r, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawShapes(t) {
        const sorted = [...state.shapes].sort((a, b) => a.y - b.y);

        for (const shape of sorted) {
            drawMorphShape(shape, t);
        }
    }

    function drawMorphShape(shape, t) {
        const color = mixHex(
            palette.colors[shape.colorIndex],
            palette.colors[shape.targetColorIndex],
            smoothstep(shape.colorMix),
        );

        ctx.save();
        ctx.translate(shape.x, shape.y);
        ctx.rotate(shape.rotation);
        ctx.scale(shape.squishX, shape.squishY);

        ctx.shadowColor = 'rgba(92, 64, 38, 0.16)';
        ctx.shadowBlur = 24 + shape.localPulse * 12;
        ctx.shadowOffsetY = 16;

        const gradient = ctx.createRadialGradient(
            -shape.r * 0.32,
            -shape.r * 0.42,
            shape.r * 0.18,
            0,
            0,
            shape.r * 1.2,
        );
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(0.16, lightenHex(color, 0.32));
        gradient.addColorStop(1, color);

        ctx.fillStyle = gradient;
        buildMorphPath(shape, t);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.globalAlpha = 0.26;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(-shape.r * 0.25, -shape.r * 0.32, shape.r * 0.16, shape.r * 0.1, -0.45, 0, TAU);
        ctx.fill();

        ctx.restore();
    }

    function buildMorphPath(shape, t) {
        const points = 96;
        const baseVertices = getVertices(shape.kind, shape.r);
        const roundPower = getRoundPower(shape.kind);
        const organic = smoothstep(shape.organic);

        ctx.beginPath();

        for (let i = 0; i <= points; i += 1) {
            const a = (i / points) * TAU;
            const geometricRadius = radiusToPolygonEdge(a, baseVertices);
            const circleRadius = shape.r;
            const roundedGeometryRadius = lerp(geometricRadius, circleRadius, roundPower);
            const softWave =
                Math.sin(a * 2 + shape.seedA + t * 0.55) * shape.r * 0.1 +
                Math.sin(a * 3 - shape.seedB + t * 0.37) * shape.r * 0.07 +
                Math.cos(a * 5 + shape.seedC - t * 0.31) * shape.r * 0.04;

            const pulseWave = Math.sin(a * 4 + t * 2.4) * shape.r * 0.04 * shape.localPulse;
            const radius = lerp(
                roundedGeometryRadius,
                circleRadius + softWave + pulseWave,
                organic,
            );
            const x = Math.cos(a) * radius;
            const y = Math.sin(a) * radius;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.closePath();
    }

    function getVertices(kind, r) {
        if (kind === 'circle') {
            const vertices = [];
            for (let i = 0; i < 18; i += 1) {
                const a = (i / 18) * TAU;
                vertices.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
            }
            return vertices;
        }

        if (kind === 'diamond') {
            return [
                { x: 0, y: -r },
                { x: r, y: 0 },
                { x: 0, y: r },
                { x: -r, y: 0 },
            ];
        }

        const sides = kind === 'triangle' ? 3 : kind === 'square' ? 4 : 5;
        const start = kind === 'square' ? -Math.PI / 4 : -Math.PI / 2;
        const vertices = [];

        for (let i = 0; i < sides; i += 1) {
            const a = start + (i / sides) * TAU;
            vertices.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
        }

        return vertices;
    }

    function getRoundPower(kind) {
        if (kind === 'circle') return 1;
        if (kind === 'triangle') return 0.12;
        if (kind === 'square' || kind === 'diamond') return 0.1;
        return 0.08;
    }

    function radiusToPolygonEdge(angle, vertices) {
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        let best = Infinity;

        for (let i = 0; i < vertices.length; i += 1) {
            const a = vertices[i];
            const b = vertices[(i + 1) % vertices.length];
            const sx = b.x - a.x;
            const sy = b.y - a.y;
            const denom = cross(dx, dy, sx, sy);

            if (Math.abs(denom) < 0.00001) continue;

            const qpx = a.x;
            const qpy = a.y;
            const rayT = cross(qpx, qpy, sx, sy) / denom;
            const segT = cross(qpx, qpy, dx, dy) / denom;

            if (rayT >= 0 && segT >= -0.0001 && segT <= 1.0001) {
                best = Math.min(best, rayT);
            }
        }

        return Number.isFinite(best) ? best : vertices[0].x;
    }

    function hexToRgb(hex) {
        const raw = hex.replace('#', '');
        return {
            r: parseInt(raw.slice(0, 2), 16),
            g: parseInt(raw.slice(2, 4), 16),
            b: parseInt(raw.slice(4, 6), 16),
        };
    }

    function rgbToHex({ r, g, b }) {
        const toHex = (value) =>
            Math.round(clamp(value, 0, 255))
                .toString(16)
                .padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    function mixHex(a, b, t) {
        const ca = hexToRgb(a);
        const cb = hexToRgb(b);
        return rgbToHex({
            r: ca.r + (cb.r - ca.r) * t,
            g: ca.g + (cb.g - ca.g) * t,
            b: ca.b + (cb.b - ca.b) * t,
        });
    }

    function lightenHex(hex, amount) {
        const c = hexToRgb(hex);
        return rgbToHex({
            r: c.r + (255 - c.r) * amount,
            g: c.g + (255 - c.g) * amount,
            b: c.b + (255 - c.b) * amount,
        });
    }

    function smoothstep(t) {
        const x = clamp(t, 0, 1);
        return x * x * (3 - 2 * x);
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function cross(ax, ay, bx, by) {
        return ax * by - ay * bx;
    }

    function random(min, max) {
        return min + Math.random() * (max - min);
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && state.running) {
            pausePlay();
        }
    });

    resize();
    draw(0);
})();
