from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).parent
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
for n in range(1,6):
 image=Image.new('RGB',(700,540),'white');d=ImageDraw.Draw(image)
 d.text((30,20),'FIXTURE SINTÉTICA · NÃO É PROVA OFICIAL',font=small,fill='#7b5218')
 d.text((30,60),f'QUESTÃO {n} · {n+1} + {n+1} = ?',font=font,fill='#142f32')
 values={1:[4,5,6,7,8],2:[4,6,8,9,10],3:[4,6,8,10,12],4:[4,6,8,10,12],5:[12,20,25,30,35]}[n]
 for i,value in enumerate(values):d.text((35,115+i*45),f'({chr(65+i)}) {value}',font=font,fill='black')
 d.line((355,375,355,135),fill='black',width=2);d.line((355,375,630,375),fill='black',width=2)
 d.line((355,340,610,170),fill='#176b54',width=4)
 d.text((390,410),'Gráfico fictício de apoio',font=small,fill='black')
 d.text((35,485),'Alternativas preservadas na imagem de teste.',font=small,fill='#596b73')
 image.save(root/f'test-{n}.png')
