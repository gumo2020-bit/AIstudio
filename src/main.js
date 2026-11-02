import { createClient } from '@supabase/supabase-js';
import { escapeHtml as e, reasonLength, validAnswer, percent, genders } from './utils.js';
import './style.css';
const app=document.querySelector('#app');
const url=import.meta.env.VITE_SUPABASE_URL, key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let db; try { if(url && key && !key.includes('YOUR_')) db=createClient(url,key); } catch {}
let step='home', questions=[], survey={id:crypto.randomUUID(),age:'',gender:'',consent:false,answers:[]}, busy=false;
let session=null, stats=null, adminChecked=false, filters={min:5,max:120,gender:''};
const countText='이름과 연락처는 수집하지 않습니다. 연령·성별·선택·선택 이유·응답 시각을 수집해 AI 윤리 관점 비교에 사용하며 관리자만 확인합니다. 이유에 이름이나 연락처를 적지 마세요. 수집에 동의하지 않으면 참여하지 않아도 됩니다.';
function errorText(err) { return err?.message || '처리 중 문제가 생겼습니다. 연결을 확인하고 다시 시도해 주세요.'; }
function notice(message){const el=document.querySelector('#notice'); if(el) el.textContent=message;}
function btn(label,id,kind='primary'){return `<button class="${kind}" id="${id}">${label}</button>`;}
function shell(content){app.innerHTML=`<header><a href="#" class="brand">◈ 선택의 순간 <span>AI ETHICS LAB</span></a><a href="#admin">관리자 통계 ↗</a></header><main>${content}<p id="notice" role="status" aria-live="polite"></p></main><footer>서로 다른 선택에서, 더 깊은 생각으로.</footer>`;}
function render(){
 if(location.hash==='#admin'){renderAdmin();return;}
 if(!db){shell('<section class="hero"><span class="eyebrow">설정이 필요합니다</span><h1>연결 정보를 입력해 주세요.</h1><p>README 안내에 따라 Supabase 테이블과 환경변수 두 개를 설정하면 시작할 수 있어요.</p></section>');return;}
 if(step==='home'){
 shell(`<section class="hero"><span class="eyebrow">당신의 선택에는 어떤 가치가 담겨 있나요?</span><h1>AI와 함께 사는 세상,<br>선택의 순간.</h1><p>세 가지 딜레마를 읽고 당신의 생각을 들려주세요.<br>정답보다 중요한 것은 선택에 담긴 이유입니다.</p><div class="tags"><span>3개의 이야기</span><span>약 5분</span><span>이름 없이 참여</span></div>${btn('생각 나누기 시작 →','start')}<p class="fine">${countText}</p></section>`);
 document.querySelector('#start').onclick=()=>{step='profile';render();};
 }else if(step==='profile'){
 shell(`<section class="panel narrow"><span class="eyebrow">시작하기 전에</span><h1>당신에 대해 알려주세요.</h1><form id="profile"><label>연령 (만 나이)<input name="age" type="number" min="5" max="120" step="1" required value="${e(survey.age)}" placeholder="예: 25"></label><label>성별<select name="gender" required><option value="">선택해 주세요</option>${Object.entries(genders).map(([v,t])=>`<option value="${v}" ${survey.gender===v?'selected':''}>${t}</option>`).join('')}</select></label><div class="consent"><p>${countText}</p><label class="check"><input type="checkbox" name="consent" required ${survey.consent?'checked':''}> 위 수집·이용 안내를 읽고 동의합니다.</label></div><nav>${btn('이전으로','back','plain')}<button class="primary" type="submit" ${busy?'disabled':''}>${busy?'문항 불러오는 중…':'딜레마 살펴보기 →'}</button></nav></form></section>`);
 document.querySelector('#back').onclick=()=>{step='home';render();};
 document.querySelector('#profile').onsubmit=async ev=>{ev.preventDefault(); if(busy)return; const f=new FormData(ev.target);survey.age=Number(f.get('age'));survey.gender=f.get('gender');survey.consent=f.has('consent');busy=true;render();try{const {data,error}=await db.from('questions').select('*').eq('active',true).order('position');if(error)throw error;if(data.length!==3)throw new Error('활성 문항이 3개여야 합니다. 관리자에게 문의해 주세요.');questions=data;survey.answers=data.map(q=>survey.answers.find(a=>a.question_id===q.id && a.version===q.updated_at)||({question_id:q.id,version:q.updated_at,choice:'',reason:''}));step=0;busy=false;render();}catch(err){busy=false;render();notice(errorText(err));}};
 }else if(typeof step==='number'){
 const q=questions[step], a=survey.answers[step];
 shell(`<section class="survey"><div class="stephead"><span class="eyebrow">DILEMMA ${String(step+1).padStart(2,'0')}</span><span>${step+1} / 3</span></div><progress max="3" value="${step+1}" aria-label="문항 진행 상황"></progress><h1>${e(q.title)}</h1><p class="scenario">${e(q.scenario)}</p><div class="choices" role="group" aria-label="A 또는 B 선택">${['A','B'].map(c=>`<button class="choice ${a.choice===c?'selected':''}" data-choice="${c}" aria-pressed="${a.choice===c}"><span class="choice-title">${c} <span>선택지 ${c}</span><b>${a.choice===c?'✓':'○'}</b></span><span>${e(q[c==='A'?'option_a':'option_b'])}</span></button>`).join('')}</div><label for="reason">이 선택지를 선택한 이유를 작성해 주세요.</label><textarea id="reason" rows="5" placeholder="어떤 가치를 중요하게 생각했나요? 선택한 이유를 자유롭게 적어 주세요.">${e(a.reason)}</textarea><p class="fine"><span id="counter">${reasonLength(a.reason)}</span> / 1000자 · 공백 제외 5자 이상</p><nav>${btn('← 이전으로','back','plain')}${btn(step===2?'응답 확인하기 →':'다음으로 →','next')}</nav></section>`);
 document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{a.choice=b.dataset.choice;render();});
 document.querySelector('#reason').oninput=ev=>{a.reason=ev.target.value;document.querySelector('#counter').textContent=reasonLength(a.reason);};
 document.querySelector('#back').onclick=()=>{step=step===0?'profile':step-1;render();};
 document.querySelector('#next').onclick=()=>{if(!validAnswer(a)){notice('선택지 하나를 고르고 이유를 공백 제외 5~1000자로 작성해 주세요.');return;}step=step===2?'review':step+1;render();};
 }else if(step==='review'){
 shell(`<section class="panel"><span class="eyebrow">마지막 확인</span><h1>이 생각을 나눌까요?</h1><p>${survey.age}세 · ${genders[survey.gender]}</p>${questions.map((q,i)=>`<article class="review"><h2>${e(q.title)}</h2><p><b>선택 ${survey.answers[i].choice}</b></p><p>${e(survey.answers[i].reason)}</p><button class="plain edit" data-index="${i}" ${busy?'disabled':''}>수정하기</button></article>`).join('')}<nav>${btn('← 이전으로','back','plain')}<button class="primary" id="submit" ${busy?'disabled':''}>${busy?'저장 중…':'제출하기 ✓'}</button></nav><p class="fine">오류가 나면 이 화면에서 재시도하세요. 같은 응답은 한 번만 저장됩니다.</p></section>`);
 document.querySelectorAll('.edit').forEach(b=>b.onclick=()=>{if(busy)return;step=Number(b.dataset.index);render();});
 document.querySelector('#back').onclick=()=>{if(busy)return;step=2;render();};
 document.querySelector('#submit').onclick=async()=>{if(busy)return;busy=true;render();try{const {error}=await db.rpc('submit_survey',{p_id:survey.id,p_age:survey.age,p_gender:survey.gender,p_answers:survey.answers,p_consent:survey.consent});if(error)throw error;step='done';busy=false;render();}catch(err){busy=false;render();notice(errorText(err));}};
 }else if(step==='done'){
 shell(`<section class="hero"><div class="done">✓</div><span class="eyebrow">응답이 저장되었습니다</span><h1>당신의 생각이<br>더 나은 AI를 만듭니다.</h1><p>세 가지 선택에 담긴 고민을 나눠주셔서 감사합니다.</p>${btn('처음으로','reset')}</section>`);
 document.querySelector('#reset').onclick=()=>{survey={id:crypto.randomUUID(),age:'',gender:'',consent:false,answers:[]};step='home';render();};
 }
}
function renderAdmin(){
 if(!db){shell('<h1>Supabase 환경변수를 먼저 설정해 주세요.</h1>');return;}
 if(!adminChecked){shell('<h1>로그인 확인 중…</h1>');return;}
 if(!session){
 shell(`<section class="panel narrow"><span class="eyebrow">ADMIN ONLY</span><h1>관리자 로그인</h1><p>등록된 관리자 계정만 통계를 조회할 수 있습니다.</p><form id="login"><label>이메일<input name="email" type="email" autocomplete="username" required></label><label>비밀번호<input name="password" type="password" autocomplete="current-password" required></label><button class="primary" ${busy?'disabled':''}>${busy?'로그인 중…':'로그인'}</button></form></section>`);
 document.querySelector('#login').onsubmit=async ev=>{ev.preventDefault();if(busy)return;const f=new FormData(ev.target);busy=true;try{const {data,error}=await db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)throw error;session=data.session;busy=false;await loadStats();}catch(err){busy=false;renderAdmin();notice('로그인 실패: '+errorText(err));}};return;
 }
 shell(`<section><div class="stephead"><div><span class="eyebrow">ADMIN DASHBOARD</span><h1>선택을 한눈에.</h1></div>${btn('로그아웃','logout','plain')}</div><form class="filters" id="filters"><label>최소 연령<input name="min" type="number" min="5" max="120" required value="${filters.min}"></label><label>최대 연령<input name="max" type="number" min="5" max="120" required value="${filters.max}"></label><label>성별<select name="gender"><option value="">전체 성별</option>${Object.entries(genders).map(([v,t])=>`<option value="${v}" ${filters.gender===v?'selected':''}>${t}</option>`).join('')}</select></label><button class="primary" ${busy?'disabled':''}>${busy?'조회 중…':'필터 적용 / 새로고침'}</button></form>${stats?statsHtml(): '<p>통계를 불러오거나 관리자 등록 상태를 확인해 주세요.</p>'}</section>`);
 document.querySelector('#logout').onclick=async()=>{await db.auth.signOut();session=null;stats=null;renderAdmin();};
 document.querySelector('#filters').onsubmit=async ev=>{ev.preventDefault();if(busy)return;const f=new FormData(ev.target);const min=Number(f.get('min')),max=Number(f.get('max'));if(min>max){notice('최소 연령은 최대 연령보다 작거나 같아야 합니다.');return;}filters={min,max,gender:f.get('gender')};await loadStats();};
}
async function loadStats(){busy=true;stats=null;renderAdmin();try{const {data,error}=await db.rpc('get_stats',{p_min:filters.min,p_max:filters.max,p_gender:filters.gender||null});if(error)throw error;stats=data;busy=false;renderAdmin();}catch(err){busy=false;renderAdmin();notice(errorText(err));}}
function statsHtml(){return `<div class="metric"><span>조건에 맞는 완료 응답</span><strong>${stats.total}<small>명</small></strong><p>아래 통계에도 동일한 필터가 적용됩니다.</p></div><div class="breakdowns"><article class="panel"><h2>연령대별 응답자</h2>${stats.ages.map(x=>`<p>${x.age_band===0?'5~9세':x.age_band+'~'+Math.min(x.age_band+9,120)+'세'} <b>${x.count}명</b></p>`).join('')||'<p>응답 없음</p>'}</article><article class="panel"><h2>성별 응답자</h2>${stats.genders.map(x=>`<p>${genders[x.gender]} <b>${x.count}명</b></p>`).join('')||'<p>응답 없음</p>'}</article></div><h2>문항별 선택 비율</h2><p class="fine">문항 수정 전후는 별도로 집계합니다. 분모는 해당 문항 버전에 응답한 사람 수입니다.</p>${stats.questions.map(q=>`<article class="panel stat"><h2>${e(q.title)}</h2><p class="fine">문항 버전: ${new Date(q.question_version).toLocaleString('ko-KR')} · ${q.total}명</p>${['a','b'].map(c=>`<div class="bar-label"><b>선택 ${c.toUpperCase()} · ${q[c+'_count']}명 (${percent(q[c+'_count'],q.total)}%)</b><p>${e(q['option_'+c])}</p></div><div class="track"><div class="bar ${c}" style="width:${percent(q[c+'_count'],q.total)}%"></div></div>`).join('')}</article>`).join('')||'<p>아직 제출된 응답이 없습니다.</p>'}<h2>최근 선택 이유</h2><p class="fine">필터에 맞는 문항 응답 중 최근 50개입니다. 통계는 전체 응답을 집계합니다.</p>${stats.recent.map(r=>`<article class="review"><h3>${e(r.title)} · 선택 ${e(r.choice)}</h3><p>${e(r.reason)}</p><span class="fine">${r.age}세 · ${genders[r.gender]} · ${new Date(r.created_at).toLocaleString('ko-KR')}</span></article>`).join('')}`;}
window.addEventListener('hashchange',()=>{if(location.hash==='#admin' && session)loadStats();else render();});
render();
if(db){db.auth.getSession().then(({data})=>{session=data.session;adminChecked=true;if(location.hash==='#admin' && session)loadStats();else render();});db.auth.onAuthStateChange((event,s)=>{session=s;if(event==='SIGNED_OUT'){stats=null;if(location.hash==='#admin')renderAdmin();}});}
