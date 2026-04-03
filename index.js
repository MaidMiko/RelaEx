// ============================================================
// 💕 Relationship Meter — SillyTavern Extension
// Dating Sim Style | Multi-NPC Tracking | 10k Scale
// ============================================================
// วางไฟล์นี้ใน: /public/scripts/extensions/third-party/relationship-meter/
// ============================================================

import { eventSource, event_types, saveSettingsDebounced } from "../../../../script.js";
import { extension_settings, getContext } from "../../../extensions.js";

const EXT_NAME = "relationship_meter";

/** Below SillyTavern #movingDivs (4000) so extension drawers / top bar stay usable */
const RM_Z_BAR = 3970;
const RM_Z_FLOAT = 3980;
const RM_Z_POPUP = 3985;
const RM_Z_MODAL = 3990;
const RM_Z_OVERLAY = 3992;

function rmEscapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function rmEscapeAttr(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ============================================================
// 💎 RELATIONSHIP LEVELS — 10k Scale (13 ระดับ)
// ============================================================
const LEVELS = [
    { id: 0, emoji: "💀", name: "💀 แตกหัก", en: "Broken", min: -Infinity, max: -10000, color: "#9E0000", glow: "#FF0000" },
    { id: 1, emoji: "☠️", name: "☠️ คู่อาฆาต", en: "Nemesis", min: -9999, max: -8000, color: "#B71C1C", glow: "#FF1744" },
    { id: 2, emoji: "🔥", name: "🔥 ศัตรู", en: "Enemy", min: -7999, max: -6000, color: "#D32F2F", glow: "#FF5252" },
    { id: 3, emoji: "⚡", name: "⚡ เป็นปฏิปักษ์", en: "Hostile", min: -5999, max: -4000, color: "#F57C00", glow: "#FF9800" },
    { id: 4, emoji: "❄️", name: "❄️ เย็นชา", en: "Cold", min: -3999, max: -2000, color: "#0288D1", glow: "#03A9F4" },
    { id: 5, emoji: "🌧️", name: "🌧️ ตึงเครียด", en: "Tense", min: -1999, max: -500, color: "#7B1FA2", glow: "#9C27B0" },
    { id: 6, emoji: "😐", name: "😐 เฉยๆ", en: "Neutral", min: -499, max: 499, color: "#78909C", glow: "#90A4AE" },
    { id: 7, emoji: "🌱", name: "🌱 คนรู้จัก", en: "Acquainted", min: 500, max: 1999, color: "#388E3C", glow: "#4CAF50" },
    { id: 8, emoji: "🤝", name: "🤝 เป็นมิตร", en: "Friendly", min: 2000, max: 3999, color: "#1976D2", glow: "#2196F3" },
    { id: 9, emoji: "💛", name: "💛 เชื่อใจ", en: "Trusted", min: 4000, max: 5999, color: "#FBC02D", glow: "#FFEB3B" },
    { id: 10, emoji: "💖", name: "💖 สนิทสนม", en: "Intimate", min: 6000, max: 7999, color: "#C2185B", glow: "#E91E63" },
    { id: 11, emoji: "♥", name: "♥ อุทิศตน", en: "Devoted", min: 8000, max: 9999, color: "#D32F2F", glow: "#FF5252" },
    { id: 12, emoji: "★", name: "★ ผูกพันวิญญาณ", en: "Soulbound", min: 10000, max: Infinity, color: "#E040FB", glow: "#EA80FC" },
];

// ============================================================
// 🎭 EMOTION TAG SCORES (Fallback)
// ============================================================
const EMOTION_SCORES = {
    happy: +8, joy: +10, love: +15, blush: +12, smile: +8,
    laugh: +8, warm: +10, affection: +15, trust: +12, safe: +10,
    ดีใจ: +8, รัก: +15, ชอบ: +10, ยิ้ม: +8, อบอุ่น: +10, เชือใจ: +12,
    angry: -12, hate: -15, sad: -8, cry: -8, fear: -10,
    โกรธ: -12, เกลียด: -15, เศร้า: -8, กลัว: -10
};

const KEYWORD_VAR_SCORES = {
    love: +25, hate: -25, kiss: +18, hug: +12, confess: +30,
    รัก: +25, เกลียด: -25, จูบ: +18, กอด: +12, สารภาพ: +30
};

const KEYWORD_RULES = [
    { words: ["ขอบคุณ", "ดีใจ", "ยินดี", "ชอบ"], score: +5 },
    { words: ["สำคัญ", "ห่วงใย", "อยากอยู่ด้วย"], score: +8 },
    { words: ["เชื่อใจ", "สัญญา", "จะไม่ทอดทิ้ง"], score: +12 },
    { words: ["รัก", "รักนะ", "รักมาก", "รักที่สุด"], score: +15 },
    { words: ["ไม่ชอบ", "รำคาญ", "หยุดได้แล้ว"], score: -8 },
    { words: ["เกลียด", "ชิงชัง", "ไม่อยากเจอ"], score: -15 },
];

// ============================================================
// 📦 STATE (Multi-NPC Storage)
// ============================================================
let state = {
    charId: null,
    charName: "Unknown",
};

let npcsData = {};
// format: { "NPC_Name": { points, levelId, lastChange, history, avatar: "", desc: "" } }

function getKey(charId) { return `rm_v2_${charId}`; }

function saveState() {
    if (!state.charId) return;
    localStorage.setItem(getKey(state.charId), JSON.stringify(npcsData));
}

function loadState(charId, charName) {
    state.charId = charId;
    state.charName = charName || "Unknown";
    const raw = localStorage.getItem(getKey(charId));
    if (raw) {
        try {
            npcsData = JSON.parse(raw);
            let updated = false;
            // Migrations & Cleanups
            for (let k of Object.keys(npcsData)) {
                // Delete bot name if it was just an empty fallback
                if (k === state.charName && npcsData[k].points === 0 && (!npcsData[k].history || npcsData[k].history.length === 0)) {
                    delete npcsData[k];
                    updated = true;
                    continue;
                }

                let cleanK = k.replace(/\s*\([^)]*\)\s*/g, '').trim();
                let lowerK = cleanK.toLowerCase();
                let canonicalName = cleanK;
                if (k !== cleanK) {
                    for (let ex of Object.keys(npcsData)) {
                        if (ex.toLowerCase() === lowerK && ex !== k) {
                            canonicalName = ex;
                            break;
                        }
                    }
                    if (!npcsData[canonicalName]) {
                        npcsData[canonicalName] = npcsData[k];
                    } else if (Math.abs(npcsData[k].points) > Math.abs(npcsData[canonicalName].points)) {
                        npcsData[canonicalName].points = npcsData[k].points;
                        npcsData[canonicalName].levelId = npcsData[k].levelId;
                    }
                    delete npcsData[k];
                    updated = true;
                }
            }
            if (updated) saveState();
        } catch { resetStateValues(); }
    } else {
        // Migration from v1
        const rawOld = localStorage.getItem(`rm_v1_${charId}`);
        if (rawOld) {
            try {
                const old = JSON.parse(rawOld);
                const p = old.points || 0;
                npcsData = {
                    [old.charName || state.charName]: {
                        points: p,
                        levelId: getLevel(p).id,
                        lastChange: 0,
                        history: old.history || [],
                        avatar: '',
                        desc: ''
                    }
                };
            } catch { resetStateValues(); }
        } else {
            resetStateValues();
        }
    }
}

function resetStateValues() {
    npcsData = {};
}

// ============================================================
// 🧠 SCORING ENGINE
// ============================================================
function getLevel(points) {
    return LEVELS.find(l => points >= l.min && points <= l.max) || LEVELS[6];
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// Parse rel-tracker div appended to bot messages
function processRelTrackerDiv(text) {
    try {
        // Try multiple regex patterns for robustness
        const patterns = [
            /<div[^>]*id=["']?rel-tracker["']?[^>]*>([\s\S]*?)<\/div>/ig,
            /\[rel-tracker\]([\s\S]*?)\[\/rel-tracker\]/ig,
        ];
        let found = false;
        let anyUpdated = false;

        for (const regex of patterns) {
            let match;
            while ((match = regex.exec(text)) !== null) {
                found = true;
                const content = match[1].trim();
                console.log('💕 [RM] Tracker content found:', content);
                const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                lines.forEach(line => {
                    if (line.toLowerCase().includes('npc_name') && line.toLowerCase().includes('score')) return;
                    if (line.startsWith('---') || line.startsWith('===')) return;
                    const parts = line.split('|').map(p => p.trim());
                    if (parts.length >= 2) {
                        let name = parts[0];
                        if (!name || name.length === 0) return;
                        name = name.replace(/\s*\([^)]*\)\s*/g, '').trim();
                        const cleanScore = parts[1].replace(/,/g, '').replace(/\+/g, '').trim();
                        const currentScore = parseInt(cleanScore, 10);

                        if (!isNaN(currentScore)) {
                            // Find canonical name to avoid duplicates like "vanta" vs "Vanta"
                            const lowerName = name.toLowerCase();
                            let canonicalName = name;
                            for (let k of Object.keys(npcsData)) {
                                if (k.toLowerCase() === lowerName) {
                                    canonicalName = k;
                                    break;
                                }
                            }

                            if (!npcsData[canonicalName]) {
                                npcsData[canonicalName] = { points: 0, levelId: 6, lastChange: 0, history: [], avatar: '', desc: '' };
                            }

                            const oldPoints = npcsData[canonicalName].points;
                            const change = currentScore - oldPoints;

                            // Silent update mode for syncing history without alerts
                            if (window.rmSilentSyncMode) {
                                npcsData[canonicalName].points = currentScore;
                                npcsData[canonicalName].levelId = getLevel(currentScore).id;
                            } else {
                                console.log(`💕 [RM] NPC: ${canonicalName} | old: ${oldPoints} | new: ${currentScore} | change: ${change}`);
                                if (change !== 0) {
                                    applyNpcScore(canonicalName, change, 'ai', parts[4] || 'Update Tracker');
                                    anyUpdated = true;
                                } else {
                                    npcsData[canonicalName].points = currentScore;
                                    npcsData[canonicalName].levelId = getLevel(currentScore).id;
                                }
                            }
                        }
                    }
                });
            }
            if (found) break; // stop trying other patterns if found
        }

        // Even if no scores changed, save & render to show all NPCs
        if (found && !anyUpdated) {
            saveState();
            renderBar();
        }
        return found;
    } catch (err) {
        console.error('💕 [RM] Error in processRelTrackerDiv:', err);
        return false;
    }
}

// Fallback regex keyword parser
function calculateScoreFallback(text) {
    let total = 0;
    const numRegex = /\[([^\]]*?):\s*([+-]?\d+)\]/g;
    let m;
    while ((m = numRegex.exec(text)) !== null) total += parseInt(m[2], 10);

    const tagRegex = /\*([a-zA-Zก-ฮ\u0E40-\u0E4E]+)\*/g;
    while ((m = tagRegex.exec(text)) !== null) {
        const score = EMOTION_SCORES[m[1]] ?? EMOTION_SCORES[m[1].toLowerCase()];
        if (score) total += score;
    }

    const varRegex = /\{\{([a-zA-Zก-ฮ\u0E40-\u0E4E_]+)\}\}/g;
    while ((m = varRegex.exec(text)) !== null) {
        const score = KEYWORD_VAR_SCORES[m[1]] ?? KEYWORD_VAR_SCORES[m[1].toLowerCase()];
        if (score) total += score;
    }

    const lower = text.toLowerCase();
    for (const rule of KEYWORD_RULES) {
        if (rule.words.some(w => lower.includes(w.toLowerCase()))) {
            total += rule.score; break;
        }
    }
    return clamp(total, -100, 100);
}

function applyNpcScore(name, change, source = "ai", reason = "") {
    if (!npcsData[name]) {
        npcsData[name] = { points: 0, levelId: 6, lastChange: 0, history: [], avatar: '', desc: '' };
    }
    const npc = npcsData[name];
    const oldLevelId = npc.levelId;

    npc.points = clamp(npc.points + change, -15000, 15000);
    npc.lastChange = change;

    const newLevel = getLevel(npc.points);
    npc.levelId = newLevel.id;

    npc.history.unshift({ change, total: npc.points, source, time: Date.now(), reason });
    if (npc.history.length > 20) npc.history.pop();

    saveState();
    renderBar();

    if (newLevel.id !== oldLevelId) {
        showLevelChangeOverlay(name, newLevel, newLevel.id > oldLevelId);
    }
}

// ============================================================
// 🎨 UI — FLOATING BAR (Multi-NPC Support)
// ============================================================
function renderBar() {
    const s = extension_settings[EXT_NAME] ?? {};
    if (!s.enabled || !s.bar_visible) { $('#rm-bar').remove(); return; }

    let entries = Object.keys(npcsData).map(k => ({ name: k, ...npcsData[k] }));

    let htmlRows = entries.length === 0 ? '<div style="text-align:center;padding:8px 0;color:rgba(255,255,255,0.4);font-size:12px;">ยังไม่มีข้อมูลความสัมพันธ์</div>' : entries.map(ent => {
        const level = getLevel(ent.points);
        const nextLv = LEVELS[level.id + 1];
        let barWidth = 50;
        let nextText = "✨ MAX LEVEL";

        if (nextLv && isFinite(level.min)) {
            const range = nextLv.min - level.min;
            const curr = ent.points - level.min;
            barWidth = Math.max(2, Math.min(100, (curr / range) * 100));
            const need = nextLv.min - ent.points;
            nextText = `${need.toLocaleString()} pts → ${nextLv.emoji}`;
        }

        const lastChange = ent.lastChange || 0;
        const chgStr = lastChange > 0 ? `+${lastChange}` : `${lastChange}`;
        const chgColor = lastChange > 0 ? "#FF6BAE" : lastChange < 0 ? "#FF6B6B" : "transparent";

        return `
        <div style="margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.9);">${ent.name}</span>
                <div style="display:flex;align-items:center;gap:6px;">
                    ${lastChange !== 0 ? `<span style="font-size:10px;font-weight:800;color:${chgColor};background:${chgColor}22;padding:1px 6px;border-radius:10px;">${chgStr}</span>` : ''}
                    <span style="font-size:12px;font-weight:700;color:${level.color};text-shadow:0 0 10px ${level.glow}aa;">${level.name}</span>
                </div>
            </div>
            <div style="background:rgba(255,255,255,0.07);border-radius:4px;height:5px;overflow:hidden;position:relative;">
                <div style="position:absolute;top:0;left:0;height:100%;width:${barWidth}%;background:linear-gradient(90deg,${level.glow},${level.color});box-shadow:0 0 10px ${level.color}99;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:3px;">
                <span style="font-size:10px;color:rgba(255,255,255,0.4);font-family:monospace;">${ent.points.toLocaleString()} pts</span>
                <span style="font-size:10px;color:rgba(255,255,255,0.3);">${nextText}</span>
            </div>
        </div>`;
    }).join("");

    let $bar = $('#rm-bar');
    if (!$bar.length) {
        const barPos = s.bar_pos || { top: '10px', left: '50%', tx: '-50%' };
        const theme1 = s.color_primary || '#7B1FA2';
        const theme2 = s.color_secondary || '#E91E8C';
        $('body').append(`
<div id="rm-bar" style="
    position:fixed; top:${barPos.top}; left:${barPos.left}; transform:translateX(${barPos.tx});
    z-index:${RM_Z_BAR}; width:380px; max-width:95vw; max-height:40vh; display:flex; flex-direction:column;
    background:linear-gradient(rgba(15,5,25,0.92), rgba(15,5,25,0.92)), linear-gradient(135deg,${theme1},${theme2});
    border:1px solid rgba(255,255,255,0.1); border-radius:12px;
    padding:6px 14px 10px; pointer-events:auto;
    box-shadow:0 6px 30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06);
    backdrop-filter:blur(12px);
    font-family:'Segoe UI',Tahoma,sans-serif;
">
    <div id="rm-bar-handle" style="cursor:grab; text-align:center; padding:4px 0; margin-bottom:6px; opacity:0.5; font-size:12px; color:#fff;">⠿ สไลด์เพื่อย้ายตำแหน่ง ⠿</div>
    <div id="rm-bar-content" style="overflow-y:auto; flex:1;"></div>
    <style>#rm-bar-content::-webkit-scrollbar { width:4px; } #rm-bar-content::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.2); border-radius:4px; }</style>
</div>`);
        $bar = $('#rm-bar');

        // Drag Logic
        let isDragging = false;
        let startX, startY, initLeft, initTop;
        $('#rm-bar-handle').off('mousedown touchstart').on('mousedown touchstart', function (e) {
            isDragging = true;
            const pts = e.touches ? e.touches[0] : e;
            startX = pts.clientX; startY = pts.clientY;
            const rect = $bar[0].getBoundingClientRect();
            initLeft = rect.left; initTop = rect.top;
            $bar.css({ transform: 'none' }); // Remove translateX(-50%) on first drag
            $('#rm-bar-handle').css('cursor', 'grabbing');
        });
        $(document).off('mousemove.rmbar touchmove.rmbar').on('mousemove.rmbar touchmove.rmbar', function (e) {
            if (!isDragging) return;
            e.preventDefault();
            const pts = e.touches ? e.touches[0] : e;
            $bar.css({ left: initLeft + (pts.clientX - startX) + 'px', top: initTop + (pts.clientY - startY) + 'px' });
        });
        $(document).off('mouseup.rmbar touchend.rmbar').on('mouseup.rmbar touchend.rmbar', function () {
            if (!isDragging) return;
            isDragging = false;
            $('#rm-bar-handle').css('cursor', 'grab');
            extension_settings[EXT_NAME]['bar_pos'] = { top: $bar.css('top'), left: $bar.css('left'), tx: '0' };
            saveSettingsDebounced();
        });
    }
    $('#rm-bar-content').html(htmlRows);
}

// ============================================================
// 🎉 UI — LEVEL CHANGE OVERLAY
// ============================================================
function loadConfetti() {
    if (window.confetti || document.getElementById('rm-confetti')) return;
    const s = document.createElement('script');
    s.id = 'rm-confetti';
    s.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
    document.head.appendChild(s);
}

function fireConfetti(isUp, levelColor) {
    if (!window.confetti) return;
    if (isUp) {
        const colors = [levelColor, '#FF6BAE', '#FFD700', '#FFF'];
        const end = Date.now() + 2800;
        (function frame() {
            window.confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0 }, colors });
            window.confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1 }, colors });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    } else {
        // Use withered roses if supported, otherwise fallback to dark red "petals"
        try {
            const rose = window.confetti.shapeFromText({ text: '🥀', scalar: 3 });
            window.confetti({
                particleCount: 25, spread: 90, gravity: 1.2, ticks: 300,
                origin: { y: 0.1 }, shapes: [rose], scalar: 2
            });
        } catch (e) {
            window.confetti({
                particleCount: 50, spread: 100, gravity: 1.5, ticks: 300,
                origin: { y: 0.1 }, colors: ['#4a0404', '#8b0000', '#2b0000', '#111111'],
                shapes: ['circle', 'square'], scalar: 1.2
            });
        }
    }
}

function showLevelChangeOverlay(npcName, level, isUp) {
    $('#rm-overlay').remove();
    loadConfetti();
    setTimeout(() => fireConfetti(isUp, level.color), 400);

    const icon = isUp ? '💕' : '💔';
    const title = isUp ? 'ความสัมพันธ์ดีขึ้น!' : 'ความสัมพันธ์แย่ลง...';
    const desc = isUp
        ? `${npcName} มีความรู้สึกที่ดีขึ้นต่อคุณ`
        : `${npcName} ดูเย็นชาลงกว่าเดิม...`;

    // Dismiss function — accessible globally as safeguard
    window.rmDismissOverlay = function () {
        const $ov = $('#rm-overlay');
        if ($ov.length) {
            $ov.fadeOut(220, function () { $(this).remove(); });
        }
    };

    $('body').append(`
<div id="rm-overlay" style="
    position:fixed;inset:0;z-index:${RM_Z_OVERLAY};
    background:radial-gradient(circle at center, ${level.glow}44 0%, rgba(0,0,0,0.92) 80%);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    animation:rmFadeIn 0.35s ease;
    font-family:'Segoe UI',Tahoma,sans-serif;
    cursor:pointer;
">
<style>
    @keyframes rmFadeIn  { from{opacity:0} to{opacity:1} }
    @keyframes rmPopUp   { from{opacity:0;transform:scale(0.85) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes rmPulse   { 0%,100%{filter:drop-shadow(0 0 12px ${level.color})} 50%{filter:drop-shadow(0 0 30px ${level.color})} }
</style>
<div style="
    background:linear-gradient(145deg,rgba(18,6,32,0.98),rgba(40,16,65,0.98));
    border:1px solid ${level.color}55;border-radius:24px;
    padding:clamp(24px, 6vw, 44px) clamp(20px, 6vw, 52px);
    max-width:420px;width:90%;box-sizing:border-box;text-align:center;
    animation:rmPopUp 0.5s cubic-bezier(0.34,1.56,0.64,1);
    box-shadow:0 24px 80px rgba(0,0,0,0.9),0 0 60px ${level.glow}33;
    cursor:default;
" onclick="event.stopPropagation()">
    <div style="font-size:64px;margin-bottom:16px;animation:rmPulse 2s ease-in-out infinite;">${icon}</div>
    <div style="font-size:11px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:10px;">${title}</div>
    <div style="font-size:30px;font-weight:900;color:${level.color};text-shadow:0 0 25px ${level.glow}cc;margin-bottom:4px;">${level.name}</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-bottom:6px;">${desc}</div>
    <div style="display:inline-block;background:${level.color}18;border:1px solid ${level.color}33;border-radius:8px;padding:6px 16px;margin-top:16px;margin-bottom:22px;">
        <span style="font-size:12px;color:rgba(255,255,255,0.5);">คะแนนปัจจุบัน </span>
        <span style="font-size:14px;font-weight:800;color:${level.color};font-family:monospace;">${npcsData[npcName].points.toLocaleString()} pts</span>
    </div>
    <br>
    <button onclick="window.rmDismissOverlay()" style="
        background:linear-gradient(135deg,${level.glow},${level.color});
        color:#FFF;border:none;border-radius:50px;
        padding:11px 40px;font-size:14px;font-weight:700;cursor:pointer;
        box-shadow:0 6px 20px ${level.color}55;
    ">✓ รับทราบ</button>
</div>
</div>`);

    // Click on dark background to dismiss
    $('#rm-overlay').on('click', function () { window.rmDismissOverlay(); });

    // Auto-dismiss after 8 seconds as safety net
    setTimeout(() => { window.rmDismissOverlay(); }, 8000);
}

// ============================================================
// 📊 UI — POPUP DASHBOARD
// ============================================================
function renderPopup() {
    try {
        const currentScrollLeft = $('#rm-popup .rm-npc-btn-container').length ? $('#rm-popup .rm-npc-btn-container').scrollLeft() : 0;
        console.log('💕 [RM] renderPopup called, npcsData keys:', Object.keys(npcsData), 'charName:', state.charName);
        let items = Object.keys(npcsData).map(k => ({ name: k, ...npcsData[k] }));
        if (items.length === 0) items.push({ name: 'ไม่มีข้อมูล', points: 0, levelId: 6, lastChange: 0, history: [], avatar: '', desc: 'ระบบกำลังรอการบันทึกค่า...' });

        if (!window.rmPopupSelectedNpc || !npcsData[window.rmPopupSelectedNpc]) {
            // If the AI somehow mistakenly injected "Unknown", try selecting a real valid name first
            const validItem = items.find(i => i.name.toLowerCase() !== 'unknown') || items[0];
            window.rmPopupSelectedNpc = validItem.name;
        }

        // Make sure we have the pure base object and inject its name key
        let rawNpc = npcsData[window.rmPopupSelectedNpc];
        let currNpc = rawNpc ? { name: window.rmPopupSelectedNpc, ...rawNpc } : items[0];

        // Ensure all required properties exist (fallback name is only a safety net)
        currNpc = { points: 0, levelId: 6, lastChange: 0, history: [], avatar: '', desc: '', name: 'Unknown', ...currNpc };
        const level = getLevel(currNpc.points);

        const histHTML = currNpc.history && currNpc.history.length
            ? currNpc.history.slice(0, 10).map(h => {
                const c = h.change > 0 ? '#FF6BAE' : h.change < 0 ? '#FF6B6B' : '#888';
                const sgn = h.change > 0 ? '+' : '';
                const src = h.source === 'user' ? '🧑' : '🤖';
                const mins = Math.floor((Date.now() - h.time) / 60000);
                const t = mins < 1 ? 'เมื่อกี้' : mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`;
                return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
                <span style="font-size:14px;">${src}</span>
                <div style="flex:1; display:flex; flex-direction:column;">
                    <span style="font-size:11px;color:rgba(255,255,255,0.7);">${h.reason || (h.source === 'user' ? 'การกระทำ' : 'อัปเดต')}</span>
                    <span style="font-size:9px;color:rgba(255,255,255,0.35);">${t}</span>
                </div>
                <span style="font-size:12px;font-weight:800;color:${c};">${sgn}${h.change}</span>
                <span style="font-size:11px;color:rgba(255,255,255,0.4);font-family:monospace;min-width:44px;text-align:right;">${h.total.toLocaleString()}</span>
            </div>`;
            }).join('')
            : `<div style="text-align:center;padding:16px;color:rgba(255,255,255,0.25);font-size:12px;">ยังไม่มีประวัติ</div>`;

        const levelsHTML = LEVELS.map(l => {
            const cur = l.id === level.id;
            return `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;
            border-radius:7px;margin-bottom:2px;
            background:${cur ? l.color + '1A' : 'transparent'};
            border-left:2px solid ${cur ? l.color : 'transparent'};">
            <span style="font-size:14px;">${l.emoji}</span>
            <div style="flex:1;">
                <div style="font-size:11px;font-weight:${cur ? 700 : 400};color:${cur ? l.color : 'rgba(255,255,255,0.45)'};">${l.name}</div>
                <div style="font-size:10px;color:rgba(255,255,255,0.2);">
                    ${isFinite(l.min) ? l.min.toLocaleString() : '-∞'} ~ ${isFinite(l.max) ? l.max.toLocaleString() : '∞'}
                </div>
            </div>
            ${cur ? `<span style="font-size:10px;font-weight:700;color:${l.color};background:${l.color}22;padding:2px 8px;border-radius:20px;">NOW</span>` : ''}
        </div>`;
        }).join('');

        const nextLv = LEVELS[level.id + 1];
        let barW = 50, barText = "MAX ✨";
        if (nextLv && isFinite(level.min)) {
            const range = nextLv.min - level.min;
            const curr = currNpc.points - level.min;
            barW = Math.max(2, Math.min(100, (curr / range) * 100));
            barText = `ต้องการอีก ${(nextLv.min - currNpc.points).toLocaleString()} pts`;
        }

        const npcTabsHTML = items.length > 1 ? `<div class="rm-npc-btn-container" style="display:flex; gap:6px; overflow-x:auto; -webkit-overflow-scrolling:touch; padding:8px 14px; background:rgba(0,0,0,0.2); border-bottom:1px solid rgba(255,255,255,0.05); white-space:nowrap; touch-action:pan-x; overscroll-behavior-x:contain;">
            ${items.map(p => {
            const isActive = p.name === window.rmPopupSelectedNpc;
            const safeAttr = rmEscapeAttr(p.name);
            return `<button type="button" class="rm-npc-btn" data-name="${safeAttr}" style="
                    flex-shrink:0; padding:5px 10px; border-radius:12px; font-size:11px; font-weight:600;
                    background:${isActive ? level.color + '44' : 'rgba(255,255,255,0.05)'};
                    border:1px solid ${isActive ? level.color : 'rgba(255,255,255,0.1)'};
                    color:${isActive ? '#fff' : 'rgba(255,255,255,0.5)'}; cursor:pointer; touch-action:manipulation; -webkit-tap-highlight-color:rgba(255,255,255,0.12);
                ">${rmEscapeHtml(p.name)}</button>`;
        }).join('')}
        </div>` : '';

        const $btn = $('#rm-float-btn');
        let posCss = 'bottom:78px; right:18px;';
        if ($btn.length) {
            const rect = $btn[0].getBoundingClientRect();
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            const popW = 315;
            const gap = 12;

            let verticalPlacement = '';
            if (rect.top > winH / 2) {
                let b = winH - rect.top + gap;
                verticalPlacement = `bottom:${b}px;`;
            } else {
                let t = rect.bottom + gap;
                verticalPlacement = `top:${t}px;`;
            }

            let r = winW - rect.right;
            if (r + popW > winW - 10) r = winW - popW - 10;
            if (r < 10) r = 10;

            posCss = `${verticalPlacement} right:${r}px;`;
        }

        const s = extension_settings[EXT_NAME] || {};
        const theme1 = s.color_primary || '#7B1FA2';
        const theme2 = s.color_secondary || '#E91E8C';

        const av = currNpc.avatar || 'https://i.ibb.co/VvzYW3G/default-avatar.png';
        const lore = currNpc.desc || 'ไม่มีประวัติ ตัวละครถูกสร้างผ่าน Tracker';
        const safeName = currNpc.name.replace(/'/g, "\\'");

        let $popup = $('#rm-popup');
        if (!$popup.length) {
            $('body').append(`
<div id="rm-popup" style="
    position:fixed;${posCss}width:315px;max-width:90vw;
    background:linear-gradient(rgba(18,6,32,0.94), rgba(18,6,32,0.94)), linear-gradient(160deg,${theme1},${theme2});
    border:1px solid ${level.color}44;border-radius:18px;
    z-index:${RM_Z_POPUP};overflow:hidden;
    box-shadow:0 20px 60px rgba(0,0,0,0.85);
    font-family:'Segoe UI',Tahoma,sans-serif;
    animation:rmFadeIn 0.2s ease-out;
">
    <style>
        @keyframes rmFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes rmSlideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .rm-tab-btn { flex:1;padding:8px 4px;border:none;cursor:pointer;font-size:11px;
            font-weight:600;letter-spacing:0.5px;transition:all 0.2s;background:transparent;color:rgba(255,255,255,0.4); }
        .rm-tab-btn.active { color:#FFF;border-bottom:2px solid ${level.color}!important; }
        .rm-npc-btn::-webkit-scrollbar { display:none; }
    </style>
    <div id="rm-popup-content"></div>
</div>`);
            $popup = $('#rm-popup');
        }

        $popup.css('border', `1px solid ${level.color}44`);

        const innerHtml = `
    <div style="background:linear-gradient(90deg,${level.glow}99,${level.color}66);
        padding:12px 14px;display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="display:flex; gap:10px; align-items:center; flex:1;">
            <div style="width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,0.3);overflow:hidden;border:2px solid rgba(255,255,255,0.2);flex-shrink:0;">
                <img src="${av}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='https://i.ibb.co/VvzYW3G/default-avatar.png'">
            </div>
            <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:14px;font-weight:800;color:#FFF;letter-spacing:0.2px;">${currNpc.name}</span>
                    <button onclick="window.rmEditProfile('${safeName}')" style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:rgba(255,255,255,0.8);cursor:pointer;font-size:10px;padding:2px 6px;">⚙️ Edit</button>
                    ${currNpc.name !== 'ไม่มีข้อมูล' ? `<button onclick="window.rmDeleteNpc('${safeName}')" style="background:rgba(255,0,0,0.15);border:1px solid rgba(255,0,0,0.3);border-radius:4px;color:#ff6b6b;cursor:pointer;font-size:10px;padding:2px 6px;margin-left:4px;">🗑️ ลบ</button>` : ''}
                </div>
                <div title="${lore}" style="font-size:10px;color:rgba(255,255,255,0.7);margin-top:2px;line-height:1.2;max-height:24px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">
                    ${lore}
                </div>
            </div>
        </div>
        <button onclick="$('#rm-popup').fadeOut(150,function(){$(this).remove()})" style="cursor:pointer;background:none;border:none;color:#fff;padding-left:10px;">✕</button>
    </div>
    ${npcTabsHTML}
    <div style="padding:18px 16px 12px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="font-size:46px;font-weight:900;color:${level.color};text-shadow:0 0 35px ${level.glow}cc;line-height:1;">
            ${currNpc.points.toLocaleString()}
        </div>
        <div style="font-size:15px;margin-top:6px;">${level.name}</div>
        <div style="background:rgba(255,255,255,0.07);border-radius:4px;height:4px;margin-top:10px;overflow:hidden;">
            <div style="height:100%;width:${barW}%;background:linear-gradient(90deg,${level.glow},${level.color});"></div>
        </div>
        <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-top:4px;">${barText}</div>
    </div>
    <div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.06);">
        <button class="rm-tab-btn active" data-tab="history" style="border-bottom:2px solid ${level.color};">ประวัติ</button>
        <button class="rm-tab-btn" data-tab="levels" style="border-bottom:2px solid transparent;">ระดับทั้งหมด</button>
    </div>
    <div id="rm-pane-history" style="padding:8px 12px;max-height:165px;overflow-y:auto;">${histHTML}</div>
    <div id="rm-pane-levels" style="padding:8px 10px;max-height:165px;overflow-y:auto;display:none;">${levelsHTML}</div>
    <div style="height:12px;"></div>`;

        $('#rm-popup-content').html(innerHtml);

        const $pop = $('#rm-popup');
        $pop.off('click.rmTab', '.rm-tab-btn').on('click.rmTab', '.rm-tab-btn', function () {
            const tab = $(this).data('tab');
            $('.rm-tab-btn').removeClass('active').css('border-bottom', '2px solid transparent');
            $(this).addClass('active').css('border-bottom', `2px solid ${level.color}`);
            $('[id^="rm-pane-"]').hide();
            $(`#rm-pane-${tab}`).show();
        });

        $pop.off('pointerup.rmNpc', '.rm-npc-btn').on('pointerup.rmNpc', '.rm-npc-btn', function (e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            e.stopPropagation();
            const name = $(this).attr('data-name');
            if (!name || name === window.rmPopupSelectedNpc) return;
            window.rmPopupSelectedNpc = name;
            renderPopup();
        });

        if (currentScrollLeft > 0) {
            setTimeout(() => $('#rm-popup .rm-npc-btn-container').scrollLeft(currentScrollLeft), 0);
        }

    } catch (err) {
        console.error('💕 [RM] Error in renderPopup:', err);
    }
}

// ============================================================
// ⚙️ UI — SETTINGS PANEL (Extensions tab)
// ============================================================
function createSettingsUI() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = {
            enabled: true,
            bar_visible: false,
            score_ai: true,
            score_user: true,
            btn_pos: null,
            color_primary: '#7B1FA2',
            color_secondary: '#E91E8C'
        };
    }
    const s = extension_settings[EXT_NAME];

    // Reverting to inline string to fix PC browser loading/CORS bugs where the tab disappears
    const settingsHtml = `
<div id="rm_settings">
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>💕 Relationship Meter</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down"></div>
        </div>
        <div class="inline-drawer-content">
            <div class="flex-container" style="flex-wrap:wrap;flex-direction:column;gap:4px;">
                <label class="checkbox_label" for="rm-s-enabled">
                    <input id="rm-s-enabled" type="checkbox" ${s.enabled !== false ? 'checked' : ''} />
                    <span>เปิดใช้งาน Extension</span>
                </label>
                <label class="checkbox_label" for="rm-s-bar">
                    <input id="rm-s-bar" type="checkbox" ${s.bar_visible ? 'checked' : ''} />
                    <span>แสดงแถบคะแนน (Floating Bar)</span>
                </label>
                <label class="checkbox_label" for="rm-s-score-ai">
                    <input id="rm-s-score-ai" type="checkbox" ${s.score_ai !== false ? 'checked' : ''} />
                    <span>คิดคะแนนจากข้อความ AI/NPC Tracking</span>
                </label>
                <label class="checkbox_label" for="rm-s-score-user">
                    <input id="rm-s-score-user" type="checkbox" ${s.score_user !== false ? 'checked' : ''} />
                    <span>คิดคะแนนจากข้อความ User</span>
                </label>
                <hr style="border-color:rgba(255,255,255,0.1);width:100%;margin:6px 0;">
                <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
                    <span style="font-size:12px;">🎨 สีหลัก (Primary Color)</span>
                    <input type="color" id="rm-s-color1" value="${s.color_primary || '#7B1FA2'}" style="width:28px;height:24px;padding:0;border:none;border-radius:4px;cursor:pointer;background:none;">
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
                    <span style="font-size:12px;">🎨 สีรอง (Secondary Color)</span>
                    <input type="color" id="rm-s-color2" value="${s.color_secondary || '#E91E8C'}" style="width:28px;height:24px;padding:0;border:none;border-radius:4px;cursor:pointer;background:none;">
                </div>
                <hr style="border-color:rgba(255,255,255,0.1);width:100%;margin:6px 0;">
                <div class="flex" style="flex-wrap:wrap;gap:4px;">
                    <button id="rm-btn-manual" class="menu_button" style="width:auto;">✏️ ปรับคะแนน</button>
                    <button id="rm-btn-reset" class="menu_button" style="width:auto;">🔄 รีเซ็ตทั้งหมด</button>
                </div>
            </div>
        </div>
    </div>
</div>`;

    $('#relaex_extension_slot').remove();
    const $relaSlot = $('<div id="relaex_extension_slot" class="extension_container"></div>');
    $('#extensions_settings2').prepend($relaSlot);
    $relaSlot.html(settingsHtml);

    // Removed the custom inline-drawer toggle handler here Because SillyTavern handles it natively by default. 
    // Double handling it caused the "auto-close" bug on Mobile.

    // Event bindings
    $('#rm-s-enabled').on('change', function () {
        saveSetting('enabled', this.checked);
        if (this.checked) {
            mountFloatButton();
            renderBar();
            window.rmBindEvents();
        } else {
            window.rmUnbindEvents();
        }
    });
    $('#rm-s-bar').on('change', function () { saveSetting('bar_visible', this.checked); renderBar(); });
    $('#rm-s-score-ai').on('change', function () { saveSetting('score_ai', this.checked); });
    $('#rm-s-score-user').on('change', function () { saveSetting('score_user', this.checked); });

    $('#rm-s-color1').on('change', function () { saveSetting('color_primary', $(this).val()); $('#rm-float-btn').remove(); mountFloatButton(); });
    $('#rm-s-color2').on('change', function () { saveSetting('color_secondary', $(this).val()); $('#rm-float-btn').remove(); mountFloatButton(); });

    $('#rm-btn-manual').on('click', function () { window.rmManual(); });
    $('#rm-btn-reset').on('click', function () { window.rmReset(); });
}

function saveSetting(key, val) {
    extension_settings[EXT_NAME][key] = val;
    saveSettingsDebounced();
}

// ============================================================
// 🔘 UI — FLOATING BUTTON
// ============================================================
function mountFloatButton() {
    if ($('#rm-float-btn').length) return;

    const s = extension_settings[EXT_NAME] || {};
    const c1 = s.color_primary || '#7B1FA2';
    const c2 = s.color_secondary || '#E91E8C';

    $('body').append(`
<button id="rm-float-btn" title="Relationship Meter" style="
    position:fixed;bottom:18px;right:18px;width:48px;height:48px;
    border-radius:50%;border:none;cursor:pointer;z-index:${RM_Z_FLOAT};
    background:linear-gradient(135deg,${c1},${c2});
    box-shadow:0 4px 18px ${c2}70;
    font-size:20px;display:flex;align-items:center;justify-content:center;
    transition:box-shadow 0.18s; user-select:none; touch-action:none;
">💕</button>`);

    const $btn = $('#rm-float-btn');

    function clampButtonPosition() {
        if (!$btn.length) return;
        const rect = $btn[0].getBoundingClientRect();
        const maxLenX = window.innerWidth - 48;
        const maxLenY = window.innerHeight - 48;
        let cLeft = rect.left;
        let cTop = rect.top;
        if (cLeft > maxLenX) cLeft = maxLenX;
        if (cLeft < 0) cLeft = 0;
        if (cTop > maxLenY) cTop = maxLenY;
        if (cTop < 0) cTop = 0;
        $btn.css({ left: cLeft + 'px', top: cTop + 'px', right: 'auto', bottom: 'auto' });
    }

    if (s.btn_pos) {
        let nLeft = s.btn_pos.x;
        let nTop = s.btn_pos.y;
        const maxLeft = window.innerWidth - 48;
        const maxTop = window.innerHeight - 48;
        if (nLeft > maxLeft) nLeft = maxLeft;
        if (nLeft < 0) nLeft = 0;
        if (nTop > maxTop) nTop = maxTop;
        if (nTop < 0) nTop = 0;
        $btn.css({ bottom: 'auto', right: 'auto', left: nLeft + 'px', top: nTop + 'px' });
    }

    $(window).on('resize.rmBtn', function () {
        if (!rmDragState.active) clampButtonPosition();
    });

    // Simplified drag/click state
    const rmDragState = { active: false, moved: false, startX: 0, startY: 0, startLeft: 0, startTop: 0, lastTouch: 0, clickHandled: false, justDragged: false };
    const DRAG_THRESHOLD = 8;

    function onPointerDown(e) {
        // Touch multi-finger guard
        if (e.type === 'touchstart' && e.originalEvent.touches.length > 1) return;
        // Skip emulated mouse after touch
        if (e.type === 'touchstart') rmDragState.lastTouch = Date.now();
        if (e.type === 'mousedown' && Date.now() - rmDragState.lastTouch < 500) return;

        // Only preventDefault on touch to prevent scrolling; NOT on mouse to keep click event working
        if (e.type === 'touchstart') e.preventDefault();
        rmDragState.active = true;
        rmDragState.moved = false;

        const ev = e.type === 'touchstart' ? e.originalEvent.touches[0] : e;
        rmDragState.startX = ev.clientX;
        rmDragState.startY = ev.clientY;
        const rect = $btn[0].getBoundingClientRect();
        rmDragState.startLeft = rect.left;
        rmDragState.startTop = rect.top;

        $(document).on('mousemove.rmDrag touchmove.rmDrag', onPointerMove);
        $(document).on('mouseup.rmDrag touchend.rmDrag', onPointerUp);
    }

    function onPointerMove(e) {
        if (!rmDragState.active) return;
        const ev = e.type === 'touchmove' ? e.originalEvent.touches[0] : e;
        const dx = ev.clientX - rmDragState.startX;
        const dy = ev.clientY - rmDragState.startY;
        if (!rmDragState.moved && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        rmDragState.moved = true;
        $btn.css({ cursor: 'grabbing' });
        let newLeft = Math.max(0, Math.min(rmDragState.startLeft + dx, window.innerWidth - 48));
        let newTop = Math.max(0, Math.min(rmDragState.startTop + dy, window.innerHeight - 48));
        $btn.css({ left: newLeft + 'px', top: newTop + 'px', right: 'auto', bottom: 'auto' });
    }

    function onPointerUp(e) {
        // Skip emulated mouseup after touchend
        if (e.type === 'mouseup' && Date.now() - rmDragState.lastTouch < 500) return;
        const wasMoved = rmDragState.moved;
        rmDragState.active = false;
        rmDragState.moved = false;
        $btn.css({ cursor: 'pointer' });
        $(document).off('mousemove.rmDrag touchmove.rmDrag mouseup.rmDrag touchend.rmDrag');

        if (wasMoved) {
            // Save new position after drag
            rmDragState.justDragged = true;
            const rect = $btn[0].getBoundingClientRect();
            saveSetting('btn_pos', { x: rect.left, y: rect.top });
        } else {
            // This was a click — toggle popup
            rmDragState.clickHandled = true;
            $('#rm-overlay').remove(); // Clear any stale overlay blocking the view
            console.log('💕 [RM] Button clicked via pointerUp, toggling popup');
            if ($('#rm-popup').length) {
                $('#rm-popup').fadeOut(150, function () { $(this).remove(); });
            } else {
                renderPopup();
            }
        }
    }

    $btn.on('mousedown touchstart', onPointerDown);

    $btn.on('mouseenter', function () { if (!rmDragState.active) $(this).css({ boxShadow: `0 6px 28px ${c2}AA` }); })
        .on('mouseleave', function () { if (!rmDragState.active) $(this).css({ boxShadow: `0 4px 18px ${c2}70` }); });

    // Fallback click handler — guarantees popup toggle even if mouseup flow fails
    $btn.on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        // If drag just happened, skip (onPointerUp already toggled)
        if (rmDragState.justDragged) {
            rmDragState.justDragged = false;
            return;
        }
        // If onPointerUp already handled it (popup exists or was just rendered), skip
        if (rmDragState.clickHandled) {
            rmDragState.clickHandled = false;
            return;
        }
        console.log('💕 [RM] Fallback click handler triggered');
        if ($('#rm-popup').length) {
            $('#rm-popup').fadeOut(150, function () { $(this).remove(); });
        } else {
            renderPopup();
        }
    });
}

// ============================================================
// 🌐 GLOBAL ACTIONS
// ============================================================
window.rmReset = function () {
    if (!confirm(`รีเซ็ตคะแนนความสัมพันธ์ทั้งหมดใช่ไหม?\n(ข้อมูลทั้งหมดจะถูกล้าง)`)) return;
    resetStateValues();
    saveState();
    renderBar();
    $('#rm-popup').remove();
    renderPopup();
};

window.rmDeleteNpc = function (npcName) {
    if (!confirm(`คุณต้องการลบข้อมูลของ ${npcName} ใช่หรือไม่?`)) return;
    delete npcsData[npcName];
    saveState();
    window.rmPopupSelectedNpc = null;
    if ($('#rm-popup').length) {
        renderPopup();
    }
    renderBar();
};

window.rmManual = function () {
    const names = Object.keys(npcsData);
    if (names.length === 0) names.push(state.charName);

    let targetName = names[0];
    if (names.length > 1) {
        const nameList = names.map((n, i) => `${i + 1}. ${n}`).join('\n');
        const inputName = prompt(`เลือกตัวละครที่จะปรับคะแนน:\n${nameList}`, "1");
        if (!inputName) return;
        const idx = parseInt(inputName, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= names.length) { alert('ไม่พอดีกับตัวเลือก'); return; }
        targetName = names[idx];
    }

    const input = prompt(`ปรับคะแนนให้ ${targetName} (ใส่ตัวเลข เช่น +50 หรือ -30 หรือตัวเลขสุทธิ):\nคะแนนปัจจุบัน: ${npcsData[targetName]?.points || 0}`, '');
    if (!input) return;

    let valStr = input.trim();
    if (valStr.startsWith('+') || valStr.startsWith('-')) {
        const change = parseInt(valStr.replace('+', ''), 10);
        if (isNaN(change)) { alert('กรุณาใส่ตัวเลข'); return; }
        applyNpcScore(targetName, change, 'manual', 'ปรับคะแนนเอง');
    } else {
        const absolute = parseInt(valStr, 10);
        if (isNaN(absolute)) { alert('กรุณาใส่ตัวเลข'); return; }
        const old = npcsData[targetName]?.points || 0;
        applyNpcScore(targetName, absolute - old, 'manual', 'ปรับคะแนนเอง');
    }

    $('#rm-popup').remove();
    renderPopup();
};

window.rmEditProfile = function (name) {
    const npc = npcsData[name];
    if (!npc) return;
    $('#rm-profile-modal').remove();

    const head = rmEscapeHtml(name);
    $('body').append(`
<div id="rm-profile-modal" style="position:fixed;inset:0;z-index:${RM_Z_MODAL};background:rgba(0,0,0,0.62);display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));box-sizing:border-box;font-family:'Segoe UI',Tahoma,sans-serif;">
    <div style="background:linear-gradient(145deg,rgba(18,6,32,0.98),rgba(40,16,65,0.98));border:1px solid rgba(255,255,255,0.14);border-radius:16px;max-width:420px;width:100%;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,0.85);">
        <div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:12px;">แก้โปรไฟล์: ${head}</div>
        <label style="display:block;font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:4px;">URL รูปภาพ (เว้นว่างแล้วกดบันทึก = ลบ URL ใช้รูปเริ่มต้น)</label>
        <input id="rm-modal-avatar" type="text" class="text_pole" style="width:100%;box-sizing:border-box;margin-bottom:12px;" placeholder="https://..." autocomplete="off" />
        <label style="display:block;font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:4px;">คำอธิบาย / ประวัติสั้น</label>
        <textarea id="rm-modal-desc" class="text_pole" style="width:100%;box-sizing:border-box;min-height:72px;resize:vertical;margin-bottom:14px;"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;align-items:center;">
            <button type="button" id="rm-modal-clear-av" class="menu_button" style="margin-right:auto;">ล้าง URL รูป</button>
            <button type="button" id="rm-modal-cancel" class="menu_button">ยกเลิก</button>
            <button type="button" id="rm-modal-save" class="menu_button">บันทึก</button>
        </div>
    </div>
</div>`);

    $('#rm-modal-avatar').val(npc.avatar || '');
    $('#rm-modal-desc').val(npc.desc || '');

    const closeModal = () => { $('#rm-profile-modal').remove(); };

    $('#rm-profile-modal').on('click.rmProf', function (e) {
        if (e.target.id === 'rm-profile-modal') closeModal();
    });

    $('#rm-modal-cancel').on('click.rmProf', closeModal);
    $('#rm-modal-clear-av').on('click.rmProf', () => { $('#rm-modal-avatar').val(''); });

    $('#rm-modal-save').on('click.rmProf', () => {
        const vAv = $('#rm-modal-avatar').val().trim();
        const vDesc = $('#rm-modal-desc').val().trim();
        if (vAv) npcsData[name].avatar = vAv;
        else delete npcsData[name].avatar;
        npcsData[name].desc = vDesc;
        saveState();
        closeModal();
        if ($('#rm-popup').length) {
            const sc = $('#rm-popup .rm-npc-btn-container').length ? $('#rm-popup .rm-npc-btn-container').scrollLeft() : 0;
            renderPopup();
            if (sc > 0) setTimeout(() => $('#rm-popup .rm-npc-btn-container').scrollLeft(sc), 0);
        }
        renderBar();
    });
};

let rmEventsBound = false;

function rmHandleChatChanged() {
    setTimeout(() => {
        const c = getContext();
        if (c?.characterId) {
            loadState(c.characterId, c.name2);

            // Sync with Chat History (for cross-device synchronization and enforcing Lore values)
            if (c.chat && c.chat.length > 0) {
                // Find LATEST AI message with a tracker div
                const aiMsgs = [...c.chat].filter(m => !m.is_user && m.mes && m.mes.includes('rel-tracker'));
                if (aiMsgs.length > 0) {
                    const latestMsg = aiMsgs[aiMsgs.length - 1];
                    try {
                        window.rmSilentSyncMode = true; // Prevent popup alerts during background sync
                        processRelTrackerDiv(latestMsg.mes);
                        window.rmSilentSyncMode = false;
                        saveState(); // Ensure updated lore values are saved
                    } catch (e) {
                        window.rmSilentSyncMode = false;
                    }
                }
            }

            renderBar();
            $('#rm-popup').remove();
        }
    }, 600);
}

function rmHandleMessageReceived() {
    const s = extension_settings[EXT_NAME];
    if (!s?.enabled || !s?.score_ai) return;
    // Delay to ensure message is fully available (streaming support)
    setTimeout(() => {
        try {
            const c = getContext();
            if (!c?.chat?.length) return;
            const last = c.chat[c.chat.length - 1];
            if (!last || last.is_user) return;

            const mesText = last.mes || '';
            console.log('💕 [RM] MESSAGE_RECEIVED, text length:', mesText.length,
                'has rel-tracker:', mesText.includes('rel-tracker'));

            const hasTracker = processRelTrackerDiv(mesText);

            // By user request: "ค่ามาจากลอร์เท่านั้น" (Values must come from Lore ONLY).
            // We disable calculateScoreFallback entirely if there is a tracking div or strictly rely on AI outputs.
            // Keeping the fallback logic minimal or off if LORE tracking is the primary source.
            if (!hasTracker && !s?.score_ai_strict) {
                // If you want to force lore only, you might skip this completely
                // But for backwards compability, we'll keep it unless we want to strip it.
                // Reqiurement: "ดึงค่าจาก ลอร์บุ้ค ... ค่ามาจากลอร์เท่านั้น"
                // Let's rely ONLY on the rel-tracker div! So we do nothing if not found!
            }
        } catch (err) {
            console.error('💕 [RM] Error in MESSAGE_RECEIVED handler:', err);
        }
    }, 1500);
}

function rmHandleUserMessage() {
    const s = extension_settings[EXT_NAME];
    // Disabled fallback score evaluation from User text to enforce "Lore Only" points
    // if (!s?.enabled || !s?.score_user) return;
    // const c = getContext(); ...
}

let rmRenderInterval = null;

window.rmBindEvents = function () {
    if (rmEventsBound) return;
    eventSource.on(event_types.CHAT_CHANGED, rmHandleChatChanged);
    eventSource.on(event_types.MESSAGE_RECEIVED, rmHandleMessageReceived);
    eventSource.on(event_types.USER_MESSAGE_RENDERED, rmHandleUserMessage);
    rmRenderInterval = setInterval(() => {
        const s = extension_settings[EXT_NAME];
        if (s?.enabled && s?.bar_visible) renderBar();
    }, 5000);
    rmEventsBound = true;
    console.log('💕 [RM] Events Bound');
};

window.rmUnbindEvents = function () {
    if (!rmEventsBound) return;
    eventSource.removeListener(event_types.CHAT_CHANGED, rmHandleChatChanged);
    eventSource.removeListener(event_types.MESSAGE_RECEIVED, rmHandleMessageReceived);
    eventSource.removeListener(event_types.USER_MESSAGE_RENDERED, rmHandleUserMessage);
    if (rmRenderInterval) clearInterval(rmRenderInterval);
    rmEventsBound = false;
    $('#rm-float-btn, #rm-bar, #rm-popup, #rm-overlay').remove();
    console.log('💕 [RM] Events Unbound / Extension Disabled');
};

// ============================================================
// 🚀 INIT
// ============================================================
jQuery(async () => {
    createSettingsUI();
    loadConfetti();

    if (extension_settings[EXT_NAME]?.enabled !== false) {
        mountFloatButton();
        const ctx = getContext();
        if (ctx?.characterId) {
            loadState(ctx.characterId, ctx.name2);
        }
        renderBar();
        window.rmBindEvents();
    }

    console.log('💕 Relationship Meter Multi-NPC 10k loaded!');
});
