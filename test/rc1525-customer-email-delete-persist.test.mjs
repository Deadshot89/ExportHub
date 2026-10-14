import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {mergeState}=require('../api/shared/merge.js');

function serverCustomer(){
  return {
    id:'CUST-EMAIL-1',
    account:'10001',
    name:'Testkunde',
    customerEmail:'kunde@example.com',
    customerMail:'kunde@example.com',
    email:'kunde@example.com',
    mail:'kunde@example.com',
    salesMail:'sales@example.com',
    salesEmail:'sales@example.com',
    salesPersonMail:'sales@example.com',
    salesPersonEmail:'sales@example.com',
    salesContactMail:'sales@example.com',
    salesContactEmail:'sales@example.com',
    rc385SalesMail:'sales@example.com',
    salesCc:'sales@example.com',
    salesContacts:[{name:'Sales',email:'sales@example.com',role:'sales'}],
    customerSalesContacts:[{name:'Sales',email:'sales@example.com',role:'sales'}],
    cc:'cc@example.com',
    mailCc:'cc@example.com',
    rc385Cc:'cc@example.com',
    ccContacts:[{name:'Disposition',email:'cc@example.com',role:'cc'}],
    customerCcContacts:[{name:'Disposition',email:'cc@example.com',role:'cc'}],
    updatedAt:'2026-10-14T08:00:00.000Z'
  };
}

test('RC1525: bewusst entfernte Kunden-Mailadressen bleiben nach Server-Merge gelöscht',()=>{
  const server={customers:[serverCustomer()]};
  const incoming={customers:[{
    id:'CUST-EMAIL-1',
    account:'10001',
    name:'Testkunde',
    customerEmail:'',
    customerMail:'',
    email:'',
    mail:'',
    salesMail:'',
    salesEmail:'',
    salesPersonMail:'',
    salesPersonEmail:'',
    salesContactMail:'',
    salesContactEmail:'',
    rc385SalesMail:'',
    salesCc:'',
    salesContacts:[],
    customerSalesContacts:[],
    cc:'',
    mailCc:'',
    rc385Cc:'',
    ccContacts:[],
    customerCcContacts:[],
    updatedAt:'2026-10-14T09:00:00.000Z'
  }]};

  const out=mergeState(server,incoming);
  const customer=out.customers[0];

  assert.equal(customer.customerEmail,'');
  assert.equal(customer.customerMail,'');
  assert.equal(customer.email,'');
  assert.equal(customer.mail,'');
  assert.equal(customer.salesMail,'');
  assert.equal(customer.salesEmail,'');
  assert.deepEqual(customer.salesContacts,[]);
  assert.deepEqual(customer.customerSalesContacts,[]);
  assert.equal(customer.cc,'');
  assert.equal(customer.mailCc,'');
  assert.equal(customer.rc385Cc,'');
  assert.deepEqual(customer.ccContacts,[]);
  assert.deepEqual(customer.customerCcContacts,[]);
});

test('RC1525: wirklich fehlende Mailfelder eines partiellen Clients bleiben weiterhin verlustgeschützt',()=>{
  const server={customers:[serverCustomer()]};
  const incoming={customers:[{
    id:'CUST-EMAIL-1',
    account:'10001',
    name:'Testkunde aktualisiert',
    updatedAt:'2026-10-14T09:00:00.000Z'
  }]};

  const out=mergeState(server,incoming);
  const customer=out.customers[0];

  assert.equal(customer.customerEmail,'kunde@example.com');
  assert.equal(customer.salesMail,'sales@example.com');
  assert.deepEqual(customer.salesContacts,[{name:'Sales',email:'sales@example.com',role:'sales'}]);
  assert.equal(customer.cc,'cc@example.com');
  assert.deepEqual(customer.ccContacts,[{name:'Disposition',email:'cc@example.com',role:'cc'}]);
});
