var dao = require('../models/dao_yanshi');

exports.choujiang = function(data, fn){
    dao.getMsgByTime(data, function(err, ret){
        if( !err ){
            var userIds = [];
            ret.forEach(function(v, i){
                var id = v.fromUserId || '';
                if( id ){
                    id = id.replace('u_', '');
                    if( /^\d+$/.test(id) ){
                        userIds.push(id);
                    }
                }
            });
            data.ids = userIds;
            dao.getUserByIds(data, function(err_user, ret_user){
                var ids = [];
                if( !err_user ){
                    ret_user.forEach(function(user, i_user){
                        ids.push(user.id);
                    });
                    fn(ids);
                    return;
                }
                console.log(err_user);
            });
            return;
        }
        console.log(err);
    });
}
