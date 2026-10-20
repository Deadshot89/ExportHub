import test from 'node:test';
import assert from 'node:assert/strict';
import {assertUniqueNotificationCards} from '../e2e/helpers/notification-identity.mjs';

test('RC1586: wiederkehrende Aufgaben mit gleichem Titel aber anderer ID sind gültig',()=>{
  const cards=[
    {id:'managed:spanien:2026-10-19',title:'Essentra Spanien'},
    {id:'managed:spanien:2026-10-20',title:'Essentra Spanien'},
    {id:'managed:spanien:2026-10-22',title:'Essentra Spanien'},
    {id:'managed:spanien:2026-10-26',title:'Essentra Spanien'}
  ];
  assert.equal(assertUniqueNotificationCards(cards),4);
});
test('RC1586: dieselbe Aufgaben-ID zweimal gerendert bleibt ein Release-Fehler',()=>{
  assert.throws(()=>assertUniqueNotificationCards([
    {id:'task-73',title:'ABD prüfen'},
    {id:'TASK-73',title:'ABD prüfen'}
  ]),/Doppelt gerenderte Benachrichtigung/);
});
test('RC1586: Karten ohne Aufgaben-ID werden nicht still akzeptiert',()=>{
  assert.throws(()=>assertUniqueNotificationCards([{title:'Essentra Spanien',id:''}]),/keine aufrufbare Aufgaben-ID/);
});
test('RC1586: leere und generische Ghost-Titel bleiben verboten',()=>{
  for(const title of ['', 'Aufgabe', 'Task']){
    assert.throws(()=>assertUniqueNotificationCards([{id:'task-1',title}]),/Ghost-Aufgabe/);
  }
});
test('RC1586: leere Aufgabenansicht bleibt zulässig',()=>{
  assert.equal(assertUniqueNotificationCards([]),0);
});
