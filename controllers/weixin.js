var dao_wx = require('../models/dao_wx'),
    dao = require('../models/dao'),
    util = require('../lib/util');

//--------------------------- 日志配置 ---------------------------//
var li = util.getLogger('INFO', 'weixin.js');
var ld = util.getLogger('DEBUG', 'weixin.js');

var sureObj = util.sureObj,
    sureAry = util.sureAry;

exports.markUnsubscrib = function(wx_id, fn){
    dao.getUserByWxId(wx_id, function(err, ret){
        if( !err){
            var user = sureObj(ret);
            dao_wx.markUnsubscrib(user, function(err_wx, ret_wx){
                if( !err_wx ){
                    li.info('取消关注的用户标记成功！');
                    fn && fn(true);
                    return;
                }
                li.info('取消关注的用户标记不成功，不知道哪里出错了！');
                fn && fn(null);
            });
            return;
        }
        ld.debug(err);
    });
};
