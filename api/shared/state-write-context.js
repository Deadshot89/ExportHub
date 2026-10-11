'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

const storage = new AsyncLocalStorage();

function run(fn) {
  return storage.run({ user: null }, fn);
}

function captureUser(user) {
  const store = storage.getStore();
  if (!store || !user || typeof user !== 'object') return false;
  store.user = user;
  return true;
}

function currentUser() {
  const store = storage.getStore();
  return store && store.user || null;
}

function active() {
  return Boolean(storage.getStore());
}

module.exports = { run, captureUser, currentUser, active };
