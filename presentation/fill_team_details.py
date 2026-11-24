import os
import win32com.client

out_dir = os.path.abspath(r'C:\Users\SANJANA G T\Documents\campusmate-mcp\presentation')
pptx = os.path.join(out_dir, 'wHACKiest_2026_CampusMate_MCP.pptx')
pdf = os.path.join(out_dir, 'wHACKiest_2026_CampusMate_MCP.pdf')

ppt = win32com.client.Dispatch('PowerPoint.Application')
ppt.Visible = 1
pres = ppt.Presentations.Open(pptx)
s1 = pres.Slides(1)

def find_shape(slide, prefix):
    for sh in slide.Shapes:
        if sh.HasTextFrame and sh.TextFrame.HasText:
            if sh.TextFrame.TextRange.Text.strip().startswith(prefix):
                return sh
    raise RuntimeError('Shape not found: ' + prefix)

def set_text(sh, text, bold=False):
    tr = sh.TextFrame.TextRange
    tr.Text = text
    tr.Font.Bold = bold
    tr.Font.Color.RGB = 26 + 31 * 256 + 41 * 65536

set_text(find_shape(s1, 'TEAM NAME:'), 'TEAM NAME:  Phoenix', bold=True)
set_text(find_shape(s1, 'COLLEGE NAME:'), 'COLLEGE NAME:  Sapthagiri NPS University', bold=True)
set_text(find_shape(s1, 'TRACK:'), 'TRACK:  Track 1 – Make MCP Matter', bold=True)
set_text(find_shape(s1, 'TEAM ID:'), 'TEAM ID:  [Enter Team ID]')
set_text(find_shape(s1, 'Member 1'), 'Member 1 (Lead):  Sanjana G T\rMember 2:  Sanjana R\rMember 3:  Savitha Y U')
set_text(find_shape(s1, 'USN:'), 'USN:  25SUUBECS1248\rUSN:  25SUUBECS1255\rUSN:  25SUUBECS1281')

# Remove the unverified market-size statistic on the Business Model slide
for sh in pres.Slides(8).Shapes:
    if sh.HasTextFrame and sh.TextFrame.HasText:
        tr = sh.TextFrame.TextRange
        if 'TAM: Over 40 million' in tr.Text:
            tr.Text = tr.Text.replace(
                '• TAM: Over 40 million higher-education students across global universities.',
                '• Market size: [Add a sourced figure before submission]')

pres.Save()
pres.SaveAs(pdf, 32)
img_dir = os.path.join(out_dir, 'official_template_png')
for i in range(1, pres.Slides.Count + 1):
    pres.Slides(i).Export(os.path.join(img_dir, f'official_slide_{i}.png'), 'PNG', 1920, 1080)
pres.Close()
ppt.Quit()
print('Done')
