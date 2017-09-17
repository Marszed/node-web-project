var conf = require('../conf'),
	dashixiong = require('../controllers/dashixiong'),
	pool = conf.openDB();  //打开数据库链接

exports.doit = function(fn){
    pool.query('select * from UserOrder', function(err, ret){
		var products = null;
		ret.forEach(function(order, i){
			var ids_ary = JSON.parse(order.productIds);
			products = dashixiong.getProductsWithIds(ids_ary);//products内的产品现在是具体的product对象
			var total = dashixiong.countTotal(products);
			
			setTimeout(function(){
				pool.query('update UserOrder set snapshot=? where id=?', [JSON.stringify(total.snapshot), order.id], function(err, ret){ 
					if(err){
						console.log('订单%d的快照插入失败 ', order.id, err);
						return;
					}
					console.log('订单%d的快照插入成功 ', order.id);
				});	

			}, i*100);
			
		});//end forEach
		


    });
};
dashixiong.ready(function(){
	exports.doit();
});

