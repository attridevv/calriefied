/* Calorified — app.js */
/* Fresh, vitality health tracker */

'use strict';

// ===== STORAGE KEYS =====
const DATA_KEY  = 'calorified_data';
const PROFILE_KEY = 'calorified_profile';
const BODY_KEY  = 'calorified_body';

// ===== PROFILE (persistent across days) =====
function getProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; }
  catch { return {}; }
}
function saveProfile(p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }

// ===== DATA (per-day) =====
function getData() {
  try { return JSON.parse(localStorage.getItem(DATA_KEY)) || {}; }
  catch { return {}; }
}
function saveData(d) { localStorage.setItem(DATA_KEY, JSON.stringify(d)); }
function getDayData(date) {
  const d = getData();
  const k = dateKey(date);
  if (!d[k]) d[k] = { foods: [], water: 0 };
  return d[k];
}
function saveDayData(date, day) {
  const d = getData();
  d[dateKey(date)] = day;
  saveData(d);
}

// ===== BODY HISTORY =====
function getBody() {
  try { return JSON.parse(localStorage.getItem(BODY_KEY)) || []; }
  catch { return []; }
}
function saveBody(arr) { localStorage.setItem(BODY_KEY, JSON.stringify(arr)); }

// ===== HELPERS =====
function dateKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function isToday(d) { return dateKey(d) === dateKey(new Date()); }
function isFuture(d) {
  const today = new Date(); today.setHours(0,0,0,0);
  const dd = new Date(d); dd.setHours(0,0,0,0);
  return dd > today;
}
function fmtDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmt(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
function fmtKcal(n){ return Math.round(n); }
function escape(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(t,d2){
  const el=document.createElement('div'); el.className='toast';
  el.innerHTML=`<div class="t">${escape(t)}</div><div class="d">${escape(d2)}</div>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; },2200);
  setTimeout(()=>el.remove(),2600);
}

// ===== STATE =====
let activeDate = new Date();
let activeView = 'dashboard';

// ===== UI HELPERS =====
function $(id){ return document.getElementById(id); }
function showView(view){
  activeView=view;
  document.querySelectorAll('.view').forEach(v=>{
    v.classList.toggle('active', v.dataset.view===view);
  });
  document.querySelectorAll('.nav-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.view===view);
  });
  // re-render view content
  if(view==='dashboard') renderDashboard();
  else if(view==='log') renderLog();
  else if(view==='body') renderBody();
  else if(view==='weekly') renderWeekly();
  else if(view==='coaching') renderCoaching();
}
function setSidebarOpen(open){
  $('sidebar').classList.toggle('open',!!open);
}

// ===== DATE NAVIGATION =====
function changeDate(offset){
  activeDate.setDate(activeDate.getDate()+offset);
  renderDateLabel();
  renderDashboard();
  renderLog();
  renderNavCal();
}
function renderDateLabel(){
  const today=new Date();
  const key=dateKey(activeDate);
  const todayKey=dateKey(today);
  const yesterday=new Date(today); yesterday.setDate(yesterday.getDate()-1);
  const tomorrow=new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  let label;
  if(key===todayKey) label='Today';
  else if(key===dateKey(yesterday)) label='Yesterday';
  else if(key===dateKey(tomorrow)) label='Tomorrow';
  else label=fmtDate(activeDate);
  $('dateLabel').textContent=label;
}
function renderNavCal(){
  const day=getDayData(activeDate);
  const total=(day.foods||[]).reduce((s,f)=>s+(f.calories||0),0);
  $('navCalDay').textContent=fmtKcal(total);
}

// ===== COMPUTED MACROS =====
function calcTotals(foods){
  return (foods||[]).reduce((a,f)=>({
    calories: a.calories+(f.calories||0),
    protein:  a.protein+(f.protein||0),
    carbs:    a.carbs+(f.carbs||0),
    fat:      a.fat+(f.fat||0),
    fiber:    a.fiber+(f.fiber||0),
  }),{calories:0,protein:0,carbs:0,fat:0,fiber:0});
}
function getGoals(){
  const p=getProfile();
  return {
    calories: p.goals?.calories||2500,
    protein: p.goals?.protein||170,
    carbs:   p.goals?.carbs||260,
    fat:     p.goals?.fat||65,
    fiber:   p.goals?.fiber||30,
    water:   p.goals?.water||2500,
  };
}

// ===== RING ANIMATION =====
function animateRing(el, pct){
  // pct 0..1
  const circ=2*Math.PI*80; // r=80
  el.style.strokeDashoffset=circ*(1-clamp(pct,0,1));
}
function animateMiniRing(el, pct){
  const circ=2*Math.PI*22; // r=22
  el.style.strokeDashoffset=circ*(1-clamp(pct,0,1));
}

// ===== DASHBOARD RENDER =====
function renderDashboard(){
  const day=getDayData(activeDate);
  const goals=getGoals();
  const totals=calcTotals(day.foods);
  const waterPct=clamp(day.water/goals.water,0,1);

  // Main ring
  const mainPct=Math.min(totals.calories/goals.calories,1);
  animateRing($('mainRing'), mainPct);
  $('ringVal').textContent=fmtKcal(totals.calories);
  const rem=Math.max(0,goals.calories-totals.calories);
  $('ringRem').textContent=rem>0?`${fmtKcal(rem)} remaining`:`${fmtKcal(rem)} over`;

  // Mini macro rings
  animateMiniRing($('ringProFill'), clamp(totals.protein/goals.protein,0,1));
  animateMiniRing($('ringCarbFill'), clamp(totals.carbs/goals.carbs,0,1));
  animateMiniRing($('ringFatFill'), clamp(totals.fat/goals.fat,0,1));
  animateMiniRing($('ringFiberFill'), clamp(totals.fiber/goals.fiber,0,1));

  $('dashPro').textContent=fmtKcal(totals.protein)+'g';
  $('dashProGoal').textContent='/'+goals.protein+'g';
  $('dashCarb').textContent=fmtKcal(totals.carbs)+'g';
  $('dashCarbGoal').textContent='/'+goals.carbs+'g';
  $('dashFat').textContent=fmtKcal(totals.fat)+'g';
  $('dashFatGoal').textContent='/'+goals.fat+'g';
  $('dashFiber').textContent=fmtKcal(totals.fiber)+'g';
  $('dashFiberGoal').textContent='/'+goals.fiber+'g';

  // Water
  $('waterLabel').textContent=`${day.water||0} / ${goals.water} ml`;
  $('waterFill').style.width=(waterPct*100)+'%';

  // Today's meals
  const meals=[
    {key:'breakfast',label:'Breakfast',icon:'☀️'},
    {key:'lunch',label:'Lunch',icon:'🌞'},
    {key:'dinner',label:'Dinner',icon:'🌙'},
    {key:'snacks',label:'Snacks',icon:'🍪'},
  ];
  $('dashMeals').innerHTML=meals.map(m=>{
    const mf=(day.foods||[]).filter(f=>f.meal===m.key);
    const mc=mf.reduce((s,f)=>s+(f.calories||0),0);
    const rows=mf.slice(0,3).map(f=>`
      <div class="food-row">
        <span class="name">${escape(f.name)}</span>
        <div class="macros">
          <span class="mc cal">${fmtKcal(f.calories)}</span>
          <span class="mc pro">${fmtKcal(f.protein)}g P</span>
          <span class="mc carb">${fmtKcal(f.carbs)}g C</span>
          <span class="mc fat">${fmtKcal(f.fat)}g F</span>
        </div>
        <button class="del" data-id="${f.id}" data-view="dashboard">×</button>
      </div>`).join('');
    const more=mf.length>3?`<div style="font-size:11px;color:var(--text3);padding:4px 12px;">+${mf.length-3} more</div>`:'';
    return `
      <div class="meal-card fade-up">
        <div class="meal-head">
          <h3>${m.icon} ${m.label}</h3>
          <span class="total">${fmtKcal(mc)} cal</span>
        </div>
        ${mf.length?rows+more:`<div class="empty-meal">No foods logged</div>`}
      </div>`;
  }).join('');

  // Delete handlers
  $('dashMeals').onclick=e=>{
    const btn=e.target.closest('.del');
    if(btn) deleteFood(Number(btn.dataset.id), btn.dataset.view);
  };
}

// ===== LOG VIEW RENDER =====
function renderLog(){
  const goals=getGoals();
  const day=getDayData(activeDate);
  const totals=calcTotals(day.foods);

  // Goals display
  $('goalsDisplay').innerHTML=`
    <div class="macro-ring" style="cursor:pointer;" onclick="promptGoals()">
      <div style="flex:1;"><div class="val" style="font-size:1.3rem;color:var(--cal);">${fmtKcal(goals.calories)}</div><div class="lbl" style="color:var(--text2);font-size:11px;">Calories</div></div>
    </div>
    <div class="macro-ring">
      <div style="flex:1;"><div class="val" style="font-size:1.3rem;color:var(--protein);">${goals.protein}g</div><div class="lbl" style="color:var(--text2);font-size:11px;">Protein</div></div>
    </div>
    <div class="macro-ring">
      <div style="flex:1;"><div class="val" style="font-size:1.3rem;color:var(--carbs);">${goals.carbs}g</div><div class="lbl" style="color:var(--text2);font-size:11px;">Carbs</div></div>
    </div>
    <div class="macro-ring">
      <div style="flex:1;"><div class="val" style="font-size:1.3rem;color:var(--fat);">${goals.fat}g</div><div class="lbl" style="color:var(--text2);font-size:11px;">Fat</div></div>
    </div>
    <div class="macro-ring">
      <div style="flex:1;"><div class="val" style="font-size:1.3rem;color:var(--fiber);">${goals.fiber}g</div><div class="lbl" style="color:var(--text2);font-size:11px;">Fiber</div></div>
    </div>`;

  const meals=[
    {key:'breakfast',label:'Breakfast',icon:'☀️'},
    {key:'lunch',label:'Lunch',icon:'🌞'},
    {key:'dinner',label:'Dinner',icon:'🌙'},
    {key:'snacks',label:'Snacks',icon:'🍪'},
  ];
  $('logMeals').innerHTML=meals.map(m=>{
    const mf=(day.foods||[]).filter(f=>f.meal===m.key);
    const mc=mf.reduce((s,f)=>s+(f.calories||0),0);
    const rows=mf.map(f=>`
      <li class="food-row">
        <span class="name">${escape(f.name)}</span>
        <div class="macros">
          <span class="mc cal">${fmtKcal(f.calories)}</span>
          <span class="mc pro">${fmtKcal(f.protein)}g P</span>
          <span class="mc carb">${fmtKcal(f.carbs)}g C</span>
          <span class="mc fat">${fmtKcal(f.fat)}g F</span>
          <span class="mc" style="color:var(--text3);">${fmtKcal(f.fiber)}g fi</span>
        </div>
        <button class="del" data-id="${f.id}" data-view="log">×</button>
      </li>`).join('');
    return `
      <div class="meal-card fade-up">
        <div class="meal-head">
          <h3>${m.icon} ${m.label}</h3>
          <span class="total">${fmtKcal(mc)} cal</span>
        </div>
        <ul class="food-list">${mf.length?rows:`<li><div class="empty-meal">No foods logged</div></li>`}</ul>
      </div>`;
  }).join('');

  $('logMeals').onclick=e=>{
    const btn=e.target.closest('.del');
    if(btn) deleteFood(Number(btn.dataset.id), btn.dataset.view);
  };
}

// ===== BODY VIEW RENDER =====
function calcTDEE(weight, height, age, sex='male', activity=1.55){
  // Mifflin-St Jeor
  let bmr;
  if(sex==='male') bmr=10*weight+6.25*height-5*age+5;
  else bmr=10*weight+6.25*height-5*age-161;
  return Math.round(bmr*activity);
}
function calcBMI(weight, height){
  if(!weight||!height) return null;
  return (weight/Math.pow(height/100,2)).toFixed(1);
}
function renderBody(){
  const p=getProfile();
  const body=getBody();
  const goals=getGoals();

  // TDEE
  const w=p.weight||0, h=p.height||0, a=p.age||0;
  const tdee=calcTDEE(w,h,a,'male',1.55);
  $('tdeeVal').textContent=w&&h&&a?tdee:'--';
  const bmi=calcBMI(w,h);
  $('bmiVal').textContent=bmi||'--';

  // Recommended macros
  if(tdee){
    const recPro=Math.round(w*2); // 2g/kg
    const recFat=Math.round(w*0.8); // 0.8g/kg
    const proCal=recPro*4;
    const fatCal=recFat*9;
    const carbCal=tdee-proCal-fatCal;
    const recCarb=Math.round(carbCal/4);
    $('recPro').textContent=recPro+'g';
    $('recProCal').textContent=proCal+' kcal';
    $('recCarb').textContent=recCarb+'g';
    $('recCarbCal').textContent=carbCal+' kcal';
    $('recFat').textContent=recFat+'g';
    $('recFatCal').textContent=fatCal+' kcal';
  }

  // Body form prefill
  if(p.weight) $('bodyWeight').value=p.weight;
  if(p.height) $('bodyHeight').value=p.height;
  if(p.age)     $('bodyAge').value=p.age;
  if(p.goal)    $('bodyGoal').value=p.goal;

  // History
  const recent=[...body].reverse().slice(0,14);
  if(recent.length===0){
    $('bodyHistory').innerHTML=`<div class="empty-meal">No body stats logged yet. Save your profile to get started.</div>`;
  } else {
    $('bodyHistory').innerHTML=recent.map(b=>{
      const d=new Date(b.date);
      const bmi2=calcBMI(b.weight,p.height||b.height||0);
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:var(--surface);border:1px solid var(--border);margin-bottom:6px;">
          <span style="font-size:11px;color:var(--text2);width:80px;">${fmt(d)}</span>
          <span style="flex:1;font-weight:800;">${b.weight} kg</span>
          <span style="font-size:11px;color:var(--text2);">BMI ${bmi2||'--'}</span>
          <span style="font-size:11px;color:var(--text3);">${b.goal||''}</span>
        </div>`;
    }).join('');
  }
}

// ===== WEEKLY VIEW RENDER =====
function renderWeekly(){
  const today=new Date();
  const days=[];
  for(let i=6;i>=0;i--){
    const d=new Date(today); d.setDate(d.getDate()-i);
    days.push(d);
  }

  const goals=getGoals();

  $('weekGrid').innerHTML=days.map(d=>{
    const day=getDayData(d);
    const totals=calcTotals(day.foods||[]);
    const pct=clamp(totals.calories/goals.calories,0,1.2);
    const barH=Math.round(pct*60);
    const dow=d.toLocaleDateString('en-US',{weekday:'short'}).slice(0,2);
    const dom=d.getDate();
    const isTod=d.getDate()===today.getDate()&&d.getMonth()===today.getMonth()&&d.getFullYear()===today.getFullYear();
    return `
      <div class="day-col ${isTod?'today':''} ${isFuture(d)?'future':''}">
        <div class="dow">${dow}</div>
        <div class="dom">${dom}</div>
        <div class="kcal">${fmtKcal(totals.calories)}</div>
        <div class="bar-wrap"><div class="bar" style="height:${barH}px;"></div></div>
      </div>`;
  }).join('');

  // Week totals
  let wkCal=0,wkPro=0,wkCarb=0,wFat=0,wFiber=0;
  let count=0;
  days.forEach(d=>{
    const day=getDayData(d);
    const t=calcTotals(day.foods||[]);
    wkCal+=t.calories; wkPro+=t.protein; wkCarb+=t.carbs; wFat+=t.fat; wFiber+=t.fiber;
    if((day.foods||[]).length>0) count++;
  });

  $('wkTotalCal').textContent=fmtKcal(wkCal);
  $('wkTotalPro').textContent=fmtKcal(wkPro)+'g';
  $('wkTotalCarb').textContent=fmtKcal(wkCarb)+'g';
  $('wkTotalFat').textContent=fmtKcal(wFat)+'g';
  $('wkTotalFiber').textContent=fmtKcal(wFiber)+'g';

  const avgCal=count?Math.round(wkCal/count):0;
  $('avgCalories').textContent=avgCal;
  const diff=avgCal-Math.round(goals.calories);
  $('avgVsGoal').textContent=diff>0?`+${diff} over goal`:`${Math.abs(diff)} under goal`;

  // Streak
  const streak=calcStreak();
  $('weekStreak').textContent=streak;

  const avgPro=count?Math.round(wkPro/count):0;
  $('totalProtein').textContent=avgPro+'g';
}
function calcStreak(){
  const d=getData();
  const keys=Object.keys(d).sort().reverse();
  let streak=0;
  const today=new Date(); today.setHours(0,0,0,0);
  for(const k of keys){
    const dd=new Date(k); dd.setHours(0,0,0,0);
    if(dd>today) continue;
    const day=d[k];
    if(day&&(day.foods||[]).length>0){
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ===== COACHING VIEW =====
function renderCoaching(){
  const p=getProfile();
  $('coachTdee').textContent=p.tdee||'--';
  if(p.weight) $('coachWeight').value=p.weight;
  if(p.height) $('coachHeight').value=p.height;
  if(p.age)     $('coachAge').value=p.age;
  if(p.goal)    $('coachGoal').value=p.goal;
}

// ===== FOOD CRUD =====
function addFoodFromForm(prefix){
  const name=$(prefix+'Name').value.trim();
  const cal=parseFloat($(prefix+'Cal').value)||0;
  const pro=parseFloat($(prefix+'Pro').value)||0;
  const carb=parseFloat($(prefix+'Carb').value)||0;
  const fat=parseFloat($(prefix+'Fat').value)||0;
  const fiber=parseFloat($(prefix+'Fiber').value)||0;
  const meal=$(prefix+'Meal').value;
  if(!name) return;

  const day=getDayData(activeDate);
  day.foods=day.foods||[];
  day.foods.push({id:Date.now(),name,calories:cal,protein:pro,carbs:carb,fat,fiber,meal});
  saveDayData(activeDate,day);

  if(prefix!=='modal'){
    $[prefix+'Name'].value='';
    $[prefix+'Cal'].value='';
    $[prefix+'Pro'].value='';
    $[prefix+'Carb'].value='';
    $[prefix+'Fat'].value='';
    $[prefix+'Fiber'].value='';
  }

  toast('Food Added',`${name} logged — ${fmtKcal(cal)} cal`);
  renderAll();
}
function deleteFood(id, view){
  const day=getDayData(activeDate);
  const idx=(day.foods||[]).findIndex(f=>f.id===id);
  if(idx>-1){
    const removed=day.foods.splice(idx,1)[0];
    saveDayData(activeDate,day);
    toast('Deleted',removed.name||'Food removed');
    renderAll();
  }
}
function renderAll(){
  renderDashboard();
  renderLog();
  renderNavCal();
}

// ===== WATER =====
function addWater(ml){
  const day=getDayData(activeDate);
  day.water=(day.water||0)+ml;
  saveDayData(activeDate,day);
  toast('Water Logged',`${ml}ml added — ${day.water}ml total`);
  renderDashboard();
}

// ===== GOALS =====
function promptGoals(){
  const p=getProfile();
  const goals=getGoals();
  const cal=prompt('Daily calorie goal?', goals.calories);
  if(cal!==null){
    p.goals=p.goals||{};
    p.goals.calories=parseInt(cal)||2500;
    const pro=prompt('Daily protein goal (g)?', p.goals.protein||goals.protein);
    if(pro!==null) p.goals.protein=parseInt(pro)||170;
    const carb=prompt('Daily carbs goal (g)?', p.goals.carbs||goals.carbs);
    if(carb!==null) p.goals.carbs=parseInt(carb)||260;
    const fat=prompt('Daily fat goal (g)?', p.goals.fat||goals.fat);
    if(fat!==null) p.goals.fat=parseInt(fat)||65;
    const fiber=prompt('Daily fiber goal (g)?', p.goals.fiber||goals.fiber);
    if(fiber!==null) p.goals.fiber=parseInt(fiber)||30;
    saveProfile(p);
    toast('Goals Updated','Your daily targets have been saved.');
    renderLog();
    renderDashboard();
  }
}

// ===== PROFILE SAVE =====
function saveProfileData(){
  const p=getProfile();
  const w=parseFloat($('bodyWeight').value);
  const h=parseFloat($('bodyHeight').value);
  const a=parseInt($('bodyAge').value);
  const g=$('bodyGoal').value;
  if(w) p.weight=w;
  if(h) p.height=h;
  if(a) p.age=a;
  p.goal=g;
  p.tdee=calcTDEE(p.weight||w||0, p.height||h||0, p.age||a||0,'male',1.55);
  saveProfile(p);

  // Log body entry
  if(w){
    const body=getBody();
    const today=dateKey();
    const last=body[body.length-1];
    if(!last||last.date!==today||last.weight!==w){
      body.push({date:today,weight:w,height:h,goal:g});
      saveBody(body);
    }
  }

  toast('Profile Saved',`TDEE: ${p.tdee} kcal/day`);
  renderBody();
}

// ===== TDEE CALCULATOR =====
function calcTDEEFromCoach(){
  const w=parseFloat($('coachWeight').value);
  const h=parseFloat($('coachHeight').value);
  const a=parseInt($('coachAge').value);
  const g=$('coachGoal').value;
  if(!w||!h||!a){ toast('Missing Data','Please fill in weight, height, and age.'); return; }
  const p=getProfile();
  p.weight=w; p.height=h; p.age=a; p.goal=g;
  p.tdee=calcTDEE(w,h,a,'male',1.55);
  saveProfile(p);

  let target;
  if(g==='lose') target=Math.round(p.tdee*0.80);
  else if(g==='gain') target=Math.round(p.tdee*1.10);
  else target=p.tdee;

  $('coachTdee').textContent=`${p.tdee} kcal (${target} for ${g})`;
  toast('TDEE Calculated',`Maintenance: ${p.tdee} kcal/day`);
}

// ===== MODALS =====
function openModal(id){ $(id).classList.add('active'); }
function closeModal(id){ $(id).classList.remove('active'); }

// ===== EVENT WIRING =====
function wire(){
  // Nav
  document.querySelectorAll('.nav-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      showView(b.dataset.view);
      if(window.matchMedia('(max-width:980px)').matches) setSidebarOpen(false);
    });
  });

  // Date nav
  $('prevDay').addEventListener('click',()=>changeDate(-1));
  $('nextDay').addEventListener('click',()=>changeDate(1));

  // Top bar
  $('menuBtn').addEventListener('click',()=>setSidebarOpen(true));
  $('closeSidebarBtn')&&$('closeSidebarBtn').addEventListener('click',()=>setSidebarOpen(false));
  $('logFoodBtn').addEventListener('click',()=>openModal('foodModal'));

  // Dashboard water
  $('addWaterBtn').addEventListener('click',()=>openModal('waterModal'));
  $('waterModalAdd').addEventListener('click',()=>{
    const ml=parseInt($('modalWater').value);
    if(ml>0) addWater(ml);
    $('modalWater').value='';
    closeModal('waterModal');
  });
  $('waterModalCancel').addEventListener('click',()=>closeModal('waterModal'));
  $('waterModal').addEventListener('click',e=>{ if(e.target.id==='waterModal') closeModal('waterModal'); });

  // Quick water buttons
  $('waterModal')&&document.querySelectorAll('.water-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      const ml=parseInt(b.dataset.ml);
      if(ml) addWater(ml);
      closeModal('waterModal');
    });
  });

  // Food form
  $('addFoodBtn').addEventListener('click',()=>addFoodFromForm('food'));
  $('foodName').addEventListener('keydown',e=>{ if(e.key==='Enter') addFoodFromForm('food'); });

  // Quick presets (delegated)
  document.querySelectorAll('.quick-btn[data-preset]').forEach(b=>{
    b.addEventListener('click',()=>{
      const parts=b.dataset.preset.split(',');
      $('foodName').value=parts[0];
      $('foodCal').value=parts[1];
      $('foodPro').value=parts[2];
      $('foodCarb').value=parts[3];
      $('foodFat').value=parts[4];
      $('foodFiber').value=parts[5]||0;
    });
  });

  // Modal
  $('modalCancel').addEventListener('click',()=>closeModal('foodModal'));
  $('modalAdd').addEventListener('click',()=>{
    addFoodFromForm('modal');
    $('modalName').value=''; $('modalCal').value='';
    $('modalPro').value=''; $('modalCarb').value='';
    $('modalFat').value='';
    closeModal('foodModal');
  });
  $('modalName').addEventListener('keydown',e=>{ if(e.key==='Enter') $('modalAdd').click(); });
  $('foodModal').addEventListener('click',e=>{ if(e.target.id==='foodModal') closeModal('foodModal'); });

  // Goals
  $('editGoalsBtn').addEventListener('click',promptGoals);

  // Profile
  $('saveProfileBtn').addEventListener('click',saveProfileData);

  // TDEE coach
  $('calcTdeeBtn').addEventListener('click',calcTDEEFromCoach);
}

// ===== INIT =====
function init(){
  renderDateLabel();
  renderNavCal();
  renderDashboard();
  showView('dashboard');
  setSidebarOpen(false);
  wire();
}
init();
