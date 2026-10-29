/* Resolución de conjuros simples explícitamente soportados; otros efectos se gestionan con DM. */
(function () {
  'use strict';
  const rules=CHARACTER_RULES;
  function cast(id,target,slotLevel=0) {
    const p=combat.p,c=rules.classFor(state),spell=rules.spells.find(s=>s.id===id);
    const learned=state.spellbook?.find(s=>s.rulesSpellId===id&&s.prepared);
    if(!combat.on||!isPlayerTurn()||!p||!spell||!learned||!c?.cast||!spell.classes.includes(c.id)) return false;
    const untrainedArmor=state.inventory.some(i=>i.equipped&&window.CHARACTER_EQUIPMENT?.armor.some(a=>a.id===i.equipmentId&&!c.armor.includes(a.type)));
    if(untrainedArmor){cLog('⛔ No puedes lanzar conjuros con armadura o escudo sin entrenamiento.','log-miss');return false;}
    if(spell.bonus?!p.ba:!p.action)return false;
    if(hasPCond('incapacitated')||hasPCond('unconscious')||hasPCond('paralyzed')||hasPCond('stunned'))return false;
    const healing=spell.type==='heal';
    if(!healing&&(!target||target.hp<=0||distOf(target)>spell.range||!hasLineOfSight(p.pos,target.pos)))return false;
    if(healing&&p.hp>=state.hpMax)return false;
    let slot;
    if(spell.level){
      if(p.slotSpellCast){cLog('⛔ Solo puedes gastar un espacio de conjuro por turno.','log-miss');return false;}
      slot=rules.spellSlots(state).find(s=>s.level===slotLevel&&s.level>=spell.level&&(state.spellSlotsSpent?.[s.pact?'pact':s.level]||0)<s.max);
      if(!slot)return false;
    }
    if(spell.bonus){p.ba=false;p.lastBonus='conjuro';}else p.action=false;
    if(slot){const key=slot.pact?'pact':String(slot.level);state.spellSlotsSpent||={};state.spellSlotsSpent[key]=(state.spellSlotsSpent[key]||0)+1;p.slotSpellCast=true;saveState();}
    const ability=abilityMod(state.abilities[c.cast]),dc=8+profBonus(state.level)+ability;
    const scale=spell.level?Math.max(0,slotLevel-spell.level):state.level>=17?3:state.level>=11?2:state.level>=5?1:0;
    let total=0,parts=[];
    if(healing){
      const dice=rollDice(spell.dice+2*scale,spell.sides),amount=Math.max(0,sum(dice)+ability),before=p.hp;
      p.hp=Math.min(state.hpMax,p.hp+amount);total=p.hp-before;
      parts.push(`${dice.length}d${spell.sides}(${dice.join(',')}) ${fmtMod(ability)} → +${total} PG`);
    }else if(spell.type==='automatic'){
      // Cada dardo 1d4+1; se agrupan contra objetivo elegido. Escudo/Contraconjuro se resuelven con DM.
      const die=rollDie(spell.sides),count=spell.dice+scale;total=(die+1)*count;parts.push(`${count} × (1d4(${die})+1) → ${total}`);
    }else{
      const beams=spell.beams?1+scale:1;
      for(let i=0;i<beams;i++){
        let hit=true,crit=false;
        if(spell.type==='attack'){
          const near=combat.enemies.some(e=>e.hp>0&&distOf(e)<=5),cm=condModsVs(target,distOf(target));
          const dis=near||cm.dis||hasPCond('poisoned')||hasPCond('blinded'),adv=p.hidden||cm.adv;
          const rolls=rollDice(adv!==dis?2:1,20),chosen=adv&&!dis?Math.max(...rolls):dis&&!adv?Math.min(...rolls):rolls[0];
          const cover=hasCover(target,p)?2:0;crit=chosen===20;hit=chosen!==1&&(crit||chosen+ability+profBonus(state.level)>=target.ac+cover);p.hidden=false;
          parts.push(`d20(${rolls.join(',')}) ${fmtMod(ability+profBonus(state.level))} vs CA ${target.ac+cover}: ${hit?'impacto':'fallo'}`);
        }else{
          const bonus=target.mods?.[spell.save]||0,die=rollDie(20);hit=die+bonus<dc;
          parts.push(`${spell.save.toUpperCase()}: d20(${die}) ${fmtMod(bonus)} vs CD ${dc}: ${hit?'falla':'salva'}`);
        }
        if(hit){const count=(spell.beams?1:spell.dice+scale)*(crit?2:1),dice=rollDice(count,spell.sides);total+=sum(dice);parts.push(`${count}d${spell.sides}(${dice.join(',')})${crit?' crítico':''}`);if(spell.sap)target.sap=true;}
      }
    }
    p.hidden=false;
    if(!healing){const before=target.hp;target.hp=Math.max(0,target.hp-total);if(combat.stats)combat.stats.dmg+=before-target.hp;fxHit(target,total,false);}
    cLog(`✨ ${spell.name} → ${healing?escapeHtml(state.name):eName(target)}: ${parts.join(' · ')}${spell.damageType?' · '+spell.damageType:''}`,'log-hit');
    cLog('📖 Confirma componentes, resistencias y reacciones defensivas con DM. Otros rasgos especiales no se aplican automáticamente.','log-info');
    renderCombat();window.CHARACTER_UI?.render();checkCombatEnd();
    return true;
  }
  window.CHARACTER_MAGIC={cast};
})();
