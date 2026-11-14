"""Draw the actual homework architecture as a standalone editable SVG."""
from pathlib import Path
from html import escape

OUT = Path(__file__).resolve().parent
W, H = 3000, 2620
p = []
GREEN, ORANGE, BLUE, PURPLE = '#137d62', '#d46c1b', '#2366a6', '#7652aa'
INK = '#203533'
def rect(x,y,w,h,fill='#fff',stroke=INK,r=20,sw=3,extra=''):
    p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
def text(x,y,s,size=32,fill=INK,bold=False,anchor='start'):
    p.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-weight="{700 if bold else 400}" text-anchor="{anchor}">{escape(s)}</text>')
def lines(x,y,ss,size=30,gap=43,fill=INK,bold=False):
    for i,s in enumerate(ss): text(x,y+i*gap,s,size,fill,bold)
def path(d,color=INK,sw=5,dash=False,arrow=True):
    mark = f' marker-end="url(#{color[1:]})"' if arrow else ''
    p.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"'+(' stroke-dasharray="13 10"' if dash else '')+mark+'/>')
def card(x,y,w,h,title,body,color=GREEN,tag=None,size=35):
    rect(x+6,y+8,w,h,'#dae1d8','none')
    rect(x,y,w,h,'#fff',INK)
    rect(x,y,12,h,color,'none',8)
    text(x+30,y+48,title,size,color,True)
    lines(x+30,y+91,body,28,39)
    if tag: text(x+w-20,y+42,tag,25,color,True,'end')
def panel(x,y,w,h,n,title,color,bg):
    rect(x+8,y+10,w,h,'#d7ded3','none',28)
    rect(x,y,w,h,bg,INK,28,4)
    rect(x+15,y+15,w-30,88,color,INK,20,2)
    p.append(f'<circle cx="{x+67}" cy="{y+59}" r="33" fill="white" stroke="{INK}" stroke-width="3"/>')
    text(x+67,y+74,str(n),42,color,True,'middle')
    text(x+122,y+76,title,45,'#fff',True)
def pill(x,y,w,label,color=GREEN,size=29):
    rect(x,y,w,55,'#fff',color,20,2)
    text(x+w/2,y+38,label,size,color,True,'middle')
def mascot(x,y,color):
    # Small original comic engineer: hair, face, glasses and laptop.
    p.append(f'<circle cx="{x}" cy="{y}" r="32" fill="#ffe1b7" stroke="{INK}" stroke-width="3"/>')
    path(f'M{x-31} {y-4} Q{x-42} {y-43} {x-7} {y-31} L{x+3} {y-48} L{x+12} {y-29} Q{x+40} {y-39} {x+31} {y-3}',INK,8,False,False)
    rect(x-24,y-8,21,15,'#fff',INK,5,2); rect(x+4,y-8,21,15,'#fff',INK,5,2)
    path(f'M{x-3} {y} H{x+4} M{x-9} {y+15} Q{x} {y+24} {x+11} {y+13}',INK,2,False,False)
    rect(x-42,y+37,84,46,color,INK,12,3)
    rect(x-44,y+49,88,46,'#e8eff1',INK,5,3)
    text(x,y+82,'</>',23,color,True,'middle')

p.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
p.append('<defs>')
for c in [INK,GREEN,ORANGE,BLUE,PURPLE,'#75847e']:
    p.append(f'<marker id="{c[1:]}" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto-start-reverse"><path d="M1 1 L10 6 L1 11 Z" fill="{c}"/></marker>')
p.append('<pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.3" fill="#b9b5a4" opacity=".22"/></pattern></defs>')
p.append('<g font-family="Microsoft YaHei, Microsoft YaHei UI, sans-serif">')
rect(0,0,W,H,'#fffaf0','none',0)
rect(0,0,W,H,'url(#dots)','none',0)
text(70,108,'OctoShelf 作业系统架构全景图',78,INK,True)
text(76,166,'Cloudflare 前端 × AWS 后端 × PostgreSQL × GitHub Actions × Android',34,'#65776b')
pill(2210,58,710,'实际部署版 · Android 模拟器验证通过',GREEN,28)
mascot(2870,146,ORANGE)

# 1: Actual client request chain; Cloudflare sends assets to the browser.
panel(50,220,2900,920,1,'用户访问：页面、手机与同一套后端',GREEN,'#f0f8ee')
card(125,350,790,140,'Cloudflare Workers',['Next.js 静态导出 out/ · CDN 分发页面、JS、CSS'],ORANGE)
path('M365 495 V575',ORANGE,5)
text(410,545,'① 下载静态资源',29,ORANGE,True)
card(125,590,500,155,'浏览器',['搜索、收藏增删改查','备注和标签 · 令牌存 sessionStorage'],GREEN)
path('M635 665 H890',GREEN,5)
lines(650,590,['② HTTPS JSON','+ Bearer 项目令牌'],27,37,GREEN,True)
card(900,590,370,155,'API Gateway',['公网 HTTPS 入口','转发请求、调用函数'],PURPLE, size=35)
rect(1410,470,1465,390,'#eaf2ff',BLUE,24,3,'stroke-dasharray="16 10"')
text(1440,520,'同一个 AWS VPC · 悉尼 ap-southeast-2',36,BLUE,True)
path('M1280 665 H1485',GREEN,5)
text(1285,620,'③ 调用',27,GREEN,True)
card(1500,590,485,155,'AWS Lambda',['Node.js + Hono · 校验项目令牌','处理业务 · 通过 ENI 接入私有子网'],GREEN)
card(2310,590,515,155,'RDS PostgreSQL',['普通实例 db.t4g.micro · 无公网地址','github_search / github_users'],BLUE,size=34)
path('M1995 665 H2295',GREEN,5)
lines(2010,585,['④ 内网 5432 + TLS','IAM 数据库认证'],27,38,GREEN,True)
text(1510,817,'Lambda 私有应用子网 A/B；数据库允许指定安全组访问',29,BLUE)
card(125,890,650,145,'Android App · 已验证',['收藏展示、详情、搜索与刷新','本地模拟器调用真实 API · 令牌存 SecureStore'],GREEN,size=35)
path('M785 965 H835 V715 H890',GREEN,5)
lines(850,840,['同一 API','同一项目令牌'],25,36,GREEN)
card(1500,920,800,110,'AWS Secrets Manager',['保存项目 API 令牌；Lambda 启动时读取'],ORANGE,size=32)
path('M1745 910 V875 H1375 V765 H1530',ORANGE,4,True)
text(1890,900,'辅助读取经 NAT',26,ORANGE)
text(990,1090,'响应：JSON 沿请求链路返回；浏览器来源由后端 CORS 校验',31,GREEN,True)
text(125,1090,'CF 只托管静态前端，不代理业务 API。',29,INK,True)
mascot(1150,395,GREEN)
pill(950,500,400,'两端共用同一套后端！',GREEN,28)

# 2: Public egress path, separate from database traffic.
panel(50,1180,2900,475,2,'Lambda 主动出网：私有子网 → NAT → IGW → GitHub',ORANGE,'#fff3e6')
card(125,1320,520,140,'Lambda VPC 网卡',['私有应用子网 A/B · 跨两个 AZ'],GREEN)
card(880,1320,460,140,'公共 NAT Gateway',['公有子网 A · 共用一个 NAT'],ORANGE)
card(1630,1320,390,140,'IGW',['挂载在 VPC 上的互联网网关'],PURPLE)
card(2360,1320,500,140,'GitHub API / 公网',['搜索用户、读取开发者资料'],BLUE)
path('M655 1388 H865',ORANGE,5); text(686,1350,'主动出网',28,ORANGE,True)
path('M1350 1388 H1615',ORANGE,5); text(1385,1350,'公网出口',28,ORANGE,True)
path('M2030 1388 H2345',ORANGE,5); text(2090,1350,'HTTPS 443',28,ORANGE,True)
pill(125,1503,790,'私有子网：0.0.0.0/0 → NAT',ORANGE)
pill(950,1503,790,'公有子网：0.0.0.0/0 → IGW',ORANGE)
pill(1775,1503,1085,'VPC 内部：local 路由；数据库访问不经过 NAT',BLUE,28)
text(125,1610,'两 AZ 共用一个 NAT 是课程成本方案；请求响应可以返回，公网不能主动连接 Lambda 私有网卡。',29,INK,True)

# 3: Bastion and database safety.
panel(50,1695,1350,610,3,'人工运维：通过跳板机管理数据库',BLUE,'#edf5ff')
card(110,1855,305,145,'管理员电脑',['本机终端','SSH 私钥登录'],BLUE,size=33)
card(565,1855,350,145,'EC2 跳板机',['Amazon Linux','公有 IP · psql 客户端'],BLUE,size=33)
card(1045,1855,300,145,'RDS 数据库',['无公网地址','与跳板机同 VPC'],BLUE,size=33)
path('M425 1930 H550',BLUE,4); lines(427,1818,['SSH 22','当前 IP /32'],24,31,BLUE,True)
path('M925 1930 H1030',BLUE,4); lines(932,1818,['内网','5432 + TLS'],23,31,BLUE,True)
rect(535,2030,810,74,'#fff',BLUE,16,2,'stroke-dasharray="12 8"')
text(940,2078,'跳板机和 RDS 位于同一个 VPC',30,BLUE,True,'middle')
lines(110,2164,['数据库 5432：仅允许 Lambda 安全组 + 跳板机安全组。','业务连接不经过跳板机；跳板机只用于人工运维。','RDS 使用现有默认子网组，不是独立隔离数据库子网。'],27,44)
mascot(1245,2210,BLUE)

# 4: CI/CD, official hosted build separate from privileged deploy machine.
panel(1450,1695,1500,610,4,'自动发布：构建与部署分开执行',PURPLE,'#f5effb')
pill(1505,1810,345,'git push main',PURPLE,30)
path('M1860 1838 H1980',PURPLE,4)
rect(1995,1808,885,63,'#fff',PURPLE,15,2)
text(2437,1850,'GitHub CI：类型、测试、数据库、构建检查通过',27,PURPLE,True,'middle')
path('M2440 1880 V1905 H1770 V1920',PURPLE,4)
card(1505,1930,540,115,'GitHub 托管 Runner',['构建 Next.js → out/ 静态资源'],ORANGE,size=31)
path('M2055 1987 H2220',ORANGE,4)
card(2235,1930,645,115,'Wrangler → Cloudflare Workers',['Token 存 GitHub Secrets · 更新前端'],ORANGE,size=30)
path('M2440 1905 H2190 V2080 H1770 V2090',PURPLE,3,True)
card(1505,2100,540,112,'GitHub 构建 Lambda',['ZIP + SHA256 → GitHub Artifact'],PURPLE,size=31)
path('M2055 2156 H2130',PURPLE,4)
card(2145,2100,390,112,'专用 EC2 Runner',['下载、校验构建包'],BLUE,size=29)
path('M2545 2156 H2610',PURPLE,4)
card(2625,2100,255,112,'Lambda',['更新后端代码'],GREEN,size=31)
text(1505,2254,'Runner 用 EC2 实例角色 · 无长期 AWS 密钥 · 无数据库访问权限',25,BLUE,True)
text(1505,2290,'管理员经 SSM 管理 Runner（无 SSH 入站）；构建任务不占用这台 EC2。',24,INK)

# Footer, legend, and current verification scope.
rect(50,2345,2900,220,'#fffce1',INK,25,3)
text(90,2400,'读图指南',38,INK,True)
for x,c,label in [(360,GREEN,'业务请求'),(850,ORANGE,'主动出网'),(1340,BLUE,'人工运维'),(1830,PURPLE,'代码发布')]:
    path(f'M{x} 2388 H{x+110}',c,4); text(x+135,2400,label,31,c,True)
text(90,2460,'四个分区展示同一套资源；Android 已在另一分支完成开发，并通过本地模拟器与真实数据调用验证。',30,INK,True)
text(90,2510,'注意：NAT、RDS、EC2、磁盘与公网 IPv4 会消耗额度；业务正常不代表可以省略资源清理。',29,'#8d571f')
text(90,2595,'基于本项目实际部署与验证记录绘制 · 未将旧 Aurora Express 或 S3/CloudFront 旧方案混入当前架构',24,'#66766b')
p.append('</g></svg>')
(OUT/'octoshelf-system-architecture-comic.svg').write_text('\n'.join(p),encoding='utf-8')
print(OUT/'octoshelf-system-architecture-comic.svg')
