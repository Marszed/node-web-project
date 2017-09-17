var conf = require( '../conf' );
var hash = require( './md5' );
var uutil = require('./util');

//------------------- 常用的工具方法 ---------------------------//
var end = uutil.end; 

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'lib/middleware_check_fake_wx_id.js');
var ld = uutil.getLogger('DEBUG', 'lib/middleware_check_fake_wx_id.js');


//网页版的微信出来之后, 用户可能会通过篡改query上的wx_id从而获得多个注册账号
module.exports = middleware_check_fake_wx_id = function (req, res, next) {
    var timestamp = req.query.timestamp;
    var wx_app_token = conf.wx.wx_app_token;
    var wx_id = req.query.wx_id;
    var sig_need_check = req.query.sig;//待校验的签名

    var sig = uutil.makeSig({
        timestamp : timestamp,
        wx_app_token : wx_app_token,
        wx_id : wx_id
    }, conf.wx.wx_app_token);

    console.log( '计算的sig ', sig );
    console.log( '待验的sig ', sig_need_check );

    if( sig == sig_need_check ){
        console.log( '====== 这是一个合法的请求!');
        next();
        return;
    }
    li.info( '用户的微信id貌似不太正确, 可能有篡改! wx_id是: '+wx_id );
    end( res, '这貌似不像一个合法的请求哦~ 点击“返回”重试一下也许可以解决问题' );
};


