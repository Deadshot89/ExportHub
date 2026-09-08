(function(root){
  'use strict';

  const STATUS=Object.freeze({
    DRAFT:'Entwurf',
    REVIEW:'In Prüfung',
    APPROVED:'Freigegeben',
    ARCHIVED:'Archiviert'
  });

  function clone(value){
    return value===undefined?undefined:JSON.parse(JSON.stringify(value));
  }

  function text(value){
    return String(value==null?'':value).trim();
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function versionsOf(document){
    return Array.isArray(document&&document.versions)?document.versions:[];
  }

  function findVersion(document,version){
    const wanted=text(version);
    return versionsOf(document).find(item=>text(item&&item.version)===wanted)||null;
  }

  function currentVersionRecord(document){
    const current=text(document&&document.currentVersion);
    return findVersion(document,current)||versionsOf(document).slice().reverse().find(Boolean)||null;
  }

  function validateRelease(input){
    const source=input&&typeof input==='object'?input:{};
    const errors=[];
    const warnings=[];
    if(!text(source.number)) errors.push('SOP-Nummer fehlt');
    if(!text(source.title)) errors.push('Titel fehlt');
    if(!text(source.version)) errors.push('Version fehlt');
    if(!text(source.approvedBy)) errors.push('Freigabeverantwortlicher fehlt');
    const visuals=Array.isArray(source.visuals)?source.visuals:[];
    if(visuals.some(v=>v&&v.required===true&&v.type==='placeholder')){
      warnings.push('Pflicht-Bildplatzhalter offen');
    }
    return {ok:errors.length===0,errors,warnings};
  }

  function seedState(state,documents){
    const next=clone(state&&typeof state==='object'?state:{})||{};
    const current=Array.isArray(next.isoSops)?next.isoSops:[];
    const byNumber=new Map(current.map(item=>[text(item&&item.number),clone(item)]));
    for(const source of Array.isArray(documents)?documents:[]){
      const number=text(source&&source.number);
      if(!number||byNumber.has(number)) continue;
      const seeded=clone(source);
      if(!Array.isArray(seeded.versions)){
        seeded.versions=[{
          version:text(seeded.version)||'1.0',
          status:text(seeded.status)||STATUS.DRAFT,
          title:text(seeded.title),
          content:clone(seeded.sections||{}),
          visuals:clone(seeded.visuals||[]),
          createdBy:text(seeded.createdBy),
          createdAt:seeded.createdAt||nowIso(),
          changeReason:text(seeded.changeReason)||'Ersterstellung'
        }];
      }
      seeded.currentVersion=text(seeded.currentVersion)||text(seeded.version)||'1.0';
      byNumber.set(number,seeded);
    }
    next.isoSops=Array.from(byNumber.values());
    return next;
  }

  function createDraftVersion(document,options){
    const source=clone(document&&typeof document==='object'?document:{});
    const opts=options&&typeof options==='object'?options:{};
    const version=text(opts.version);
    if(!version) throw new Error('Neue Versionsnummer fehlt');
    if(findVersion(source,version)) throw new Error('Version existiert bereits');
    const base=currentVersionRecord(source);
    if(!base) throw new Error('Ausgangsversion fehlt');
    const draft=clone(base);
    draft.version=version;
    draft.status=STATUS.DRAFT;
    draft.createdBy=text(opts.actor);
    draft.createdAt=nowIso();
    draft.changeReason=text(opts.reason);
    draft.reviewedBy='';
    draft.reviewedAt='';
    draft.approvedBy='';
    draft.approvedAt='';
    draft.archivedBy='';
    draft.archivedAt='';
    source.versions=versionsOf(source).map(clone);
    source.versions.push(draft);
    source.draftVersion=version;
    source.updatedAt=draft.createdAt;
    return source;
  }

  function submitForReview(document,options){
    const source=clone(document&&typeof document==='object'?document:{});
    const opts=options&&typeof options==='object'?options:{};
    const version=text(opts.version||source.draftVersion);
    const target=findVersion(source,version);
    if(!target) throw new Error('Version nicht gefunden');
    if(target.status!==STATUS.DRAFT) throw new Error('Nur Entwürfe können zur Prüfung eingereicht werden');
    target.status=STATUS.REVIEW;
    target.submittedBy=text(opts.actor);
    target.submittedAt=nowIso();
    source.updatedAt=target.submittedAt;
    return source;
  }

  function approveVersion(document,options){
    const source=clone(document&&typeof document==='object'?document:{});
    const opts=options&&typeof options==='object'?options:{};
    const version=text(opts.version);
    const target=findVersion(source,version);
    if(!target) throw new Error('Version nicht gefunden');
    if(target.status!==STATUS.REVIEW) throw new Error('Nur geprüfte Fassungen können freigegeben werden');
    target.reviewedBy=text(opts.reviewedBy||opts.actor);
    target.reviewedAt=opts.reviewedAt||nowIso();
    target.approvedBy=text(opts.actor);
    target.approvedAt=nowIso();
    target.validFrom=text(opts.validFrom)||target.approvedAt.slice(0,10);
    const release=validateRelease({
      number:source.number,
      title:target.title||source.title,
      version:target.version,
      approvedBy:target.approvedBy,
      visuals:target.visuals||source.visuals
    });
    if(!release.ok) throw new Error(release.errors.join('; '));
    for(const item of versionsOf(source)){
      if(item!==target&&item.status===STATUS.APPROVED){
        item.status=STATUS.ARCHIVED;
        item.archivedAt=target.approvedAt;
        item.archivedBy=target.approvedBy;
        item.archiveReason='Durch neu freigegebene Version ersetzt';
      }
    }
    target.status=STATUS.APPROVED;
    source.currentVersion=target.version;
    source.draftVersion='';
    source.version=target.version;
    source.status=STATUS.APPROVED;
    source.validFrom=target.validFrom;
    source.reviewedBy=target.reviewedBy;
    source.approvedBy=target.approvedBy;
    source.updatedAt=target.approvedAt;
    return source;
  }

  function archiveVersion(document,options){
    const source=clone(document&&typeof document==='object'?document:{});
    const opts=options&&typeof options==='object'?options:{};
    const target=findVersion(source,text(opts.version||source.currentVersion));
    if(!target) throw new Error('Version nicht gefunden');
    target.status=STATUS.ARCHIVED;
    target.archivedBy=text(opts.actor);
    target.archivedAt=nowIso();
    target.archiveReason=text(opts.reason);
    if(text(source.currentVersion)===text(target.version)){
      source.status=STATUS.ARCHIVED;
    }
    source.updatedAt=target.archivedAt;
    return source;
  }

  function documentStatus(document){
    const current=currentVersionRecord(document);
    return text(current&&current.status)||text(document&&document.status);
  }

  function filterDocuments(documents,filters){
    const list=Array.isArray(documents)?documents:[];
    const f=filters&&typeof filters==='object'?filters:{};
    const query=text(f.query||f.q).toLowerCase();
    const area=text(f.area);
    const status=text(f.status);
    return list.filter(doc=>{
      if(area&&text(doc&&doc.area)!==area) return false;
      if(status&&documentStatus(doc)!==status) return false;
      if(!query) return true;
      const haystack=[doc&&doc.number,doc&&doc.title,doc&&doc.area]
        .concat(Array.isArray(doc&&doc.keywords)?doc.keywords:[])
        .map(text).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  root.ExportHubIsoSopModel=Object.freeze({
    STATUS,
    seedState,
    createDraftVersion,
    submitForReview,
    approveVersion,
    archiveVersion,
    validateRelease,
    filterDocuments,
    currentVersionRecord
  });
})(typeof globalThis!=='undefined'?globalThis:this);
