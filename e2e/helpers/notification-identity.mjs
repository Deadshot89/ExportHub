// RC1586: A repeated title is not a duplicate: recurring and distinct tasks may use
// the same title. The notification center's action data-id is its stable task identity.
export function assertUniqueNotificationCards(rows){
  const seen=new Map();
  for(const [index,row] of rows.entries()){
    const title=String(row?.title??'').trim();
    if(!title||/^(?:Aufgabe|Task)$/i.test(title)){
      throw new Error('Ghost-Aufgabe ohne fachlichen Titel in Benachrichtigung '+(index+1));
    }
    const id=String(row?.id??'').trim();
    if(!id){
      throw new Error('Benachrichtigung '+(index+1)+' hat keine aufrufbare Aufgaben-ID');
    }
    const key=id.toLocaleLowerCase('de-DE');
    if(seen.has(key)){
      throw new Error('Doppelt gerenderte Benachrichtigung für dieselbe Aufgaben-ID an Position '+(seen.get(key)+1)+' und '+(index+1));
    }
    seen.set(key,index);
  }
  return seen.size;
}
