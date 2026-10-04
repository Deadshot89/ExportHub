'use strict';
// RC1432: Die aktuelle Pickup-Implementierung bleibt separat, damit spätere
// Recovery-/POD-Fixes nicht durch das Wiederherstellen der ABD-Zweitunterschrift
// zurückgerollt werden.
module.exports=require('./handler-rc1432');
