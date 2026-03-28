// ============================================================
// 💕 Relationship Meter — SillyTavern Extension
// Dating Sim Style | Multi-NPC Tracking | 10k Scale
// ============================================================
// วางไฟล์นี้ใน: /public/scripts/extensions/third-party/relationship-meter/
// ============================================================

import { eventSource, event_types, saveSettingsDebounced } from "../../../../script.js";
import { extension_settings, getContext } from "../../../extensions.js";

const EXT_NAME = "relationship_meter";

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
                        const name = parts[0];
                        if (!name || name.length === 0) return;
                        const cleanScore = parts[1].replace(/,/g, '').replace(/\+/g, '').trim();
                        const currentScore = parseInt(cleanScore, 10);

                        if (!isNaN(currentScore)) {
                            if (!npcsData[name]) {
                                npcsData[name] = { points: 0, levelId: 6, lastChange: 0, history: [], avatar: '', desc: '' };
                            }
                            const oldPoints = npcsData[name].points;
                            const change = currentScore - oldPoints;
                            console.log(`💕 [RM] NPC: ${name} | old: ${oldPoints} | new: ${currentScore} | change: ${change}`);

                            if (change !== 0) {
                                applyNpcScore(name, change, 'ai', parts[4] || 'Update Tracker');
                                anyUpdated = true;
                            } else {
                                // Even if change is 0, ensure points match tracker value
                                npcsData[name].points = currentScore;
                                npcsData[name].levelId = getLevel(currentScore).id;
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
    if (entries.length === 0) {
        entries.push({ name: state.charName, points: 0, levelId: 6, lastChange: 0 });
    }

    let htmlRows = entries.map(ent => {
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

    const html = `
<div id="rm-bar" style="
    position:fixed; top:10px; left:50%; transform:translateX(-50%);
    z-index:99999; width:380px; max-width:95vw; max-height:40vh; overflow-y:auto;
    background:linear-gradient(135deg,rgba(15,5,25,0.95) 0%,rgba(35,12,55,0.95) 100%);
    border:1px solid rgba(255,255,255,0.1); border-radius:12px;
    padding:10px 14px; pointer-events:auto;
    box-shadow:0 6px 30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06);
    backdrop-filter:blur(12px);
    font-family:'Segoe UI',Tahoma,sans-serif;
">
    <style>#rm-bar::-webkit-scrollbar { width:4px; } #rm-bar::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.2); border-radius:4px; }</style>
    ${htmlRows}
</div>`;

    if ($('#rm-bar').length) $('#rm-bar').replaceWith(html);
    else $('body').append(html);
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
    position:fixed;inset:0;z-index:9999999;
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
    padding:44px 52px;max-width:420px;width:90%;text-align:center;
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
    $('#rm-popup').remove(); // Always clean up first
    console.log('💕 [RM] renderPopup called, npcsData keys:', Object.keys(npcsData), 'charName:', state.charName);
    let items = Object.keys(npcsData).map(k => ({ name: k, ...npcsData[k] }));
    if (items.length === 0) items.push({ name: state.charName || 'Unknown', points: 0, levelId: 6, lastChange: 0, history: [], avatar: '', desc: '' });

    if (!window.rmPopupSelectedNpc || !npcsData[window.rmPopupSelectedNpc]) {
        window.rmPopupSelectedNpc = items[0].name;
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

    const npcTabsHTML = items.length > 1 ? `<div style="display:flex; gap:6px; overflow-x:auto; padding:8px 14px; background:rgba(0,0,0,0.2); border-bottom:1px solid rgba(255,255,255,0.05); white-space:nowrap;">
            ${items.map(p => {
        const isActive = p.name === window.rmPopupSelectedNpc;
        return `<button class="rm-npc-btn" data-name="${p.name}" style="
                    padding:5px 10px; border-radius:12px; font-size:11px; font-weight:600;
                    background:${isActive ? level.color + '44' : 'rgba(255,255,255,0.05)'};
                    border:1px solid ${isActive ? level.color : 'rgba(255,255,255,0.1)'};
                    color:${isActive ? '#fff' : 'rgba(255,255,255,0.5)'}; cursor:pointer;
                ">${p.name}</button>`;
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
    const bg1 = '#0E051A';
    const bg2 = '#200C34';

    const av = currNpc.avatar || 'https://i.ibb.co/VvzYW3G/default-avatar.png';
    const lore = currNpc.desc || 'ไม่มีประวัติ ตัวละครถูกสร้างผ่าน Tracker';
    const safeName = currNpc.name.replace(/'/g, "\\'");

    $('body').append(`
<div id="rm-popup" style="
    position:fixed;${posCss}width:315px;
    background:linear-gradient(160deg,${bg1}F8,${bg2}F8);
    border:1px solid ${level.color}44;border-radius:18px;
    z-index:99998;overflow:hidden;
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
    <div style="padding:10px 12px;border-top:1px solid rgba(255,255,255,0.05);display:flex;gap:6px;">
        <button onclick="window.rmReset()" style="flex:1;padding:7px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:rgba(255,255,255,0.4);font-size:11px;cursor:pointer;">🔄 รีเซ็ตทั้งหมด</button>
        <button onclick="window.rmManual()" style="flex:1;padding:7px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:rgba(255,255,255,0.4);font-size:11px;cursor:pointer;">✏️ ปรับคะแนน</button>
    </div>
</div>`);

    $(document).off('click', '.rm-tab-btn').on('click', '.rm-tab-btn', function () {
        const tab = $(this).data('tab');
        $('.rm-tab-btn').removeClass('active').css('border-bottom', '2px solid transparent');
        $(this).addClass('active').css('border-bottom', `2px solid ${level.color}`);
        $('[id^="rm-pane-"]').hide();
        $(`#rm-pane-${tab}`).show();
    });

    $(document).off('click', '.rm-npc-btn').on('click', '.rm-npc-btn', function () {
        window.rmPopupSelectedNpc = $(this).data('name');
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
async function createSettingsUI() {
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

    // Clean up old unused color keys
    delete s.btn_color1; delete s.btn_color2; delete s.bg_color1; delete s.bg_color2;

    const extensionUrl = import.meta.url.replace('/index.js', '');
    let settingsHtml;
    try {
        settingsHtml = await $.get(`${extensionUrl}/settings.html`);
    } catch (err) {
        console.error('💕 [RM] Failed to load settings.html', err);
        return;
    }

    $('#rm_settings').remove();
    $('#extensions_settings2').append(settingsHtml);

    // Apply saved values to the loaded HTML form
    $('#rm-s-enabled').prop('checked', !!s.enabled);
    $('#rm-s-bar').prop('checked', !!s.bar_visible);
    $('#rm-s-score-ai').prop('checked', !!s.score_ai);
    $('#rm-s-score-user').prop('checked', !!s.score_user);
    $('#rm-s-color1').val(s.color_primary || '#7B1FA2');
    $('#rm-s-color2').val(s.color_secondary || '#E91E8C');

    // Make the standard inline drawer toggle work for our injected HTML
    $('#extensions_settings2').off('click', '#rm_settings .inline-drawer-toggle').on('click', '#rm_settings .inline-drawer-toggle', function () {
        $(this).next('.inline-drawer-content').stop().slideToggle(200);
        $(this).find('.inline-drawer-icon').toggleClass('down up');
    });

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
    border-radius:50%;border:none;cursor:pointer;z-index:99997;
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
    if (!npcsData[name]) return;
    const newAvatar = prompt(`[1/2] ระบุ URL รูปภาพ (API Link) สำหรับ ${name}\n(ทิ้งว่างไว้เพื่อใช้รูปเดิม):`, npcsData[name].avatar || '');
    if (newAvatar !== null) {
        if (newAvatar.trim() !== '') npcsData[name].avatar = newAvatar.trim();
        else if (newAvatar === '') delete npcsData[name].avatar;

        const newDesc = prompt(`[2/2] ระบุคำอธิบาย/ประวัติสั้นๆ สำหรับ ${name}:`, npcsData[name].desc || '');
        if (newDesc !== null) npcsData[name].desc = newDesc.trim();

        saveState();
        $('#rm-popup').remove();
        renderPopup();
    }
};

let rmEventsBound = false;

function rmHandleChatChanged() {
    setTimeout(() => {
        const c = getContext();
        if (c?.characterId) {
            loadState(c.characterId, c.name2);
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
            if (!hasTracker) {
                const change = calculateScoreFallback(mesText);
                if (change !== 0) {
                    applyNpcScore(state.charName, change, 'ai', 'Legacy Keyword Match');
                }
            }
        } catch (err) {
            console.error('💕 [RM] Error in MESSAGE_RECEIVED handler:', err);
        }
    }, 1500);
}

function rmHandleUserMessage() {
    const s = extension_settings[EXT_NAME];
    if (!s?.enabled || !s?.score_user) return;
    const c = getContext();
    if (!c?.chat?.length) return;
    const last = [...c.chat].reverse().find(m => m.is_user);
    if (!last) return;

    const change = calculateScoreFallback(last.mes || '');
    if (change !== 0) {
        applyNpcScore(state.charName, change, 'user', 'Legacy Keyword Match');
    }
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
