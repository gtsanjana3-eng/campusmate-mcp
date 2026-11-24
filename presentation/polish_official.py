import os
import win32com.client

d = os.path.abspath(r'C:\Users\SANJANA G T\Documents\campusmate-mcp\presentation')
ppt = win32com.client.Dispatch('PowerPoint.Application')
ppt.Visible = 1
p = ppt.Presentations.Open(os.path.join(d, 'wHACKiest_2026_CampusMate_MCP.pptx'))

def fix_footer(shapes):
    n = 0
    for sh in shapes:
        if sh.HasTextFrame and sh.TextFrame.HasText:
            tr = sh.TextFrame.TextRange
            if '<Team Name>' in tr.Text:
                tr.Replace('<Team Name>', 'Phoenix')
                n += 1
    return n

count = fix_footer(p.SlideMaster.Shapes)
for i in range(1, p.SlideMaster.CustomLayouts.Count + 1):
    count += fix_footer(p.SlideMaster.CustomLayouts(i).Shapes)
for s in p.Slides:
    count += fix_footer(s.Shapes)
print('footers fixed:', count)

# Left-align card text (slides 2,3,7,8), bold card headings
for idx in (2, 3, 7, 8):
    for sh in p.Slides(idx).Shapes:
        if sh.Type == 1 and sh.HasTextFrame and sh.TextFrame.HasText:
            tf = sh.TextFrame
            tf.TextRange.ParagraphFormat.Alignment = 1
            tf.VerticalAnchor = 1
            tf.MarginLeft = 14; tf.MarginRight = 14; tf.MarginTop = 12
            head = tf.TextRange.Paragraphs(1)
            head.Font.Bold = True
            head.Font.Color.RGB = 20 + 56 * 256 + 42 * 65536

p.Save()
p.SaveAs(os.path.join(d, 'wHACKiest_2026_CampusMate_MCP.pdf'), 32)
for i in range(1, p.Slides.Count + 1):
    p.Slides(i).Export(os.path.join(d, 'official_template_png', f'official_slide_{i}.png'), 'PNG', 1920, 1080)
p.Close()
ppt.Quit()
print('ok')
