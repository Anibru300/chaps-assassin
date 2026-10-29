const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const defaults=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8')+'; JSON.parse(JSON.stringify(DEFAULT_STATE))');
module.exports={defaults,async seed(context){await context.addInitScript(data=>{if(!localStorage.getItem('chaps-state-v1'))localStorage.setItem('chaps-state-v1',JSON.stringify(data));},defaults);}};
