/**
 * RC1968 P1 / issue #904: A carrier address saved with an old shipment is not
 * an authorization to re-add it to an outgoing mail after the customer-folder
 * shipping addresses have been edited.
 *
 * The generated RC1112 HTML has three separate carrier-mail paths (rc543, overview reminder and the
 * later mail-status bridge). Patch ALL THREE and fail the build if either source
 * anchor changes. Customer/own mail, CC and historical sent-mail evidence
 * remain untouched.
 */
const RC1968_REPLACEMENTS = [
  {
    id: 'RC543_CARRIER_MAIL',
    before: "if(type==='carrier')return emailList(sh.carrierEmail||c.carrierEmail||c.speditionMail||c.carrierMail||c.forwarderEmail||c.palletCarrierEmail||c.packageCarrierEmail).join('; ');",
    after: "if(type==='carrier')return emailList(c&&Object.prototype.hasOwnProperty.call(c,'carrierEmail')?c.carrierEmail:c?(c.carrierMail||c.speditionMail||c.forwarderEmail||c.palletCarrierEmail||c.packageCarrierEmail):(sh&&sh.carrierEmail)).join('; ');"
  },
  {
    id: 'OVERVIEW_REMINDER_RECIPIENT',
    before: "var to=[];keys.forEach(function(k){to=to.concat(emailList(c[k])).concat(emailList(sh&&sh[k]))});",
    after: "var to=[];if(target==='carrier'&&c&&Object.prototype.hasOwnProperty.call(c,'carrierEmail')){to=emailList(c.carrierEmail)}else if(target==='carrier'&&c&&Object.keys(c).length){keys.forEach(function(k){to=to.concat(emailList(c[k]))})}else{keys.forEach(function(k){to=to.concat(emailList(c[k])).concat(emailList(sh&&sh[k]))})};"
  },
  {
    id: 'MAIL_STATUS_CARRIER_TO',
    before: "function carrierTo(c,sh){var l=locationFor(c,sh),explicit=mergeEmails(sh&&sh.carrierEmail,sh&&sh.speditionMail,sh&&sh.forwarderEmail,l&&l.carrierEmail,l&&l.speditionMail,l&&l.carrierMail,l&&l.forwarderEmail,c&&c.carrierEmail,c&&c.speditionMail,c&&c.carrierMail,c&&c.forwarderEmail,c&&c.anmeldungMail,c&&c.mailRecipients);return explicit}",
    after: "function carrierTo(c,sh){if(c){if(Object.prototype.hasOwnProperty.call(c,'carrierEmail'))return mergeEmails(c.carrierEmail);return mergeEmails(c.carrierMail,c.speditionMail,c.forwarderEmail,c.anmeldungMail,c.mailRecipients,c.palletCarrierEmail,c.packageCarrierEmail)}return mergeEmails(sh&&sh.carrierEmail,sh&&sh.speditionMail,sh&&sh.forwarderEmail)}"
  }
];

export function patchRc1968CarrierMailHtml(source, file='index.html') {
  let html=String(source);
  for (const patch of RC1968_REPLACEMENTS) {
    const count=html.split(patch.before).length-1;
    if (count!==1) throw new Error('RC1968 '+file+' '+patch.id+': expected one source anchor, found '+count);
    html=html.replace(patch.before,patch.after);
  }
  return html;
}

export const RC1968_PATCH_COUNT=RC1968_REPLACEMENTS.length;
