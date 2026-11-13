'use strict';
// RC1349: the audience is set ONLY at the authenticated token-issue endpoint,
// persisted in the server-side public-access record. URL parameters are NOT trusted.
function audience(value){
 if(value==='customer')return'customer';
 if(value==='carrier')return'carrier';
 return'legacy'; // older mixed-purpose links have no authorization to read item-level data.
}
function mayReadDeliveryItems(record){return audience(record&&record.avisAudience)==='customer'}
module.exports={audience,mayReadDeliveryItems};
