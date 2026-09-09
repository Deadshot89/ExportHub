from pathlib import Path

path = Path('api/shared/merge.js')
source = path.read_text(encoding='utf-8')

marker = 'RC1016_SHIPMENT_COLLECTIONS'
if marker in source:
    print('RC1016 merge protection already applied')
    raise SystemExit(0)

insert_before_local = "\nconst LOCAL_ONLY_KEYS = new Set(["
if source.count(insert_before_local) != 1:
    raise SystemExit('RC1016: LOCAL_ONLY_KEYS anchor missing or ambiguous')

constants = r'''
const RC1016_SHIPMENT_COLLECTIONS = new Set([
  'shipments', 'savedShipments', 'salesSharedShipments', 'sharedShipments',
  'shipmentArchive', 'archivedShipments', 'archive'
]);

const RC1016_AVIS_FIELDS = [
  'customerAvisPickupDate','avisPickupDate',
  'customerAvisPickupTimeFrom','avisPickupTimeFrom',
  'customerAvisPickupTimeTo','avisPickupTimeTo',
  'customerAvisPickupPlate','avisPickupPlate',
  'customerAvisShipmentNumber','avisShipmentNumber',
  'customerAvisPickupNote','avisPickupNote',
  'customerAvisResponseAt','avisResponseAt',
  'customerAvisResponseReference','avisResponseReference',
  'customerAvisResponseStatus','avisResponseStatus',
  'customerConfirmed','customerConfirmedAt','customerConfirmedVia',
  'plannedPickupDate','pickupDate'
];
'''
source = source.replace(insert_before_local, '\n' + constants + insert_before_local.lstrip('\n'), 1)

merge_anchor = "\nfunction mergeShipmentProtected(serverItem, incomingItem) {"
if source.count(merge_anchor) != 1:
    raise SystemExit('RC1016: mergeShipmentProtected anchor missing or ambiguous')

helpers = r'''
function rc1016AvisTimestamp(value) {
  const candidates = [
    value && value.customerAvisResponseAt,
    value && value.avisResponseAt,
    value && value.customerConfirmedAt
  ];
  let latest = 0;
  for (const candidate of candidates) {
    const time = Date.parse(candidate || '');
    if (Number.isFinite(time) && time > latest) latest = time;
  }
  return latest;
}

function rc1016ProtectAvis(out, serverItem, incomingItem) {
  const serverAvisTs = rc1016AvisTimestamp(serverItem);
  const incomingAvisTs = rc1016AvisTimestamp(incomingItem);
  if (serverAvisTs === incomingAvisTs) return out;
  const source = serverAvisTs > incomingAvisTs ? serverItem : incomingItem;
  if (!source || Math.max(serverAvisTs, incomingAvisTs) <= 0) return out;
  for (const key of RC1016_AVIS_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, key)) out[key] = clone(source[key]);
  }
  return out;
}
'''
source = source.replace(merge_anchor, '\n' + helpers + merge_anchor.lstrip('\n'), 1)

status_anchor = "  // Status may only follow the newer persisted record; no rank-based auto-promotion here."
if source.count(status_anchor) != 1:
    raise SystemExit('RC1016: shipment status anchor missing or ambiguous')
source = source.replace(status_anchor, "  // RC1016: customer Avis responses are server-persisted business data.\n  // A later save from a stale browser may not roll them back.\n  rc1016ProtectAvis(out, serverItem, incomingItem);\n\n" + status_anchor, 1)

collection_anchor = "      const shipmentCollection = name === 'shipments' || name === 'savedShipments';\n      const key = shipmentCollection ? shipmentIdentityKey(item, index) : itemKey(item, keys, index);"
if source.count(collection_anchor) != 1:
    raise SystemExit('RC1016: shipment collection identity anchor missing or ambiguous')
source = source.replace(
    collection_anchor,
    "      const shipmentCollection = RC1016_SHIPMENT_COLLECTIONS.has(name);\n      const key = shipmentCollection ? shipmentIdentityKey(item, index) : itemKey(item, keys, index);",
    1,
)

merge_branch = "      else if (name === 'shipments' || name === 'savedShipments') map.set(key, source === 'incoming' ? mergeShipmentProtected(existing, item) : mergeShipmentProtected(item, existing));"
if source.count(merge_branch) != 1:
    raise SystemExit('RC1016: protected shipment merge branch missing or ambiguous')
source = source.replace(
    merge_branch,
    "      else if (RC1016_SHIPMENT_COLLECTIONS.has(name)) map.set(key, source === 'incoming' ? mergeShipmentProtected(existing, item) : mergeShipmentProtected(item, existing));",
    1,
)

path.write_text(source, encoding='utf-8')
print('RC1016 Lieferavis persistence protection applied')
