var conf = require('../conf'),
    conn = conf.getConnection();

var tId = 1; //道具id， 1为新人令

conn.query('select User.id from User left join UserTool on User.id=UserTool.userId where tId=? and isAvailable=?', [tId, 1], function(err, ret){
    var ids = [];
    if( !err ){
        ret = ret || [];
        ret.forEach(function(user, i){
            ids.push( user.id );
        });

        if( !ids.length ) ids.push(0);

        conn.query('update UserTool set isAvailable=0 where userId in ('+ ids.join(',') +')', function(err_update, ret_update){
            if( err_update ){
                console.log( err_update );
                return;
            }
            console.log( ret_update.affectedRows );
            console.log('Update success!');
        });
    }
});
