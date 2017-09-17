var request = require('request');
//var uutil = require('../lib/util');
var conf = require('../conf');
var API = require('wechat').API;
var api = new API(conf.wx.wx_app_id, conf.wx.wx_app_secret);

//--------------------------- 日志配置 ---------------------------//
//var li = uutil.getLogger('INFO', 'res/wx_group.js');
//var ld = uutil.getLogger('DEBUG', 'res/wx_group.js');


var token_obj = null;

//获取访问微信高级权限的access_token
exports.accessToken = function (fn) {
    var now = new Date().getTime();

    if( token_obj ){//看看是不是过期了, 过期之后得重新获取一下access_token
        if( now - token_obj.expires_in_future >= 0  ){//过期了
            console.log( 'access_token 过期了, set 为null. 即将重新请求' );
            token_obj = null; 
        }
    }
    
    if( !token_obj ){//还没有token 或者 token过期
        request({
        	url : 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid='+ conf.wx.wx_app_id +'&secret=' + conf.wx.wx_app_secret
        }, function(err, res_obj, body){
        	token_obj = JSON.parse(body);
            token_obj.expires_in_future = new Date().getTime() + token_obj.expires_in*1000;//未来某个时间过期, 目前微信token 过期的时间是120分钟(7200秒)

            console.log( '请求到的token是: ' );
            console.log( token_obj );

            fn&&fn( null, token_obj);
        });
        return;
    }
    
    console.log( 'access_token 还有'+ ( token_obj.expires_in_future - now )/1000  +'秒过期' );
    fn( null, token_obj );

};


exports.accessToken_hjdsx = function (fn) {
    var now = new Date().getTime();

    if( token_obj ){//看看是不是过期了, 过期之后得重新获取一下access_token
        if( now - token_obj.expires_in_future >= 0  ){//过期了
            console.log( 'access_token 过期了, set 为null. 即将重新请求' );
            token_obj = null;
        }
    }

    if( !token_obj ){//还没有token 或者 token过期
        request({
        	url : 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid='+ conf.wxs['hjdsx'].wx_app_id +'&secret=' + conf.wxs['hjdsx'].wx_app_secret
        }, function(err, res_obj, body){
            if(err){
                console.log(err);
                return;
            }
        	token_obj = JSON.parse(body);
            token_obj.expires_in_future = new Date().getTime() + token_obj.expires_in*1000;//未来某个时间过期, 目前微信token 过期的时间是120分钟(7200秒)

            console.log( '请求到的token是: ' );
            console.log( token_obj );

            fn&&fn( null, token_obj);
        });
        return;
    }

    console.log( 'access_token 还有'+ ( token_obj.expires_in_future - now )/1000  +'秒过期' );
    fn( null, token_obj );

};