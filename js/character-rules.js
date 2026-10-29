/* D&D 2024. Datos mecánicos resumidos, fuentes oficiales por clase.
   Núcleo puro: no DOM, almacenamiento ni acceso a otras cuentas. */
(function (root) {
  'use strict';
  const AB = ['str','dex','con','int','wis','cha'];
  const ALL_SKILLS = ['acrobatics','animalHandling','arcana','athletics','deception','history','insight','intimidation','investigation','medicine','nature','perception','performance','persuasion','religion','sleightOfHand','stealth','survival'];
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const mod = score => Math.floor((score - 10) / 2);
  const pb = level => Math.ceil(level / 4) + 1;
  const classes = [
    {id:'barbarian',es:'Bárbaro',en:'Barbarian',die:12,saves:['str','con'],skills:['animalHandling','athletics','intimidation','nature','perception','survival'],count:2,armor:['light','medium','shield'],weapons:'martial',gold:75,mastery:2,extra:5},
    {id:'bard',es:'Bardo',en:'Bard',die:8,saves:['dex','cha'],skills:ALL_SKILLS,count:3,armor:['light'],weapons:'simple',gold:90,cast:'cha',caster:'full'},
    {id:'cleric',es:'Clérigo',en:'Cleric',die:8,saves:['wis','cha'],skills:['history','insight','medicine','persuasion','religion'],count:2,armor:['light','medium','shield'],weapons:'simple',gold:110,cast:'wis',caster:'full'},
    {id:'druid',es:'Druida',en:'Druid',die:8,saves:['int','wis'],skills:['animalHandling','arcana','insight','medicine','nature','perception','religion','survival'],count:2,armor:['light','shield'],weapons:'simple',gold:50,cast:'wis',caster:'full'},
    {id:'fighter',es:'Guerrero',en:'Fighter',die:10,saves:['str','con'],skills:['acrobatics','animalHandling','athletics','history','insight','intimidation','persuasion','perception','survival'],count:2,armor:['light','medium','heavy','shield'],weapons:'martial',gold:155,mastery:3,extra:5},
    {id:'monk',es:'Monje',en:'Monk',die:8,saves:['str','dex'],skills:['acrobatics','athletics','history','insight','religion','stealth'],count:2,armor:[],weapons:'monk',gold:50,extra:5},
    {id:'paladin',es:'Paladín',en:'Paladin',die:10,saves:['wis','cha'],skills:['athletics','insight','intimidation','medicine','persuasion','religion'],count:2,armor:['light','medium','heavy','shield'],weapons:'martial',gold:150,mastery:2,extra:5,cast:'cha',caster:'half'},
    {id:'ranger',es:'Explorador',en:'Ranger',die:10,saves:['str','dex'],skills:['animalHandling','athletics','insight','investigation','nature','perception','stealth','survival'],count:3,armor:['light','medium','shield'],weapons:'martial',gold:150,mastery:2,extra:5,cast:'wis',caster:'half'},
    {id:'rogue',es:'Pícaro',en:'Rogue',die:8,saves:['dex','int'],skills:['acrobatics','athletics','deception','insight','intimidation','investigation','perception','persuasion','sleightOfHand','stealth'],count:4,armor:['light'],weapons:'rogue',gold:100,mastery:2},
    {id:'sorcerer',es:'Hechicero',en:'Sorcerer',die:6,saves:['con','cha'],skills:['arcana','deception','insight','intimidation','persuasion','religion'],count:2,armor:[],weapons:'simple',gold:50,cast:'cha',caster:'full'},
    {id:'warlock',es:'Brujo',en:'Warlock',die:8,saves:['wis','cha'],skills:['arcana','deception','history','intimidation','investigation','nature','religion'],count:2,armor:['light'],weapons:'simple',gold:100,cast:'cha',caster:'pact'},
    {id:'wizard',es:'Mago',en:'Wizard',die:6,saves:['int','wis'],skills:['arcana','history','insight','investigation','medicine','religion'],count:2,armor:[],weapons:'simple',gold:55,cast:'int',caster:'full'}
  ].map((value,index) => ({...value,source:`https://www.dndbeyond.com/classes/${2190875+index}-${value.id}`}));
  const species = [
    {id:'dragonborn',es:'Dracónido',en:'Dragonborn',speed:30,notes:'Elegir ascendencia dracónica, resistencia y aliento. Aliento: recurso de mesa.'},
    {id:'dwarf',es:'Enano',en:'Dwarf',speed:30,hp:1,notes:'+1 PG por nivel. Resistencia al veneno; visión en oscuridad.'},
    {id:'elf',es:'Elfo',en:'Elf',speed:30,skill:['insight','perception','survival'],notes:'Elegir linaje y magia; trance y ascendencia feérica.'},
    {id:'gnome',es:'Gnomo',en:'Gnome',speed:30,notes:'Elegir linaje; ventaja en salvaciones INT, SAB y CAR.'},
    {id:'goliath',es:'Goliat',en:'Goliath',speed:35,notes:'Elegir ascendencia gigante; gestionar usos de rasgo en recursos.'},
    {id:'halfling',es:'Mediano',en:'Halfling',speed:30,notes:'Suerte y valentía: confirmar rerolls y ventajas con DM.'},
    {id:'human',es:'Humano',en:'Human',speed:30,skill:ALL_SKILLS,notes:'Competencia adicional, dote de origen adicional e Inspiración tras descanso largo.'},
    {id:'orc',es:'Orco',en:'Orc',speed:30,notes:'Adrenalina, aguante y visión en oscuridad; gestionar recursos de especie.'},
    {id:'tiefling',es:'Tiefling',en:'Tiefling',speed:30,notes:'Elegir legado infernal, resistencia y magia de legado.'},
    {id:'custom',es:'Otra especie / personalizada',en:'Custom species',speed:30,notes:'Rasgos, idiomas, velocidad y resistencias acordados con DM.'}
  ];
  const backgrounds = [
    {id:'acolyte',es:'Acólito',en:'Acolyte',abilities:['int','wis','cha'],skills:['insight','religion'],feat:'magicInitiateCleric',tool:'Útiles de calígrafo'},
    {id:'criminal',es:'Criminal',en:'Criminal',abilities:['dex','con','int'],skills:['sleightOfHand','stealth'],feat:'alert',tool:'Herramientas de ladrón'},
    {id:'sage',es:'Sabio',en:'Sage',abilities:['con','int','wis'],skills:['arcana','history'],feat:'magicInitiateWizard',tool:'Útiles de calígrafo'},
    {id:'soldier',es:'Soldado',en:'Soldier',abilities:['str','dex','con'],skills:['athletics','intimidation'],feat:'savageAttacker',tool:'Juego de mesa (elegir tipo)'},
    {id:'custom',es:'Otro trasfondo / personalizado',en:'Custom background',abilities:AB,skills:[],tool:'Herramienta acordada con DM'}
  ];
  const origins = [
    ['alert','Alerta','Competencia en iniciativa e intercambio con aliado voluntario.'],
    ['tough','Duro','+2 PG por nivel.'],
    ['skilled','Habilidoso','Tres competencias adicionales en habilidades o herramientas; elegir en ficha.'],
    ['lucky','Afortunado','Usos de suerte iguales a competencia; gestionar con DM.'],
    ['savageAttacker','Atacante salvaje','Una vez por turno, comparar dos tiradas de daño de arma y elegir.'],
    ['magicInitiateCleric','Iniciado en magia (Clérigo)','Elegir dos trucos y un conjuro de nivel 1 de Clérigo.'],
    ['magicInitiateWizard','Iniciado en magia (Mago)','Elegir dos trucos y un conjuro de nivel 1 de Mago.'],
    ['magicInitiateDruid','Iniciado en magia (Druida)','Elegir dos trucos y un conjuro de nivel 1 de Druida.'],
    ['healer','Sanador','Curación con equipo y dados de golpe; confirmar efecto con DM.'],
    ['musician','Músico','Elegir instrumentos; Inspiración para aliados tras descansar.'],
    ['tavernBrawler','Peleador de taberna','Ataques desarmados y armas improvisadas; gestionar efectos con DM.'],
    ['crafter','Artesano','Elegir herramientas de artesano; fabricación y descuento de equipo.']
  ].map(([id,name,desc]) => ({id,name,desc}));
  const features={
    barbarian:{1:'Furia, Defensa sin armadura, Maestría',2:'Sentido del peligro, Ataque temerario',3:'Subclase, Conocimiento primigenio',5:'Ataque extra, Movimiento rápido',6:'Subclase',7:'Instinto salvaje, Salto instintivo',9:'Golpe brutal',10:'Subclase',11:'Furia implacable',13:'Golpe brutal mejorado',14:'Subclase',15:'Furia persistente',17:'Golpe brutal mejorado',18:'Fuerza indomable',20:'Campeón primigenio'},
    bard:{1:'Inspiración bárdica, Lanzamiento de conjuros',2:'Pericia, Aprendiz de todo',3:'Subclase',5:'Fuente de inspiración',6:'Subclase',7:'Contraencanto',9:'Pericia',10:'Secretos mágicos',14:'Subclase',18:'Inspiración superior',20:'Palabras de creación'},
    cleric:{1:'Lanzamiento de conjuros, Orden divina',2:'Canalizar divinidad',3:'Subclase',5:'Quemar muertos vivientes',6:'Subclase',7:'Golpes benditos',10:'Intervención divina',14:'Golpes benditos mejorados',17:'Subclase',20:'Intervención divina mayor'},
    druid:{1:'Lanzamiento de conjuros, Druídico, Orden primigenia',2:'Forma salvaje, Compañero salvaje',3:'Subclase',5:'Resurgimiento salvaje',6:'Subclase',7:'Furia elemental',10:'Subclase',14:'Subclase',15:'Furia elemental mejorada',18:'Conjuros en forma bestial',20:'Archidruida'},
    fighter:{1:'Estilo de combate, Segundo aliento, Maestría',2:'Acción súbita, Mente táctica',3:'Subclase',5:'Ataque extra, Cambio táctico',7:'Subclase',9:'Indomable, Maestro táctico',10:'Subclase',11:'Dos ataques extra',13:'Ataques estudiados',15:'Subclase',17:'Acción súbita e Indomable mejorados',18:'Subclase',20:'Tres ataques extra'},
    monk:{1:'Artes marciales, Defensa sin armadura',2:'Focus, Movimiento sin armadura, Metabolismo extraordinario',3:'Desviar ataques, Subclase',4:'Caída lenta',5:'Ataque extra, Golpe aturdidor',6:'Golpes potenciados, Subclase',7:'Evasión',9:'Movimiento acrobático',10:'Focus mejorado, Restauración propia',11:'Subclase',13:'Desviar energía',14:'Superviviente disciplinado',15:'Focus perfecto',17:'Subclase',18:'Defensa superior',20:'Cuerpo y mente'},
    paladin:{1:'Imposición de manos, Conjuros, Maestría',2:'Estilo de combate, Castigo divino',3:'Canalizar divinidad, Subclase',5:'Ataque extra, Montura fiel',6:'Aura de protección',7:'Subclase',9:'Abjurar enemigos',10:'Aura de coraje',11:'Golpes radiantes',14:'Toque restaurador',15:'Subclase',18:'Expansión de aura',20:'Subclase'},
    ranger:{1:'Conjuros, Enemigo predilecto, Maestría',2:'Explorador hábil, Estilo de combate',3:'Subclase',5:'Ataque extra',6:'Movilidad',7:'Subclase',9:'Pericia',10:'Incansable',11:'Subclase',13:'Cazador implacable',14:'Velo de la naturaleza',15:'Subclase',17:'Cazador preciso',18:'Sentidos salvajes',20:'Azote de enemigos'},
    rogue:{1:'Pericia, Furtivo, Jerga de ladrones, Maestría',2:'Acción astuta',3:'Subclase, Puntería firme',5:'Golpes astutos, Esquiva asombrosa',6:'Pericia',7:'Evasión, Talento confiable',9:'Subclase',11:'Golpes astutos mejorados',13:'Subclase',14:'Golpes tortuosos',15:'Mente escurridiza',17:'Subclase',18:'Elusivo',20:'Golpe de suerte'},
    sorcerer:{1:'Conjuros, Hechicería innata',2:'Fuente de magia, Metamagia',3:'Subclase',5:'Restauración de hechicería',6:'Subclase',7:'Hechicería encarnada',10:'Metamagia',14:'Subclase',17:'Metamagia',18:'Subclase',20:'Apoteosis arcana'},
    warlock:{1:'Magia de pacto, Invocaciones',2:'Astucia mágica',3:'Subclase',6:'Subclase',9:'Contactar con patrón',10:'Subclase',11:'Arcanum místico N6',13:'Arcanum místico N7',14:'Subclase',15:'Arcanum místico N8',17:'Arcanum místico N9',20:'Maestro sobrenatural'},
    wizard:{1:'Conjuros, Adepto ritual, Recuperación arcana',2:'Erudito',3:'Subclase',5:'Memorizar conjuro',6:'Subclase',10:'Subclase',14:'Subclase',18:'Dominio de conjuros',20:'Conjuros característicos'}
  };
  const slots = [[],[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
  const spells = [
    {id:'fireBolt',name:'Descarga de fuego',en:'Fire Bolt',level:0,classes:['sorcerer','wizard'],dice:1,sides:10,range:120,type:'attack',damageType:'Fuego'},
    {id:'eldritchBlast',name:'Descarga sobrenatural',en:'Eldritch Blast',level:0,classes:['warlock'],dice:1,sides:10,range:120,type:'attack',beams:true,damageType:'Fuerza'},
    {id:'sacredFlame',name:'Llama sagrada',en:'Sacred Flame',level:0,classes:['cleric'],dice:1,sides:8,range:60,type:'save',save:'dex',damageType:'Radiante'},
    {id:'viciousMockery',name:'Burla dañina',en:'Vicious Mockery',level:0,classes:['bard'],dice:1,sides:6,range:60,type:'save',save:'wis',sap:true,damageType:'Psíquico'},
    {id:'cureWounds',name:'Curar heridas',en:'Cure Wounds',level:1,classes:['bard','cleric','druid','paladin','ranger'],dice:2,sides:8,range:5,type:'heal',abilityBonus:true},
    {id:'healingWord',name:'Palabra de curación',en:'Healing Word',level:1,classes:['bard','cleric','druid'],dice:2,sides:4,range:60,type:'heal',abilityBonus:true,bonus:true},
    {id:'magicMissile',name:'Proyectil mágico',en:'Magic Missile',level:1,classes:['sorcerer','wizard'],dice:3,sides:4,range:120,type:'automatic',damageType:'Fuerza'}
  ];
  const simple = new Set(['club','dagger','greatclub','handaxe','javelin','lightHammer','mace','quarterstaff','sickle','spear','dart','lightCrossbow','shortbow','sling']);
  const finesse = new Set(['dagger','dart','rapier','scimitar','shortsword','whip']);
  const light = new Set(['club','dagger','handaxe','lightHammer','sickle','scimitar','shortsword','handCrossbow']);
  const ranged = new Set(['dart','sling','lightCrossbow','shortbow','longbow','handCrossbow','heavyCrossbow']);
  const classFor = data => classes.find(c => [c.id,norm(c.es),norm(c.en)].includes(norm(data.identity?.charClass)));
  const speciesFor = data => species.find(s => [s.id,norm(s.es),norm(s.en)].includes(norm(data.identity?.species)));
  const isRogue = data => classFor(data)?.id === 'rogue';
  const isAssassin = data => isRogue(data) && data.level >= 3 && ['asesino','assassin'].includes(norm(data.identity?.subclass));
  function backgroundFor(spec) {const bg=backgrounds.find(b=>b.id===spec?.backgroundId);return bg?.id==='custom'?{...bg,skills:Array.isArray(spec.backgroundSkills)?spec.backgroundSkills:[],feat:spec.backgroundFeat}:bg;}
  function spellSlots(data) {
    const c = classFor(data), lv = data.level;
    if (c?.caster === 'pact') return [{level:Math.min(5,Math.ceil(lv/2)),max:lv===1?1:lv<11?2:lv<17?3:4,pact:true}];
    const row = slots[c?.caster === 'full' ? lv : c?.caster === 'half' ? Math.ceil(lv/2) : 0] || [];
    return row.map((max,index) => ({level:index+1,max,pact:false}));
  }
  function attacks(data) {
    const c = classFor(data);
    if (c?.id === 'fighter' && data.level >= 20) return 4;
    if (c?.id === 'fighter' && data.level >= 11) return 3;
    return c?.extra && data.level >= c.extra ? 2 : 1;
  }
  function masteryCount(data) {
    const c=classFor(data);return c?.id==='fighter'?(data.level>=16?6:data.level>=10?5:data.level>=4?4:3):c?.id==='barbarian'?(data.level>=10?4:data.level>=4?3:2):(c?.mastery||0);
  }
  function progression(data){
    const c=classFor(data);return Array.from({length:20},(_,i)=>{const lv=i+1,asi=[4,8,12,16].includes(lv)||c?.id==='fighter'&&[6,14].includes(lv)||c?.id==='rogue'&&lv===10;const label=[features[c?.id]?.[lv],`Competencia +${pb(lv)}`,asi?'Dote / mejora de características':'',lv===19?'Dote épica':''].filter(Boolean).join(' · ');const detail='Referencia de clase: rasgos especiales, subclases y elecciones se registran en ficha y se resuelven con DM cuando no están automatizados.';return{lv,asi,boon:lv===19,es:label,en:label,detailEs:detail,detailEn:detail};});
  }
  function weapon(data, w) {
    const c = classFor(data), id = w.weaponId;
    const property = norm(w.props);
    const isRanged = ranged.has(id) || /ranged|municion|ammunition/.test(property);
    const fin = finesse.has(id) || /finesse|sutil/.test(property);
    const monkWeapon = c?.id==='monk' && !isRanged && (simple.has(id)||light.has(id)||id==='unarmed');
    const ability = w.attackAbility && AB.includes(w.attackAbility) ? w.attackAbility : isRanged ? 'dex' : (fin||monkWeapon) && data.abilities.dex > data.abilities.str ? 'dex' : 'str';
    const trained = typeof w.proficient === 'boolean' ? w.proficient : !c ? false : c.weapons === 'martial' || simple.has(id) || c.weapons === 'rogue' && (fin || light.has(id)) || c.weapons === 'monk' && light.has(id);
    const abilityMod = mod(data.abilities[ability]);
    return {ability,abilityMod,proficient:trained,attack:abilityMod+(trained?pb(data.level):0)+(Number(w.attackBonus)||0),damage:w.autoBonus?abilityMod:w.bonus,fin:fin||isRanged};
  }
  function blank(base) {
    const data = structuredClone(base);
    Object.assign(data,{name:'Nuevo personaje',level:1,xp:0,hpCurrent:1,hpMax:1,hpTemp:0,ac:10,initiative:0,speed:30,hitDiceSpent:0,deathSuccess:0,deathFail:0,inspiration:false,feats:[],weapons:[],inventory:[],journal:[],languages:['Común'],proficiencies:[],masteryChoices:[],notes:'',backstory:'',passiveManual:null,asiNotes:{},progressionOverrides:{},session:{lastPlayed:'',location:'',recap:'',nextGoal:''},sessionNotes:{},tableConditions:{},savedVersions:{},spellbook:[],spellSlotsSpent:{},resources:{},portrait:'',creation:null});
    data.identity = {charClass:'',subclass:'',species:'',background:'',alignment:'',playerName:'',campaign:''};
    data.personality = {traits:'',ideal:'',bond:'',flaw:''}; data.appearance = {age:'',height:'',weight:'',desc:''};
    AB.forEach(a => {data.abilities[a]=10;data.saveProfs[a]=false;});
    for(const skill of Object.keys(data.skills)) data.skills[skill]={p:false,e:false};
    for(const tool of Object.keys(data.tools)) data.tools[tool]={p:false,e:false};
    for(const coin of Object.keys(data.currency)) data.currency[coin]=0;
    return data;
  }
  function validate(spec) {
    const errors = [], c = classes.find(c=>c.id===spec?.classId), s = species.find(s=>s.id===spec?.speciesId), bg = backgroundFor(spec);
    if (!spec || !String(spec.name||'').trim() || String(spec.name).length>80) errors.push('Nombre: entre 1 y 80 caracteres.');
    if (!c || !s || !bg) return [...errors,'Elige clase, especie y trasfondo.'];
    if (!Number.isInteger(spec.level)||spec.level<1||spec.level>20) errors.push('Nivel: entero de 1 a 20.');
    const scores = AB.map(a=>Number(spec.abilities?.[a]));
    if (scores.some(n=>!Number.isInteger(n)||n<3||n>20)) errors.push('Características base: enteros entre 3 y 20.');
    if (spec.method==='standard' && [...scores].sort((a,b)=>a-b).join(',')!=='8,10,12,13,14,15') errors.push('Reparte 15, 14, 13, 12, 10 y 8 una sola vez.');
    if(spec.method==='points') {
      const costs={8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9};
      if(scores.some(n=>costs[n]===undefined)||scores.reduce((n,v)=>n+(costs[v]??100),0)>27) errors.push('Compra: valores 8–15 y máximo 27 puntos.');
    }
    if(!['standard','points','manual'].includes(spec.method)) errors.push('Elige método de características.');
    const boosts=AB.map(a=>Number(spec.boosts?.[a]||0));
    if (boosts.some((n,i)=>!Number.isInteger(n)||n<0||n>2||(n>0&&!bg.abilities.includes(AB[i]))||scores[i]+n>20) || !['0,0,0,0,1,2','0,0,0,1,1,1'].includes([...boosts].sort().join(','))) errors.push('Trasfondo: reparte +2/+1 o +1/+1/+1 entre atributos permitidos, máximo 20.');
    const selected=spec.skills||[];
    if (!Array.isArray(selected)||new Set(selected).size!==c.count||selected.length!==c.count||selected.some(k=>!c.skills.includes(k)||bg.skills.includes(k))) errors.push(`Elige ${c.count} habilidades de clase distintas del trasfondo.`);
    if(s.skill && (!s.skill.includes(spec.speciesSkill)||selected.includes(spec.speciesSkill)||bg.skills.includes(spec.speciesSkill))) errors.push('Elige habilidad de especie sin repetir.');
    if(s.id==='human'&&!origins.some(f=>f.id===spec.originFeat)) errors.push('Elige dote de origen humana.');
    if(s.id==='human'&&spec.originFeat===bg.feat&&bg.feat!=='skilled') errors.push('Dote humana debe ser diferente de dote del trasfondo.');
    if(c.id==='rogue') {
      const proficient=new Set([...selected,...bg.skills,...(s.skill?[spec.speciesSkill]:[])]);
      const ex=spec.expertise||[];
      if(!Array.isArray(ex)||ex.length!==(spec.level>=6?4:2)||new Set(ex).size!==ex.length||ex.some(k=>!proficient.has(k))) errors.push(`Elige ${spec.level>=6?4:2} pericias entre habilidades competentes.`);
    }
    if (s.id==='custom'&&!String(spec.speciesName||'').trim()) errors.push('Escribe especie personalizada.');
    if (bg.id==='custom'&&!String(spec.backgroundName||'').trim()) errors.push('Escribe trasfondo personalizado.');
    if(bg.id==='custom' && (bg.skills.length!==2||new Set(bg.skills).size!==2||bg.skills.some(k=>!ALL_SKILLS.includes(k))||!origins.some(f=>f.id===bg.feat))) errors.push('Trasfondo personalizado: elige dos habilidades distintas y dote de origen.');
    if(spec.level>=3&&!String(spec.subclass||'').trim()) errors.push('Desde nivel 3, indica subclase.');
    if(!Array.isArray(spec.languages)||new Set(spec.languages).size!==3||spec.languages.length!==3||!spec.languages.includes('Común')) errors.push('Elige Común y otros dos idiomas distintos.');
    if(c.id==='rogue'&&(!String(spec.rogueLanguage||'').trim()||spec.languages?.includes(spec.rogueLanguage)||spec.rogueLanguage==='Jerga de ladrones'))errors.push('Pícaro: elige idioma adicional distinto de idiomas iniciales y Jerga de ladrones.');
    return errors;
  }
  function create(base,spec,catalog=[]) {
    const errors=validate(spec); if(errors.length) throw new Error(errors.join('\n'));
    const data=blank(base), c=classes.find(c=>c.id===spec.classId), s=species.find(s=>s.id===spec.speciesId), bg=backgroundFor(spec);
    data.name=spec.name.trim(); data.level=spec.level;
    data.xp=[0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000][data.level-1];
    data.identity={...data.identity,charClass:c.es,species:s.id==='custom'?spec.speciesName.trim():s.es,background:bg.id==='custom'?spec.backgroundName.trim():bg.es,subclass:data.level>=3?String(spec.subclass).trim():'',playerName:String(spec.playerName||'').slice(0,80),campaign:String(spec.campaign||'').slice(0,120)};
    AB.forEach(a=>{data.abilities[a]=Number(spec.abilities[a])+Number(spec.boosts?.[a]||0); data.saveProfs[a]=c.saves.includes(a);});
    [...spec.skills,...bg.skills,...(s.skill?[spec.speciesSkill]:[])].forEach(k=>data.skills[k]={p:true,e:(spec.expertise||[]).includes(k)});
    data.languages=[...spec.languages]; if(c.id==='rogue') data.languages.push('Jerga de ladrones',spec.rogueLanguage.trim());
    const featIds=[bg.feat,...(s.id==='human'?[spec.originFeat]:[])].filter(Boolean);
    data.feats=featIds.map(id=>{const f=origins.find(f=>f.id===id);return{name:f.name,desc:f.desc,featId:id,custom:true};});
    const con=mod(data.abilities.con), hpPerLevel=(s.hp||0)+(featIds.includes('tough')?2:0);
    data.hpMax=data.hpCurrent=Math.max(1,c.die+con+hpPerLevel)+(data.level-1)*Math.max(1,c.die/2+1+con+hpPerLevel);
    data.ac=10+mod(data.abilities.dex);
    if(c.id==='barbarian') data.ac+=con;
    if(c.id==='monk') data.ac+=mod(data.abilities.wis);
    data.speed=s.speed+(c.id==='monk'&&data.level>=2?10+5*Math.floor((data.level-2)/4):0)+(c.id==='barbarian'&&data.level>=5?10:0);
    data.initiative=mod(data.abilities.dex)+(featIds.includes('alert')?pb(data.level):0);
    const labels={light:'Armadura ligera',medium:'Armadura media',heavy:'Armadura pesada',shield:'Escudos'};
    data.proficiencies=[...c.armor.map(a=>labels[a]),'Armas sencillas',...(c.weapons==='martial'?['Armas marciales']:c.weapons==='rogue'?['Armas marciales (Sutil o Ligera)']:c.weapons==='monk'?['Armas marciales (Ligera)']:[]),...(bg.tool?[bg.tool]:[])];
    if(bg.id==='criminal'||c.id==='rogue') data.tools.thievesTools.p=true;
    if(c.id==='druid')data.proficiencies.push('Kit de herborista');
    data.currency.gp=c.gold+50; // Opción de oro de clase + trasfondo; no regalar equipo además.
    data.weapons=[{name:'Golpe desarmado',weaponId:'unarmed',dice:1,sides:c.id==='monk'?(data.level>=17?12:data.level>=11?10:data.level>=5?8:6):1,bonus:mod(data.abilities.str),autoBonus:true,proficient:true,props:'cuerpo a cuerpo, sin arma',mastery:''}];
    data.creation={ruleset:'2024',classId:c.id,speciesId:s.id,backgroundId:bg.id,ready:true,method:spec.method,hpMethod:'fixed',equipment:'gold',notes:s.notes,autoHp:true,autoAc:true,autoInitiative:true,autoSpeed:true};
    data.notes=[s.notes,'Equipo inicial: elegiste oro; compra armas, armadura, foco y componentes antes de simular.','Rasgos de especie, dotes, subclase y conjuros con efectos especiales se resuelven con DM.',data.level>1?'Revisa elecciones de niveles anteriores: dotes/ASI, conjuros, maestrías y recursos.':''].filter(Boolean).join('\n');
    return data;
  }
  function recharge(data,rest) {
    if(rest==='long'||rest==='short'&&classFor(data)?.caster==='pact') data.spellSlotsSpent={};
    for(const resource of Object.values(data.resources||{})) if(rest==='long'||resource.recharge==='short') resource.spent=0;
  }
  function recalculate(data,armorClass) {
    const c=classFor(data),managed=data.creation;if(!c||!managed)return;
    const s=species.find(s=>s.id===managed.speciesId),con=mod(data.abilities.con),featIds=(data.feats||[]).map(f=>f.featId);
    if(managed.autoHp){const bonus=(s?.hp||0)+(featIds.includes('tough')?2:0),max=Math.max(1,c.die+con+bonus)+(data.level-1)*Math.max(1,c.die/2+1+con+bonus);data.hpCurrent=Math.max(0,Math.min(max,data.hpCurrent+max-data.hpMax));data.hpMax=max;}
    if(managed.autoInitiative)data.initiative=mod(data.abilities.dex)+(featIds.includes('alert')?pb(data.level):0);
    if(managed.autoAc&&armorClass)data.ac=armorClass(data);
    if(managed.autoSpeed)data.speed=(s?.speed||30)+(c.id==='monk'&&data.level>=2?10+5*Math.floor((data.level-2)/4):0)+(c.id==='barbarian'&&data.level>=5?10:0);
    for(const w of data.weapons||[])if(w.weaponId==='unarmed'&&c.id==='monk')w.sides=data.level>=17?12:data.level>=11?10:data.level>=5?8:6;
  }
  function validateState(data) {
    if(data.creation!=null && (typeof data.creation!=='object'||Array.isArray(data.creation)||data.creation.ruleset!=='2024'||typeof data.creation.ready!=='boolean'||!classes.some(c=>c.id===data.creation.classId))) throw new Error('Datos de creación incompatibles.');
    if(data.spellbook && (!Array.isArray(data.spellbook)||data.spellbook.length>200||data.spellbook.some(s=>!s||typeof s.id!=='string'||typeof s.name!=='string'||s.name.length>120||!Number.isInteger(s.level)||s.level<0||s.level>9||typeof s.details!=='string'))) throw new Error('Lista de conjuros no válida.');
    if(data.resources && (Array.isArray(data.resources)||typeof data.resources!=='object'||Object.keys(data.resources).length>60||Object.values(data.resources).some(r=>!r||typeof r.name!=='string'||!Number.isInteger(r.max)||r.max<1||r.max>999||!Number.isInteger(r.spent)||r.spent<0||r.spent>r.max||!['short','long'].includes(r.recharge)))) throw new Error('Recursos de personaje no válidos.');
    if(data.spellSlotsSpent && (Array.isArray(data.spellSlotsSpent)||typeof data.spellSlotsSpent!=='object'||Object.entries(data.spellSlotsSpent).some(([k,v])=>!/^([1-9]|pact)$/.test(k)||!Number.isInteger(v)||v<0||v>99))) throw new Error('Espacios de conjuro no válidos.');
  }
  const api={classes,species,backgrounds,backgroundFor,origins,spells,abilities:AB,skills:ALL_SKILLS,classFor,speciesFor,isRogue,isAssassin,spellSlots,attacks,masteryCount,progression,weapon,blank,validate,create,recharge,recalculate,validateState,mod,pb};
  root.CHARACTER_RULES=api;
})(globalThis);
