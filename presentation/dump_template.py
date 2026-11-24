import win32com.client
import os

ppt = win32com.client.Dispatch('PowerPoint.Application')
template_path = os.path.abspath(r'C:\Users\SANJANA G T\Documents\campusmate-mcp\presentation\downloaded_template.pptx')
pres = ppt.Presentations.Open(template_path)

print("="*60)
print(f"Total Slides: {pres.Slides.Count}")
print("="*60)

for i in range(1, pres.Slides.Count + 1):
    slide = pres.Slides(i)
    print(f"\n=================== SLIDE {i} ===================")
    for idx, shape in enumerate(slide.Shapes):
        shape_type = shape.Type
        text = ""
        if shape.HasTextFrame and shape.TextFrame.HasText:
            text = shape.TextFrame.TextRange.Text.strip()
        print(f"Shape {idx+1} [Type: {shape_type}, Left: {shape.Left:.1f}, Top: {shape.Top:.1f}, W: {shape.Width:.1f}, H: {shape.Height:.1f}]")
        if text:
            print(f"   TEXT: {text}")

pres.Close()
ppt.Quit()
