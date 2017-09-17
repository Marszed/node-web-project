var products = require('./products');
var request = require('request');
var needle = require('needle');
var dao = require('../models/dao');

var products_ary = [];
for(var p in products){
	products_ary.push(products[p]);
}



products_ary.forEach(function(product, i){
	console.log(product.id, product.title);
	setTimeout(function(){
		product.promotePrice = product.promote_price;
		dao.insertProduct(product, function(err, ret){
			console.log(product.id, product.title, '==== 插入成功');
		
		});	
	}, 1000*i);


});

