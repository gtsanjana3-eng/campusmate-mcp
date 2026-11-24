import win32com.client
import os

def rgb(r, g, b):
    return r + (g * 256) + (b * 256 * 256)

C_DARK_GREEN = rgb(20, 56, 42)
C_OXFORD_SLATE = rgb(30, 46, 61)
C_GOLD = rgb(200, 150, 62)
C_WHITE = rgb(255, 255, 255)
C_TEXT_DARK = rgb(26, 31, 41)
C_TEXT_MUTED = rgb(85, 95, 110)
C_CARD_BG = rgb(249, 248, 245)
C_BORDER = rgb(226, 230, 236)
C_LIGHT_GREEN = rgb(236, 253, 243)
C_ACCENT_GREEN = rgb(6, 118, 71)

def populate():
    out_dir = os.path.abspath(r'C:\Users\SANJANA G T\Documents\campusmate-mcp\presentation')
    template_path = os.path.join(out_dir, 'downloaded_template.pptx')
    out_pptx = os.path.join(out_dir, 'wHACKiest_2026_CampusMate_MCP.pptx')
    out_pdf = os.path.join(out_dir, 'wHACKiest_2026_CampusMate_MCP.pdf')

    ppt = win32com.client.Dispatch('PowerPoint.Application')
    ppt.Visible = 1
    pres = ppt.Presentations.Open(template_path)

    # ========================================================
    # SLIDE 1: Title Slide (Official Template)
    # ========================================================
    s1 = pres.Slides(1)
    
    # Project Banner Box
    p_banner = s1.Shapes.AddShape(1, 550, 110, 365, 140)
    p_banner.Fill.Solid()
    p_banner.Fill.ForeColor.RGB = C_DARK_GREEN
    p_banner.Line.Visible = True
    p_banner.Line.ForeColor.RGB = C_GOLD
    p_banner.Line.Weight = 2
    tf_pb = p_banner.TextFrame
    tf_pb.TextRange.Text = "PROJECT:\nCampusMate MCP\n\n" \
                           "An Everyday Student Life Assistant\nPowered by Model Context Protocol (MCP)\n\n" \
                           "“Your college life, in your AI assistant,\nand nothing happens without your yes.”"
    tf_pb.TextRange.Font.Name = "Segoe UI"
    tf_pb.TextRange.Font.Size = 10.5
    tf_pb.TextRange.Font.Bold = True
    tf_pb.TextRange.Font.Color.RGB = C_WHITE
    tf_pb.TextRange.ParagraphFormat.Alignment = 2 # Center

    # Fill Shape 8 (TEAM NAME:)
    s1.Shapes(8).TextFrame.TextRange.Text = "TEAM NAME:  Logic Squad"
    s1.Shapes(8).TextFrame.TextRange.Font.Bold = True
    s1.Shapes(8).TextFrame.TextRange.Font.Color.RGB = C_TEXT_DARK

    # Fill Shape 10 (COLLEGE NAME:)
    s1.Shapes(10).TextFrame.TextRange.Text = "COLLEGE NAME:  [Enter College Name / Affiliation]"
    s1.Shapes(10).TextFrame.TextRange.Font.Color.RGB = C_TEXT_MUTED

    # Fill Shape 12 (TRACK:)
    s1.Shapes(12).TextFrame.TextRange.Text = "TRACK:  Track 1 – Make MCP Matter"
    s1.Shapes(12).TextFrame.TextRange.Font.Bold = True
    s1.Shapes(12).TextFrame.TextRange.Font.Color.RGB = C_DARK_GREEN

    # Fill Shape 14 (TEAM ID:)
    s1.Shapes(14).TextFrame.TextRange.Text = "TEAM ID:  [Enter Team ID]"
    s1.Shapes(14).TextFrame.TextRange.Font.Color.RGB = C_TEXT_MUTED

    # Fill Shape 16 (Members)
    s1.Shapes(16).TextFrame.TextRange.Text = "Member 1 (Lead):  [Lead Name]\n" \
                                             "Member 2:  [Member 2 Name]\n" \
                                             "Member 3:  [Member 3 Name]\n" \
                                             "Member 4:  [Member 4 Name]"
    s1.Shapes(16).TextFrame.TextRange.Font.Size = 9.5
    s1.Shapes(16).TextFrame.TextRange.Font.Color.RGB = C_TEXT_DARK

    # Fill Shape 17 (USNs)
    s1.Shapes(17).TextFrame.TextRange.Text = "USN:  [USN 1]\n" \
                                             "USN:  [USN 2]\n" \
                                             "USN:  [USN 3]\n" \
                                             "USN:  [USN 4]"
    s1.Shapes(17).TextFrame.TextRange.Font.Size = 9.5
    s1.Shapes(17).TextFrame.TextRange.Font.Color.RGB = C_TEXT_DARK

    # ========================================================
    # SLIDE 2: Problem Statement
    # ========================================================
    s2 = pres.Slides(2)
    s2.Shapes(3).Delete() # Remove "INCLUDE:"
    s2.Shapes(3).Delete() # Remove instruction text
    
    # 3 Structured Problem Cards
    cards_s2 = [
        ("The Core Problem", "Student academic life is fragmented across 5+ disconnected tools (attendance ERP, WhatsApp circulars, Google Classroom, timetable photos in gallery), causing missed deadlines and debarment risks.", 50.4, 185, 270),
        ("Who It Affects & Stakes", "Affects every college student under mandatory 75% attendance regulations. Falling below 75% results in semester exam debarment. Manually calculating allowed skips is error-prone.", 335, 185, 270),
        ("Existing Gaps & AI Deficit", "Traditional chatbots are blind to personal schedule records, hallucinate math calculations probabilistically, and lack governed controls needed to safely perform student actions.", 620, 185, 270)
    ]
    for title, body, left, top, width in cards_s2:
        c = s2.Shapes.AddShape(5, left, top, width, 275) # 5 = rounded rect
        c.Fill.Solid()
        c.Fill.ForeColor.RGB = C_CARD_BG
        c.Line.ForeColor.RGB = C_BORDER
        tf = c.TextFrame
        tf.TextRange.Text = f"{title.upper()}\n\n{body}"
        tf.TextRange.Font.Name = "Segoe UI"
        tf.TextRange.Font.Size = 11.5
        tf.TextRange.Font.Color.RGB = C_TEXT_DARK

    # ========================================================
    # SLIDE 3: Proposed Solution
    # ========================================================
    s3 = pres.Slides(3)
    s3.Shapes(3).Delete()
    s3.Shapes(3).Delete()

    sol_cards = [
        ("Solution in One Line", "CampusMate MCP is an open Model Context Protocol server paired with a companion student dashboard that brings your academic life into conversational AI while guaranteeing nothing happens without student approval.", 50.4, 185, 415, 130),
        ("Key Implemented Features", "• 10 MCP Tools: 6 read tools + 4 governed act tools.\n• Deterministic attendance math in code (canMiss / mustAttend).\n• Pending action review with in-place draft editing.\n• Per-tool ability switches & 30-day activity audit log.", 480, 185, 415, 130),
        ("Everyday User Flow", "1. Student asks AI in natural language ('Can I skip OS tomorrow?' / 'Email Prof. Rao for an extension').\n2. AI reads context or proposes a pending action via MCP tools.\n3. Student inspects the exact action on the companion dashboard.\n4. Student approves with confirmation; action executes atomically.", 50.4, 325, 415, 140),
        ("What's Built in MVP", "• Deployed live on Render with seeded student data.\n• All 10 tools, 2 resources, and 3 prompts active.\n• Dual-channel security: Bearer token (MCP) vs. httpOnly Session.\n• 239 automated tests passing with 96% coverage.", 480, 325, 415, 140)
    ]
    for title, body, left, top, width, height in sol_cards:
        c = s3.Shapes.AddShape(5, left, top, width, height)
        c.Fill.Solid()
        c.Fill.ForeColor.RGB = C_CARD_BG
        c.Line.ForeColor.RGB = C_BORDER
        tf = c.TextFrame
        tf.TextRange.Text = f"{title.upper()}\n\n{body}"
        tf.TextRange.Font.Name = "Segoe UI"
        tf.TextRange.Font.Size = 10.5
        tf.TextRange.Font.Color.RGB = C_TEXT_DARK

    # ========================================================
    # SLIDE 4: Tech Stack
    # ========================================================
    s4 = pres.Slides(4)
    s4.Shapes(3).Delete()
    s4.Shapes(3).Delete()

    t_table_shape = s4.Shapes.AddTable(6, 3, 50.4, 185, 840, 275)
    t_table = t_table_shape.Table
    t_table.Columns(1).Width = 140
    t_table.Columns(2).Width = 230
    t_table.Columns(3).Width = 470

    stack_headers = ["Layer", "Technology Choice", "Why We Picked It & Architectural Role"]
    for c_idx, h in enumerate(stack_headers):
        cell = t_table.Cell(1, c_idx + 1)
        cell.Shape.Fill.Solid()
        cell.Shape.Fill.ForeColor.RGB = C_DARK_GREEN
        tr = cell.Shape.TextFrame.TextRange
        tr.Text = h
        tr.Font.Name = "Segoe UI"
        tr.Font.Size = 11
        tr.Font.Bold = True
        tr.Font.Color.RGB = C_WHITE

    stack_rows = [
        ("Runtime & Lang", "Node 24 + TypeScript 7 Strict", "Native TypeScript execution with zero build lag. Strict API typing shared across server and web workspaces."),
        ("MCP Protocol", "@modelcontextprotocol/server 2.4", "Official MCP SDK implementation over stateless Hono Streamable HTTP adapter with per-request isolation."),
        ("Web Framework", "Hono 4 + Zod 4", "High-performance router; Zod provides robust two-way schema validation on all MCP inputs and outputs."),
        ("Database", "node:sqlite (Built-in)", "12 relational tables. Zero external DB setup required. Fast, ACID compliant, embedded and lightweight."),
        ("Dashboard UI", "React 19 + Vite 8 + CSS Modules", "Accessible, responsive collegiate interface with design tokens. Uses httpOnly session authentication.")
    ]
    for r_idx, row in enumerate(stack_rows):
        for c_idx, val in enumerate(row):
            cell = t_table.Cell(r_idx + 2, c_idx + 1)
            cell.Shape.Fill.Solid()
            cell.Shape.Fill.ForeColor.RGB = C_WHITE if r_idx % 2 == 0 else C_CARD_BG
            tr = cell.Shape.TextFrame.TextRange
            tr.Text = val
            tr.Font.Name = "Segoe UI"
            tr.Font.Size = 10
            if c_idx == 0:
                tr.Font.Bold = True
            tr.Font.Color.RGB = C_TEXT_DARK

    # ========================================================
    # SLIDE 5: Process Flow / Architecture Diagram
    # ========================================================
    s5 = pres.Slides(5)
    s5.Shapes(3).Delete()
    s5.Shapes(3).Delete()

    flow_box = s5.Shapes.AddShape(5, 50.4, 185, 840, 275)
    flow_box.Fill.Solid()
    flow_box.Fill.ForeColor.RGB = C_OXFORD_SLATE
    flow_box.Line.ForeColor.RGB = C_GOLD
    flow_box.Line.Weight = 1.5
    tf_f = flow_box.TextFrame
    tf_f.TextRange.Text = "STEP-BY-STEP PROCESS FLOW & SYSTEM ARCHITECTURE\n\n" \
                          " [ Student / AI Host ]            [ CampusMate Server (Node 24 + Hono) ]           [ Student Dashboard (React 19) ]\n" \
                          "   Claude / Inspector                      POST /mcp (Stateless HTTP)                      Browser (/api/* Routes)\n" \
                          "          │                                              │                                             │\n" \
                          "          │  1. Student Query ('Email Prof. Rao')        │                                             │\n" \
                          "          ├─────────────────────────────────────────────►│                                             │\n" \
                          "          │                                              │ 2. Validates Zod schema                     │\n" \
                          "          │                                              │    Checks tool permission (abilities)       │\n" \
                          "          │                                              │    Inserts into pending_actions             │\n" \
                          "          │  3. Returns { status: 'pending' }            │                                             │\n" \
                          "          │◄─────────────────────────────────────────────┤                                             │\n" \
                          "          │                                              │ 4. Polls pending card                       │\n" \
                          "          │                                              │◄────────────────────────────────────────────┤\n" \
                          "          │                                              │ 5. Student reviews & clicks Approve         │\n" \
                          "          │                                              │◄────────────────────────────────────────────┤\n" \
                          "          │                                              │ 6. Atomic Execution (pending → approved)    │\n" \
                          "          │                                              │    Delivers to mock outbox + logs activity  │\n" \
                          "          │                                              │                                             │\n" \
                          "  ZERO MCP APPROVAL TOOLS  ·  SESSION COOKIE REQUIRED FOR APPROVE  ·  SEPARATE CREDENTIAL BOUNDARIES"
    tf_f.TextRange.Font.Name = "Cascadia Code"
    tf_f.TextRange.Font.Size = 9.5
    tf_f.TextRange.Font.Color.RGB = C_WHITE

    # ========================================================
    # SLIDE 6: Novelty / Innovation
    # ========================================================
    s6 = pres.Slides(6)
    s6.Shapes(3).Delete()
    s6.Shapes(3).Delete()

    c_table_shape = s6.Shapes.AddTable(5, 4, 50.4, 185, 840, 275)
    c_table = c_table_shape.Table
    c_table.Columns(1).Width = 140
    c_table.Columns(2).Width = 230
    c_table.Columns(3).Width = 230
    c_table.Columns(4).Width = 240

    comp_headers = ["Evaluation Metric", "Generic Chatbots (Pre-MCP)", "Autonomous AI Agents", "CampusMate MCP (Our Solution)"]
    for c_idx, h in enumerate(comp_headers):
        cell = c_table.Cell(1, c_idx + 1)
        cell.Shape.Fill.Solid()
        cell.Shape.Fill.ForeColor.RGB = C_DARK_GREEN if c_idx == 3 else C_OXFORD_SLATE
        tr = cell.Shape.TextFrame.TextRange
        tr.Text = h
        tr.Font.Name = "Segoe UI"
        tr.Font.Size = 10
        tr.Font.Bold = True
        tr.Font.Color.RGB = C_WHITE

    comp_rows = [
        ("Campus Data Access", "Blind (No access to personal ERP or timetable)", "Accesses via fragile scripts / scraping", "Native, structured MCP tools (get_today, get_timetable, etc.)"),
        ("Attendance Calculations", "Hallucinates numbers probabilistically", "Calls code but lacks verification", "Deterministic math in code (canMiss / mustAttend at 75% cutoff)"),
        ("Action Governance", "Cannot trigger real-world actions", "Autonomous execution (high risk of rogue emails)", "Strict Human-in-the-Loop (AI only proposes; student approves)"),
        ("Prompt Injection Safety", "Vulnerable to indirect system prompt hijacking", "High risk: executes attacker's instructions", "Defanged: attacks only land as harmless pending cards to reject")
    ]
    for r_idx, row in enumerate(comp_rows):
        for c_idx, val in enumerate(row):
            cell = c_table.Cell(r_idx + 2, c_idx + 1)
            cell.Shape.Fill.Solid()
            cell.Shape.Fill.ForeColor.RGB = C_LIGHT_GREEN if c_idx == 3 else (C_WHITE if r_idx % 2 == 0 else C_CARD_BG)
            tr = cell.Shape.TextFrame.TextRange
            tr.Text = val
            tr.Font.Name = "Segoe UI"
            tr.Font.Size = 9.5
            if c_idx == 0:
                tr.Font.Bold = True
            if c_idx == 3:
                tr.Font.Bold = True
                tr.Font.Color.RGB = C_DARK_GREEN
            else:
                tr.Font.Color.RGB = C_TEXT_DARK

    # ========================================================
    # SLIDE 7: Impact & Feasibility
    # ========================================================
    s7 = pres.Slides(7)
    s7.Shapes(3).Delete()
    s7.Shapes(3).Delete()

    imp_cards = [
        ("Measurable Student Impact", "• Prevents Academic Debarment: Accurate attendance warnings before crossing the 75% cutoff.\n• Zero Missed Deadlines: Consolidates circulars and assignment alerts in one daily brief.\n• Reduces Faculty Friction: Professional email drafting with verified recipient lookup.", 50.4, 185, 415, 130),
        ("Technical & Time Feasibility", "• Lean Production Footprint: Embedded SQLite + Node 24 runs on lightweight containers.\n• Zero Database Hosting Costs: No PostgreSQL or Redis clusters needed for campus scale.\n• Sub-10ms Tool Execution: Instant MCP responses with stateless per-request architecture.", 480, 185, 415, 130),
        ("Identified Risks & Mitigations", "• Risk 1 (Prompt Injection in notices): Contained strictly to unexecuted pending cards.\n• Risk 2 (Browser bot driving dashboard): Passcode re-entry verification planned.\n• Risk 3 (Network drop at approval): Atomic SQL transactions prevent partial or duplicate executions.", 50.4, 325, 415, 140),
        ("Scalability & Extensibility", "• Multi-Host Interoperability: Works out of the box with Claude, MCP Inspector, or any standard client.\n• Modular Source Adapters: Pluggable interfaces for Canvas, Google Classroom, and university ERPs.\n• 239 Automated Tests: Complete test harness ensuring continuous reliability.", 480, 325, 415, 140)
    ]
    for title, body, left, top, width, height in imp_cards:
        c = s7.Shapes.AddShape(5, left, top, width, height)
        c.Fill.Solid()
        c.Fill.ForeColor.RGB = C_CARD_BG
        c.Line.ForeColor.RGB = C_BORDER
        tf = c.TextFrame
        tf.TextRange.Text = f"{title.upper()}\n\n{body}"
        tf.TextRange.Font.Name = "Segoe UI"
        tf.TextRange.Font.Size = 10.5
        tf.TextRange.Font.Color.RGB = C_TEXT_DARK

    # ========================================================
    # SLIDE 8: Business Model
    # ========================================================
    s8 = pres.Slides(8)
    s8.Shapes(3).Delete()
    s8.Shapes(3).Delete()

    bm_cards = [
        ("Target Market & Users", "• Primary: University engineering, science, and arts students managing complex semester schedules.\n• Secondary: Academic departments and faculty seeking structured, dignified student communication.\n• TAM: Over 40 million higher-education students across global universities.", 50.4, 185, 415, 130),
        ("Campus Deployment & Sustainability", "• B2B Institutional Licensing: Deployed as an official university-licensed MCP bridge for campus ERPs.\n• Freemium Personal Tier: Free individual student tier with local SQLite storage; premium institutional tier with automatic LMS syncing.\n• Low Infrastructure Cost: Runs on minimal compute resources.", 480, 185, 415, 130),
        ("Go-To-Market (GTM) Strategy", "• Phase 1 (Grassroots Student Adoption): Open-source self-hosted MCP server for tech-forward students.\n• Phase 2 (Department Pilots): Department-level pilot for CSE student cohorts.\n• Phase 3 (ERP Integration Partnerships): Partnering with university LMS providers (Canvas / Moodle).", 50.4, 325, 415, 140),
        ("Key Partnerships & Growth Plan", "• Cloud / LMS Partnerships: Integration with Google Classroom, Canvas API, and university portals.\n• AI Ecosystem Alignment: Published to official MCP tool directories for one-click connector setup.\n• Privacy-First Positioning: Complete student data ownership builds long-term academic trust.", 480, 325, 415, 140)
    ]
    for title, body, left, top, width, height in bm_cards:
        c = s8.Shapes.AddShape(5, left, top, width, height)
        c.Fill.Solid()
        c.Fill.ForeColor.RGB = C_CARD_BG
        c.Line.ForeColor.RGB = C_BORDER
        tf = c.TextFrame
        tf.TextRange.Text = f"{title.upper()}\n\n{body}"
        tf.TextRange.Font.Name = "Segoe UI"
        tf.TextRange.Font.Size = 10.5
        tf.TextRange.Font.Color.RGB = C_TEXT_DARK

    # ========================================================
    # Save PPTX, PDF & Slide PNGs
    # ========================================================
    print("Saving populated official template PPTX to:", out_pptx)
    pres.SaveAs(out_pptx)

    print("Saving populated official template PDF to:", out_pdf)
    pres.SaveAs(out_pdf, 32) # ppSaveAsPDF = 32

    img_dir = os.path.join(out_dir, 'official_template_png')
    os.makedirs(img_dir, exist_ok=True)
    print("Exporting slide images for official template...")
    for i in range(1, pres.Slides.Count + 1):
        slide_img = os.path.join(img_dir, f'official_slide_{i}.png')
        pres.Slides(i).Export(slide_img, 'PNG', 1920, 1080)
    print("Exported official template slide images.")

    pres.Close()
    ppt.Quit()
    print("Successfully populated official hackathon template!")

if __name__ == '__main__':
    populate()
