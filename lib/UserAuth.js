var conf = require( '../conf' );
var accounter = require( '../controllers/accounter' );
var uutil = require( '../lib/util' );

//全部请求都不需要验证
var isMatch = function(str){
	if( str.indexOf('/admin/login') != -1 || str.indexOf('/admin/dologin') != -1 || str.indexOf('/list_quickly') != -1 ){
		return false;
	}
    
    //TODO 不知道为何multipart的请求一经过本中间件的getUserFromCacheById 之后, 就没有办法parse了, 先放过这些个请求. 有安全隐患
    if( str.indexOf( 'updateimg' ) != -1 || str.indexOf('product\/doadd') != -1 || str.indexOf('product\/doupdate') != -1 || str.indexOf( 'img/doadd' ) != -1  ){
		return false;
	}

	if( str.indexOf('/admin') != -1 ){
		return true;
	}
	return false;
};

module.exports = function UserAuth(){
    return function UserAuth(req, res, next){
        var base_time = new Date().getTime();
        //首先确定一下哪些请求需要用权限控制
		var uri = req.originalUrl;
		var isJsonp = req.query.jsonp;
        if(uri.indexOf('?') != -1){
            uri = uri.substring(0,uri.indexOf('?'));
        }
		if(isMatch(uri)){
            var user_id = req.cookies.user_id;
            var t = req.cookies.wx_dsx_ticket;

			//验证
            accounter.getUserFromCacheById(user_id, function (err, user) {
                uutil.printTime( base_time, 'UserAuth从redis中取数据耗时' );
                if(!accounter.isTicketAvailableForUser(t, user)){//验证不通过
				    res.redirect('/dashixiongwx/admin/login');
                    return;
                }
                req.user = user;
                next();
            });

            return;
		}
		next();	
    };
};














