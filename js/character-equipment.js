/* Equipo básico: compra explícita, cambio de monedas y armadura equipada. */
(function () {
  'use strict';
  const rules=CHARACTER_RULES;
  const extra=[
    ['greatclub','Gran garrote','Greatclub','1d8','push',5,null,'dos manos'],
    ['battleaxe','Hacha de batalla','Battleaxe','1d8','topple',5,null,'versátil (1d10)'],
    ['flail','Mangual','Flail','1d8','sap',5,null,''],
    ['glaive','Guja','Glaive','1d10','graze',10,null,'pesada, dos manos, alcance'],
    ['greataxe','Gran hacha','Greataxe','1d12','cleave',5,null,'pesada, dos manos'],
    ['greatsword','Espadón','Greatsword','2d6','graze',5,null,'pesada, dos manos'],
    ['halberd','Alabarda','Halberd','1d10','cleave',10,null,'pesada, dos manos, alcance'],
    ['lance','Lanza de caballería','Lance','1d10','topple',10,null,'pesada, dos manos, alcance'],
    ['longsword','Espada larga','Longsword','1d8','sap',5,null,'versátil (1d10)'],
    ['maul','Maza a dos manos','Maul','2d6','topple',5,null,'pesada, dos manos'],
    ['morningstar','Lucero del alba','Morningstar','1d8','sap',5,null,''],
    ['pike','Pica','Pike','1d10','push',10,null,'pesada, dos manos, alcance'],
    ['trident','Tridente','Trident','1d8','topple',5,'20/60','arrojadiza, versátil (1d10)'],
    ['warhammer','Martillo de guerra','Warhammer','1d8','push',5,null,'versátil (1d10)'],
    ['warPick','Pico de guerra','War Pick','1d8','sap',5,null,'versátil (1d10)'],
    ['heavyCrossbow','Ballesta pesada','Heavy Crossbow','1d10','slow',0,'100/400','munición, pesada, recarga, dos manos'],
    ['musket','Mosquete','Musket','1d12','slow',0,'40/120','munición, recarga, dos manos'],
    ['pistol','Pistola','Pistol','1d10','vex',0,'30/90','munición, recarga']
  ];
  for(const [id,es,en,dmg,mastery,melee,range,props] of extra)if(!WEAPON_MASTERY.some(w=>w.id===id))WEAPON_MASTERY.push({id,es,en,dmg,mastery,melee,range,fin:!melee,propsEs:props,propsEn:props});
  const prices={club:.1,dagger:2,greatclub:.2,handaxe:5,javelin:.5,lightHammer:2,mace:5,quarterstaff:.2,sickle:1,spear:1,dart:.05,lightCrossbow:25,shortbow:25,sling:.1,battleaxe:10,flail:10,glaive:20,greataxe:30,greatsword:50,halberd:20,lance:10,longsword:15,maul:10,morningstar:15,pike:5,rapier:25,scimitar:25,shortsword:10,trident:5,warhammer:15,warPick:5,whip:2,blowgun:10,handCrossbow:75,heavyCrossbow:50,longbow:50,musket:500,pistol:250};
  const armor=[
    {id:'padded',name:'Armadura acolchada',cost:5,weight:8,type:'light',base:11},
    {id:'leather',name:'Armadura de cuero',cost:10,weight:10,type:'light',base:11},
    {id:'studded',name:'Cuero tachonado',cost:45,weight:13,type:'light',base:12},
    {id:'hide',name:'Armadura de pieles',cost:10,weight:12,type:'medium',base:12},
    {id:'chainShirt',name:'Camisa de malla',cost:50,weight:20,type:'medium',base:13},
    {id:'scale',name:'Cota de escamas',cost:50,weight:45,type:'medium',base:14},
    {id:'breastplate',name:'Coraza',cost:400,weight:20,type:'medium',base:14},
    {id:'halfPlate',name:'Semiplacas',cost:750,weight:40,type:'medium',base:15},
    {id:'ringMail',name:'Cota de anillas',cost:30,weight:40,type:'heavy',base:14},
    {id:'chainMail',name:'Cota de malla',cost:75,weight:55,type:'heavy',base:16,strength:13},
    {id:'splint',name:'Armadura de bandas',cost:200,weight:60,type:'heavy',base:17,strength:15},
    {id:'plate',name:'Armadura de placas',cost:1500,weight:65,type:'heavy',base:18,strength:15},
    {id:'shield',name:'Escudo',cost:10,weight:6,type:'shield',base:2}
  ];
  const gear=[{id:'arcaneFocus',name:'Foco arcano (bastón)',cost:5,weight:4},{id:'holySymbol',name:'Símbolo sagrado (amuleto)',cost:5,weight:1},{id:'druidicFocus',name:'Foco druídico (muérdago)',cost:1,weight:0},{id:'componentPouch',name:'Bolsa de componentes',cost:25,weight:2},{id:'spellbook',name:'Libro de conjuros',cost:50,weight:3},{id:'arrows',name:'20 flechas',cost:1,weight:1},{id:'bolts',name:'20 virotes',cost:1,weight:1}];
  const weights={club:2,dagger:1,greatclub:10,handaxe:2,javelin:2,lightHammer:2,mace:4,quarterstaff:4,sickle:2,spear:3,dart:.25,lightCrossbow:5,shortbow:2,sling:0,battleaxe:4,flail:2,glaive:6,greataxe:7,greatsword:6,halberd:6,lance:6,longsword:3,maul:10,morningstar:4,pike:18,rapier:2,scimitar:3,shortsword:2,trident:4,warhammer:5,warPick:2,whip:3,blowgun:1,handCrossbow:3,heavyCrossbow:18,longbow:2,musket:10,pistol:3};
  const items=[...WEAPON_MASTERY.map(w=>({id:w.id,name:w.es,cost:prices[w.id],weight:weights[w.id],weapon:w})),...armor,...gear].filter(i=>Number.isFinite(i.cost));
  function funds(data){return Object.entries({pp:1000,gp:100,st:100,ep:50,sp:10,cp:1}).reduce((sum,[coin,v])=>sum+(data.currency[coin]||0)*v,0);}
  function purchase(data,id){
    const item=items.find(i=>i.id===id);if(!item)throw new Error('Equipo no disponible.');
    const cost=Math.round(item.cost*100),money=funds(data);if(money<cost)throw new Error('Monedas insuficientes.');
    for(const coin of Object.keys(data.currency))data.currency[coin]=0;
    const remaining=money-cost;data.currency.gp=Math.floor(remaining/100);data.currency.sp=Math.floor(remaining%100/10);data.currency.cp=remaining%10;
    data.inventory.push({name:item.name,qty:1,wt:item.weight,note:`Comprado: ${item.cost} po`,equipmentId:id,equipped:false});
    if(item.weapon){const w=item.weapon,m=w.dmg.match(/(\d+)d(\d+)/);data.weapons.unshift({name:w.es,weaponId:w.id,dice:m?Number(m[1]):1,sides:m?Number(m[2]):1,bonus:0,autoBonus:true,props:w.propsEs,mastery:MASTERY_PROPERTIES.find(p=>p.id===w.mastery)?.name||''});}
    return item;
  }
  function armorClass(data){
    const c=rules.classFor(data),dex=rules.mod(data.abilities.dex),worn=data.inventory.filter(i=>i.equipped).map(i=>armor.find(a=>a.id===i.equipmentId)).filter(Boolean),body=worn.find(a=>a.type!=='shield'),shield=worn.some(a=>a.type==='shield');
    let ac=body?body.base+(body.type==='light'?dex:body.type==='medium'?Math.min(2,dex):0):10+dex;
    if(!body&&c?.id==='barbarian')ac+=rules.mod(data.abilities.con);
    if(!body&&!shield&&c?.id==='monk')ac+=rules.mod(data.abilities.wis);
    return ac+(shield?2:0);
  }
  function equip(data,index,checked){
    const entry=data.inventory[index],item=armor.find(a=>a.id===entry?.equipmentId);if(!item)throw new Error('Armadura no válida.');
    if(checked)for(const row of data.inventory){const other=armor.find(a=>a.id===row.equipmentId);if(other&&(other.type==='shield')===(item.type==='shield'))row.equipped=false;}
    entry.equipped=checked;data.ac=armorClass(data);if(data.creation)data.creation.autoAc=true;
    return rules.classFor(data)?.armor.includes(item.type)?'CA actualizada. Revisa manos libres, Sigilo y requisitos de FUE.':'Sin entrenamiento: confirma penalizaciones y bloqueo de conjuros con DM.';
  }
  window.CHARACTER_EQUIPMENT={items,armor,purchase,equip,armorClass,funds};
})();
