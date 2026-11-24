# CampusMate MCP: 3-Minute Video Script & Storyboard

**Project Name:** CampusMate MCP  
**Team Name:** Logic Squad  
**Hackathon Track:** Track 1 – Make MCP Matter  
**Target Duration:** Exactly 180 Seconds (3:00)  
**Video Resolution:** 1920x1080 (16:9 Full HD, 30fps)  
**Audio Asset:** `CampusMate_Full_Narration.wav` (Duration: 178.5s)  
**Subtitle Asset:** `CampusMate_Demo_Captions.srt` / `CampusMate_Demo_Captions.vtt`  
**Video Output:** `CampusMate_MCP_Demo_Presentation.mp4`  

---

## Detailed Timeline & Storyboard Matrix

| Timestamp | Segment Name | Visual Scene / Screen Recording | On-Screen Caption | Narration Voiceover |
| :---: | :--- | :--- | :--- | :--- |
| **0:00 – 0:10** | Title Screen & Identity | High-contrast collegiate dark green title screen with gold accents: `CampusMate MCP`, `Team Logic Squad`, `Track 1: Make MCP Matter`. | *CampusMate MCP · Track 1: Make MCP Matter · Team Logic Squad* | *"Welcome to CampusMate MCP, built by team Logic Squad for Track 1: Make MCP Matter."* |
| **0:10 – 0:20** | Project Mission | Animated camera zooms smoothly into the tagline card: *"Your college life, in your AI assistant, and nothing happens without your yes."* Quick flash of the live dashboard. | *"Your college life, in your AI assistant, and nothing happens without your yes."* | *"CampusMate solves an everyday student challenge: managing academic life through an AI assistant you can truly trust."* |
| **0:20 – 0:32** | The Student Reality | Visual montage of 4 browser tabs: a clunky attendance ERP portal, a noisy WhatsApp circular chat, Google Classroom deadlines, and a crumpled timetable photo. | *Student data fragmented across 5+ disconnected channels* | *"Everyday student life is scattered across attendance portals, WhatsApp circulars, Google Classroom, and timetable photos."* |
| **0:32 – 0:45** | Academic Stakes & AI Trust Gap | Highlight on the 75% attendance rule and fear of exam debarment. Shows a red warning badge: *"Generic AI cannot be trusted with autonomous execution."* | *75% Attendance cutoff · Debarment risk · Chatbot trust deficit* | *"Missing the 75% attendance cutoff can mean exam debarment. Writing to faculty takes endless hesitation. Generic chatbots are blind to personal data, and students cannot trust autonomous bots to send emails or change records."* |
| **0:45 – 0:58** | Introducing CampusMate | Smooth transition to CampusMate web dashboard (`/`). Camera pans across Today's classes (DBMS, OS, CN, ML) and upcoming assignment countdowns. | *CampusMate MCP: Open MCP Server + Student Control Dashboard* | *"Enter CampusMate MCP: an open Model Context Protocol server paired with a dedicated companion student dashboard."* |
| **0:58 – 0:10** (1:10) | The Dual Architecture | Animated graphic showing Claude on the left, CampusMate Server in the middle, and the Student Dashboard on the right with the approval barrier. | *The AI can only propose · Only the student approves* | *"The AI assistant gains rich, structured context about classes, assignments, circulars, and attendance. Our core governance guarantee: The AI can only propose. Only the student can approve in the dashboard."* |
| **1:10 – 1:25** | Demo 1: Attendance Intelligence | Live recording of Claude / Inspector prompt: *"Can I skip OS tomorrow?"* Highlights `get_attendance(OS)` tool execution. Output: 40/52 held (76.9%). Result: `canMiss: 1`. | *Live Demo: Deterministic Attendance Calculation (Zero Hallucination)* | *"Let's see a live demonstration. A student asks Claude: 'Can I skip Operating Systems class tomorrow?' CampusMate executes get_attendance. Using deterministic code math, it computes 40 of 52 classes attended: 76.9%."* |
| **1:25 – 1:35** | Demo 1 Math Callout | Callout box showing the exact formula: `floor(attended / 0.75 - held) = 1`. Claude displays: *"You can miss 1 more class."* | *Calculated in TypeScript code · Never guessed by the LLM* | *"The AI reports: 'You can miss 1 more class and remain above 75%.' Zero mathematical hallucination."* |
| **1:35 – 1:45** | Demo 2: Governed Email Action | Student prompts: *"Email Prof. Rao for a 2-day extension on DBMS."* Shows `draft_faculty_email` tool call. Claude states: *"Waiting for approval in CampusMate."* | *Live Demo: Governed Faculty Email Proposal* | *"Next, the student asks: 'Email Professor Rao for a 2-day extension on the DBMS assignment.' The AI calls draft_faculty_email. It does not send an email—it creates a pending card in CampusMate."* |
| **1:45 – 1:55** | Demo 2: Review & Approval | Switch to CampusMate **Approvals** tab. Approvals badge updates to `1`. Show card with verified email (`k.rao@college.example.edu`). Edit body line $\rightarrow$ click **Approve** $\rightarrow$ confirmation modal $\rightarrow$ success! | *Student inspects, edits draft, and approves with confirmation* | *"In the dashboard, the student reviews the verified recipient, edits the draft, and clicks Approve."* |
| **1:55 – 2:08** | Why MCP Matters | Split-screen diagram contrasting standard LLMs vs. MCP-connected tools. Highlights the open protocol standard linking AI to SQLite. | *Why MCP Matters: Grounded Context + Open Interoperability* | *"Why does MCP matter? It transforms conversational AI into a grounded everyday assistant connected to real databases."* |
| **2:08 – 2:18** | Dual Security Boundary | Zoom in on architecture diagram showing the Bearer token path at `POST /mcp` vs. httpOnly Session Cookie at `/api/*`. Highlights: *No approve tool in MCP.* | *Dual Security: Bearer Token (MCP) vs. httpOnly Session Cookie (API)* | *"Our dual-channel architecture strictly isolates the AI's Bearer token from the dashboard's authenticated session cookie. The MCP endpoint has zero approval tools. The AI literally cannot approve its own proposals."* |
| **2:18 – 2:28** | Permissions & Injection Defense | Screen recording of the **Permissions** tab toggling off *"Draft emails"*. Quick display of the seeded prompt injection notice (`nt-os-record`) contained as a pending card. | *Per-tool ability killswitches · Prompt injection containment* | *"Per-tool permission killswitches let students disable any capability instantly with full transparency in the Activity log. Even when untrusted circulars contain prompt injection, the attack is safely contained to a pending card that is easily rejected."* |
| **2:28 – 2:42** | Production Tech Stack | Grid display of technology logos and badges: Node 24, TypeScript Strict, Hono 4, SQLite, React 19, Zod 4, Vitest, Render. Highlights: `239 tests passing`. | *Node 24 · TypeScript 7 · Hono · SQLite · React 19 · 239 Tests* | *"CampusMate is built on Node 24 with native TypeScript, Hono, SQLite, React 19, and the official MCP SDK. It is verified by 239 automated tests with 96% code coverage and deployed live on Render."* |
| **2:42 – 2:52** | Value & Hackathon Impact | High-impact motion graphic showing student daily utility: morning briefings, zero missed deadlines, and transparent audit trails. | *Everyday Student Utility · Governed AI Agency · Track 1 Winner* | *"CampusMate makes MCP matter by providing everyday student utility protected by unwavering human consent."* |
| **2:52 – 3:00** | Final Closing Screen | Hero conclusion screen with live deployment link (`campusmate-ulnc.onrender.com`), GitHub repository link, and team identity: `Logic Squad`. | *CampusMate MCP · Team Logic Squad · Track 1: Make MCP Matter* | *"We are Team Logic Squad for Track 1: Make MCP Matter. Thank you!"* |

---

## Audio-Visual Production Specifications

- **Aspect Ratio:** 16:9 Widescreen (1920x1080)
- **Framerate:** 30 FPS
- **Color Grade:** Collegiate Forest Green (`#14382A`), Campus Cream (`#F9F8F5`), Accent Collegiate Gold (`#C8963E`)
- **Subtitle Typography:** Segoe UI / Inter, 32pt, white text with semi-transparent black pill box (`rgba(0,0,0,0.7)`)
- **Audio Mix:**
  - Voiceover Narration: Normalized to -14 LUFS, centered, high-pass filter at 80Hz.
  - Background Music: Soft, uplifting collegiate acoustic / ambient piano bed ducked to -24 dB during voiceover.
