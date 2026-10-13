import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const LOCALES=Object.freeze(['de','en','pl','es','fr','it']);
export const TRANSLATIONS=Object.freeze({
  de:Object.freeze({
    'taskV2.dashboard.today':'Heute','taskV2.dashboard.week':'Diese Woche','taskV2.dashboard.overdue':'Überfällig','taskV2.dashboard.critical':'Kritisch','taskV2.dashboard.done':'Erledigt','taskV2.dashboard.waiting':'Wartet','taskV2.dashboard.title':'Aufgabenübersicht','taskV2.dashboard.overloaded':'Woche überlastet','taskV2.dashboard.progress':'Wochenfortschritt',
    'taskV2.customer.title':'Kundenaufgaben','taskV2.customer.active':'Aktiv','taskV2.customer.upcoming':'Kommend','taskV2.customer.history':'Historie','taskV2.customer.emptyActive':'Keine aktiven Aufgaben','taskV2.customer.emptyUpcoming':'Keine kommenden Aufgaben','taskV2.customer.emptyHistory':'Keine Historie',
    'taskV2.archive.title':'Aufgabenarchiv','taskV2.archive.empty':'Keine archivierten Aufgaben',
    'taskV2.stats.open':'Offen','taskV2.stats.overdue':'Überfällig','taskV2.stats.completed':'Erledigt','taskV2.stats.onTime':'Pünktlich','taskV2.stats.late':'Zu spät','taskV2.stats.automatic':'Automatisch','taskV2.stats.manual':'Manuell','taskV2.stats.averageMinutes':'Ø Minuten','taskV2.stats.title':'Aufgabenstatistik'
  }),
  en:Object.freeze({
    'taskV2.dashboard.today':'Today','taskV2.dashboard.week':'This week','taskV2.dashboard.overdue':'Overdue','taskV2.dashboard.critical':'Critical','taskV2.dashboard.done':'Done','taskV2.dashboard.waiting':'Waiting','taskV2.dashboard.title':'Task dashboard','taskV2.dashboard.overloaded':'Week overloaded','taskV2.dashboard.progress':'Weekly progress',
    'taskV2.customer.title':'Customer tasks','taskV2.customer.active':'Active','taskV2.customer.upcoming':'Upcoming','taskV2.customer.history':'History','taskV2.customer.emptyActive':'No active tasks','taskV2.customer.emptyUpcoming':'No upcoming tasks','taskV2.customer.emptyHistory':'No history',
    'taskV2.archive.title':'Task archive','taskV2.archive.empty':'No archived tasks',
    'taskV2.stats.open':'Open','taskV2.stats.overdue':'Overdue','taskV2.stats.completed':'Completed','taskV2.stats.onTime':'On time','taskV2.stats.late':'Late','taskV2.stats.automatic':'Automatic','taskV2.stats.manual':'Manual','taskV2.stats.averageMinutes':'Avg. minutes','taskV2.stats.title':'Task statistics'
  }),
  pl:Object.freeze({
    'taskV2.dashboard.today':'Dzisiaj','taskV2.dashboard.week':'Ten tydzień','taskV2.dashboard.overdue':'Zaległe','taskV2.dashboard.critical':'Krytyczne','taskV2.dashboard.done':'Zakończone','taskV2.dashboard.waiting':'Oczekujące','taskV2.dashboard.title':'Przegląd zadań','taskV2.dashboard.overloaded':'Tydzień przeciążony','taskV2.dashboard.progress':'Postęp tygodniowy',
    'taskV2.customer.title':'Zadania klienta','taskV2.customer.active':'Aktywne','taskV2.customer.upcoming':'Nadchodzące','taskV2.customer.history':'Historia','taskV2.customer.emptyActive':'Brak aktywnych zadań','taskV2.customer.emptyUpcoming':'Brak nadchodzących zadań','taskV2.customer.emptyHistory':'Brak historii',
    'taskV2.archive.title':'Archiwum zadań','taskV2.archive.empty':'Brak zarchiwizowanych zadań',
    'taskV2.stats.open':'Otwarte','taskV2.stats.overdue':'Zaległe','taskV2.stats.completed':'Zakończone','taskV2.stats.onTime':'Na czas','taskV2.stats.late':'Po terminie','taskV2.stats.automatic':'Automatycznie','taskV2.stats.manual':'Ręcznie','taskV2.stats.averageMinutes':'Śr. minuty','taskV2.stats.title':'Statystyki zadań'
  }),
  es:Object.freeze({
    'taskV2.dashboard.today':'Hoy','taskV2.dashboard.week':'Esta semana','taskV2.dashboard.overdue':'Atrasadas','taskV2.dashboard.critical':'Críticas','taskV2.dashboard.done':'Completadas','taskV2.dashboard.waiting':'En espera','taskV2.dashboard.title':'Resumen de tareas','taskV2.dashboard.overloaded':'Semana sobrecargada','taskV2.dashboard.progress':'Progreso semanal',
    'taskV2.customer.title':'Tareas del cliente','taskV2.customer.active':'Activas','taskV2.customer.upcoming':'Próximas','taskV2.customer.history':'Historial','taskV2.customer.emptyActive':'No hay tareas activas','taskV2.customer.emptyUpcoming':'No hay tareas próximas','taskV2.customer.emptyHistory':'Sin historial',
    'taskV2.archive.title':'Archivo de tareas','taskV2.archive.empty':'No hay tareas archivadas',
    'taskV2.stats.open':'Abiertas','taskV2.stats.overdue':'Atrasadas','taskV2.stats.completed':'Completadas','taskV2.stats.onTime':'A tiempo','taskV2.stats.late':'Con retraso','taskV2.stats.automatic':'Automáticas','taskV2.stats.manual':'Manuales','taskV2.stats.averageMinutes':'Prom. minutos','taskV2.stats.title':'Estadísticas de tareas'
  }),
  fr:Object.freeze({
    'taskV2.dashboard.today':"Aujourd’hui",'taskV2.dashboard.week':'Cette semaine','taskV2.dashboard.overdue':'En retard','taskV2.dashboard.critical':'Critiques','taskV2.dashboard.done':'Terminées','taskV2.dashboard.waiting':'En attente','taskV2.dashboard.title':'Tableau des tâches','taskV2.dashboard.overloaded':'Semaine surchargée','taskV2.dashboard.progress':'Progression hebdomadaire',
    'taskV2.customer.title':'Tâches du client','taskV2.customer.active':'Actives','taskV2.customer.upcoming':'À venir','taskV2.customer.history':'Historique','taskV2.customer.emptyActive':'Aucune tâche active','taskV2.customer.emptyUpcoming':'Aucune tâche à venir','taskV2.customer.emptyHistory':'Aucun historique',
    'taskV2.archive.title':'Archive des tâches','taskV2.archive.empty':'Aucune tâche archivée',
    'taskV2.stats.open':'Ouvertes','taskV2.stats.overdue':'En retard','taskV2.stats.completed':'Terminées','taskV2.stats.onTime':'À temps','taskV2.stats.late':'En retard','taskV2.stats.automatic':'Automatiques','taskV2.stats.manual':'Manuelles','taskV2.stats.averageMinutes':'Moy. minutes','taskV2.stats.title':'Statistiques des tâches'
  }),
  it:Object.freeze({
    'taskV2.dashboard.today':'Oggi','taskV2.dashboard.week':'Questa settimana','taskV2.dashboard.overdue':'Scadute','taskV2.dashboard.critical':'Critiche','taskV2.dashboard.done':'Completate','taskV2.dashboard.waiting':'In attesa','taskV2.dashboard.title':'Riepilogo attività','taskV2.dashboard.overloaded':'Settimana sovraccarica','taskV2.dashboard.progress':'Avanzamento settimanale',
    'taskV2.customer.title':'Attività cliente','taskV2.customer.active':'Attive','taskV2.customer.upcoming':'In arrivo','taskV2.customer.history':'Cronologia','taskV2.customer.emptyActive':'Nessuna attività attiva','taskV2.customer.emptyUpcoming':'Nessuna attività in arrivo','taskV2.customer.emptyHistory':'Nessuna cronologia',
    'taskV2.archive.title':'Archivio attività','taskV2.archive.empty':'Nessuna attività archiviata',
    'taskV2.stats.open':'Aperte','taskV2.stats.overdue':'Scadute','taskV2.stats.completed':'Completate','taskV2.stats.onTime':'Puntuali','taskV2.stats.late':'In ritardo','taskV2.stats.automatic':'Automatiche','taskV2.stats.manual':'Manuali','taskV2.stats.averageMinutes':'Media minuti','taskV2.stats.title':'Statistiche attività'
  })
});

export function patchRepository(root=process.cwd()){
  const changed=[];
  for(const locale of LOCALES){
    const file=path.join(root,'assets/i18n',locale+'.json');
    if(!fs.existsSync(file))throw new Error('TaskPlanner V2 projection i18n file missing '+locale);
    const before=fs.readFileSync(file,'utf8'),parsed=JSON.parse(before),next=Object.assign({},parsed,TRANSLATIONS[locale]),after=JSON.stringify(next,null,2)+'\n';
    if(after!==before){fs.writeFileSync(file,after);changed.push(locale);}
  }
  return{changed,locales:LOCALES.slice(),keyCount:Object.keys(TRANSLATIONS.de).length};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=patchRepository();
  console.log(`TaskPlanner V2 projection i18n prepared for ${result.locales.join(', ')} (${result.keyCount} keys)`);
}
