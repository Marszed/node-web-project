var conf = require('../conf'),
    conn = conf.getConnection();

var marker = {},
    total = 0;

//获取所有的货架
conn.query('select id,content from Section where shopId not in (1,2,3,5,9)', function(err, ret){
    if( !err ){
        try{
            //记录每个商品属于哪个货架
            ret.forEach(function(v, i){
                var ids = JSON.parse( v.content );
                ids.forEach(function(id, i_id){
                    marker[ id ] = v.id;
                    total++;
                });
            });
            //获取所有的订单信息
            conn.query('select id,shopId,userId,productIds from UserOrder where shopId not in (1,2,3,5,9)', function(err_order, ret_orders){
                ret_orders.forEach(function(order, index){
                    var ids = JSON.parse( order.productIds),
                        pid = ids[0],
                        section_id = typeof pid == 'string' && pid.indexOf('+') != -1 ? marker[pid.split('+')[0]] : marker[pid];
                    console.log('pid='+pid);
                    console.log('section_id='+section_id);
                    if( section_id ){
                        conn.query('update UserOrder set sectionId=? where id=?', [section_id, order.id], function(err, ret){});
                    }
                });
                console.log('done');
            });
        }catch(e){}
    }
});

