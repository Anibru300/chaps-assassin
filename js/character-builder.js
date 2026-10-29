/* Creación guiada y recursos propios de cada personaje. */
(function () {
  'use strict';
  const rules=CHARACTER_RULES, el=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const option=(id,label)=>`<option value="${esc(id)}">${esc(label)}</option>`;
  const skillLabel=k=>t('skill_'+k);
  let step=0, busy=false, owner=null;
  const draftKey=()=>`chaps-builder:${owner}`;
  const ids=['builder-identity','builder-stats','builder-review'];
  function value(id){return el(id).value;}
  function selected(name){return [...el('character-builder').querySelectorAll(`[name="${name}"]:checked`)].map(x=>x.value);}
  function spec(){
    return {name:value('builder-name').trim(),classId:value('builder-class'),speciesId:value('builder-species'),backgroundId:value('builder-background'),level:Number(value('builder-level')),subclass:value('builder-subclass'),speciesName:value('builder-species-name'),backgroundName:value('builder-background-name'),backgroundSkills:[value('builder-bg-skill-1'),value('builder-bg-skill-2')],backgroundFeat:value('builder-background-feat'),originFeat:value('builder-origin-feat'),speciesSkill:value('builder-species-skill'),skills:selected('builder-skill'),expertise:selected('builder-expertise'),method:value('builder-method'),abilities:Object.fromEntries(rules.abilities.map(a=>[a,Number(value('builder-'+a))])),boosts:Object.fromEntries(rules.abilities.map(a=>[a,Number(value('builder-boost-'+a))])),languages:['Común',value('builder-language-1'),value('builder-language-2')],rogueLanguage:value('builder-rogue-language'),playerName:value('builder-player'),campaign:value('builder-campaign')};
  }
  function saveDraft(){if(owner) localStorage.setItem(draftKey(),JSON.stringify(spec()));}
  function error(text){el('builder-error').textContent=text; if(text) el('builder-error').focus();}
  function renderChoices(previous){
    const c=rules.classes.find(c=>c.id===value('builder-class')), s=rules.species.find(s=>s.id===value('builder-species')), bg=rules.backgroundFor(spec());
    el('builder-custom-background').hidden=bg.id!=='custom';
    el('builder-class-source').href=c.source;
    el('builder-class-info').textContent=`d${c.die} · ${c.count} habilidades · salvaciones ${c.saves.map(a=>t('ability_'+a)).join(' / ')} · ${c.gold+50} po iniciales para comprar equipo`;
    el('builder-species-name-field').hidden=s.id!=='custom'; el('builder-background-name-field').hidden=bg.id!=='custom';
    el('builder-species-note').textContent=s.notes;
    el('builder-rogue-language-field').hidden=c.id!=='rogue';
    el('builder-human-feat-field').hidden=s.id!=='human';
    el('builder-species-skill-field').hidden=!s.skill;
    el('builder-species-skill').innerHTML=option('','Elegir habilidad')+(s.skill||[]).map(k=>option(k,skillLabel(k))).join('');
    if(previous?.speciesSkill) el('builder-species-skill').value=previous.speciesSkill;
    el('builder-skills').innerHTML=c.skills.map(k=>`<label><input type="checkbox" name="builder-skill" value="${k}" ${previous?.skills?.includes(k)&&!bg.skills.includes(k)?'checked':''} ${bg.skills.includes(k)?'disabled':''}> ${esc(skillLabel(k))}${bg.skills.includes(k)?' (trasfondo)':''}</label>`).join('');
    el('builder-skill-hint').textContent=`Elige ${c.count}; trasfondo: ${bg.skills.map(skillLabel).join(', ')||'personalizado, completar en ficha'}.`;
    el('builder-expertise-field').hidden=c.id!=='rogue';
    el('builder-expertise').innerHTML=rules.skills.map(k=>`<label><input type="checkbox" name="builder-expertise" value="${k}" ${previous?.expertise?.includes(k)?'checked':''}> ${esc(skillLabel(k))}</label>`).join('');
    el('builder-expertise-hint').textContent=`Elige ${Number(value('builder-level'))>=6?4:2} habilidades competentes.`;
    for(const a of rules.abilities){el('builder-boost-'+a).disabled=!bg.abilities.includes(a); if(!bg.abilities.includes(a))el('builder-boost-'+a).value='0';}
    el('builder-boost-hint').textContent=`+2/+1 o +1/+1/+1: ${bg.abilities.map(a=>t('ability_'+a)).join(', ')}. Valores base antes de aumentos.`;
  }
  function review(){
    const current=spec(), errors=rules.validate(current), list=el('builder-review-list'); list.replaceChildren();
    for(const text of errors){const li=document.createElement('li');li.textContent=text;list.appendChild(li);}
    if(!errors.length){
      const data=rules.create(DEFAULT_STATE,current);
      for(const text of [`${data.name} · ${data.identity.charClass} N${data.level} · ${data.identity.species} · ${data.identity.background}`,`PG ${data.hpMax} · CA ${data.ac} sin armadura · Iniciativa ${fmtMod(data.initiative)} · Velocidad ${data.speed} ft`,`${data.currency.gp} po: compra equipo en ficha; no se ha añadido equipo gratuito.`,`Competencias y salvaciones calculadas. Subclase, dotes de niveles y magia: completar elecciones en ficha.`]){const li=document.createElement('li');li.textContent=text;list.appendChild(li);}
    }
    el('builder-submit').disabled=!!errors.length||busy;
  }
  function showStep(next){
    step=next;ids.forEach((id,i)=>el(id).hidden=i!==step);
    el('builder-step').textContent=`${step+1}/3 · ${['Identidad y origen','Características y habilidades','Revisión'][step]}`;
    el('builder-back').hidden=step===0;el('builder-next').hidden=step===2;el('builder-submit').hidden=step!==2;
    if(step===2)review();error('');el('builder-step').focus();
  }
  function open(){
    owner=window.CHAPS_CLOUD?.userInfo()?.uid;
    if(!owner){el('character-status').textContent='Entra con Google o correo para crear personaje.';return;}
    el('builder-form').reset();
    const defaults={}; rules.abilities.forEach((a,i)=>defaults[a]=[15,14,13,12,10,8][i]);
    let draft;try{draft=JSON.parse(localStorage.getItem(draftKey()));}catch(_){}
    if(draft&&(!rules.classes.some(c=>c.id===draft.classId)||!rules.species.some(s=>s.id===draft.speciesId)||!rules.backgrounds.some(b=>b.id===draft.backgroundId)))draft=null;
    const current=draft||{classId:'rogue',speciesId:'human',backgroundId:'criminal',originFeat:'tough',level:1,method:'standard',abilities:defaults,boosts:{dex:2,con:1}};
    for(const [id,key] of [['name','name'],['class','classId'],['species','speciesId'],['background','backgroundId'],['level','level'],['method','method'],['subclass','subclass'],['species-name','speciesName'],['background-name','backgroundName'],['origin-feat','originFeat'],['player','playerName'],['campaign','campaign'],['rogue-language','rogueLanguage']])if(current[key]!=null) el('builder-'+id).value=current[key];
    for(const a of rules.abilities){el('builder-'+a).value=current.abilities?.[a]??10;el('builder-boost-'+a).value=current.boosts?.[a]||0;}
    if(current.languages){el('builder-language-1').value=current.languages[1];el('builder-language-2').value=current.languages[2];}
    else {el('builder-language-1').value='Élfico';el('builder-language-2').value='Enano';}
    if(current.backgroundSkills){el('builder-bg-skill-1').value=current.backgroundSkills[0];el('builder-bg-skill-2').value=current.backgroundSkills[1];}if(current.backgroundFeat)el('builder-background-feat').value=current.backgroundFeat;renderChoices(current);showStep(0);el('character-builder').showModal();
  }
  async function submit(event){
    event.preventDefault();if(busy)return;
    const current=spec(),errors=rules.validate(current);if(errors.length){error(errors.join('\n'));return;}
    if(owner!==window.CHAPS_CLOUD?.userInfo()?.uid){error('Cuenta cambió. Cierra y vuelve a crear personaje.');return;}
    busy=true;el('builder-submit').disabled=true;el('builder-cancel').disabled=true;
    const controls=[...el('builder-form').querySelectorAll('input,select,textarea')].map(node=>({node,disabled:node.disabled}));controls.forEach(({node})=>node.disabled=true);
    try{
      const result=await window.CHAPS_CLOUD.createCharacter(current.name,false,current);
      localStorage.removeItem(draftKey());el('character-builder').close();
      el('character-status').textContent=result?.synced?'Personaje creado y sincronizado. Completa equipo y magia en ficha.':'Personaje guardado en dispositivo; sincronización pendiente. Completa equipo y magia en ficha.';
      renderAll();el('section-identity').scrollIntoView({block:'start'});
    }catch(value){error(window.CHAPS_CLOUD?.errorText(value)||value.message);}
    finally{controls.forEach(({node,disabled})=>node.disabled=disabled);busy=false;el('builder-submit').disabled=false;el('builder-cancel').disabled=false;}
  }
  function render(){
    if(!el('section-class'))return;
    if(el('character-builder')?.open&&owner!==window.CHAPS_CLOUD?.userInfo()?.uid){saveDraft();el('character-builder').close();}
    const c=rules.classFor(state), empty=!c;
    el('character-welcome').hidden=!empty;
    const portrait=el('portrait-img');if(portrait){portrait.src=state.creation||empty?'assets/adventurer.svg':'assets/chaps-portrait.jpg';portrait.alt=state.name;}
    el('class-summary').textContent=c?`${c.es} N${state.level} · d${c.die} · ${rules.attacks(state)} ataque(s) por acción de Atacar${c.cast?` · Conjuros: ${t('ability_'+c.cast)} ${fmtMod(abilityMod(state.abilities[c.cast])+profBonus(state.level))}, CD ${8+abilityMod(state.abilities[c.cast])+profBonus(state.level)}`:''}`:'Crea personaje para ver capacidades de clase.';
    el('class-source').hidden=!c;if(c)el('class-source').href=c.source;
    el('class-notes').textContent=state.creation?.notes||'Ficha existente: valores manuales conservados. Revisa rasgos y elecciones con DM.';
    el('class-checklist').textContent=c?[!state.weapons.length?'Compra o añade armas para combate.':'',c.cast&&!state.spellbook?.length?'Elige conjuros de clase; añade detalles y preparados.':'',state.level>=3&&!state.identity.subclass?'Elige subclase.':'',state.level>=4?'Revisa dotes/ASI de niveles alcanzados.':'','Rasgos especiales y subclases: referencia de clase; automatización parcial indicada en combate.'].filter(Boolean).join(' '):'';
    const equipment=window.CHARACTER_EQUIPMENT;
    updateOptions(el('character-shop-item'),equipment.items.map(i=>[i.id,`${i.name} · ${i.cost} po`]));
    el('character-shop-buy').disabled=empty||!!combat.on;
    const worn=el('character-equipped');worn.replaceChildren();
    state.inventory.forEach((entry,index)=>{const item=equipment.armor.find(a=>a.id===entry.equipmentId);if(!item)return;const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=!!entry.equipped;input.disabled=!!combat.on;input.onchange=()=>{el('character-shop-status').textContent=equipment.equip(state,index,input.checked);saveState();renderIdentity();render();};label.className='resource-row';label.append(input,document.createTextNode(`${entry.name} · equipada`));worn.appendChild(label);});
    const slots=el('spell-slots');slots.replaceChildren();
    for(const row of rules.spellSlots(state)){
      const key=row.pact?'pact':String(row.level), used=state.spellSlotsSpent?.[key]||0;
      const div=document.createElement('div');div.className='resource-row';
      const text=document.createElement('span');text.textContent=`${row.pact?'Pacto':'Espacios'} N${row.level}: ${Math.max(0,row.max-used)}/${row.max}`;div.appendChild(text);
      for(const [label,delta] of [['Gastar',1],['Devolver',-1]]){const b=document.createElement('button');b.type='button';b.className='btn btn-small';b.textContent=label;b.disabled=delta>0?used>=row.max:used<=0;b.onclick=()=>{state.spellSlotsSpent||={};state.spellSlotsSpent[key]=Math.max(0,Math.min(row.max,used+delta));saveState();render();};div.appendChild(b);}slots.appendChild(div);
    }
    const spells=el('character-spell-list');spells.replaceChildren();
    const quick=el('character-spell-quick'), quickItems=rules.spells.filter(s=>s.classes.includes(c?.id));
    const signature=JSON.stringify(quickItems.map(s=>s.id));
    if(quick.dataset.items!==signature){quick.innerHTML=option('','Conjuro libre / personalizar')+quickItems.map(s=>option(s.id,`${s.name} (${s.en}) · N${s.level}`)).join('');quick.dataset.items=signature;}
    for(const spell of state.spellbook||[]){
      const row=document.createElement('div');row.className='spell-row';
      const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=!!spell.prepared;check.onchange=()=>{spell.prepared=check.checked;saveState();};label.append(check,document.createTextNode(`${spell.name} · N${spell.level} · preparado`));row.appendChild(label);
      const detail=document.createElement('p');detail.className='hint';detail.textContent=spell.details;row.appendChild(detail);
      const b=document.createElement('button');b.type='button';b.className='btn btn-small';b.textContent='Quitar';b.onclick=()=>{state.spellbook=state.spellbook.filter(s=>s.id!==spell.id);saveState();render();};row.appendChild(b);spells.appendChild(row);
    }
    const resources=el('character-resources');resources.replaceChildren();
    for(const [id,r] of Object.entries(state.resources||{})){
      const row=document.createElement('div');row.className='resource-row';const span=document.createElement('span');span.textContent=`${r.name}: ${r.max-r.spent}/${r.max} · descanso ${r.recharge==='short'?'corto':'largo'}`;row.appendChild(span);
      for(const [label,change] of [['Usar',1],['Devolver',-1],['Quitar',0]]){const b=document.createElement('button');b.type='button';b.className='btn btn-small';b.textContent=label;b.disabled=change===1?r.spent>=r.max:change===-1?r.spent===0:false;b.onclick=()=>{if(!change)delete state.resources[id];else r.spent+=change;saveState();render();};row.appendChild(b);}resources.appendChild(row);
    }
    renderCombat();
  }
  function updateOptions(select,items){const signature=JSON.stringify(items);if(select.dataset.items!==signature){const previous=select.value;select.innerHTML=items.map(([id,label])=>option(id,label)).join('');if(items.some(([id])=>String(id)===previous))select.value=previous;select.dataset.items=signature;}}
  function renderCombat(){
    if(!el('character-cast-spell')||typeof combat==='undefined')return;
    const c=rules.classFor(state),learned=new Set((state.spellbook||[]).filter(s=>s.prepared).map(s=>s.rulesSpellId));
    const available=rules.spells.filter(s=>s.classes.includes(c?.id)&&learned.has(s.id));
    updateOptions(el('character-cast-spell'),available.map(s=>[s.id,s.name]));
    updateOptions(el('character-cast-target'),combat.enemies.map((e,i)=>[i,eName(e)+' · '+e.hp+' PG']).filter(([i])=>combat.enemies[i].hp>0));
    updateOptions(el('character-cast-slot'),rules.spellSlots(state).map(s=>[s.level,`N${s.level}: ${Math.max(0,s.max-(state.spellSlotsSpent?.[s.pact?'pact':s.level]||0))}/${s.max}`]));
    const spell=available.find(s=>s.id===el('character-cast-spell').value);
    el('character-magic-panel').hidden=!c?.cast;
    el('character-cast-target').disabled=spell?.type==='heal';el('character-cast-slot').disabled=!spell?.level;
    el('character-cast').disabled=!spell||!combat.on||!isPlayerTurn()||(spell.bonus?!combat.p?.ba:!combat.p?.action);
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const dialog=document.createElement('dialog');dialog.id='character-builder';dialog.setAttribute('aria-labelledby','builder-title');
    dialog.innerHTML=`<form id="builder-form" novalidate>
      <h2 id="builder-title">Crear personaje · D&D 2024</h2><p id="builder-step" tabindex="-1"></p>
      <div id="builder-error" class="login-error" role="alert" tabindex="-1"></div>
      <section id="builder-identity"><div class="grid grid-2">
      <label class="field"><span>Nombre</span><input id="builder-name" maxlength="80" required></label>
      <label class="field"><span>Nivel</span><input id="builder-level" type="number" min="1" max="20" value="1"></label>
      <label class="field"><span>Clase</span><select id="builder-class">${rules.classes.map(c=>option(c.id,c.es)).join('')}</select></label>
      <label class="field"><span>Subclase (desde N3)</span><input id="builder-subclass" maxlength="80" placeholder="Nombre de subclase"></label>
      <label class="field"><span>Especie</span><select id="builder-species">${rules.species.map(s=>option(s.id,s.es)).join('')}</select></label>
      <label class="field" id="builder-species-name-field"><span>Especie personalizada</span><input id="builder-species-name" maxlength="80"></label>
      <label class="field"><span>Trasfondo</span><select id="builder-background">${rules.backgrounds.map(b=>option(b.id,b.es)).join('')}</select></label>
      <label class="field" id="builder-background-name-field"><span>Trasfondo personalizado</span><input id="builder-background-name" maxlength="80"></label>
      <div id="builder-custom-background" hidden><label class="field"><span>Habilidad de trasfondo 1</span><select id="builder-bg-skill-1">${rules.skills.map(k=>option(k,skillLabel(k))).join('')}</select></label><label class="field"><span>Habilidad de trasfondo 2</span><select id="builder-bg-skill-2">${rules.skills.map(k=>option(k,skillLabel(k))).join('')}</select></label><label class="field"><span>Dote del trasfondo</span><select id="builder-background-feat">${rules.origins.map(f=>option(f.id,f.name)).join('')}</select></label></div>
      <label class="field"><span>Jugador (opcional)</span><input id="builder-player" maxlength="80"></label><label class="field"><span>Campaña (opcional)</span><input id="builder-campaign" maxlength="120"></label>
      </div><p id="builder-class-info" class="hint"></p><a id="builder-class-source" target="_blank" rel="noopener noreferrer">Consultar clase oficial</a><p id="builder-species-note" class="hint"></p>
      <p>Idiomas: Común y dos adicionales.</p><div class="grid grid-2">${[1,2].map(n=>`<label class="field"><span>Idioma ${n}</span><select id="builder-language-${n}">${['Élfico','Enano','Gigante','Gnómico','Goblin','Mediano','Orco','Dracónico','Lengua de signos común'].map(l=>option(l,l)).join('')}</select></label>`).join('')}</div>
      <label class="field" id="builder-rogue-language-field"><span>Idioma adicional de Pícaro (además de Jerga de ladrones)</span><input id="builder-rogue-language" value="Dracónico" maxlength="80"></label></section>
      <section id="builder-stats" hidden><label class="field"><span>Método de características</span><select id="builder-method"><option value="standard">Reparto estándar</option><option value="points">Compra de 27 puntos</option><option value="manual">Tiradas / valores acordados con DM</option></select></label><p id="builder-boost-hint" class="hint"></p>
      <div class="builder-abilities">${rules.abilities.map(a=>`<label class="field"><span>${esc(t('ability_'+a))}</span><input id="builder-${a}" type="number" min="3" max="20"><span>Aumento</span><select id="builder-boost-${a}">${[0,1,2].map(n=>option(n,'+'+n)).join('')}</select></label>`).join('')}</div>
      <h3>Habilidades de clase</h3><p id="builder-skill-hint" class="hint"></p><div id="builder-skills" class="builder-checks"></div>
      <label class="field" id="builder-species-skill-field"><span>Habilidad adicional de especie</span><select id="builder-species-skill"></select></label>
      <label class="field" id="builder-human-feat-field"><span>Dote de origen humana</span><select id="builder-origin-feat">${rules.origins.map(f=>option(f.id,f.name)).join('')}</select></label>
      <fieldset id="builder-expertise-field"><legend>Pericia</legend><p id="builder-expertise-hint" class="hint"></p><div id="builder-expertise" class="builder-checks"></div></fieldset></section>
      <section id="builder-review" hidden><h3>Revisa antes de guardar</h3><ul id="builder-review-list"></ul><p class="hint">Una clase por personaje. Equipo por compra con oro; conjuros y elecciones especiales se completan en ficha. Cambiar texto de clase después no reconstruye personaje.</p></section>
      <div class="rest-row builder-actions"><button type="button" class="btn" id="builder-cancel">Guardar borrador y cerrar</button><button type="button" class="btn" id="builder-back">Atrás</button><button type="button" class="btn btn-crimson" id="builder-next">Siguiente</button><button type="submit" class="btn btn-crimson" id="builder-submit" hidden>Crear y guardar personaje</button></div></form>`;
    document.body.appendChild(dialog);el('builder-language-2').value='Enano';
    el('builder-form').addEventListener('submit',submit);
    el('builder-next').onclick=()=>{saveDraft();showStep(Math.min(2,step+1));};el('builder-back').onclick=()=>showStep(Math.max(0,step-1));
    el('builder-cancel').onclick=()=>{saveDraft();dialog.close();};dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();else saveDraft();});
    for(const id of ['builder-class','builder-species','builder-background','builder-level','builder-bg-skill-1','builder-bg-skill-2'])el(id).addEventListener('change',()=>{const previous=spec();renderChoices(previous);saveDraft();});
    el('builder-form').addEventListener('change',saveDraft);
    el('welcome-create').onclick=open;
    el('character-spell-quick').onchange=()=>{const s=rules.spells.find(s=>s.id===value('character-spell-quick'));if(s){el('character-spell-name').value=s.name;el('character-spell-level').value=s.level;el('character-spell-details').value=`${s.en} · ${s.range} ft · ${s.bonus?'acción adicional':'acción'} · resolución básica disponible en Combate. Revisar componentes y efectos con DM.`;}};
    el('character-spell-form').onsubmit=event=>{event.preventDefault();const name=value('character-spell-name').trim(),level=Number(value('character-spell-level')),details=value('character-spell-details').trim();if(!name||name.length>120||!Number.isInteger(level)||level<0||level>9||(state.spellbook||[]).length>=200)return;const quick=rules.spells.find(s=>s.id===value('character-spell-quick')&&s.level===level&&s.classes.includes(rules.classFor(state)?.id));state.spellbook||=[];state.spellbook.push({id:crypto.randomUUID(),name,level,details:details.slice(0,5000),prepared:true,...(quick?{rulesSpellId:quick.id}:{})});saveState();event.target.reset();el('character-spell-quick').value='';render();};
    el('character-resource-form').onsubmit=event=>{event.preventDefault();const name=value('character-resource-name').trim(),max=Number(value('character-resource-max'));if(!name||!Number.isInteger(max)||max<1||max>999||Object.keys(state.resources||{}).length>=60)return;state.resources||={};state.resources[crypto.randomUUID()]={name,max,spent:0,recharge:value('character-resource-rest')};saveState();event.target.reset();render();};
    el('character-shop-buy').onclick=()=>{if(combat.on)return;try{const item=window.CHARACTER_EQUIPMENT.purchase(state,value('character-shop-item'));saveState();renderAll();el('character-shop-status').textContent=`${item.name}: comprado. Armaduras requieren marcar equipada; armas ya disponibles en ficha.`;}catch(error){el('character-shop-status').textContent=error.message;}};
    for(const id of ['character-cast-spell','character-cast-slot'])el(id).addEventListener('change',renderCombat);
    el('character-cast').onclick=()=>{const ok=window.CHARACTER_MAGIC.cast(value('character-cast-spell'),combat.enemies[Number(value('character-cast-target'))],Number(value('character-cast-slot')));el('character-cast-status').textContent=ok?'Conjuro resuelto; revisa tirada en registro.':'Revisa turno, acción, objetivo, alcance y espacios disponibles. Solo un espacio de conjuro por turno.';};
    render();
  });
  window.CHARACTER_UI={open,render,renderCombat};
})();
