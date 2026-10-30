#!/usr/bin/env python3
"""
Rebuilds data.js for the Chauhan Advisory Policy Desk.

Usage:
  python3 tools/build_data.py <folder of LIC Premdue PDFs> <client_roster.json> [out=data.js]

1. Every LIC "Premium Due List" PDF (Premdue<YYYYMM>891914.pdf) is converted with pdftotext and parsed.
   Each list must tie to LIC's own Grand Total or the build stops.
2. Policy state comes only from LIC lists: on latest list = unpaid; disappeared within 5 months of its FUP = paid;
   fell off 6+ months after FUP = lapsed; MT/LP flag then paid = completed.
3. EstCom / (InstPrem x Due) gives each policy's commission rate (cr), used for the revenue projection.
4. The client roster (exported from the Google Sheet) only supplies phone numbers and client ids.
"""
import re,json,glob,os,sys,subprocess,collections
PDF_DIR,ROSTER=sys.argv[1],sys.argv[2]
OUT=sys.argv[3] if len(sys.argv)>3 else 'data.js'

# ---------- 1. parse LIC lists ----------
rowre=re.compile(r'^\s*(\d+)\s+(\d{9})\s+(.*?)\s+(\d+/\d+)\s+(Hly|Mly|Yly|Qly)\s+(\d\d/\d{4})\s+(?:(MT|LP|ST|FY)\s+)?([\d.]+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+([\d.]+)\s*$')
R=[]
for f in sorted(glob.glob(os.path.join(PDF_DIR,'*Premdue*.pdf'))):
    ym=re.search(r'Premdue(\d{4})(\d\d)',f); due=ym.group(2)+'/'+ym.group(1)
    if any(r['list']==due for r in R): continue
    lines=subprocess.run(['pdftotext','-layout',f,'-'],capture_output=True,text=True).stdout.split('\n')
    merged=[];i=0
    while i<len(lines):
        L=lines[i]
        if re.match(r'^\s*\d+\s+\d{9}\s+\d\d/\d\d/\d{4}\s*$',L):
            sno,pol,doc=L.split()
            merged.append(f'{sno} {pol} '+re.sub(r'^\s*(.*?)\s{2,}(\d+/\d+)',lambda mm: mm.group(1)+' '+doc+'   '+mm.group(2),lines[i+1],count=1)); i+=2; continue
        merged.append(L);i+=1
    gt=None;n0=len(R)
    for L in merged:
        g=re.search(r'Grand Total\s+Premium\s*:\s*(\d+)',L)
        if g: gt=int(g.group(1))
        if re.match(r'^\s*\d+\s+\d{9}',L):
            r=rowre.match(L)
            if not r: sys.exit(f'Unparsed row in {due}: {L}')
            sno,pol,namedoc,pt,mod,fup,flg,ip,dues,gst,tot,com=r.groups()
            dm=re.search(r'(\d\d/\d\d/\d{4})',namedoc); doc=dm.group(1) if dm else ''
            R.append(dict(list=due,policy=pol,name=re.sub(r'\s+',' ',namedoc.replace(doc,' ')).strip(),doc=doc,plan=pt,mode=mod,fup=fup,flg=flg or '',inst=float(ip),dues=int(dues),tot=int(tot),com=float(com)))
    s=sum(x['tot'] for x in R[n0:])
    if s!=gt: sys.exit(f'{due}: rows sum {s} != LIC grand total {gt}')
    print(f'{due}: {len(R)-n0} rows, Rs {s} (ties to LIC total)')

# ---------- 2. per-policy state ----------
mi=lambda m:int(m[3:])*12+int(m[:2])-1
ms=lambda i:f'{i%12+1:02d}/{i//12}'
STEP={'Hly':6,'Qly':3,'Yly':12,'Mly':1}
MODEN={'Hly':'Half-yearly','Qly':'Quarterly','Yly':'Yearly','Mly':'Monthly'}
months=sorted({r['list'] for r in R},key=mi)
LAST=mi(months[-1])
by=collections.defaultdict(dict)
for r in R: by[r['policy']][r['list']]=r
def model():
    out={}
    for p,t in by.items():
        seen=sorted(t,key=mi); last=seen[-1]; L=t[last]; F=mi(L['fup']); step=STEP[L['mode']]
        hist=[(m,t[m]['fup'],t[m]['dues'],t[m]['tot']) for m in seen]
        names=sorted({t[m]['name'] for m in seen})
        # count payment events: FUP advances
        pays=[]
        prev=None
        for m in seen:
            f=mi(t[m]['fup'])
            if prev is not None and f>prev: pays.append(m)
            prev=f
        o=dict(policy=p,name=L['name'],name_variants=names,doc=L['doc'],plan=L['plan'],mode=L['mode'],frequency=MODEN[L['mode']],inst=L['inst'],
               flg=L['flg'],cr=round(L['com']/(L['inst']*L['dues']),5),last_list=last,last_fup=L['fup'],last_dues=L['dues'],last_tot=L['tot'],first_seen=seen[0],lists_seen=len(seen),payments_observed=len(pays))
        if mi(last)==LAST:
            o['state']='unpaid'; o['fup']=L['fup']
        else:
            g=mi(last)-F
            if g<=5:
                o['state']='paid'
                # next FUP: first due strictly after the absent month
                nxt=F
                while nxt<=mi(last)+1-0 and nxt<=mi(last): nxt+=step
                # after paying, FUP must exceed the month after last (they're absent from list last+1)
                while nxt<=mi(last)+1: nxt+=step
                o['fup']=ms(nxt)
            else:
                o['state']='dropped'; o['fup']=L['fup']
        out[p]=o
    return out

# ---------- 3. merge roster, write data.js ----------
def title(s):
    s=re.sub(r'\s*[\[\(][^\]\)]*[\]\)]','',s)
    s=re.sub(r'\s+',' ',s).strip()
    t=' '.join(w.capitalize() if not re.fullmatch(r'\(?LA\)?|\[LA\]',w) else '' for w in s.replace('.', ' ').split())
    return re.sub(r'\s+',' ',re.sub(r'^(Mr|Mrs|Ms)\s+','',t)).replace('( L A )','').strip()
M=model()
D={r['policy_number']:r for r in json.load(open(ROSTER))}
def title(s):
    s=re.sub(r'\s*[\[\(][^\]\)]*[\]\)]','',s)
    s=re.sub(r'\s+',' ',s).strip()
    t=' '.join(w.capitalize() if not re.fullmatch(r'\(?LA\)?|\[LA\]',w) else '' for w in s.replace('.', ' ').split())
    return re.sub(r'\s+',' ',re.sub(r'^(Mr|Mrs|Ms)\s+','',t)).replace('( L A )','').strip()
MODE={'Half-yearly':'Hly','Quarterly':'Qly','Yearly':'Yly','Monthly':'Mly'}
# phone lookup fallback by normalized LIC name for policies with no roster row
def norm(s): return re.sub(r'[^a-z]','',s.lower())
name2phone={}
for r in D.values():
    if r['phone']: name2phone.setdefault(norm(r['name']),r['phone'])
out=[]
for p,o in M.items():
    r=D.get(p,{})
    state=o['state']
    if state=='paid' and o['flg'] in ('MT','LP'): state='completed'
    elif state=='paid':
        # paid but its next due fell inside the data window and it never re-listed
        mi=lambda m:int(m[3:])*12+int(m[:2])-1
        if mi(o['fup'])<=mi(months[-1]): state='verify'
    hist=[[m,by[p][m]['fup'],by[p][m]['dues']] for m in months if m in by[p]]
    phone=r.get('phone') or name2phone.get(norm(o['name']),'')
    out.append(dict(p=p,n=title(o['name']),sn=r.get('name',''),cid=r.get('client_id',''),ph=phone,
        pl=o['plan'],md=o['mode'],ip=int(round(o['inst'])),doc=o['doc'],fl=o['flg'],st=state,fup=o['fup'],
        ll=o['last_list'],ld=o['last_dues'],lt=o['last_tot'],cr=o['cr'],h=hist,lic=1))
for p,r in D.items():
    if p in M: continue
    m=re.search(r'(\d+)[-/](\d+)',r['plan'])
    plan=f'{int(m.group(1))}/{int(m.group(2))}' if m else r['plan']
    term_end=int(r['start_date'][:4])+int(m.group(2)) if m else None
    sd=r['start_date']; doc=f'{sd[8:10]}/{sd[5:7]}/{sd[:4]}'
    out.append(dict(p=p,n=re.sub(r'\s*[\[\(][^\]\)]*[\]\)]','',r['name']).strip(),sn=r['name'],cid=r['client_id'],ph=r['phone'],pl=plan,md=MODE[r['frequency']],
        ip=r['inst_premium'],doc=doc,fl='',st='offlist',te=term_end,lic=0))
import datetime
meta=dict(source_lists=months,latest_list=months[-1],agent='LIC01891914',built=datetime.date.today().isoformat())
js='// Generated by tools/build_data.py. Do not hand-edit; re-run the builder when new LIC due lists arrive.\n'
js+='const META='+json.dumps(meta)+';\nconst POLICIES='+json.dumps(out,separators=(',',':'),ensure_ascii=False)+';\n'
open(OUT,'w').write(js)
print(len(out),collections.Counter(x['st'] for x in out),len(js))
