import os
import time
import win32com.client
import pyttsx3

# PPT Constants
ppMediaTaskStatusInProgress = 1
ppMediaTaskStatusDone = 3
ppMediaTaskStatusFailed = 4

def generate_voiceover_and_video():
    out_dir = os.path.abspath(r"C:\Users\SANJANA G T\Documents\campusmate-mcp\presentation")
    audio_dir = os.path.join(out_dir, "audio")
    os.makedirs(audio_dir, exist_ok=True)
    
    # 1. Synthesize professional narration audio for each segment
    engine = pyttsx3.init()
    engine.setProperty('rate', 155) # Good pacing for presentation
    
    segments = [
        ("seg1_intro", "Welcome to CampusMate MCP, built by team Logic Squad for Track 1: Make MCP Matter. CampusMate solves a challenge every college student faces: managing academic life through an everyday AI assistant that you can truly trust."),
        ("seg2_problem", "Student life is scattered across attendance portals, WhatsApp circulars, Google Classroom, and timetable photos. Missing an attendance threshold can mean exam debarment. Generic chatbots are blind to this data, and cannot be trusted with autonomous execution."),
        ("seg3_solution", "Enter CampusMate MCP. CampusMate pairs a Model Context Protocol server with a companion student dashboard. The AI assistant gains real-time academic context, but under one core rule: the AI can only propose. Only the student approves."),
        ("seg4_features", "CampusMate provides deterministic attendance calculations, pending proposals for emails, reminders, and deadlines, granular per-tool permission switches, and a transparent 30-day activity audit trail."),
        ("seg5_whymcp", "Why does MCP matter? Because it transforms AI from a generic chatbot into a grounded campus assistant. It connects models to verifiable tools and SQLite records, while keeping human control at the center."),
        ("seg6_arch", "Our dual-channel architecture strictly isolates the AI's Bearer token from the student's dashboard session cookie. The MCP endpoint has zero approval tools, making autonomous bypass impossible."),
        ("seg7_tools", "Our 10 production-ready tools include 6 read tools for instant context and 4 act tools for proposals. Every tool is strictly validated against two-way Zod schemas."),
        ("seg8_safety", "Our approval lifecycle ensures every action is verified. In our prompt injection defense test, even when an untrusted campus circular attempts to hijack the AI, it is safely stopped at a pending approval card."),
        ("seg9_tech", "CampusMate is built on Node 24 with native TypeScript execution, Hono, node:sqlite, React 19, and the official MCP SDK. It is validated by 239 automated tests with 96% code coverage."),
        ("seg10_demo", "In our live workflows, querying attendance returns exact math: 76.9% attendance means the student can miss exactly one class. Drafting faculty emails creates pending cards for dashboard review and outbox delivery."),
        ("seg11_impact", "CampusMate delivers immediate daily value to students while establishing a zero-trust model for agentic interactions. Our future roadmap expands to direct university ERP and LMS integrations."),
        ("seg12_closing", "By combining rich campus context with strict human-in-the-loop control, CampusMate makes MCP matter for everyday student life. We are Team Logic Squad. Thank you!")
    ]
    
    full_audio_text = " ".join([text for _, text in segments])
    full_audio_path = os.path.join(audio_dir, "CampusMate_Full_Narration.wav")
    print("Synthesizing full voiceover audio to:", full_audio_path)
    engine.save_to_file(full_audio_text, full_audio_path)
    engine.runAndWait()
    
    for seg_id, text in segments:
        seg_path = os.path.join(audio_dir, f"{seg_id}.wav")
        engine.save_to_file(text, seg_path)
        engine.runAndWait()
    print("Synthesized all 12 narration audio segments.")

    # 2. Render MP4 video via PowerPoint COM
    pptx_path = os.path.join(out_dir, "CampusMate_MCP_Presentation.pptx")
    mp4_path = os.path.join(out_dir, "CampusMate_MCP_Demo_Presentation.mp4")

    print("Opening presentation in PowerPoint for video rendering...")
    ppt = win32com.client.Dispatch('PowerPoint.Application')
    ppt.Visible = 1
    pres = ppt.Presentations.Open(pptx_path)

    # Set exact 15 seconds per slide = 180 seconds total (exact 3 minutes)
    for i in range(1, 13):
        s = pres.Slides(i)
        s.SlideShowTransition.AdvanceOnTime = True
        s.SlideShowTransition.AdvanceTime = 15

    print(f"Starting video export to {mp4_path} (180s duration, 1080p)...")
    pres.CreateVideo(mp4_path, False, 15, 1080, 30, 85)

    # Monitor export progress
    start_time = time.time()
    while True:
        status = pres.CreateVideoStatus
        if status == ppMediaTaskStatusDone:
            print("\nVideo export completed successfully!")
            break
        elif status == ppMediaTaskStatusFailed:
            print("\nVideo export failed!")
            break
        elif status == ppMediaTaskStatusInProgress:
            elapsed = int(time.time() - start_time)
            print(f"\rEncoding video... {elapsed}s elapsed", end="", flush=True)
            time.sleep(2)
        else:
            time.sleep(1)

    pres.Close()
    ppt.Quit()
    print("Video generation finished! File size:", os.path.getsize(mp4_path) if os.path.exists(mp4_path) else "Not found")

if __name__ == "__main__":
    generate_voiceover_and_video()
