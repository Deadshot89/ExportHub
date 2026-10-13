import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const LOCALES=Object.freeze(['de','en','pl','es','fr','it']);
export const TRANSLATIONS=Object.freeze({
  de:Object.freeze({
    'taskV2.planner.title':'Aufgabenplaner','taskV2.planner.workweek':'Arbeitswoche','taskV2.planner.month':'Monat','taskV2.planner.currentWeek':'Aktuelle Woche','taskV2.planner.nextWeek':'Nächste Woche','taskV2.planner.overdue':'Überfällig','taskV2.planner.noOverdue':'Keine überfälligen Aufgaben','taskV2.planner.overload':'Diese Woche ist überlastet.','taskV2.planner.todaySummary':'Heute: {count} Aufgaben · {critical} kritisch · {overdue} überfällig'
  }),
  en:Object.freeze({
    'taskV2.planner.title':'Task planner','taskV2.planner.workweek':'Workweek','taskV2.planner.month':'Month','taskV2.planner.currentWeek':'Current week','taskV2.planner.nextWeek':'Next week','taskV2.planner.overdue':'Overdue','taskV2.planner.noOverdue':'No overdue tasks','taskV2.planner.overload':'This week is overloaded.','taskV2.planner.todaySummary':'Today: {count} tasks · {critical} critical · {overdue} overdue'
  }),
  pl:Object.freeze({
    'taskV2.planner.title':'Planer zadań','taskV2.planner.workweek':'Tydzień roboczy','taskV2.planner.month':'Miesiąc','taskV2.planner.currentWeek':'Bieżący tydzień','taskV2.planner.nextWeek':'Następny tydzień','taskV2.planner.overdue':'Zaległe','taskV2.planner.noOverdue':'Brak zaległych zadań','taskV2.planner.overload':'Ten tydzień jest przeciążony.','taskV2.planner.todaySummary':'Dzisiaj: {count} zadań · {critical} krytyczne · {overdue} zaległe'
  }),
  es:Object.freeze({
    'taskV2.planner.title':'Planificador de tareas','taskV2.planner.workweek':'Semana laboral','taskV2.planner.month':'Mes','taskV2.planner.currentWeek':'Semana actual','taskV2.planner.nextWeek':'Próxima semana','taskV2.planner.overdue':'Atrasadas','taskV2.planner.noOverdue':'No hay tareas atrasadas','taskV2.planner.overload':'Esta semana está sobrecargada.','taskV2.planner.todaySummary':'Hoy: {count} tareas · {critical} críticas · {overdue} atrasadas'
  }),
  fr:Object.freeze({
    'taskV2.planner.title':'Planificateur de tâches','taskV2.planner.workweek':'Semaine de travail','taskV2.planner.month':'Mois','taskV2.planner.currentWeek':'Semaine actuelle','taskV2.planner.nextWeek':'Semaine prochaine','taskV2.planner.overdue':'En retard','taskV2.planner.noOverdue':'Aucune tâche en retard','taskV2.planner.overload':'Cette semaine est surchargée.','taskV2.planner.todaySummary':"Aujourd’hui : {count} tâches · {critical} critiques · {overdue} en retard"
  }),
  it:Object.freeze({
    'taskV2.planner.title':'Pianificatore attività','taskV2.planner.workweek':'Settimana lavorativa','taskV2.planner.month':'Mese','taskV2.planner.currentWeek':'Settimana corrente','taskV2.planner.nextWeek':'Settimana prossima','taskV2.planner.overdue':'Scadute','taskV2.planner.noOverdue':'Nessuna attività scaduta','taskV2.planner.overload':'Questa settimana è sovraccarica.','taskV2.planner.todaySummary':'Oggi: {count} attività · {critical} critiche · {overdue} scadute'
  })
});

export function patchRepository(root=process.cwd()){
  const changed=[];
  for(const locale of LOCALES){
    const file=path.join(root,'assets/i18n',locale+'.json');
    if(!fs.existsSync(file))throw new Error('TaskPlanner V2 planner i18n file missing '+locale);
    const before=fs.readFileSync(file,'utf8'),parsed=JSON.parse(before),next=Object.assign({},parsed,TRANSLATIONS[locale]),after=JSON.stringify(next,null,2)+'\n';
    if(after!==before){fs.writeFileSync(file,after);changed.push(locale);}
  }
  return{changed,locales:LOCALES.slice(),keyCount:Object.keys(TRANSLATIONS.de).length};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=patchRepository();
  console.log(`TaskPlanner V2 planner i18n prepared for ${result.locales.join(', ')} (${result.keyCount} keys)`);
}
