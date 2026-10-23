(function(root){
  'use strict';

  function clone(value){ return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function number(value){ const n=Number(String(value==null?'':value).replace(',','.')); return Number.isFinite(n)?n:0; }
  function positiveInt(value){ const n=Math.round(number(value)); return n>0?n:0; }
  function text(value){ return String(value==null?'':value).trim(); }
  function low(value){ return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(); }
  function round6(value){ return Math.round((number(value)+Number.EPSILON)*1000000)/1000000; }
  function rowType(row){ return text(row&&(row.type||row.packaging||row.verpackung||row.name)); }
  function stackFactor(row){ const name=low(rowType(row)); return /gestapelt|stacked/.test(name)&&/palette|paletten|pallet/.test(name)?2:1; }
  function dimensions(row){
    let l=number(row&&(row.l||row.length||row.lengthCm)),w=number(row&&(row.w||row.width||row.widthCm));
    if(l>0&&w>0) return {l,w};
    const name=low(rowType(row)),match=name.match(/^e([0-6])$/);
    let dims=null;
    if(match){ const e={0:[30,20],1:[39,20],2:[46,33],3:[43,31],4:[66,45],5:[66,45],6:[25,15]}; dims=e[match[1]]; }
    else if(/umschlag|envelope/.test(name)) dims=[15,5];
    else if(/dusseldorfer.*palette|dusseldorf.*pallet/.test(name)) dims=[80,60];
    else if(/plastic.*palette|plastic.*pallet|kunststoff.*palette/.test(name)) dims=[122,116];
    else if(/industrie.*palette|industrial.*pallet/.test(name)) dims=[120,100];
    else if(/paletten\s*gestell|palettengestell|pallet\s*rack/.test(name)) dims=[120,90];
    else if(/euro.*palette|euro.*pallet|einweg.*palette|one.?way.*pallet/.test(name)) dims=[120,80];
    return dims?{l:dims[0],w:dims[1]}:null;
  }
  function actualEffectiveLdm(row,countOverride){
    const count=positiveInt(countOverride==null?row&&row.count:countOverride),dim=dimensions(row);
    if(!count||!dim) return null;
    const floorUnits=Math.ceil(count/stackFactor(row));
    return round6((floorUnits*dim.l*dim.w/24000)/count);
  }

  function error(code,message){
    const e=new Error(code+(message?': '+message:''));
    e.code=code;
    return e;
  }

  function normalizeRows(rows){
    return (Array.isArray(rows)?rows:[]).map(function(row,index){
      const src=row&&typeof row==='object'?row:{};
      const count=positiveInt(src.count||src.qty||src.quantity||src.anzahl||src.menge||src.colliCount);
      const next=Object.assign({},clone(src),{
        id:text(src.id||src.rowId||src._syncId)||('row-'+(index+1)),
        count:count,
        weight:round6(src.weight||src.gewicht||0),
        ldm:round6(src.ldm||src.loadingMeters||0)
      });
      const actual=actualEffectiveLdm(next,count);
      if(actual!==null) next.ldm=actual;
      return next;
    }).filter(function(row){ return row.count>0; });
  }

  function explodeRows(rows){
    const units=[];
    normalizeRows(rows).forEach(function(row){
      const perWeight=row.count?number(row.weight)/row.count:0;
      const perLdm=number(row.ldm);
      for(let index=0;index<row.count;index+=1){
        units.push({
          sourceRowId:row.id,
          unitId:row.id+'#'+(index+1),
          type:row.type||row.packaging||row.verpackung||row.name||'',
          weight:round6(perWeight),
          ldm:round6(perLdm),
          source:row
        });
      }
    });
    return units;
  }

  function rowsFromUnits(units){
    const order=[];
    const grouped=new Map();
    (Array.isArray(units)?units:[]).forEach(function(unit){
      const key=unit.sourceRowId;
      if(!grouped.has(key)){
        const source=unit.source||{};
        const row=Object.assign({},clone(source),{
          sourceRowId:key,
          id:key,
          count:0,
          weight:0,
          ldm:round6(source.ldm||source.loadingMeters||unit.ldm||0),
          unitIds:[]
        });
        grouped.set(key,row);
        order.push(key);
      }
      const row=grouped.get(key);
      row.count+=1;
      row.weight=round6(row.weight+number(unit.weight));
      row.unitIds.push(unit.unitId);
    });
    return order.map(function(key){
      const row=grouped.get(key),actual=actualEffectiveLdm(row,row.count);
      if(actual!==null) row.ldm=actual;
      return row;
    });
  }

  function fits(fitRows,units){
    if(typeof fitRows!=='function') throw error('FIT_ROWS_REQUIRED','Bestehender Stauplan-Adapter fehlt.');
    const response=fitRows(rowsFromUnits(units));
    return response===true||Boolean(response&&response.fits===true);
  }

  function validatePartition(shipmentId,sourceRows,subShipments){
    const sid=text(shipmentId);
    const source=normalizeRows(sourceRows);
    const parts=Array.isArray(subShipments)?subShipments:[];
    const expectedTotal=parts.length;
    const expectedCounts=new Map(source.map(function(row){return [row.id,row.count];}));
    const actualCounts=new Map();
    const seenUnits=new Set();

    parts.forEach(function(part,index){
      const sequence=index+1;
      if(positiveInt(part&&part.sequence)!==sequence) throw error('INVALID_SUBSHIPMENT_SEQUENCE','Teilsendungs-Reihenfolge ist ungültig.');
      if(text(part&&part.subShipmentId)!==sid+'-TRUCK-'+sequence) throw error('INVALID_SUBSHIPMENT_ID','Teilsendungs-ID ist ungültig.');
      if(positiveInt(part&&part.total)!==expectedTotal) throw error('INVALID_SUBSHIPMENT_TOTAL','Gesamtanzahl der Teilsendungen ist ungültig.');
      (Array.isArray(part&&part.rows)?part.rows:[]).forEach(function(row){
        const sourceRowId=text(row&& (row.sourceRowId||row.id));
        if(!expectedCounts.has(sourceRowId)) throw error('PARTITION_UNKNOWN_ROW','Teilsendung enthält unbekannte Colli-Zeile.');
        const count=positiveInt(row&&row.count);
        actualCounts.set(sourceRowId,(actualCounts.get(sourceRowId)||0)+count);
        const unitIds=Array.isArray(row&&row.unitIds)?row.unitIds:[];
        unitIds.forEach(function(unitId){
          const key=text(unitId);
          if(!key) return;
          if(seenUnits.has(key)) throw error('DUPLICATE_PHYSICAL_UNIT','Physische Einheit ist mehrfach zugeordnet.');
          seenUnits.add(key);
        });
      });
    });

    expectedCounts.forEach(function(expected,rowId){
      if((actualCounts.get(rowId)||0)!==expected) throw error('PARTITION_COUNT_MISMATCH','Colli-Menge stimmt nicht mit der Hauptsendung überein.');
    });
    actualCounts.forEach(function(_,rowId){
      if(!expectedCounts.has(rowId)) throw error('PARTITION_UNKNOWN_ROW','Teilsendung enthält unbekannte Colli-Zeile.');
    });
    return true;
  }

  function statusRank(status){
    const value=text(status).toLowerCase();
    if(/abgeschlossen|completed|done/.test(value)) return 5;
    if(/pod/.test(value)) return 4;
    if(/abgeholt|confirmed|picked/.test(value)) return 3;
    if(/teil|partial|begonnen/.test(value)) return 2;
    return 1;
  }

  function aggregateSubShipmentStatus(subShipments){
    const parts=Array.isArray(subShipments)?subShipments:[];
    if(!parts.length) return {status:'',complete:false,pickedUp:0,total:0,podComplete:false};
    let pickedUp=0;
    let podComplete=true;
    let allComplete=true;
    parts.forEach(function(part){
      const rank=statusRank(part&&part.status);
      if(rank>=3) pickedUp+=1;
      if(rank<5) allComplete=false;
      if(!(Array.isArray(part&&part.podFiles)&&part.podFiles.length)||rank<4) podComplete=false;
    });
    let status='Bereit zur Abholung';
    if(allComplete) status='Abgeschlossen';
    else if(podComplete&&pickedUp===parts.length) status='POD vorhanden';
    else if(pickedUp===parts.length) status='Abgeholt';
    else if(pickedUp>0||parts.some(function(part){return statusRank(part&&part.status)>=2;})) status='Teilweise abgeholt';
    return {status:status,complete:allComplete,pickedUp:pickedUp,total:parts.length,podComplete:podComplete};
  }

  function planSubShipments(options){
    const input=options&&typeof options==='object'?options:{};
    const shipmentId=text(input.shipmentId||input.id||input.reference||input.ref);
    if(!shipmentId) throw error('SHIPMENT_ID_REQUIRED','Stabile Hauptsendungs-ID fehlt.');
    const rows=normalizeRows(input.rows);
    const previous=Array.isArray(input.previousSubShipments)?clone(input.previousSubShipments):[];
    if(input.locked===true){
      return {requiredTruckCount:previous.length||1,subShipments:previous,changed:false,locked:true};
    }
    if(!rows.length) return {requiredTruckCount:1,subShipments:[],changed:previous.length>0,locked:false};
    const units=explodeRows(rows);
    if(fits(input.fitRows,units)) return {requiredTruckCount:1,subShipments:[],changed:previous.length>0,locked:false};

    const trucks=[];
    units.forEach(function(unit){
      let placed=false;
      for(let truckIndex=0;truckIndex<trucks.length;truckIndex+=1){
        const candidate=trucks[truckIndex].concat([unit]);
        if(fits(input.fitRows,candidate)){
          trucks[truckIndex].push(unit);
          placed=true;
          break;
        }
      }
      if(!placed){
        if(!fits(input.fitRows,[unit])) throw error('PHYSICAL_UNIT_EXCEEDS_CAPACITY','Eine physische Einheit passt nicht in das ausgewählte Fahrzeug.');
        trucks.push([unit]);
      }
    });

    const total=trucks.length;
    const subShipments=trucks.map(function(truckUnits,index){
      const partRows=rowsFromUnits(truckUnits);
      return {
        subShipmentId:shipmentId+'-TRUCK-'+(index+1),
        sequence:index+1,
        total:total,
        label:'Sendung '+(index+1)+' von '+total,
        rows:partRows,
        totalColli:partRows.reduce(function(sum,row){return sum+positiveInt(row.count);},0),
        totalWeight:round6(partRows.reduce(function(sum,row){return sum+number(row.weight);},0)),
        totalLdm:round6(partRows.reduce(function(sum,row){return sum+(positiveInt(row.count)*number(row.ldm));},0)),
        status:'open',
        locked:false,
        pickupHistory:[],
        podFiles:[]
      };
    });
    validatePartition(shipmentId,rows,subShipments);
    return {requiredTruckCount:total,subShipments:subShipments,changed:JSON.stringify(previous)!==JSON.stringify(subShipments),locked:false};
  }

  root.ExportHubMultiTruck={
    planSubShipments:planSubShipments,
    normalizeRows:normalizeRows,
    validatePartition:validatePartition,
    aggregateSubShipmentStatus:aggregateSubShipmentStatus,
    actualEffectiveLdm:actualEffectiveLdm
  };
})(typeof globalThis!=='undefined'?globalThis:this);
