import os
import sys
import time
import win32com.client

ppMediaTaskStatusNone = 0
ppMediaTaskStatusInProgress = 1
ppMediaTaskStatusQueued = 2
ppMediaTaskStatusDone = 3
ppMediaTaskStatusFailed = 4

def render_mp4():
    out_dir = os.path.abspath(r"C:\Users\SANJANA G T\Documents\campusmate-mcp\presentation")
    pptx_path = os.path.join(out_dir, "CampusMate_MCP_Presentation.pptx")
    mp4_path = os.path.join(out_dir, "CampusMate_MCP_Demo_Presentation.mp4")

    if os.path.exists(mp4_path):
        try:
            os.remove(mp4_path)
        except Exception:
            pass

    print(f"Opening presentation: {pptx_path}", flush=True)
    ppt = win32com.client.Dispatch('PowerPoint.Application')
    ppt.Visible = 1
    pres = ppt.Presentations.Open(pptx_path)

    # 12 slides * 15 seconds = 180 seconds
    for i in range(1, 13):
        s = pres.Slides(i)
        s.SlideShowTransition.AdvanceOnTime = True
        s.SlideShowTransition.AdvanceTime = 15

    print(f"Triggering CreateVideo -> {mp4_path}...", flush=True)
    # DefaultSlideDuration=15, VertResolution=720 (faster & crisp for web demo), FramesPerSecond=30, Quality=80
    pres.CreateVideo(mp4_path, False, 15, 720, 30, 80)

    start = time.time()
    while True:
        status = pres.CreateVideoStatus
        elapsed = int(time.time() - start)
        if status == ppMediaTaskStatusDone:
            print(f"\nSUCCESS: Video exported in {elapsed}s!", flush=True)
            break
        elif status == ppMediaTaskStatusFailed:
            print(f"\nFAILED: Video export failed after {elapsed}s!", flush=True)
            break
        else:
            print(f"\rEncoding progress... status={status}, elapsed={elapsed}s", end="", flush=True)
            time.sleep(3)

    pres.Close()
    ppt.Quit()
    if os.path.exists(mp4_path):
        size_mb = os.path.getsize(mp4_path) / (1024 * 1024)
        print(f"MP4 File successfully generated! Size: {size_mb:.2f} MB", flush=True)
    else:
        print("MP4 file not found on disk.", flush=True)

if __name__ == "__main__":
    render_mp4()
