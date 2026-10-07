'use strict';
const base=require('./index');
const {wrapCustomerAvisHandler}=require('../shared/customer-avis-download-all');
module.exports=wrapCustomerAvisHandler(base);
