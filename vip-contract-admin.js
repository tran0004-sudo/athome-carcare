/* Owner-only VIP contract ledger management.
   Existing admin login is reused. Supabase RLS independently enforces ownership.
   No contract is created for an ordinary customer reservation automatically. */
(function () {
  'use strict';
  const URL='https://xejdhnwqqaamujkebvne.supabase.co';
  const KEY='sb_publishable_ZMYuEmyPRMc0Q3c2q2Ok3A_vjCYppoE';
  const AUTH_KEY='athomeCarcareAdminSession';
  let contracts=[], links=[], jobs=[], selectedId=null, busy=false;
  const $=id=>document.getElementById(id);
  const node=(tag,klass,value)=>{
    const el=document.createElement(tag);
    if(klass)el.className=klass;
    if(value!==undefined)el.textContent=String(value);
    return el;
  };
  const phone = v => {
    let s=String(v||'').replace(/\D/g,'');
    if(/^8210\d{8}$/.test(s))s='0'+s.slice(2);
    return s;
  };
  function seoulDay(value) {
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',
      year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
    const part=key=>parts.find(p=>p.type===key)?.value||'';
    return part('year')+'-'+part('month')+'-'+part('day');
  }
  function note(message,error=false) {
    const el=$('vipAdminMessage');
    if(el){el.textContent=message;el.dataset.error=error?'1':'0';}
  }
  async function session() {
    let s;
    try{s=JSON.parse(localStorage.getItem(AUTH_KEY)||'null');}catch(_){return null;}
    if(!s||!s.access_token)return null;
    if(s.expires_at && Date.now()/1000<s.expires_at-60)return s.access_token;
    if(!s.refresh_token)return null;
    const r=await fetch(URL+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:s.refresh_token})
    });
    if(!r.ok)return null;
    const d=await r.json();
    s={...s,access_token:d.access_token,refresh_token:d.refresh_token,expires_at:d.expires_at};
    localStorage.setItem(AUTH_KEY,JSON.stringify(s));
    return s.access_token;
  }
  async function api(path,options={}) {
    const token=await session();
    if(!token)throw Error('관리자로 로그인한 후 이용해 주세요.');
    const r=await fetch(URL+'/rest/v1/'+path,{
      ...options,
      headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json',
        ...(options.headers||{})}
    });
    if(r.status===204)return null;
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(data.message||data.details||'처리 실패 ('+r.status+')');
    return data;
  }
  function choose(id) {
    selectedId=id;
    const c=contracts.find(x=>x.id===id);
    const f=$('vipContractForm');
    f.elements.namedItem('contractId').value=c?.id||'';
    f.elements.namedItem('phone').value=c?.phone||'';
    f.elements.namedItem('customerName').value=c?.customer_name||'';
    f.elements.namedItem('carModel').value=c?.car_model||'';
    f.elements.namedItem('monthlyVisits').value=c?.monthly_visits||'2';
    f.elements.namedItem('startsOn').value=c?.starts_on||'';
    f.elements.namedItem('expiresOn').value=c?.expires_on||'';
    f.elements.namedItem('anchorOn').value=c?.anchor_on||'';
    f.elements.namedItem('status').value=c?.status||'active';
    f.elements.namedItem('note').value=c?.note||'';
    $('vipContractFormTitle').textContent=c?'계약 수정':'새 VIP 계약 등록';
    renderList();
    renderDetail();
  }
  async function load() {
    if(busy)return;
    busy=true;note('VIP 계약 정보를 불러오는 중입니다.');
    try{
      const [c,l,r]=await Promise.all([
        api('vip_contracts?select=*&order=created_at.desc&limit=200'),
        api('vip_visit_links?select=contract_id,reservation_id&limit=1000'),
        api('reservations?select=id,phone,status,done_at,service_type,car_model,customer_name&status=eq.%EC%99%84%EB%A3%8C&order=done_at.desc&limit=250')
      ]);
      contracts=c||[];links=l||[];jobs=r||[];
      if(!contracts.some(v=>v.id===selectedId))selectedId=contracts[0]?.id||null;
      choose(selectedId);
      note('기록 연결은 완료된 예약만 가능하며, 자동 차감되지 않습니다.');
    }catch(e){note(e.message,true);}
    finally{busy=false;}
  }
  function renderList() {
    const out=$('vipContractList');if(!out)return;
    out.replaceChildren();
    if(!contracts.length){out.append(node('p','vip-ledger-empty','등록된 VIP 계약이 없습니다. 아래에서 새 계약을 등록하세요.'));return;}
    for(const c of contracts) {
      const button=node('button','vip-ledger-row'+(c.id===selectedId?' selected':''));
      button.type='button';
      const b=node('strong','',c.customer_name+' · 월 '+c.monthly_visits+'회');
      const small=node('small','',c.phone+' · '+c.starts_on+' ~ '+c.expires_on+' · '+({'active':'운영','paused':'일시중지','cancelled':'종료'}[c.status]||c.status));
      button.append(b,small);
      button.addEventListener('click',()=>choose(c.id));
      out.append(button);
    }
  }
  function renderDetail() {
    const out=$('vipLinkArea'); if(!out)return;
    out.replaceChildren();
    const c=contracts.find(x=>x.id===selectedId);
    if(!c){out.append(node('p','vip-ledger-empty','계약 등록 후 완료된 세차와 연결할 수 있습니다.'));return;}
    const stat=node('div','vip-ledger-stats','계약 현황 계산 중…');
    out.append(stat);
    api('rpc/vip_contract_snapshot',{method:'POST',body:JSON.stringify({p_contract_id:c.id})})
      .then(d=>{
        if(selectedId!==c.id)return;
        const st=({active:'이용 중',upcoming:'시작 예정',paused:'일시중지',cancelled:'종료',expired:'만료'})[d.status]||d.status;
        stat.textContent=st+' · 현재 이용주기 '+d.cycleStart+' ~ '+d.cycleEnd+
          ' · '+d.usedVisits+'/'+d.monthlyVisits+'회 사용, 잔여 '+d.remainingVisits+
          '회 · 만료 '+d.expiresOn+' · 권장 관리일 '+(d.nextRecommendedOn||'없음');
      })
      .catch(e=>{stat.textContent=e.message;});
    const title=node('h4','','완료된 세차 연결');
    const caption=node('p','vip-ledger-help','이 계약에 연결된 완료 기록만 월 이용 횟수에서 차감됩니다.');
    const wrap=node('div','vip-ledger-link-row');
    const sel=node('select');sel.id='vipCompletedJob';
    const occupied=new Set(links.map(v=>v.reservation_id));
    const eligible=jobs.filter(j=>phone(j.phone)===c.phone && j.status==='완료' && j.done_at &&
      seoulDay(j.done_at)>=c.starts_on &&
      seoulDay(j.done_at)<=c.expires_on && !occupied.has(j.id));
    const intro=node('option','',eligible.length?'완료된 세차를 선택하세요':'연결 가능한 완료 세차 없음');intro.value='';sel.append(intro);
    for(const j of eligible) {
      const o=node('option','',new Date(j.done_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})+' · '+(j.car_model||'차량')+' · '+j.service_type);
      o.value=j.id;sel.append(o);
    }
    const add=node('button','','이용 1회 연결');add.type='button';add.disabled=!eligible.length;
    add.addEventListener('click',()=>linkVisit(c.id,sel.value));
    wrap.append(sel,add);
    const linkTitle=node('h4','','현재 연결된 방문');
    const ul=node('ul','vip-ledger-connected');
    const attached=links.filter(l=>l.contract_id===c.id);
    if(!attached.length)ul.append(node('li','','연결된 세차 기록이 없습니다.'));
    for (const l of attached){
      const j=jobs.find(r=>r.id===l.reservation_id);
      const li=node('li','',j?new Date(j.done_at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})+' · '+(j.car_model||'차량'):(l.reservation_id.slice(0,8)+'…'));
      const remove=node('button','','연결 해제');remove.type='button';
      remove.addEventListener('click',()=>unlinkVisit(l.reservation_id));
      li.append(remove);ul.append(li);
    }
    out.append(title,caption,wrap,linkTitle,ul);
  }
  async function linkVisit(contractId,reservationId) {
    if(!reservationId)return note('완료된 세차를 선택해 주세요.',true);
    if(busy)return;busy=true;
    try{
      await api('vip_visit_links',{method:'POST',body:JSON.stringify({contract_id:contractId,reservation_id:reservationId}),headers:{Prefer:'return=minimal'}});
      busy=false;await load();note('연결되었습니다. 회원 잔여 횟수가 갱신됩니다.');
    }catch(e){busy=false;note(e.message,true);}
  }
  async function unlinkVisit(reservationId) {
    if(!confirm('이 완료 기록을 VIP 이용 횟수에서 제외하시겠습니까?'))return;
    if(busy)return;busy=true;
    try {
      await api('vip_visit_links?reservation_id=eq.'+encodeURIComponent(reservationId),{method:'DELETE'});
      busy=false;await load();note('연결이 해제되었습니다.');
    }catch(e){busy=false;note(e.message,true);}
  }
  async function save(e) {
    e.preventDefault();if(busy)return;
    const f=e.currentTarget;
    const data=Object.fromEntries(new FormData(f));
    const id=data.contractId;delete data.contractId;
    const payload={
      phone:phone(data.phone),customer_name:(data.customerName||'').trim(),
      car_model:(data.carModel||'').trim(),monthly_visits:Number(data.monthlyVisits),
      starts_on:data.startsOn,expires_on:data.expiresOn,anchor_on:data.anchorOn,
      status:data.status,note:(data.note||'').trim()
    };
    if(!/^010\d{8}$/.test(payload.phone))return note('010 휴대폰 11자리를 확인해 주세요.',true);
    if(!payload.starts_on||!payload.expires_on||!payload.anchor_on||
      payload.starts_on>payload.expires_on || payload.anchor_on<payload.starts_on||
      payload.anchor_on>payload.expires_on)return note('시작·만료·관리 기준일을 확인해 주세요.',true);
    busy=true;note('계약 저장 중입니다.');
    try{
      const path='vip_contracts'+(id?'?id=eq.'+encodeURIComponent(id):'');
      const saved=await api(path,{method:id?'PATCH':'POST',body:JSON.stringify(payload),headers:{Prefer:'return=representation'}});
      if(!id && Array.isArray(saved) && saved[0]?.id) selectedId=saved[0].id;
      busy=false;
      await load();
      note('계약이 저장되었습니다. 실제 완료 세차를 연결하면 잔여 횟수에 반영됩니다.');
    }catch(e){busy=false;note(e.message,true);}
  }
  function initialize() {
    const root=$('adminSecMembers');
    if(!root || root.querySelector('#vipContractsRoot'))return;
    const section=node('section','vip-ledger-root');
    section.id='vipContractsRoot';
    const title=node('h3','','VIP 계약 · 월별 횟수 관리');
    const hint=node('p','vip-ledger-help','월세차 계약 기간, 월 2·4회 이용권, 관리 기준일을 등록하세요. 기존 고객 목록은 아래 그대로 유지됩니다.');
    const controls=node('div','vip-ledger-controls');
    const refresh=node('button','','계약 새로고침');refresh.type='button';refresh.addEventListener('click',load);
    const fresh=node('button','','+ 새 계약');fresh.type='button';fresh.addEventListener('click',()=>choose(null));
    controls.append(refresh,fresh);
    const content=node('div','vip-ledger-grid');
    const list=node('div','vip-ledger-list');list.id='vipContractList';
    const detail=node('div','vip-ledger-editor');
    const heading=node('h4','','새 VIP 계약 등록');heading.id='vipContractFormTitle';
    const form=document.createElement('form');form.id='vipContractForm';
    const fields=[
      ['hidden','contractId',''],
      ['tel','phone','고객 연락처 (010-0000-0000)','required'],
      ['text','customerName','고객 이름','required'],
      ['text','carModel','차량 모델'],
      ['date','startsOn','계약 시작일','required'],
      ['date','expiresOn','계약 만료일','required'],
      ['date','anchorOn','관리 기준일 · 첫 권장일','required']
    ];
    for(const [type,name,label,required] of fields) {
      const control=node('input');control.type=type;control.name=name;
      if(required)control.required=true;
      if(type==='hidden'){form.append(control);continue;}
      const wrap=node('label','',label);wrap.append(control);form.append(wrap);
    }
    const visitLabel=node('label','','월 이용 횟수');
    const plan=node('select');plan.name='monthlyVisits';
    for(const n of [2,4]){const opt=node('option','','월 '+n+'회');opt.value=String(n);plan.append(opt);}
    visitLabel.append(plan);form.append(visitLabel);
    const statusLabel=node('label','','계약 상태');const statusField=node('select');statusField.name='status';
    for(const [value,label] of [['active','운영'],['paused','일시중지'],['cancelled','종료']]){
      const opt=node('option','',label);opt.value=value;statusField.append(opt);
    }
    statusLabel.append(statusField);form.append(statusLabel);
    const memoLabel=node('label','','관리자 메모 (회원에게 비공개)');
    const memo=node('textarea');memo.name='note';memo.rows=2;memoLabel.append(memo);form.append(memoLabel);
    const submit=node('button','vip-ledger-save','계약 저장');submit.type='submit';form.append(submit);
    form.addEventListener('submit',save);
    const connected=node('div','vip-ledger-connections');connected.id='vipLinkArea';
    detail.append(heading,form,connected);
    content.append(list,detail);
    const message=node('p','vip-ledger-message');message.id='vipAdminMessage';message.setAttribute('role','status');
    section.append(title,hint,controls,message,content);
    root.prepend(section);
    // Only load when the owner has opened the admin area, not when public users visit.
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-sec="members"]'))setTimeout(load,100);
    });
    const refreshButton=$('memberRefresh');
    if(refreshButton)refreshButton.addEventListener('click',load);
  }
  const observer=new MutationObserver(()=>{
    if($('adminSecMembers')){initialize();observer.disconnect();}
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{
    initialize();if(!$('adminSecMembers'))observer.observe(document.body,{childList:true,subtree:true});
  });
  else{initialize();if(!$('adminSecMembers'))observer.observe(document.body,{childList:true,subtree:true});}
})();