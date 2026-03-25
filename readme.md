# [Extension Update] Relationship Meter: Multi-NPC Tracking & 10k Score Scale! 💕

Hey r/SillyTavernAI! I've heavily modified the existing **Relationship Meter** extension to be much more dynamic and handle more hardcore RPG / dating sim mechanics for multiple characters in the same chat! 

If you want to track relationships for multiple NPCs simultaneously, support a vast -10,000 to +10,000 rating scale, and explicitly manage scores using the AI via a hidden HTML div, this is exactly what you need.

---

## ✨ Features

*   **Multi-NPC Tracking**: The extension now tracks multiple NPCs independently in the same chat based on the AI's hidden tracker div outputs. The dashboard automatically registers new NPCs and creates a new tab for each character's history.
*   **13-Level / 10k Point Scale**: Expanded the relationship tracking scale from a simple 0-11 to a hardcore range from `-10,000` (Broken 💀) to `+10,000` (Soulbound ★).
*   **Fully Draggable UI**: You can drag the floating "💕" button anywhere on your screen. The dashboard popup will intelligently render itself above or below the button dynamically so it never flies off your screen.
*   **AI "Hidden Div" Tracking**: Instead of just relying on regex keywords, the AI precisely manages logic and scores using a `display:none` hidden HTML div at the end of its response. You won't see the text clutter, but the extension reads it beautifully!

---

## 📥 Installation & Setup

1. Go to your SillyTavern extensions folder: `data/default-user/extensions/third-party/relationship-meter/` (or your equivalent RelateExt folder name).
2. Open [index.js](file:///e:/SillyTavern/SillyTavern/data/default-user/extensions/RelateExt/index.js).
3. Replace the entire code with the updated version right here: *(Insert pastebin/gist link here)*
4. Refresh SillyTavern (F5).

---

## 🤖 Jailbreak / System Prompt Injection

To make the AI natively output the hidden Div format the extension reads, add this exact prompt into your **Jailbreak**, **System Prompt**, or **Author's Note**!

```text
[SYSTEM OVERRIDE : REL_TRACKER 10k Scale]
Rules: Start scores based on lore (Lovers:3k-5k, Siblings:1k-6k, Enemies:-2k, etc.). Track all named NPCs interacting with {{user}}. Append hidden div at END of EVERY reply.

[SCORE_EVENTS]
Positive (Negative uses same scale but minus):
+50~150: Small kindness, micro-interaction.
+150~300: Meaningful act, gift, saved from minor trouble.
+300~500: Deep confession, romantic shift, major sacrifice.
+500+: Life-changing event, extreme trauma/bond.

[TIERS & BEHAVIOR (Max 10000 / Min -10000)]
10000 ★ SOULBOUND: One soul. Inseparable. Fiercely protects Main Character [Player] unprompted. Extreme devotion/jealousy.
8000~9999 ♥ DEVOTED: Blindly loyal. Will cross moral lines for {{user}}. Enraged if others hurt them.
6000~7999 💖 INTIMATE: Deepest trust. Shares darkest secrets. Prioritizes {{user}} above own needs.
4000~5999 💛 TRUSTED: Reliable ally. Defends {{user}} behind their back. High comfort level.
2000~3999 🤝 FRIENDLY: Warm, smiles often. Gives benefit of the doubt. Seeks company.
500~1999 🌱 ACQUAINTED: Cautious but open. Polite small talk.
-499~499 😐 NEUTRAL: Indifferent. Reacts based on social pressure or logic, not emotion.
-500~-1999 🌧️ TENSE: Awkward/Suspicious. Keeps distance. Passive-aggressive remarks.
-2000~-3999 ❄️ COLD: Avoids entirely. Polite but freezing hostility.
-4000~-5999 ⚡ HOSTILE: Sarcastic. Actively dislikes. Subtle sabotage without breaking laws.
-6000~-7999 🔥 ENEMY: Openly opposes. Plots against, wishes ill. Will exploit weaknesses.
-8000~-9999 ☠️ NEMESIS: Active vendetta. Sends threats/harm. Obsessive hate.
-10000 💀 BROKEN: Point of no return. Irredeemable blood feud. Death wish.

[REALISM_LOGIC]
- Max change per scene: ±500 (unless extreme climax).
- No sudden mood flips. History matters.
- Behaviors MUST align with NPC's core personality.
- Show, don't tell, the tier through narrative actions/dialogue.

[HIDDEN_DIV_FORMAT]
Append exactly this at the end of message (invisible to user):
<div style="display:none" id="rel-tracker">
NPC_Name | Score | Tier | Chg | Reason
</div>
```

---
Let me know if you run into any issues or have feature requests! Happy Roleplaying! 💕
