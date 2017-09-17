var hash = require( './lib/md5');

this.mongodb_host = '127.0.0.1';
//this.mongodb_host = '192.168.1.111';
this.mongodb_port = 27017;
this.mongodb_db= 'dashixiong';
this.mongodb_connection_string = this.mongodb_host+':'+this.mongodb_port+'/'+this.mongodb_db+'?mongodb_host';
this.authList = {
    '/admin/user' : true,
    '/admin/courses' : true
};

var static = 'http://s.ksmimi.com/',
    root = 'http://www.ksmimi.com/',
    base = static + 'dsx/',
    assets = 'http://a.ksmimi.com/',
    jspro = base + 'jspro',
    csspro = base + 'csspro',
    imgpro = base + 'img';
//if(process.env.NODE_ENV == 'deployment'){
//    jspro = 'http://s.dashixiong.com/jspro';
//    csspro = 'http://s.dashixiong.com/csspro';
//    imgpro = 'http://s.dashixiong.com/img';
//}

var qn = false;  //是否使用七牛的cdn，如需使用

//微信用户组
exports.wx_group = {
    1 : 101,
    2 : 111,
    3 : 104,
    //5 : 115
    6 : 100,
    9 : 102,
    13 : 105,
    15 : 112,
    17 : 106,
    18 : 113,
    19 : 109,
    20 : 107,
    21 : 108,
    22 : 110

};
//推广系数
exports.promotion_info = {
    base : 1,
    ratio : [
        { 0 : 1 },
        { 5 : 1.2 },
        { 10 : 1.5 },
        { 20 : 2 }
    ]
};

this.env = {
	staticRoot : static,
    base : base,
	root : root,
    qn : qn,
    upload : qn ? 'http://dashixiong.qiniudn.com' : 'http://img.ksmimi.com/uploads/products',
    jspro : jspro,
    csspro : csspro,
    imgpro : imgpro,
    assets : assets,
    img : 'http://img.ksmimi.com/uploads/products'
};
exports.path = {
	article_img_upload_dir : '/home/uploads/dashixiong/articles/',
    voice_upload_dir : '/home/uploads/dashixiong/voices/',
	product_img_upload_dir : '/home/uploads/dashixiong/products/',
    static_config_dir : '/home/assets/'
};
if( (process.env.NODE_ENV == 'development' || process.env.NODE_ENV == 'deployment')){//开发环境如果是MacOS, 竟然叫做'darwin'
	exports.path.article_img_upload_dir = '/Users/auscar/uploads/dashixiong/articles/';
    exports.path.product_img_upload_dir = '/Users/beetle/projects/uploads/dashixiong/products/';
    exports.path.voice_upload_dir = '/Users/beetle/projects/uploads/dashixiong/voices/';
    exports.path.static_config_dir = '/Users/beetle/assets/';//强哥的配置文件路径
    //exports.path.static_config_dir = '/home/lufeng/assets/';//陆峰的配置文件路径
    //exports.path.static_config_dir = '/home/zed/assets/';//彭龑的配置文件路径
//    exports.path.static_config_dir = '/home/wuyong/assets/';//军师的配置文件路径
}


var db = require('./res/dataUrl');



var mysql = require('mysql');
var pool  = mysql.createPool({
    connectionLimit : 10,
    host : db.host,
    user : db.user,
    password : db.password,
    database: db.database
});

exports.getConnection = function(){
    /*var mySqlConn = {};
    mySqlConn.query = function(){
        var args = arguments;
        pool.getConnection(function(err, conn){
            conn.query.apply(conn, args);
            conn.release();
        });
    };*/
    return pool;
};

exports.getPool = function(){
    return pool;
};


//----------------------------- 临时的权限管理 ------------------------- //
//老板(股东), 大区经理,  区域经理, 店长, A级员工, B级员工
var pwd = 'haoduojie@pyh';
var pwd_worker = 'dashixiong7788';
var pwd_worker_primary = 'dashixiong';
var powerMap = {};
powerMap[hash.md5(pwd)] = 6;//超管权限6
powerMap[hash.md5(pwd_worker)] = 2;//普通员工权限是2
powerMap[hash.md5(pwd_worker_primary)] = 1;//普通员工权限是2
exports.powerMap = powerMap;
exports.pwd = pwd;
exports.pwd_worker = pwd_worker;
exports.pwd_worker_primary = pwd_worker_primary;

//----------------------------- 微信开发相关数据 -------------------------//
exports.wx = {
	wx_app_token : 'haoduojieatpyh',
	wx_app_id : 'wx4f17193b2f6626aa',
	wx_app_secret : 'fd48420c58c2f04f50f7e4364d2014de'
};
exports.wxs = {
    //大师兄小卖部
    dsx : {
        wx_app_token : 'haoduojieatpyh',
        wx_app_id : 'wx4f17193b2f6626aa',
        wx_app_secret : 'fd48420c58c2f04f50f7e4364d2014de'
    },
    //呼叫大师兄
    hjdsx : {
        wx_app_token : 'haoduojieatpyh',
        wx_app_id : 'wx7b52fd89b4cf460f',
        wx_app_secret : '57d56fbe9fcd7d993464743fa2509867'
    }
};

//电线杆相关数据
exports.dxg = {
	wx_app_token : 'dianxianganatrockcy',
	wx_app_id : 'wx4f17193b2f6626aa',
	wx_app_secret : 'fd48420c58c2f04f50f7e4364d2014de'
};

