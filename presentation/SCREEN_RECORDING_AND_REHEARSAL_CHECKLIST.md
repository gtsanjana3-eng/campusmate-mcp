# CampusMate MCP: Screen Recording & Final Rehearsal Checklist

**Project Name:** CampusMate MCP  
**Team Name:** Logic Squad  
**Hackathon Track:** Track 1 – Make MCP Matter  
**Live URL:** `https://campusmate-ulnc.onrender.com`  

---

## 1. Pre-Recording Environment Setup

- [ ] **Wake Up Free Render Instance:**
  - Open `https://campusmate-ulnc.onrender.com` in a browser tab at least 3 minutes before recording.
  - Render free tier instances sleep after 15 minutes of inactivity; the initial wake-up takes ~50 seconds. Verify the health badge returns 200 OK before starting.
- [ ] **Local Backup Environment (Offline Insurance):**
  - Keep a local terminal open in `C:\Users\SANJANA G T\Documents\campusmate-mcp`.
  - In case the network is unstable during a live judging session, execute:
    ```bash
    npm run dev:server
    npm run dev:web
    ```
    This serves the server at `http://localhost:8787` and dashboard at `http://localhost:5173`.
- [ ] **Reset Demo Data:**
  - Run `npm run seed` or verify that the seeded student **Ananya** with 6 subjects (DBMS, OS, CN, SE, ML, PE) is active.
- [ ] **Display & Browser Settings:**
  - Browser resolution: 1920x1080 (100% zoom scale).
  - Hide browser bookmarks bar and extensions (`Ctrl + Shift + B`).
  - Clear existing pending approvals or activity logs so the dashboard starts in a clean state.

---

## 2. Screen-by-Screen Recording Checklist

### Screen 1: Dashboard Overview (Today Page)
- [ ] URL: `https://campusmate-ulnc.onrender.com/` (or `http://localhost:5173/`)
- [ ] Action: Pan down smoothly from header to show:
  1. Header navigation: *Today, Approvals, Activity, Permissions, Connect*.
  2. Today's schedule card: DBMS lecture (09:00), OS (10:00), CN (11:10), ML Lab (14:00).
  3. Upcoming deadlines: DBMS ER Diagram due in 2 days.
  4. Attendance summary gauges: OS (76.9%), CN (71.4% warning alert).

### Screen 2: Claude / MCP Inspector Interaction (Attendance)
- [ ] Connect MCP endpoint: `https://campusmate-ulnc.onrender.com/mcp` with Bearer token.
- [ ] User Input:
  ```text
  Can I skip OS tomorrow?
  ```
- [ ] Inspect Tool Call: Verify `get_attendance({ subjectCode: "OS" })` fires.
- [ ] Observe Response:
  ```text
  You are at 76.9% attendance (40 attended out of 52 classes held).
  You can miss 1 more class and remain above the required 75% cutoff.
  ```

### Screen 3: Faculty Email Proposal Workflow
- [ ] User Input:
  ```text
  Draft an email to Prof. Rao asking for a 2-day extension on the DBMS assignment.
  ```
- [ ] Inspect Tool Call: Verify `draft_faculty_email` fires with reason.
- [ ] Observe AI Response:
  ```text
  I have drafted the extension request email to Prof. K. Rao.
  It is waiting for your review and approval in the CampusMate dashboard.
  Nothing has been sent yet.
  ```

### Screen 4: Approval Dashboard & Action Execution
- [ ] Switch to browser tab: Navigate to `/approvals`.
- [ ] Notice Approvals badge shows `1`.
- [ ] Open Pending Card:
  - Verify recipient: `Prof. K. Rao (k.rao@college.example.edu)` (resolved from database).
  - Verify reason: *"Student asked for a two-day extension."*
  - Verify subject: *"Extension request for the ER diagram"*.
- [ ] Click **Edit**: Tweak one sentence in the email body.
- [ ] Click **Approve**: Confirmation modal pops up.
- [ ] Click **Confirm**: Badge drops to 0, card status updates to `done`.

### Screen 5: Activity Audit Trail
- [ ] Switch to `/activity` page.
- [ ] Observe chronological event logs:
  - `read`: `get_attendance`
  - `proposed`: `draft_faculty_email`
  - `approved`: Email to Prof. K. Rao (delivered to mock outbox).

### Screen 6: Permissions Killswitch
- [ ] Switch to `/permissions` page.
- [ ] Toggle OFF: *"Draft emails to faculty"*.
- [ ] In AI host, try asking: *"Send an email to Dr. Iyer."*
- [ ] Tool immediately refuses:
  ```text
  The student turned off "Draft emails to faculty" in CampusMate, so this isn't allowed right now.
  ```
- [ ] Switch to Activity page: Verify attempt is recorded with status `blocked`.

---

## 3. Video Editing & Assets Assembly

- [ ] Video Track: `CampusMate_MCP_Demo_Presentation.mp4` (1080p, 180s duration).
- [ ] Narration Audio Track: `CampusMate_Full_Narration.wav` (178.5s duration).
- [ ] Subtitles: Import `CampusMate_Demo_Captions.srt` (styled white with dark box).
- [ ] Verify Audio/Video sync: Confirm narration segments match the 15-second slide transitions.
- [ ] Final Export: Confirm exported video duration is exactly 3 minutes (03:00) and under 50 MB.

---

## 4. Final Rehearsal & Judging Day Dry-Run

- [ ] **Pitch Timing Check:** Rehearse the 12-slide presentation deck. Target: 7–8 minutes total, leaving 2–3 minutes for Q&A.
- [ ] **Key Talking Points Memorized:**
  1. Track 1: *Make MCP Matter* – solving real everyday student life problems.
  2. The Golden Rule: *The AI can only propose; only the student approves.*
  3. No approval tool exists in MCP – structural security boundary.
  4. 239 automated tests, 96% coverage, production-grade quality.
- [ ] **Backup Deliverables Ready:**
  - Presentation PPTX: `CampusMate_MCP_Presentation.pptx`
  - Presentation PDF: `CampusMate_MCP_Presentation.pdf`
  - Video MP4: `CampusMate_MCP_Demo_Presentation.mp4`
  - Speaker Guide: `PRESENTATION_SPEAKER_GUIDE.md`
