[Extension Update] Relationship Meter: Multi-NPC Tracking & 10k Score Scale! 💕
Hey r/SillyTavernAI! I've heavily modified the existing Relationship Meter extension to be much more dynamic and handle more hardcore RPG / dating sim mechanics for multiple characters in the same chat!

If you want to track relationships for multiple NPCs simultaneously, support a vast -10,000 to +10,000 rating scale, and explicitly manage scores using the AI via a hidden HTML div, this is exactly what you need.

✨ Features
Multi-NPC Tracking: The extension now tracks multiple NPCs independently in the same chat based on the AI's hidden tracker div outputs. The dashboard automatically registers new NPCs and creates a new tab for each character's history.
13-Level / 10k Point Scale: Expanded the relationship tracking scale from a simple 0-11 to a hardcore range from -10,000 (Broken 💀) to +10,000 (Soulbound ★).
Fully Draggable UI: You can drag the floating "💕" button anywhere on your screen. The dashboard popup will intelligently render itself above or below the button dynamically so it never flies off your screen.
AI "Hidden Div" Tracking: Instead of just relying on regex keywords, the AI precisely manages logic and scores using a display:none hidden HTML div at the end of its response. You won't see the text clutter, but the extension reads it beautifully!
📥 Installation & Setup
Go to your SillyTavern extensions folder: data/default-user/extensions/third-party/relationship-meter/ (or your equivalent RelateExt folder name).
Open 
index.js
.
Replace the entire code with the updated version right here: (Insert pastebin/gist link here)
Refresh SillyTavern (F5).
