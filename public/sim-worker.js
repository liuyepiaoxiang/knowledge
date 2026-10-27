/* sim_worker.js — 力导向模拟 Worker
 * 主线程发 init 后, Worker 以 ~60fps 独立运行 step()
 * 每帧 postMessage 回传 px/py (Float32Array copy)
 * 主线程发 reheat/pin/unpin 控制模拟
 * Topic 节点(isTopic=1)不参与模拟, 位置由主线程管理
 */
let N = 0;
let px, py, vx, vy, fixed, isTopic, domIdx;
let nDom = 0;
let eSrc, eDst, eRest, eK, eCount = 0;
let alpha = 1;
let ancX, ancY;
let running = false;

self.onmessage = function(e) {
    const m = e.data;
    if (m.type === "init") {
        N = m.count;
        px = new Float32Array(m.px);
        py = new Float32Array(m.py);
        vx = new Float32Array(N);
        vy = new Float32Array(N);
        fixed = new Uint8Array(m.fixed);
        isTopic = new Uint8Array(m.isTopic);
        domIdx = new Uint8Array(m.domIdx);
        nDom = m.nDomains;
        ancX = new Float32Array(m.ancX);
        ancY = new Float32Array(m.ancY);
        eSrc = new Uint32Array(m.edgeSrc);
        eDst = new Uint32Array(m.edgeDst);
        eRest = new Float32Array(m.edgeRest);
        eK = new Float32Array(m.edgeK);
        eCount = eSrc.length;
        alpha = 1;
        running = true;
        tick();
    } else if (m.type === "add") {
        /* mergeExt 追加节点 */
        const addN = m.count;
        const oldN = N;
        const newN = oldN + addN;
        const np = new Float32Array(newN); np.set(px); px = np;
        const npp = new Float32Array(newN); npp.set(py); py = npp;
        const nvx = new Float32Array(newN); nvx.set(vx); vx = nvx;
        const nvy = new Float32Array(newN); nvy.set(vy); vy = nvy;
        const nf = new Uint8Array(newN); nf.set(fixed); fixed = nf;
        const nt = new Uint8Array(newN); nt.set(isTopic); isTopic = nt;
        const nd = new Uint8Array(newN); nd.set(domIdx); domIdx = nd;
        for (let i = 0; i < addN; i++) {
            const gi = oldN + i;
            px[gi] = m.px[i]; py[gi] = m.py[i];
            isTopic[gi] = m.isTopic[i];
            domIdx[gi] = m.domIdx[i];
        }
        N = newN;
    } else if (m.type === "reheat") {
        alpha = Math.max(alpha, m.alpha);
    } else if (m.type === "pin") {
        fixed[m.idx] = 1;
        px[m.idx] = m.x;
        py[m.idx] = m.y;
    } else if (m.type === "unpin") {
        fixed[m.idx] = 0;
    } else if (m.type === "stop") {
        running = false;
    }
};

function tick() {
    if (!running) { setTimeout(tick, 200); return; }
    step();
    self.postMessage({ type: "pos", px: px.slice(0), py: py.slice(0) });
    setTimeout(tick, 16);
}

function step() {
    /* 按域分组斥力 (仅非 Topic) */
    const byDom = {};
    for (let i = 0; i < N; i++) {
        if (isTopic[i]) continue;
        const d = domIdx[i];
        if (!byDom[d]) byDom[d] = [];
        byDom[d].push(i);
    }
    for (const d in byDom) {
        const arr = byDom[d];
        for (let a = 0; a < arr.length; a++) {
            const i = arr[a];
            for (let b = a + 1; b < arr.length; b++) {
                const j = arr[b];
                let dx = px[i] - px[j], dy = py[i] - py[j];
                let d2 = dx * dx + dy * dy; if (d2 < 1) d2 = 1;
                if (d2 > 660 * 660) continue;
                const dd = Math.sqrt(d2);
                const f = Math.min(5200 / d2, 2.6) * alpha;
                dx /= dd; dy /= dd;
                vx[i] += dx * f; vy[i] += dy * f;
                vx[j] -= dx * f; vy[j] -= dy * f;
            }
        }
    }
    /* 弹簧 (跳过 Topic 端点) */
    for (let e = 0; e < eCount; e++) {
        const i = eSrc[e], j = eDst[e];
        if (isTopic[i] || isTopic[j]) continue;
        const rest = eRest[e];
        let dx = px[j] - px[i], dy = py[j] - py[i];
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const kk = (dist - rest) > 600 ? eK[e] * 0.22 : eK[e];
        const f = Math.min((dist - rest) * kk * alpha, 2.2);
        const nx = dx / dist, ny = dy / dist;
        vx[i] += nx * f; vy[i] += ny * f;
        vx[j] -= nx * f; vy[j] -= ny * f;
    }
    /* 向心 + 域锚定 + 积分 */
    for (let i = 0; i < N; i++) {
        if (isTopic[i]) continue;
        if (fixed[i]) { vx[i] = 0; vy[i] = 0; continue; }
        vx[i] -= px[i] * 0.00012 * alpha;
        vy[i] -= py[i] * 0.00012 * alpha;
        const d = domIdx[i];
        const anc = d < 16 ? 0.0016 : 0.0008;
        vx[i] += (ancX[d] - px[i]) * anc * alpha;
        vy[i] += (ancY[d] - py[i]) * anc * alpha;
        vx[i] *= 0.85; vy[i] *= 0.85;
        const sp = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
        if (sp > 14) { vx[i] *= 14 / sp; vy[i] *= 14 / sp; }
        px[i] += vx[i]; py[i] += vy[i];
    }
    alpha = Math.max(alpha * 0.994, 0.02);
}
