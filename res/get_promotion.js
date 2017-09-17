var conf = require('../conf'),
    conn = conf.getConnection();

var marker = {},
    msgContent = '1',
    shop_id = [0,1];

//获取所有的货架
conn.query('select fromUserId from Msg where content=?', [msgContent], function(err, ret){
    if( !err ){
        var ids = [];
        ret.forEach(function(v, i){
            var id = v.fromUserId.replace(/u_/, '');
            if( !marker[id] ){
                ids.push(id);
                marker[id] = true;
            }
        });
        console.log(ids.join(','));
        conn.query('select id from User where id in (?) and shopId in (?) group by id', [ids, shop_id], function(err_msg, ret_msg){
            console.log(ret_msg.length);
        });
    }
});

