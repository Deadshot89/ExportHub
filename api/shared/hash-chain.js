'use strict';

// SOP2 phase 1: tamper-evident event chain. This module has no Azure I/O.
const {createHash} = require('node:crypto');
const GENESIS = 'GENESIS';
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const EVENT_KEYS = ['seq', 'at', 'action', 'actor', 'data', 'prevHash', 'hash'];

function canonical(value, stack = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object') throw new TypeError('SOP_CHAIN_INVALID_DATA');
  if (stack.has(value)) throw new TypeError('SOP_CHAIN_CYCLIC_DATA');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('SOP_CHAIN_NON_JSON_DATA');
  }
  stack.add(value);
  try {
    if (Array.isArray(value)) {
      const result = [];
      if (Object.keys(value).length !== value.length) throw new TypeError('SOP_CHAIN_EXTRA_ARRAY_KEYS');
      for (let index = 0; index < value.length; index++) {
        if (!Object.hasOwn(value, index)) throw new TypeError('SOP_CHAIN_SPARSE_ARRAY');
        result.push(canonical(value[index], stack));
      }
      return result;
    }
    const result = Object.create(null);
    for (const key of Object.keys(value).sort()) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        throw new TypeError('SOP_CHAIN_UNSAFE_KEY');
      }
      const desc = Object.getOwnPropertyDescriptor(value, key);
      if (!desc || !Object.hasOwn(desc, 'value')) throw new TypeError('SOP_CHAIN_ACCESSOR_DATA');
      result[key] = canonical(desc.value, stack);
    }
    return result;
  } finally {
    stack.delete(value);
  }
}

function validIsoUtc(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(date)) return false;
  const ms = Date.parse(date);
  return Number.isFinite(ms) && new Date(ms).toISOString() === date;
}
function validText(value) { return typeof value === 'string' && value.trim().length > 0; }
function digest(event) {
  const payload = [event.seq, event.at, event.action, event.actor, canonical(event.data), event.prevHash];
  return createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
}

function verifyChain(history) {
  if (!Array.isArray(history)) return {ok:false, brokenAt:0};
  let previousHash = GENESIS;
  for (let i = 0; i < history.length; i++) {
    const event = history[i];
    try {
      if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('invalid event');
      if (Object.keys(event).length !== EVENT_KEYS.length || EVENT_KEYS.some(key => !Object.hasOwn(event, key))) throw new Error('invalid fields');
      if (event.seq !== i + 1 || !validIsoUtc(event.at) || !validText(event.action) || !validText(event.actor)) throw new Error('invalid metadata');
      if (event.prevHash !== previousHash || typeof event.hash !== 'string' || !HASH_PATTERN.test(event.hash)) throw new Error('invalid chain links');
      if (digest(event) !== event.hash) throw new Error('invalid hash');
    } catch (_) {
      return {ok:false, brokenAt:i + 1};
    }
    previousHash = event.hash;
  }
  return {ok:true, brokenAt:0};
}

function appendEvent(history, input) {
  const existing = verifyChain(history);
  if (!existing.ok) {
    const error = new Error('SOP_CHAIN_INVALID_AT_' + existing.brokenAt);
    error.code = 'SOP_CHAIN_INVALID';
    throw error;
  }
  if (!input || !validText(input.actor) || !validText(input.action)) throw new TypeError('SOP_CHAIN_ACTOR_ACTION_REQUIRED');
  const at = input.at === undefined ? new Date().toISOString() : input.at;
  if (!validIsoUtc(at)) throw new TypeError('SOP_CHAIN_INVALID_TIMESTAMP');
  const event = {
    seq:history.length + 1,
    at,
    action:input.action,
    actor:input.actor,
    data:JSON.parse(JSON.stringify(canonical(input.data === undefined ? {} : input.data))),
    prevHash:history.length ? history[history.length - 1].hash : GENESIS,
  };
  event.hash = digest(event);
  return event;
}

module.exports = {appendEvent, verifyChain};
