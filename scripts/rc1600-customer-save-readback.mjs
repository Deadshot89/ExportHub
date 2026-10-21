const PATCHES=[
  {
    "id": "RC1600_CUSTOMER_DETECT",
    "a": "const liveUsers=window.__EXPORTHUB_GET_USERS__?window.__EXPORTHUB_GET_USERS__():runtime.users||[],ackOk=!!(saveResponse&&saveResponse.ok===true&&saveResponse.ackOnly===true&&lower(saveResponse.environment)===DATA_ENVIRONMENT&&Number(saveResponse.revision||0)>=Number(runtime.revision||0)),ackNeedsRefresh=ackOk&&(saveResponse.concurrentMerge===true||saveResponse.idempotentReplay===true);",
    "b": "const liveUsers=window.__EXPORTHUB_GET_USERS__?window.__EXPORTHUB_GET_USERS__():runtime.users||[],ackOk=!!(saveResponse&&saveResponse.ok===true&&saveResponse.ackOnly===true&&lower(saveResponse.environment)===DATA_ENVIRONMENT&&Number(saveResponse.revision||0)>=Number(runtime.revision||0)),ackNeedsRefresh=ackOk&&(saveResponse.concurrentMerge===true||saveResponse.idempotentReplay===true),customerChanged=Array.isArray(stateDelta&&stateDelta.customers)&&stateDelta.customers.length>0;"
  },
  {
    "id": "RC1600_CUSTOMER_REREAD",
    "a": "if(ackOk)return{ok:true,revision:Number(saveResponse.revision||runtime.revision),state:clone(sentState),users:clone(liveUsers),concurrentMerge:false,serverSaveAck:true,ackOnly:true};\n let doc=saveResponse&&isObject(saveResponse.state)?saveResponse:null;const customerChanged=Array.isArray(stateDelta&&stateDelta.customers)&&stateDelta.customers.length>0;",
    "b": "if(ackOk&&!customerChanged)return{ok:true,revision:Number(saveResponse.revision||runtime.revision),state:clone(sentState),users:clone(liveUsers),concurrentMerge:false,serverSaveAck:true,ackOnly:true};\n let doc=saveResponse&&isObject(saveResponse.state)?saveResponse:null;"
  },
  {
    "id": "RC1600_NO_CUSTOMER_FASTACK",
    "a": "fastAck=serverAck&&d&&d.ackOnly===true&&d.concurrentMerge!==true&&!newer;",
    "b": "fastAck=serverAck&&d&&d.ackOnly===true&&d.concurrentMerge!==true&&!newer&&!(Array.isArray(stateDelta.customers)&&stateDelta.customers.length>0);"
  },
  {
    "id": "RC1600_NO_UNVERIFIED_FALLBACK",
    "a": "catch(error){postVerifyError=error;if(!serverAck||d.concurrentMerge===true||d.idempotentReplay===true)throw error;",
    "b": "catch(error){postVerifyError=error;if(!serverAck||d.concurrentMerge===true||d.idempotentReplay===true||(Array.isArray(stateDelta.customers)&&stateDelta.customers.length>0))throw error;"
  },
  {
    "id": "RC1600_CONTENT_CONFIRM",
    "a": "const confirmed=serverAck||criticalSaveDeltaConfirmed(authoritative&&authoritative.state,stateDelta);",
    "b": "const confirmed=(Array.isArray(stateDelta.customers)&&stateDelta.customers.length>0)?criticalSaveDeltaConfirmed(authoritative&&authoritative.state,stateDelta):serverAck;"
  },
  {
    "id": "RC1600_OLD_MAIL_ALIASES",
    "a": "var carrier=value(['rc405FCarrier','rc409FolderCarrier','customerFolderCarrier'],c.carrier||c.spedition);c.carrier=carrier;c.carrierName=carrier;c.spedition=carrier;c.speditionName=carrier;\n var cm=value(['rc405FCarrierMail','rc409FolderCarrierMail','customerFolderCarrierMail'],c.carrierEmail||c.carrierMail||c.speditionMail);c.carrierEmail=cm;c.carrierMail=cm;c.speditionEmail=cm;c.speditionMail=cm;c.anmeldungMail=cm;c.rc385CarrierTo=cm;\n var customer=value(['rc405FCustomerMail','rc409FolderCustomerMail'],c.customerMail||c.customerEmail);c.customerMail=customer;c.customerEmail=customer;c.mailToCustomer=customer;c.rc385CustomerTo=customer;",
    "b": "var carrier=value(['rc405FCarrier','rc409FolderCarrier','customerFolderCarrier'],c.carrier||c.spedition);c.carrier=carrier;c.carrierName=carrier;c.spedition=carrier;c.speditionName=carrier;\n var previousCustomerMail=customerMail(c),previousCarrierMail=carrierMail(c);\n function clearRemovedMailAliases(fields,before,after){var keep=new Set(rc819EmailItems(after).map(n)),removed=new Set(rc819EmailItems(before).map(n).filter(function(e){return !keep.has(e)}));if(!removed.size)return;fields.forEach(function(field){var emails=rc819EmailItems(c[field]);if(emails.some(function(e){return removed.has(n(e))}))c[field]=emails.filter(function(e){return !removed.has(n(e))}).join('; ')})}\n var cm=value(['rc405FCarrierMail','rc409FolderCarrierMail','customerFolderCarrierMail'],previousCarrierMail);c.carrierEmail=cm;c.carrierMail=cm;c.speditionEmail=cm;c.speditionMail=cm;c.anmeldungMail=cm;c.rc385CarrierTo=cm;clearRemovedMailAliases(['mail','mailAddress','mailRecipients','forwarderEmail'],previousCarrierMail,cm);\n var customer=value(['rc405FCustomerMail','rc409FolderCustomerMail'],previousCustomerMail);c.customerMail=customer;c.customerEmail=customer;c.mailToCustomer=customer;c.rc385CustomerTo=customer;clearRemovedMailAliases(['email','mailAddress','mail','recipientEmail'],previousCustomerMail,customer);"
  },
  {
    "id": "RC1600_CC_EDIT",
    "a": "var rc819NamedCc=rc819CollectCcContacts(),rc819ManualCc=value(['rc405FCc','rc409FolderCc','customerFolderMailCc','rc542CustomerCc'],c.cc||c.mailCc);c.ccContacts=rc819NamedCc;",
    "b": "var rc819NamedCc=rc819CollectCcContacts(),rc819CcInput=node(['rc405FCc','rc409FolderCc','customerFolderMailCc','rc542CustomerCc']),rc819ManualCc=value(['rc405FCc','rc409FolderCc','customerFolderMailCc','rc542CustomerCc'],c.cc||c.mailCc),ccEdited=!!(rc819CcInput&&rc819CcInput.hasAttribute('data-rc565-loaded-value')&&q(rc819CcInput.value)!==q(rc819CcInput.getAttribute('data-rc565-loaded-value')));if(ccEdited){var permittedCc=new Set(rc819EmailItems(rc819ManualCc).map(n));rc819NamedCc=rc819NamedCc.filter(function(x){return permittedCc.has(n(x.email))})}c.ccContacts=rc819NamedCc;"
  }
];
/**
 * RC1600: Harden only the customer save paths in generated RC1112 HTML.
 * The legacy source index.html is ~5 MB and RC1112 builds all three targets from it.
 * Throw on any changed or ambiguous anchor so no release silently omits these fixes.
 */
export function hardenCustomerSaveHtml(source){
  let html=String(source);
  for(const patch of PATCHES){
    const occurrences=html.split(patch.a).length-1;
    if(occurrences!==1)throw new Error('RC1600 '+patch.id+': expected one source anchor, found '+occurrences);
    html=html.replace(patch.a,patch.b);
  }
  return html;
}
export const RC1600_PATCH_COUNT=PATCHES.length;
