'use client'
import {useEffect,useMemo,useState} from 'react'
type Holding={name:string;category:string;invested:number;current:number;sip:number}
type Sip={name:string;amount:number;day:number}
const holdings0:Holding[]=[]
const sips0:Sip[]=[]
const funds=[['Parag Parikh Flexi Cap Fund','Flexi Cap','86','18.4%','Moderate'],['HDFC Flexi Cap Fund','Flexi Cap','84','17.6%','Moderate'],['UTI Nifty 50 Index Fund','Index','82','15.7%','Moderate'],['ICICI Prudential Nifty 50 Index Fund','Index','81','15.5%','Moderate'],['HDFC Nifty Next 50 Index Fund','Index','79','17.9%','Moderately High'],['Motilal Oswal Midcap Fund','Mid Cap','78','20.1%','High'],['Nippon India Growth Mid Cap Fund','Mid Cap','77','19.3%','High'],['Mirae Asset Large & Midcap Fund','Large & Mid Cap','76','16.9%','Moderately High'],['SBI Small Cap Fund','Small Cap','75','22.0%','Very High'],['Nippon India Small Cap Fund','Small Cap','74','23.1%','Very High'],['Axis India Manufacturing Fund','Thematic','72','N/A','High'],['Parag Parikh Conservative Hybrid Fund','Hybrid','70','10.8%','Moderately Low']]
const chart=[10.2,10.6,10.4,11.1,11.8,12.4,12.1,13.2,14.1,14,15.3,16.1,17,18.4]
const money=(n:number)=>`₹${Math.round(n).toLocaleString('en-IN')}`
const cleanFundName=(name:string)=>name.replace(/\s*[-–—]\s*(Direct|Regular) Plan.*$/i,'').replace(/\s*[-–—]\s*(Growth|IDCW).*/i,'').trim()
const analyticsForFund=(f:any,pulses:any[])=>{const pulse=pulses.find((p:any)=>String(p.code)===String(f.code)||cleanFundName(p.shortName||'').toLowerCase()===cleanFundName(f.name||'').toLowerCase());return {daily:pulse?.changePct??null,benchmark:null,risk:null,ter:null,returns:{y5:null,y7:null,y10:null}}}

export default function Home(){
 const [active,setActive]=useState('Dashboard'),[period,setPeriod]=useState('1Y'),[liveRec,setLiveRec]=useState<any>(null),[loadingRec,setLoadingRec]=useState(false)
 const [profileOpen,setProfileOpen]=useState(false),[profile,setProfile]=useState({name:'Your name',email:'',mobile:'',photo:''}),[liveFunds,setLiveFunds]=useState<any[]>([]),[fundStatus,setFundStatus]=useState('Loading live AMFI data…'),[fundSearch,setFundSearch]=useState(''),[fundRefreshKey,setFundRefreshKey]=useState(0),[refreshingFunds,setRefreshingFunds]=useState(false)
 const [holdings,setHoldings]=useState(holdings0),[sips,setSips]=useState(sips0)
 const [dailyPulse,setDailyPulse]=useState<any[]>([]),[pulseStatus,setPulseStatus]=useState('Loading daily NAV changes…')
 const [aiQuestion,setAiQuestion]=useState(''),[aiCategory,setAiCategory]=useState('Find a Fund'),[aiView,setAiView]=useState<any>(null)
 const [amount,setAmount]=useState(50000),[phone,setPhone]=useState(''),[saved,setSaved]=useState(false)
 const [plannerHorizon,setPlannerHorizon]=useState('7-10'),[plannerRisk,setPlannerRisk]=useState('Moderate'),[plannerGoal,setPlannerGoal]=useState('Wealth creation'),[allocationRefresh,setAllocationRefresh]=useState(0)
 const [selectedFund,setSelectedFund]=useState<{name:string;category:string;nav?:string;amc?:string;code?:string}|null>(null),[selectedAnalytics,setSelectedAnalytics]=useState<any>(null),[analyticsLoading,setAnalyticsLoading]=useState(false)
 const [compareFunds,setCompareFunds]=useState<any[]>([]),[compareAnalytics,setCompareAnalytics]=useState<any[]>([]),[compareLoading,setCompareLoading]=useState(false)
 const [investmentMode,setInvestmentMode]=useState<'monthly'|'lumpsum'>('monthly')
 const [projectionAmount,setProjectionAmount]=useState(5000)
 const [assumedReturn,setAssumedReturn]=useState(12)
 const totals=useMemo(()=>{let i=0,c=0;holdings.forEach(h=>{i+=h.invested;c+=h.current});return {i,c,g:c-i,p:i?(c-i)/i*100:0}},[holdings])
 const allocation=useMemo(()=>buildDynamicAllocation(liveFunds,amount,plannerRisk,plannerHorizon,plannerGoal,allocationRefresh),[liveFunds,amount,plannerRisk,plannerHorizon,plannerGoal,allocationRefresh])
 useEffect(()=>{try{const p=JSON.parse(localStorage.getItem('rvs-profile')||'null');if(p)setProfile(p)}catch{}},[])
 useEffect(()=>{localStorage.setItem('rvs-profile',JSON.stringify(profile))},[profile])
 useEffect(()=>{
   if(active!=='Dashboard') return
   let cancelled=false
   fetch('/api/fund-ticker',{cache:'no-store'}).then(r=>r.json()).then(d=>{
     if(cancelled)return
     setDailyPulse(d.pulses||[])
     setPulseStatus(d.status==='live'&&d.pulses?.length?`Latest available NAV · ${d.asOf}`:'Daily NAV change is not available yet')
   }).catch(()=>{if(!cancelled)setPulseStatus('Daily NAV change is not available yet')})
   return()=>{cancelled=true}
 },[active])
 useEffect(()=>{
  const t=setTimeout(async()=>{
    if(fundRefreshKey>0)setRefreshingFunds(true)
    try{
      const r=await fetch('/api/funds?limit=1000',{cache:'no-store'})
      const d=await r.json()
      setLiveFunds(d.funds||[])
      setFundStatus(d.status==='live'?`Live AMFI NAV · ${d.count} schemes loaded · ${d.asOfLabel}`:'AMFI connection unavailable — showing fallback data')
    }catch{
      setFundStatus('AMFI connection unavailable — showing fallback data')
    }finally{
      setRefreshingFunds(false)
    }
  },300)
  return()=>clearTimeout(t)
},[fundRefreshKey])
function refreshFunds(){
  setFundStatus('Refreshing live AMFI data…')
  setFundRefreshKey(x=>x+1)
}
 const filteredFunds=useMemo(()=>{const q=fundSearch.trim().toLowerCase();if(!q)return liveFunds;return liveFunds.filter(f=>`${f.name} ${f.amc} ${f.category} ${f.isin}`.toLowerCase().includes(q))},[liveFunds,fundSearch])
 const today=new Date().getDate()
 const next=useMemo(()=>sips.map(s=>({...s,days:s.day>=today?s.day-today:s.day+30-today})).sort((a,b)=>a.days-b.days)[0],[sips])
 async function getLiveRecommendation(){
   setLoadingRec(true)
   try{
     const r=await fetch('/api/recommendation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount,risk:'Moderate'})})
     const data=await r.json()
     setLiveRec(data)
   }finally{setLoadingRec(false)}
 }
 function accept(){setSips(s=>{const m=new Map(s.map(x=>[x.name,x]));allocation.filter(x=>x[0].includes('Fund')).forEach(x=>m.set(x[0],{name:x[0],amount:x[1],day:m.get(x[0])?.day||5}));return [...m.values()]});setSaved(true)}
 return <main>
 <aside className="sidebar"><div className="brand"><span>RVS</span><div><b>RVS WealthPilot</b><small>AI investing copilot</small></div></div>
 {['Dashboard','AI Fund Manager','My SIPs','SIP Planner','Fund Research','Market Intelligence'].map(x=><button className={active===x?'nav active':'nav'} onClick={()=>setActive(x)} key={x}>{x}</button>)}
 <div className="bottom">V13 · Public Beta</div></aside>
 <section className="content"><header><div><label>SEPTEMBER 2026</label><h1>{active}</h1><span className="v6tag">V13 · Public Beta · Live AMFI NAV</span></div><div className="accountWrap"><button className="profile" onClick={()=>setProfileOpen(v=>!v)}>{profile.photo?<img src={profile.photo} alt="Profile"/>:(profile.name||"RVS").split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase()}</button>{profileOpen&&<AccountPanel profile={profile} setProfile={setProfile} onClose={()=>setProfileOpen(false)}/>}</div></header>

 <div className="betaBanner"><span className="betaDot">●</span><div><b>RVS WealthPilot · Public Beta</b><small>Early-access build. Portfolio values stay empty until you add your own holdings. Mutual-fund NAV search is sourced server-side from AMFI.</small></div><span className="betaTag">BETA</span></div>

 <div className="disclaimerBanner"><div className="disclaimerIcon">⚠️</div><div><b>AI-created investing companion — not financial advice</b><p>WealthPilot helps make investment analysis easier to understand. Before investing, verify the latest NAV, fund performance, risk level and market trend on the actual/official investment platform.</p></div></div>

 {active==='Dashboard'&&<div className="dailyPulse" aria-label="Mutual fund daily NAV changes"><div className="pulseLabel"><span className="pulseDot">●</span><b>MF DAILY PULSE</b><small>{pulseStatus}</small></div><div className="pulseViewport"><div className="pulseTrack">{(dailyPulse.length?dailyPulse:[]).concat(dailyPulse).map((p:any,i:number)=><div className="pulseItem" key={`${p.code}-${i}`}><span>{p.shortName}</span><b className={p.changePct>=0?'up':'down'}>{p.changePct>=0?'+':''}{p.changePct.toFixed(2)}%</b></div>)}</div>{!dailyPulse.length&&<div className="pulseEmpty">Loading latest available mutual-fund NAV changes…</div>}</div></div>}

 {active==='Dashboard'&&<DashboardView holdings={holdings} sips={sips} totals={totals} liveFunds={liveFunds} dailyPulse={dailyPulse} setActive={setActive}/>} 

 {active==='AI Fund Manager'&&<AIFundManager aiQuestion={aiQuestion} setAiQuestion={setAiQuestion} aiCategory={aiCategory} setAiCategory={setAiCategory} aiView={aiView} setAiView={setAiView} setActive={setActive} liveFunds={liveFunds} holdings={holdings} totals={totals} setSelectedFund={setSelectedFund} setProjectionAmount={setProjectionAmount} setInvestmentMode={setInvestmentMode}/>} 

 {active==='My SIPs'&&<div className="card big"><div className="head"><div><h2>My SIPs & reminders</h2><p>Every SIP, its amount and next payment date.</p></div><span className={saved?'pill green':'pill'}>{saved?'● Reminder setup available':'Reminder not configured'}</span></div><div className="siplist">{sips.length?sips.map(s=><div className="siprow" key={s.name}><div><b>{s.name}</b><small>Monthly · {s.day}th</small></div><strong>{money(s.amount)}</strong><span className="pill green">Active</span></div>):<div className="emptyState"><b>No SIPs added yet.</b><small>Create a plan in SIP Planner, then add your SIP details here when you are ready.</small><button className="secondary" onClick={()=>setActive('SIP Planner')}>Open SIP Planner</button></div>}</div>
 <div className="reminder"><h3>3-day mobile reminder</h3><p>Enter your number. In production, the scheduler will send an SMS/WhatsApp notification three days before each SIP.</p><div><input placeholder="+91 98XXXXXXXX" value={phone} onChange={e=>setPhone(e.target.value)}/><button className="primary" onClick={()=>setSaved(!!phone)}>Enable reminders</button></div>{saved&&phone&&<small className="success">✓ Reminder preference saved for {phone}. Actual SMS/WhatsApp delivery needs a connected messaging provider.</small>}</div>
 <div className="preview">🔔 <div><b>Notification preview</b><p>"Your SIP is due in 3 days. Please ensure sufficient balance in your account."</p></div></div></div>}



 {active==='SIP Planner'&&<div className="card big"><h2>SIP Planner</h2><p>Build a monthly plan around your goal, horizon and risk comfort. Suggestions update dynamically from the live AMFI scheme list — they are a shortlist for consideration, not a buy instruction.</p>{selectedFund?<div className="selectedFund"><div><span className="pill green">Selected fund</span><h3>{selectedFund.name}</h3><small>{selectedFund.category}{selectedFund.amc?` · ${selectedFund.amc}`:''}{selectedFund.nav?` · NAV ₹${Number(selectedFund.nav).toLocaleString('en-IN')}`:''}</small></div><div className="selectedAnalytics"><span><b>5Y</b> {selectedAnalytics?.returns?.[5]!=null?selectedAnalytics.returns[5].toFixed(2)+'% CAGR':analyticsLoading?'Loading…':'—'}</span><span><b>7Y</b> {selectedAnalytics?.returns?.[7]!=null?selectedAnalytics.returns[7].toFixed(2)+'% CAGR':analyticsLoading?'Loading…':'—'}</span><span><b>10Y</b> {selectedAnalytics?.returns?.[10]!=null?selectedAnalytics.returns[10].toFixed(2)+'% CAGR':analyticsLoading?'Loading…':'—'}</span><span><b>Benchmark</b> {selectedAnalytics?.benchmark||'—'}</span><span><b>Risk-o-meter</b> {selectedAnalytics?.risk||'—'}</span><span><b>TER</b> {selectedAnalytics?.ter?.direct!=null?selectedAnalytics.ter.direct.toFixed(2)+'% Direct':analyticsLoading?'Loading…':'—'}</span></div><small className="mutedLine">{selectedAnalytics?.status==='live'?'Returns are calculated from AMFI historical NAVs. TER is the latest AMFI disclosure found for the AMC. Benchmark and Risk-o-meter are not shown until a scheme-specific disclosure is linked.':'WealthPilot shows only validated scheme-level data and does not invent missing returns, risk or cost data.'}</small><div className="selectedFundActions"><button className="secondary" onClick={async()=>{if(!selectedFund?.code)return;setAnalyticsLoading(true);try{const r=await fetch(`/api/fund-analytics?code=${encodeURIComponent(selectedFund.code)}&name=${encodeURIComponent(selectedFund.name)}&amc=${encodeURIComponent(selectedFund.amc||'')}&nav=${encodeURIComponent(selectedFund.nav||'')}`,{cache:'no-store'});setSelectedAnalytics(await r.json())}finally{setAnalyticsLoading(false)}}}>{analyticsLoading?'Refreshing analytics…':'Refresh analytics'}</button><button className="secondary" onClick={()=>{setSelectedFund(null);setSelectedAnalytics(null)}}>Change fund</button></div>{selectedAnalytics?.sources&&<div className="sourceLinks"><b>Official sources</b><a href={selectedAnalytics.sources.factsheets} target="_blank" rel="noreferrer">AMFI factsheets</a><a href={selectedAnalytics.sources.riskometer} target="_blank" rel="noreferrer">AMFI Risk-o-meter</a><a href={selectedAnalytics.sources.ter} target="_blank" rel="noreferrer">AMFI TER</a></div>}</div>:<div className="researchNote">Pick a fund from Fund Research to make the projection specific to that fund, or use the dynamic SIP allocation below.</div>}<div className="plannerMode"><button className={investmentMode==='monthly'?'sel':''} onClick={()=>setInvestmentMode('monthly')}>Monthly SIP</button><button className={investmentMode==='lumpsum'?'sel':''} onClick={()=>setInvestmentMode('lumpsum')}>One-time lump sum</button></div><label className="fieldLabel">{investmentMode==='monthly'?'Monthly investment':'One-time investment'}</label><input className="numberInput" type="number" min="500" step="500" value={projectionAmount} onChange={e=>setProjectionAmount(Math.max(0,Number(e.target.value)))}/><div className="bigmoney">{money(projectionAmount)} <small>{investmentMode==='monthly'?'/ month':'one time'}</small></div><label className="fieldLabel">Assumed annual return for projection: <b>{assumedReturn}%</b></label><input className="range" type="range" min="6" max="18" step="0.5" value={assumedReturn} onChange={e=>setAssumedReturn(Number(e.target.value))}/><small className="muted">AI uses this assumption only to illustrate possible compounding. Actual returns can be higher or lower.</small><ProjectionTable mode={investmentMode} amount={projectionAmount} rate={assumedReturn}/><div className="aiProjection"><span className="pill green">✦ AI view</span><b>At {assumedReturn}% assumed annual growth, {investmentMode==='monthly'?money(projectionAmount)+' per month':'a '+money(projectionAmount)+' lump sum'} could grow over time — but this is not a prediction or promise.</b><small>Before investing, verify the fund's latest factsheet, benchmark, risk level, expense ratio and current performance on the official/regulated platform.</small></div><div className="plannerSuggestHead"><div><h3>Dynamic SIP allocation</h3><p>WealthPilot adjusts the mix using your inputs and available live schemes.</p></div><button className="secondary" onClick={()=>setAllocationRefresh(x=>x+1)}>Refresh suggestions</button></div><div className="plannerControls"><label>Goal<select value={plannerGoal} onChange={e=>setPlannerGoal(e.target.value)}><option>Wealth creation</option><option>Retirement</option><option>Long-term goal</option><option>Capital preservation</option></select></label><label>Time horizon<select value={plannerHorizon} onChange={e=>setPlannerHorizon(e.target.value)}><option value="1-3">1–3 years</option><option value="3-5">3–5 years</option><option value="5-7">5–7 years</option><option value="7-10">7–10 years</option><option value="10+">10+ years</option></select></label><label>Risk comfort<select value={plannerRisk} onChange={e=>setPlannerRisk(e.target.value)}><option>Low</option><option>Moderate</option><option>High</option></select></label></div><input className="range" type="range" min="10000" max="200000" step="5000" value={amount} onChange={e=>setAmount(Number(e.target.value))}/><div className="bigmoney">{money(amount)} <small>/ month</small></div><div className="allocationMeta"><span>{allocation.length} suggested buckets</span><span>Goal: {plannerGoal}</span><span>Horizon: {plannerHorizon} yrs</span><span>Risk: {plannerRisk}</span></div>{allocation.map(x=><div className="alloc" key={x[0]}><span>{x[0]}<small>{x[2]}</small></span><b>{money(x[1])}</b><i style={{width:`${amount?x[1]/amount*100:0}%`}}/></div>)}<div className="researchNote"><b>How this works:</b> WealthPilot first chooses an allocation by risk, horizon and goal, then selects live AMFI schemes from different categories. It avoids making a performance claim when validated long-term return data is unavailable.</div></div>}

 {active==='Fund Research'&&<div className="card big"><div className="head"><div><span className="pill green">V7 data layer</span><h2>Fund Research</h2><p>NAV, returns, benchmark gap, risk and cost in one view.</p></div><button className="secondary" onClick={refreshFunds} disabled={refreshingFunds}>{refreshingFunds?'Refreshing…':'Refresh data'}</button></div><div className="researchNote">{fundStatus}. Live NAV is sourced server-side from AMFI. Returns, risk and scoring are shown only when validated data is available; WealthPilot does not treat NAV alone as a recommendation.</div><div className="researchToolbar"><input placeholder="Search fund, AMC or category…" value={fundSearch} onChange={e=>setFundSearch(e.target.value)}/><span>{filteredFunds.length} schemes returned</span></div><div className="fundgrid">{filteredFunds.slice(0,60).map(f=>{const a=analyticsForFund(f,dailyPulse);return <div className="fund" key={f.code}><span className="pill">{f.category||'Mutual Fund'}</span><h3>{f.name}</h3><p><b>{f.amc}</b><br/>Scheme code: <b>{f.code}</b><br/>NAV: <b>₹{Number(f.nav).toLocaleString('en-IN')}</b><br/>NAV date: <b>{f.navDate}</b><br/>ISIN: <b>{f.isin||'Not available'}</b></p><div className="analyticsMini"><div><small>Latest 1D</small><b className={a.daily==null?'muted':a.daily>=0?'up':'down'}>{a.daily==null?'—':`${a.daily>=0?'+':''}${a.daily.toFixed(2)}%`}</b></div><div><small>5Y / 7Y / 10Y</small><b className="muted">Not ingested</b></div><div><small>Benchmark</small><b className="muted">Not ingested</b></div><div><small>Risk / TER</small><b className="muted">Not ingested</b></div></div><div className="fundActions"><button className="secondary" onClick={()=>{setSelectedFund({name:f.name,category:f.category||'Mutual Fund',nav:f.nav,amc:f.amc,code:f.code});setProjectionAmount(5000);setInvestmentMode('monthly');setActive('SIP Planner')}}>Plan ₹5,000</button><button className="textBtn" onClick={()=>setSelectedFund({name:f.name,category:f.category||'Mutual Fund',nav:f.nav,amc:f.amc,code:f.code})}>View analytics →</button><button className="textBtn" onClick={()=>{setCompareFunds(prev=>prev.some(x=>x.code===f.code)?prev:prev.length<2?[...prev,{...f}]:[prev[1],{...f}]);setCompareAnalytics([])}}>{compareFunds.some(x=>x.code===f.code)?'Selected for compare ✓':'Compare'}</button></div></div>})}</div><div className="compareBar"><div><b>Compare funds</b><small>{compareFunds.length?compareFunds.map(x=>x.name.replace(/\s+-\s+(Direct|Regular) Plan.*$/i,'')).join('  vs  '):'Select up to 2 funds above'}</small></div><div className="compareActions"><button className="secondary" disabled={compareFunds.length!==2||compareLoading} onClick={async()=>{setCompareLoading(true);try{const data=await Promise.all(compareFunds.map(f=>fetch(`/api/fund-analytics?code=${encodeURIComponent(f.code)}&name=${encodeURIComponent(f.name)}&amc=${encodeURIComponent(f.amc||'')}&nav=${encodeURIComponent(f.nav||'')}`,{cache:'no-store'}).then(r=>r.json())));setCompareAnalytics(data)}finally{setCompareLoading(false)}}}>{compareLoading?'Analysing…':'Compare now'}</button><button className="textBtn" onClick={()=>{setCompareFunds([]);setCompareAnalytics([])}}>Clear</button></div></div>{compareAnalytics.length===2&&<FundComparison funds={compareFunds} analytics={compareAnalytics}/>}
 <div className="analyticsNote"><b>Analytics transparency:</b> Latest NAV is live from AMFI. Long-term returns are calculated from historical NAVs when available. Benchmark, Risk-o-meter and TER are shown only when a validated scheme-level source is available; WealthPilot does not invent missing fund metrics.</div><div className="sourceNote"><b>Official disclosure sources:</b> <a href="https://www.amfiindia.com/online-center/download-factsheets" target="_blank" rel="noreferrer">AMFI factsheets</a> · <a href="https://www.amfiindia.com/online-center/risk-o-meter" target="_blank" rel="noreferrer">AMFI Risk-o-meter</a> · <a href="https://www.amfiindia.com/ter-of-mf-schemes" target="_blank" rel="noreferrer">AMFI TER</a>. WealthPilot only populates scheme-level fields when it can match the official disclosure; otherwise it shows Not linked.</div></div>}

 {active==='Market Intelligence'&&<div className="card big"><h2>Market Intelligence</h2><p>The V7 engine is designed to combine official mutual-fund NAV data, fund performance, benchmark comparison, portfolio/risk data, macro signals and news before generating a recommendation.</p><div className="signals">{['NAV & history · AMFI latest and historical NAV','Fund performance · returns, drawdown and consistency','Benchmark · scheme vs benchmark performance','Portfolio · overlap, sector weights and concentration','Risk · volatility, downside and Risk-o-meter','Macro/news · rates, inflation, earnings and policy'].map(x=><div key={x}><span>●</span><b>{x}</b></div>)}</div>
 <div className="sourceNote">V4 data-source design: AMFI NAV/NAV history is the primary mutual-fund data input; SEBI risk disclosures and benchmark comparisons are part of the risk layer.</div></div>}
 </section></main>
}

function classifyFund(f:any){
 const n=`${f?.name||''} ${f?.category||''}`.toLowerCase()
 if(/small cap/.test(n)) return 'Small Cap'
 if(/mid cap/.test(n) && !/large &? mid/.test(n)) return 'Mid Cap'
 if(/large.*mid|large and mid/.test(n)) return 'Large & Mid Cap'
 if(/flexi cap|multi cap|multicap/.test(n)) return 'Flexi Cap'
 if(/index|nifty|sensex|etf/.test(n)) return 'Index'
 if(/hybrid|balanced advantage|equity savings|aggressive hybrid/.test(n)) return 'Hybrid'
 if(/liquid|overnight|money market|short duration|ultra short|corporate bond|banking.*psu|gilt|debt|bond/.test(n)) return 'Debt'
 if(/manufactur|sector|thematic|infrastructure|technology|pharma|consumption|defence|energy|psu/.test(n)) return 'Thematic'
 if(/elss|tax saver/.test(n)) return 'ELSS'
 return 'Other'
}
function fundQualityScore(f:any,kind:string){
 const n=(f?.name||'').toLowerCase()
 let s=0
 if(classifyFund(f)===kind)s+=50
 if(/direct/.test(n))s+=12
 if(/growth/.test(n))s+=8
 if(/regular|idcw|dividend|payout|closed ended|fof|fund of fund/.test(n))s-=10
 if(/etf/.test(n))s-=8
 if(/index/.test(n) && kind==='Index')s+=5
 return s
}
function chooseFund(funds:any[],kind:string,offset:number){
 const candidates=funds.filter(f=>classifyFund(f)===kind)
   .filter(f=>!/(etf|fund of fund|fof|close[d -]?ended|dividend|idcw)/i.test(f.name||''))
   .sort((a,b)=>fundQualityScore(b,kind)-fundQualityScore(a,kind))
 if(!candidates.length)return null
 return candidates[offset % Math.min(candidates.length,8)] || candidates[0]
}
function buildDynamicAllocation(liveFunds:any[],amount:number,risk:string,horizon:string,goal:string,refresh:number){
 const source=liveFunds||[]
 const targets = risk==='Low'
  ? (horizon==='1-3'||horizon==='3-5' ? [['Index',50],['Hybrid',30],['Debt',20]] : [['Index',45],['Flexi Cap',30],['Hybrid',15],['Debt',10]])
  : risk==='High'
  ? (horizon==='10+' ? [['Flexi Cap',30],['Index',20],['Mid Cap',25],['Small Cap',15],['Debt',10]] : [['Flexi Cap',35],['Index',30],['Mid Cap',20],['Hybrid',10],['Debt',5]])
  : (horizon==='1-3'||horizon==='3-5' ? [['Index',45],['Hybrid',30],['Flexi Cap',15],['Debt',10]] : [['Flexi Cap',35],['Index',30],['Mid Cap',20],['Hybrid',10],['Debt',5]])
 let offset=Math.abs(refresh)%8
 let picked=targets.map(([kind,pct]:any)=>{const f=chooseFund(source,kind,offset); if(f)offset++; return {kind,pct,f}})
 if(goal==='Capital preservation') picked=targets.map(([kind,pct]:any)=>{const f=chooseFund(source,kind==='Index'?'Hybrid':kind,offset); if(f)offset++; return {kind,pct,f}})
 let usable=picked.filter(x=>x.f)
 if(!usable.length){
   return [['AMFI live schemes unavailable','Review after data refresh','Refresh AMFI data']].map((x:any)=>[x[0],0,x[1]]) as [string,number,string][]
 }
 let totalPct=usable.reduce((a,x)=>a+x.pct,0)
 let rows=usable.map(x=>[x.f.name,Math.round(amount*x.pct/totalPct),`${x.kind} · ${Math.round(x.pct/totalPct)}% target`]) as [string,number,string][]
 const diff=amount-rows.reduce((a,x)=>a+x[1],0)
 if(rows.length)rows[0][1]+=diff
 return rows
}


function DashboardView({holdings,sips,totals,liveFunds,dailyPulse,setActive}:{holdings:Holding[];sips:Sip[];totals:any;liveFunds:any[];dailyPulse:any[];setActive:any}){
 const analysis=useMemo(()=>analyzePortfolio(holdings),[holdings])
 const pulseStats=useMemo(()=>{const p=dailyPulse.filter(x=>Number.isFinite(Number(x.changePct)));if(!p.length)return {avg:0,up:0,down:0};return {avg:p.reduce((a,x)=>a+Number(x.changePct),0)/p.length,up:p.filter(x=>x.changePct>0).length,down:p.filter(x=>x.changePct<0).length}},[dailyPulse])
 const categoryCount=new Set(liveFunds.map(f=>f.category||'Mutual Fund')).size
 if(!holdings.length) return <div className="dashboardCockpit">
   <div className="newUserHero card"><div><span className="pill green">✦ New to WealthPilot</span><h2>Your investing dashboard starts here.</h2><p>You haven't added any investments yet, so WealthPilot is not showing made-up portfolio values. Start with research, planning or the AI Fund Manager.</p><div className="newUserActions"><button className="primary" onClick={()=>setActive('AI Fund Manager')}>Ask AI Fund Manager →</button><button className="secondary" onClick={()=>setActive('Fund Research')}>Research funds</button><button className="secondary" onClick={()=>setActive('SIP Planner')}>Plan a SIP</button></div></div><div className="emptyOrb">✦<small>AI copilot</small></div></div>
   <div className="dashboardGrid three">
    <div className="card dashboardCard"><div className="eyebrow">MARKET PULSE</div><h3>{pulseStats.avg>0?'🙂 Positive':'😐 Mixed'} today</h3><p>{dailyPulse.length?`${pulseStats.up} funds up · ${pulseStats.down} funds down in the latest available NAV sample.`:'Waiting for the latest available NAV sample.'}</p><button className="textBtn" onClick={()=>setActive('Market Intelligence')}>View market intelligence →</button></div>
    <div className="card dashboardCard"><div className="eyebrow">FUND UNIVERSE</div><h3>{liveFunds.length?liveFunds.length.toLocaleString('en-IN'):'—'} schemes</h3><p>{liveFunds.length?`${categoryCount} categories are currently represented in the live AMFI data loaded by WealthPilot.`:'Refresh Fund Research to load live AMFI data.'}</p><button className="textBtn" onClick={()=>setActive('Fund Research')}>Explore funds →</button></div>
    <div className="card dashboardCard"><div className="eyebrow">AI FUND MANAGER</div><h3>Start with a question</h3><p>Compare funds, understand risk, plan a SIP or learn the basics in plain language.</p><button className="textBtn" onClick={()=>setActive('AI Fund Manager')}>Ask a question →</button></div>
   </div>
   <div className="dashboardGrid two">
    <div className="card insightCard"><div className="eyebrow">✦ WEALTHPILOT INSIGHT</div><h3>There is nothing to analyse yet — and that's okay.</h3><p>Once you add holdings, WealthPilot can check fund concentration, category overlap, long-term consistency, benchmark performance, risk and costs.</p><div className="insightChecks"><span>✓ Concentration</span><span>✓ Fund overlap</span><span>✓ Risk</span><span>✓ Benchmark</span><span>✓ 5Y / 7Y / 10Y</span><span>✓ Expense ratio</span></div></div>
    <div className="card dashboardCard"><div className="eyebrow">🎯 THIS MONTH</div><h3>Build an investment plan</h3><p>Tell WealthPilot how much you want to invest, your horizon and risk comfort. Suggestions are for consideration, not an order.</p><button className="primary wide" onClick={()=>setActive('SIP Planner')}>Build my SIP plan →</button></div>
   </div>
   <div className="card learnCard"><div><div className="eyebrow">🧠 30-SECOND LEARN</div><h3>Why CAGR matters</h3><p>CAGR shows an annualised growth rate over a period. It helps compare long-term growth, but it does not describe the path taken or guarantee future returns.</p></div><button className="secondary" onClick={()=>setActive('AI Fund Manager')}>Learn with AI →</button></div>
 </div>
 return <div className="dashboardCockpit">
   <div className="hero card"><div><span className="pill green">● AI view: Portfolio review</span><h2>Your portfolio is ready to review.</h2><p>WealthPilot can now analyse your allocation, performance, overlap and risk using the holdings you've added.</p></div><div className="health"><small>Portfolio health</small><strong>{analysis.score}</strong><span>{analysis.label}</span></div></div>
   <div className="grid4"><Metric l="Portfolio value" v={money(totals.c)} d={`${totals.g>=0?'+':''}${money(totals.g)} gain`}/><Metric l="Invested" v={money(totals.i)} d={`${totals.p.toFixed(1)}% return`}/><Metric l="Monthly SIP" v={money(sips.reduce((a,s)=>a+s.amount,0))} d={sips.length?'Active':'Not added'}/><Metric l="Funds" v={String(holdings.length)} d={`${analysis.categoryCount} categories`}/></div>
   <div className="dashboardGrid two">
    <div className="card insightCard"><div className="eyebrow">✦ WEALTHPILOT INSIGHT</div><h3>{analysis.title}</h3><p>{analysis.text}</p><div className="insightChecks"><span>Concentration {analysis.topPct}%</span><span>{analysis.categoryCount} categories</span><span>{analysis.overlapFlag?'Overlap to review':'No obvious overlap signal'}</span></div><button className="textBtn" onClick={()=>setActive('AI Fund Manager')}>Ask AI to explain →</button></div>
    <div className="card dashboardCard"><div className="eyebrow">📈 YOUR FUNDS</div>{holdings.slice(0,4).map(h=><div className="holdingMini" key={h.name}><div><b>{h.name}</b><small>{h.category}</small></div><strong>{h.invested?`${((h.current-h.invested)/h.invested*100).toFixed(1)}%`:'—'}</strong></div>)}<button className="textBtn" onClick={()=>setActive('AI Fund Manager')}>Analyse my funds →</button></div>
   </div>
   <div className="dashboardGrid three">
    <div className="card dashboardCard"><div className="eyebrow">MARKET PULSE</div><h3>{pulseStats.avg>0?'🙂 Positive':'😐 Mixed'} today</h3><p>{dailyPulse.length?`${pulseStats.up} up · ${pulseStats.down} down in latest NAV sample.`:'Latest NAV sample unavailable.'}</p><button className="textBtn" onClick={()=>setActive('Market Intelligence')}>View market →</button></div>
    <div className="card dashboardCard"><div className="eyebrow">🔔 NEXT SIP</div><h3>{sips.length?'Review your SIP schedule':'No SIP added'}</h3><p>{sips.length?'Your SIP reminders can be configured from My SIPs.':'Create a plan first, then add the SIP details you want to track.'}</p><button className="textBtn" onClick={()=>setActive(sips.length?'My SIPs':'SIP Planner')}>{sips.length?'View My SIPs →':'Plan a SIP →'}</button></div>
    <div className="card dashboardCard"><div className="eyebrow">🎯 THIS MONTH</div><h3>Review your plan</h3><p>Use your current amount, goal and risk comfort to generate a fresh shortlist.</p><button className="textBtn" onClick={()=>setActive('SIP Planner')}>Open SIP Planner →</button></div>
   </div>
 </div>
}

function analyzePortfolio(holdings:Holding[]){
 if(!holdings.length)return {score:0,label:'No holdings',title:'No portfolio yet',text:'Add holdings to unlock portfolio analysis.',topPct:0,categoryCount:0,overlapFlag:false}
 const total=holdings.reduce((a,h)=>a+h.current,0)
 const byCat:Record<string,number>={}; holdings.forEach(h=>byCat[h.category]=(byCat[h.category]||0)+h.current)
 const topCat=Math.max(...Object.values(byCat)); const topPct=total?Math.round(topCat/total*100):0
 const categoryCount=Object.keys(byCat).length
 const overlapFlag=holdings.length>=2 && categoryCount<holdings.length
 let score=100-(topPct>60?20:topPct>45?10:0)-(categoryCount===1?15:0)-(holdings.length===1?10:0)
 score=Math.max(45,Math.min(100,score))
 const label=score>=80?'Healthy structure':score>=65?'Worth reviewing':'Needs attention'
 const title=topPct>60?'High concentration deserves a review':overlapFlag?'Some holdings share the same category':'Portfolio structure looks reasonably spread'
 const text=topPct>60?`About ${topPct}% of your portfolio value sits in one category. Check whether that concentration matches your goal and risk comfort.`:overlapFlag?'You have more funds than distinct categories. Review whether the funds add different exposure or mainly duplicate each other.':'Your holdings are spread across multiple categories. The next step is to validate long-term performance, benchmark gap, risk and costs.'
 return {score,label,title,text,topPct,categoryCount,overlapFlag}
}

function AIFundManager({aiQuestion,setAiQuestion,aiCategory,setAiCategory,aiView,setAiView,setActive,liveFunds,holdings,totals,setSelectedFund,setProjectionAmount,setInvestmentMode}:{aiQuestion:string;setAiQuestion:any;aiCategory:string;setAiCategory:any;aiView:any;setAiView:any;setActive:any;liveFunds:any[];holdings:Holding[];totals:any;setSelectedFund:any;setProjectionAmount:any;setInvestmentMode:any}){
 const categories=[
  {name:'Find a Fund',icon:'⌕',qs:['Which fund is suitable for my goal?','Compare two funds','Which fund has performed better over 7–10 years?','Which fund can diversify my portfolio?']},
  {name:'Investment Planning',icon:'₹',qs:['I have ₹5,000 to invest. What should I consider?','Should I invest monthly or as a lump sum?','How much should I invest to reach my goal?','What could ₹5,000/month grow to in 5, 7 or 10 years?']},
  {name:'Understand My Fund',icon:'◉',qs:['Why is my fund down?','Is this fund high or low risk?','How has my fund performed historically?','Should I continue my SIP or review it?']},
  {name:'Learn',icon:'?',qs:['What is NAV?','What is CAGR?','SIP vs lump sum?','What does expense ratio mean?']}
 ]
 const run=(q:string)=>{
   setAiQuestion(q)
   const lower=q.toLowerCase()
   let view:any={title:'AI View',summary:'Tell me a little more about your goal, time horizon and risk comfort, and I can structure the analysis.',bullets:[],action:null}
   if(lower.includes('compare')) view={title:'Compare funds',summary:'I can compare two funds across the dimensions that matter instead of looking only at returns.',bullets:['Long-term performance and consistency','Risk / volatility and drawdowns','Benchmark comparison','Expense ratio and portfolio role'],action:'Open Fund Research to search both schemes.'}
   else if(lower.includes('₹5,000')||lower.includes('invest this month')||lower.includes('monthly')||lower.includes('lump sum')) view={title:'Investment planning',summary:'Start with your investment amount, time horizon and risk comfort. Then compare SIP versus lump sum rather than choosing a fund from returns alone.',bullets:['Set a realistic time horizon','Keep core allocation diversified','Use thematic exposure cautiously','Illustrate 5 / 7 / 10-year compounding separately from expected returns'],action:'Open SIP Planner for a ₹5,000 illustration.'}
   else if(lower.includes('down')||lower.includes('underperform')||lower.includes('continue my sip')||lower.includes('historically')) view={title:'Understand your fund',summary:holdings.length?`Your current portfolio value is ${money(totals.c)}. I can help investigate a fund's performance, benchmark and risk before you decide what to do.`:'You have not added holdings yet, so there is no personal portfolio performance to explain. Search a fund in Fund Research or add your holdings later.',bullets:['Check the benchmark and peer group','Separate short-term volatility from persistent underperformance','Review risk and portfolio concentration','Avoid making a decision from one bad month'],action:'Open Fund Research.'}
   else if(lower.includes('nav')||lower.includes('cagr')||lower.includes('expense')) view={title:'Learn the basics',summary:'WealthPilot can explain investing concepts in plain language before you make a decision.',bullets:[lower.includes('nav')?'NAV is the per-unit value of a mutual-fund scheme.':'Start with NAV, CAGR, risk and expense ratio as core concepts.','CAGR describes annualised growth over a period; it is not a guarantee.','Expense ratio is a recurring fund-level cost that affects returns.'],action:'Ask another question or explore Fund Research.'}
   else if(lower.includes('suitable')||lower.includes('goal')||lower.includes('diversify')) view={title:'Goal-based fund view',summary:'A fund should be evaluated against your goal, time horizon, risk comfort and existing portfolio — not just its recent return.',bullets:['Goal and horizon first','Risk capacity and Risk-o-meter','Existing portfolio overlap','7Y / 10Y history where validated data is available'],action:'Open Fund Research to shortlist funds for comparison.'}
   setAiView(view)
 }
 return <div className="card big aiManager"><div className="aiManagerHero"><div><span className="pill green">✦ RVS WealthPilot AI</span><h2>Ask your fund manager</h2><p>Choose a question below or type anything. WealthPilot will guide the analysis and show an AI view without executing investments.</p></div><div className="aiAvatar">✦<small>Copilot</small></div></div>
 <div className="aiSearch"><input value={aiQuestion} onChange={e=>setAiQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&aiQuestion.trim())run(aiQuestion)}} placeholder="Ask anything about your funds, SIPs or investing…"/><button className="primary" onClick={()=>aiQuestion.trim()&&run(aiQuestion)}>Ask AI →</button></div>
 <div className="aiCategories">{categories.map(c=><button key={c.name} className={aiCategory===c.name?'aiCat active':'aiCat'} onClick={()=>setAiCategory(c.name)}><span>{c.icon}</span><b>{c.name}</b></button>)}</div>
 <div className="questionGrid">{categories.find(c=>c.name===aiCategory)?.qs.map(q=><button key={q} onClick={()=>run(q)}><span>＋</span>{q}</button>)}</div>
 {aiView&&<div className="aiAnswer"><div className="answerTop"><span className="pill green">AI View</span><small>Guided analysis</small></div><h3>{aiView.title}</h3><p>{aiView.summary}</p><ul>{aiView.bullets.map((b:string,i:number)=><li key={i}>{b}</li>)}</ul>{aiView.action&&<div className="answerAction"><b>Next step</b><span>{aiView.action}</span><button className="secondary" onClick={()=>{if(aiView.title==='Investment planning'){setProjectionAmount(5000);setInvestmentMode('monthly');setActive('SIP Planner')}else setActive('Fund Research')}}>{aiView.title==='Investment planning'?'Open SIP Planner':'Open Research'}</button></div>}</div>}
 <div className="aiGuardrail"><b>How WealthPilot responds</b><span>It can explain, compare and illustrate. It does not place orders, take custody of money or promise returns.</span></div></div>
}

function FundComparison({funds,analytics}:{funds:any[];analytics:any[]}){
 const metric=(a:any,key:string)=>a?.returns?.[key]
 const vals=(key:string)=>analytics.map(a=>metric(a,key)).filter((v:any)=>typeof v==='number'&&Number.isFinite(v))
 const avg=(key:string)=>{const v=vals(key);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null}
 const score=(i:number)=>{
   let score=50
   const a=analytics[i]
   const peers=analytics.map(x=>x.returns||{})
   for(const y of [5,7,10]){const v=Number(a?.returns?.[y]);const all=peers.map(x=>Number(x[y])).filter(Number.isFinite);if(Number.isFinite(v)&&all.length===2){const other=all.find(x=>x!==v);if(other!==undefined)score+=v>other?12:-8}}
   const ter=Number(a?.ter?.direct); const otherTer=Number(analytics[1-i]?.ter?.direct);if(Number.isFinite(ter)&&Number.isFinite(otherTer))score+=ter<otherTer?8:-5
   return Math.max(0,Math.min(100,Math.round(score)))
 }
 const s0=score(0),s1=score(1),winner=s0===s1?null:s0>s1?0:1
 const row=(label:string,key:string)=>{const a=metric(analytics[0],key),b=metric(analytics[1],key);return <div className="compareRow"><span>{label}</span><b className={winner===0?'winner':''}>{a!=null?a.toFixed(2)+'%':'—'}</b><b className={winner===1?'winner':''}>{b!=null?b.toFixed(2)+'%':'—'}</b></div>}
 return <div className="comparePanel"><div className="compareHeader"><div><span className="pill green">Fund Compare</span><h3>WealthPilot research score</h3><p>Transparent comparison using only validated metrics currently available. This is a research signal, not a recommendation.</p></div></div><div className="compareGrid"><div className="compareFundHead"><small>Fund A</small><b>{funds[0].name}</b><strong>{s0}/100</strong></div><div className="compareFundHead"><small>Fund B</small><b>{funds[1].name}</b><strong>{s1}/100</strong></div></div><div className="compareTable"><div className="compareRow head"><span>Metric</span><b>{funds[0].name.replace(/\\s+-\\s+(Direct|Regular) Plan.*$/i,'')}</b><b>{funds[1].name.replace(/\\s+-\\s+(Direct|Regular) Plan.*$/i,'')}</b></div>{row('5Y CAGR',5)}{row('7Y CAGR',7)}{row('10Y CAGR',10)}<div className="compareRow"><span>Direct TER</span><b className={winner===0?'winner':''}>{analytics[0]?.ter?.direct!=null?analytics[0].ter.direct.toFixed(2)+'%':'—'}</b><b className={winner===1?'winner':''}>{analytics[1]?.ter?.direct!=null?analytics[1].ter.direct.toFixed(2)+'%':'—'}</b></div><div className="compareRow"><span>Benchmark</span><b>{analytics[0]?.benchmark||'Not linked'}</b><b>{analytics[1]?.benchmark||'Not linked'}</b></div><div className="compareRow"><span>Risk-o-meter</span><b>{analytics[0]?.risk||'Not linked'}</b><b>{analytics[1]?.risk||'Not linked'}</b></div></div><div className="compareInsight"><b>{winner===null?'No clear winner from available data':`Research signal: ${funds[winner].name}`}</b><span>{winner===null?'The currently validated metrics do not create a meaningful separation. Compare the funds on goal, risk, portfolio role and official scheme disclosures.':'The higher score reflects the currently available validated long-term return metrics and, where available, lower Direct TER. It does not predict future performance.'}</span></div></div>
}

function AccountPanel({profile,setProfile,onClose}:{profile:any;setProfile:any;onClose:()=>void}){const file=(e:any)=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>setProfile((p:any)=>({...p,photo:String(r.result)}));r.readAsDataURL(f)};return <div className="accountPanel"><div className="accountHead"><div><b>Account details</b><small>Your WealthPilot profile</small></div><button onClick={onClose}>×</button></div><div className="avatarEdit">{profile.photo?<img src={profile.photo} alt="Profile"/>:<div className="avatarFallback">{(profile.name||"RVS").split(" ").map((x:string)=>x[0]).join("").slice(0,2).toUpperCase()}</div>}<label className="uploadBtn">Change photo<input type="file" accept="image/*" onChange={file}/></label></div><label>Name<input value={profile.name} onChange={e=>setProfile((p:any)=>({...p,name:e.target.value}))}/></label><label>Email<input type="email" value={profile.email} onChange={e=>setProfile((p:any)=>({...p,email:e.target.value}))}/></label><label>Mobile<input inputMode="tel" value={profile.mobile} onChange={e=>setProfile((p:any)=>({...p,mobile:e.target.value}))}/></label><button className="primary full" onClick={onClose}>Save profile</button></div>}
function Metric(p:{l:string;v:string;d:string}){return <div className="card metric"><small>{p.l}</small><strong>{p.v}</strong><em>{p.d}</em></div>}
function Chart(){let min=Math.min(...chart),max=Math.max(...chart);let pts=chart.map((v,i)=>`${i/(chart.length-1)*100},${90-(v-min)/(max-min)*75}`).join(' ');return <div className="chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke"/></svg><div><span>12 mo ago</span><span>6 mo ago</span><span>Now</span></div></div>}

function ProjectionTable({mode,amount,rate}:{mode:'monthly'|'lumpsum';amount:number;rate:number}){const years=[5,7,10];return <div className="projectionWrap"><div className="projectionHead"><div><h3>Estimated growth</h3><small>{mode==='monthly'?money(amount)+' invested every month':'One-time investment of '+money(amount)}</small></div><span>{rate}% assumed annual return</span></div><div className="projectionGrid">{years.map(y=>{const r=rate/100/12,n=y*12;const value=mode==='monthly'?(r===0?amount*n:amount*((Math.pow(1+r,n)-1)/r)):(amount*Math.pow(1+rate/100,y));const invested=mode==='monthly'?amount*n:amount;return <div className="projectionCard" key={y}><span>{y} years</span><strong>{money(value)}</strong><small>Invested {money(invested)}</small><em>Potential gain {money(value-invested)}</em></div>})}</div></div>}
