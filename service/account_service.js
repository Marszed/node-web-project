//var asyncMgr = require('../lib/asyncMgr');
var uutil = require('../lib/util');
var dashixiong = require('../controllers/dashixiong');
var logger = require('../controllers/logger');
var conf = require('../conf');
var hash = require( '../lib/md5' );
var tools = require( '../lib/tools'),
    dao = require('../models/dao');

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'account_service.js');
var ld = uutil.getLogger('DEBUG', 'account_service.js');

//--------------------------- 中间件 ---------------------------//
var middleware_load_user_by_wx_id = require( '../lib/middleware_load_user_by_wx_id' );
var middleware_load_user_by_user_id = require( '../lib/middleware_load_user_by_user_id' );


//-------------------- 常用的工具方法 ----------------------//
var render = uutil.render; 
var end = uutil.end,
    sureObj = uutil.sureObj,
    sureAry = uutil.sureAry;

exports.route = function(app){

    //----------------- 账号、登录业务 ------------------//
    var middle_only_id = function(req, res, next){
        if(/^[0-9]+$/.test(req.params.user_id)){//这种路由是我们需要的
            next();
            return;
        }
        next('route');
    };
    app.get('/dashixiongwx/account/:user_id', middle_only_id, function(req, res){
      var user_id = req.params.user_id;
      dashixiong.getUserById(user_id, function (err, ret) {
         if (!err) {
            var user = ret[0];
            render(req, res, 'wx/account_info', {
              layout : true ,
              user : user
            });
         }
      });
    });

    app.get('/dashixiongwx/account/:wx_id', function(req, res){
      var wx_id = req.params.wx_id;//wx_323mmdiVsds2fbklsdopwvMMn
        render(req, res, 'wx/account', {
            layout : true,
            wx_id : wx_id
        });
    });

    //用户输入自己的登录账号和登录密码
    app.post('/dashixiongwx/account/bind/:wx_id', function(req, res){
      var wx_id = req.params.wx_id;//wx_323mmdiVsds2fbklsdopwvMMn
      var account = req.body.account;
      dashixiong.getUserByWxId( wx_id, function (err, ret) {
        if(!err){
                var user = ret[0];
          if(!user){
            end(res, '用户不存在!');
                  return;
          }

          dashixiong.updateUser({
            id : user.id,
            email : account.email,
            pwdHash : hash.md5(account.pwd),
            nick : account.nick
          }, function (err, ret) {
            if(!err){
              //自动登录, 完事之后进入用户账户页
              res.redirect('/dashixiongwx/account/'+user.id);
              return;
            }

          })
          return;//没有error, 可以返回
            }
            ld.debug(err);

      });

    });
    //根据email获取用户信息
    app.post('/dashixiongwx/get_user_by_email', function(req, res){
        var email = req.body.email || '',
            status = true;
        dao.getUserByEmail(email, function(err, ret){
            if( err || (ret && !ret.length) ) status = false;
            end(res, {status:status, data:ret});
        });
    });

    //每个用户都会有一次机会获取首次关注的代金券奖励
    app.get('/dashixiongwx/coupon/newuser/:wx_id',  middleware_load_user_by_user_id, function(req, res){
        //读取数据库, 看看这个用户有没有获取过代金券奖励
        dashixiong.getUserToolByToolId( req.user.id,  1, function (err, ret) {//1为新人令
            if( err ){//出错
                ld.debug( err );
                render(req, res, 'wx/msg', {
                    layout : true,
                    msg : '出了一点小问题. 可以返回重试一下. 如果还不行, 请微信联系我们的客服。'
                });
                return;
            }

            if( !ret.length ){//没有领取代金券, 插入数据
                dashixiong.getTool({
                    user_id : req.user.id ,
                    t_id : 1//1为新人令, 即面值为5大师币的代金券
                },  function (err, ret) {
                    render(req, res, 'wx/user_new_coupon', {
                        layout : true,
                        user : req.user
                    });
                });
                return;
            }

            render(req, res, 'wx/msg', {
                layout : true,
                msg : '你已经领取过代金券咯~'
            });


        });
    });

    //道具页面, 用户在这个页面获取道具
    app.get('/dashixiongwx/tool/grant/:wx_id',  middleware_load_user_by_wx_id, function(req, res){
        dashixiong.getUserTools( req.user.id, function (err, ret) {
            end( res, ret ) ;
        });
    });
    //用户查看自己有什么道具
    app.get('/dashixiongwx/user/tool/list/:wx_id',  middleware_load_user_by_wx_id, function(req, res){
        dashixiong.getUserTools( req.user.id, function (err, ret) {
            render(req, res, 'wx/user_tool_list', {
                layout : true,
                tools : ret
            });
        });
    });

    //删除用户的取件信息
    app.get('/dashixiongwx/user/:user_id/express/fetch/info/del/:express_id', function(req, res){
        dashixiong.delExpressInfo( req.params.express_id, function (err, ret) {
            end( res, {
                code : 0,
                msg : 'sus'
            });
        });
    });



    //用户删除地址本, 其实并不是真正的del, 而是将地址disable掉
    app.get('/dashixiongwx/addr/del/:addr_id',  middleware_load_user_by_user_id, function(req, res){
        console.log( req.params.addr_id );
        dashixiong.delAddr( req.params.addr_id-0, function (err, ret) {
            end( res, {
                code : 0,
                msg : 'sus'
            });
        });
    });


    //使用道具
    app.post('/dashixiongwx/tool/use',  middleware_load_user_by_user_id, function(req, res){
        var user_id = req.body.user_id;
        var user_tool_id = req.body.user_tool_id;
        var tool_id = req.body.tool_id;
        var str_products = req.body.str_products;
        var total_num = req.body.total_num;
        var total_pay = req.body.total_pay;

        //通过user_tool_id 获取这个用户的这个道具信息
        //dashixiong.getUserToolByToolId( user_id, tool_id, function (err, ret) {

        dashixiong.getUserToolById( user_tool_id, function (err, ret) {
            if( err ){//系统运行时错误
                end( res, {
                    code : 1,
                    msg : 'db err'
                });
                return;
            }

            if( !ret || !ret.length ){//用户没有这个道具
                end( res, {
                    code : 2,
                    msg : 'no your tool!'
                });
                return;
            }

            //运行到这里, 说明用户有使用这个道具的权限。好, 开始使用这个道具
            var tool = ret[0];
            //tool.type

            var ret = tools[ tool.type ]( tool, JSON.parse( str_products ), total_num, total_pay );//调用合适的方法来返回道具使用结果

            //返回处理结果
            end( res, {
                code : 0,
                msg : 'sus',
                type : tool.type,
                ret : ret
            });

            //将用户的这个工具标记为已经使用
            //dashixiong.disableUserTool( tool.id, function (err, disable_ret) {
            //
            //});

        });
    });


};//end exports.route
