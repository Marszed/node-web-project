var dashixiong = require( '../controllers/dashixiong' );
var uutil = require( '../lib/util' );

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'middleware_load_user_by_wx_id.js');
var ld = uutil.getLogger('DEBUG', 'middleware_load_user_by_wx_id.js');


var render = uutil.render; 

module.exports = function (req, res, next) {
    var user_id = req.cookies.user_id || req.cookies.userid || req.params.user_id || req.query.userid || req.query.user_id;
    var tool_grant_path = req.path;//检测是否是发放道具的请求，是必须用输入框的user_id获取获取微信OpenId
    if(tool_grant_path.indexOf('tool/grant') != -1){
        user_id = req.params.user_id;
    }
    if( req.body && !user_id ){
        user_id = req.body.user_id; 
    }
    var user = null;
    dashixiong.getUserById( user_id, function (err, ret) {
        if( !err ){
            req.user = ret[ 0 ];
            next();
            return;
        }
        next();
    });
    
};
