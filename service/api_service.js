var uutil = require('../lib/util'),
    end = uutil.end,
    alarmAdmin = uutil.alarmAdmin,
    render = uutil.render;
var endErr = uutil.endErr,
    sureAry = uutil.sureAry,
    sureObj = uutil.sureObj;
var hash = require('../lib/md5');

var middleware_load_user_by_wx_id = require('../lib/middleware_load_user_by_wx_id');

var dashixiong = require('../controllers/dashixiong');
var iconv = require('iconv-lite');

var apis = require('../controllers/apis'),
    dao_api = require('../models/dao_api');

var fs = require('fs');

var JPush = require("jpush-sdk");//-------------Jpush to app --------------@zed
var client = JPush.buildClient('9e0dee0ee9f19842f5aa2b96','9711761c5f370dc327b43066');
//--------------------------- 中间件 ----------------------------//
var middleware_load_products_map = require('../lib/middleware_load_products_map_of_shop');
var middleware_load_user_by_user_id = require('../lib/middleware_load_user_by_user_id');
var middleware_load_user_by_wx_id = require('../lib/middleware_load_user_by_wx_id');
var middleware_get_config_of_shop = require('../lib/middleware_get_config_of_shop');
var middleware_power = require('../lib/middleware_power');//这个模块里面有各种权限的中间件

var request = require('request'),
    tokener = require('../res/weixin_token');

var path = require('path');

var conf = require('../conf');

var middle_only_id = function (req, res, next) {
    console.log('========================================================= middle_only_id');
    if (/^[0-9]+$/.test(req.params.shop_id)) {//这种路由是我们需要的
        next();
        return;
    }
    next('route');
};


exports.route = function (app) {

    //各式各样的api接口
    app.get('/dashixiongwx/api/shop/:shop_id',
        middle_only_id,
        apis.getListOrdersHandler());

    app.get('/dashixiongwx/api/shop/:shop_id/:section_id',
        middle_only_id,
        apis.getListOrdersHandler());

    //----获取预定时服务器时间-----//
    app.get('/dashixiongwx/api/getServerTime',function(req,res){
        //产生服务器端时间
        var dt = new Date();
        var serverHour = dt.getHours();
        var serverMinute = dt.getMinutes();
        end( res, serverHour + ':' + serverMinute );
    });

    //根据用户email获取用户id
    app.get('/dashixiongwx/api/get/user/id',
        function(req,res){
            var email = req.query.email;
            dashixiong.getUserByEmail(email, function(err, ret){
                var data = {};
                if( !err ){
                    data = sureObj(ret).id;
                }
                end(res, data);
            });

        });
    //解析gbk的字符串
    app.post('/dashixiongwx/api/parse/gbk', function(req, res){
        var data = req.body.data;
        console.log("data = "+ data);
        data = iconv.decode(data, 'gbk');
        end(data);
    });

    //根据section_id获取整个货架信息（包括里面的产品）
    app.get('/dashixiongwx/api/get/section',
        middleware_load_user_by_wx_id,
        middleware_get_config_of_shop,
        function(req, res){
            var shop_id = req.query.shop_id,
                config = req.config,
                user = req.user,
                section_id = req.query.section_id,
                wId = req.query.wId,
                cur_warehouse_id = uutil.getSettingValueByKey(config, 'curWarehouseId');
            dashixiong.getSectionById(section_id, function(err, ret){
                if( !err ){
                    var pids = [];
                    ret = sureObj(ret);
                    pids = JSON.parse( ret.content );
                    if( !pids ){
                        res.end('');
                        return;
                    }
                    dashixiong.getStoreProducts({pids:pids, wId:wId}, function(err_pd, ret_pd){
                        if( !err_pd ){
                            res.end( JSON.stringify({section:ret, products:apis.sortDataWithIds(pids, ret_pd)}) );
                            return;
                        }
                        console.log(err_pd);
                    });
                    return;
                }
                console.log(err);
            })
        });

    //监控用户下不了单
    app.get('/dashixiongwx/api/monitor/order/info',function(req, res){
        var obj = {
            err : req.query.err,
            file : req.query.fileErr,
            line : req.query.line,
            au : req.query.ua,
            userId : req.query.userId,
            shopId : req.query.shopId,
            monitorType : req.query.monitorType,
            timeStamp : new Date().getTime()
        };
        var time = uutil.getDateTextByTimeStamp(new Date());
        console.log('There is an Error...');
        dashixiong.monitorOrder(obj, time, function(err){
            if(!err){
                res.end('');
            }
        });
    });

    //记录用户行为，便于分析
    app.post('/dashixiongwx/api/set/user/record', function(req, res){
        var data = req.body.data,
            analysis = apis.analysis,
            push_analysis = analysis.push;
        data.timeStamp = new Date().getTime();
        dashixiong.getUserByWxId(data.openId, function(err, ret){
            var user = sureObj(ret);
            data.userId = user.id;

            //如果管理员，不统计
            if( user.power > 0 && !uutil.isInDevelopment() ){
                res.end('You are admin, ignore it.');
                return;
            }

            try{
                data.content = JSON.stringify( data.content );
            }catch(e){

            }
            //打烊时间，不统计 add by lufeng
            dashixiong.getConfigOfShop(user.shopId,function(err2,ret2){
                if(err2){
                    console.log(err2);
                    res.end('*******服务器hold不住了*********');
                    return;
                }
                try{
                    //系统时间
                    var curDate = new Date(),
                    hour = "" + curDate.getHours(),
                    minute = "" + curDate.getMinutes();
                    if(hour.length==1){
                        hour = "0"+hour;
                    }
                    if(minute.length==1){
                        minute = "0"+minute;
                    }
                    var curDateStr = hour + minute;
                    var config = uutil.settingArrayToObj(ret2);
                    var closeTimeArr = '',
                        configCloseTime = config.closeTime;
                    if((config.closeTime).indexOf('|') != -1){//TODO 该业务稍候再实现

                    }else{
                        closeTimeArr = configCloseTime.split(',');
                        if((curDateStr < closeTimeArr[0]) || (closeTimeArr[1] < curDateStr)){
                            res.end(' ');
                            return;
                        }
                    }
                }catch (e){
                    console.log(e);
                }

                dao_api.setUserRecord(data, function(err, ret){
                    if( err ) console.log(err);
                    res.end('success');
                    //将记录直接推送到后台监控页面
                    push_analysis({
                        content : analysis.getPosition(data.position,analysis.imgs) + '<span style="display: block;color:#999999;text-align: center;line-height: 12px;">'+uutil.getTimeTxt(data.timeStamp)+'</span>',
                        user_id : user.id,
                        shop_id : user.shopId
                    });
                });

            });


        });
    });

    //在首页列出所有学校共管理员选择
    app.post('/dashixiongwx/api/select/all/school',
        middleware_load_user_by_user_id,
        middleware_power.operator,
        function(req, res){
            dashixiong.getAllSchoolAddress(function(err, ret){
                if(err){
                    console.log(err);
                    return;
                }
                res.end(JSON.stringify(ret));
            });
    });
    //更新从首页选学校的管理员的shopId
    app.post('/dashixiongwx/api/update/user/shopId',
        middleware_load_user_by_user_id,
        middleware_power.operator,
        function(req, res){
            var user = {
                shopId : req.body.user.shopId,
                id : req.body.user.userId

            };
            dashixiong.updateUser(user, function(err, ret){
                if(err){
                    console.log(err);
                    res.end('no');
                }
                res.end('success');
            });
    });

    //首次进入页面获取可用的动态样式--by@boylufeng
    app.get('/dashixiongwx/admin/shop/:shop_id/dynamic/style',
        middleware_power.operator,
        function(req, res){
            var obj = {
                shopId : req.params.shop_id
            };
            dashixiong.getDynamicStyles(obj, function(err, rows, fields){
                if(err){
                    console.log(err);
                    return;
                }
                rows.forEach(function(row, i){
                    var flag = (row.fileName).indexOf('?v=');
                    if(flag != -1){
                        rows[i].fileName = (row.fileName).substring(0,flag);
                    }
                });
                render(req, res, 'activity/dynamic_style', {
                    layout: 'admin/layout',
                    styleFiles: rows,
                    shopId: obj.shopId
                });
            });
    });

    //add new style file
    app.post('/dashixiongwx/admin/shop/dynamic/style/add',
        middleware_power.operator,
        function(req, res){
            var obj = {
                shopId: req.body.fileStyle.shopId,
                fileName: req.body.fileStyle.name,
                fileContent: req.body.fileStyle.content
            };
            if(req.body.fileStyle.edit=='true'){
                obj.edit = 'true';
            }
            if(req.body.fileStyle.id){
                obj.id = req.body.fileStyle.id;
            }
            //创建文件夹保存样式
            var dir = '/home/uploads/dashixiong/css/';
            if((obj.fileName).indexOf('.js')!=-1){
                dir = '/home/uploads/dashixiong/js/';
            }
            if(uutil.isInDevelopment()){
                dir = "/home/zed/uploads/dashixiong/css/";
                if((obj.fileName).indexOf('.js')!=-1){
                    dir = '/home/zed/uploads/dashixiong/js/';
                }
            }

            if(!fs.existsSync(dir)){//不存在该路经
                fs.mkdirSync(dir);
            }
            fs.writeFileSync(dir+(obj.fileName), obj.fileContent, 'utf8');
            //保存样式文件名
            dashixiong.insertDynamicStyle(obj, function(err){
                if(!err){
                    res.end("success");
                    return ;
                }
                console.log(err);
            });

        });
    //edit already had style file
    app.post('/dashixiongwx/admin/shop/dynamic/style/edit',
        middleware_power.operator,
        function(req, res){
            var args = req.body.args;
            var fileContent = '';
            var dir = '/home/uploads/dashixiong/css/';
            if((args.fileName).indexOf('.js')!=-1){
                dir = '/home/uploads/dashixiong/js/';
            }
            if(uutil.isInDevelopment()){
                dir = "/home/zed/uploads/dashixiong/css/";
                if((args.fileName).indexOf('.js')!=-1){
                    dir = '/home/zed/uploads/dashixiong/js/';
                }
            }
            var flag = args.fileName.indexOf('?v=')-0;
            if(flag!=-1){
                args.fileName = args.fileName.substring(0, flag);
            }
            if(fs.existsSync(dir+args.fileName)){
                fileContent = fs.readFileSync(dir+args.fileName,'utf8');
            }
            res.end(fileContent);
    });

    //delete old style file
    app.post('/dashixiongwx/admin/shop/dynamic/style/delete',
        middleware_power.operator,
        function(req, res){
            var file = {
                    id :  req.body.file.id,
                    name : req.body.file.name
            };
            var dir = '/home/uploads/dashixiong/css/';
            if((file.name).indexOf('.js')!=-1){
                dir = '/home/uploads/dashixiong/js/';
            }
            if(uutil.isInDevelopment()){
                dir = "/home/lufeng/uploads/dashixiong/css/";
                if((file.name).indexOf('.js')!=-1){
                    dir = '/home/lufeng/uploads/dashixiong/js/';
                }
            }
            dashixiong.deleteStyleFileById(file, function(err, rows){
                if(err){
                    console.log(err);
                    return;
                }
                if(fs.existsSync(dir+file.name)){
                    fs.unlinkSync(dir+file.name);
                }
                res.end('success');
                return;
            });
    });

    app.post('/dashixiongwx/admin/shop/dynamic/style/status/update',
        middleware_power.operator,
        function(req, res){
            var file = req.body.file;
            dashixiong.updateStyleFileStatus(file, function(err, rows){
                if(err){
                    console.log(err);
                    return ;
                }
                res.end('success');
                return ;
            });
    });

    //限制某些店可以应用哪类样式
    app.post('/dashixiongwx/admin/shop/dynamic/style/shopIds/update',
        middleware_power.operator,
        function(req, res){
            var argObj = req.body.argsObj;
            dashixiong.updateStyleFileShopIds(argObj, function(err, rows){
               if(err){
                   console.log(err);
                   return ;
               }
               res.end('success');
            });

    });
    //更新用户使用店铺版本状态
    app.post('/dashixiongwx/api/update/version/status',function(req,res){
        var status = req.body.status,
            versionMarkId = req.body.versionMarkId,
            userId = req.body.userId;
        if(status&&versionMarkId){
            dashixiong.updateVersionUseStatus(status,versionMarkId,function(err){
                if(!err){
                    res.end('update user version sus');
                }
                console.log(err);
            });
            return;
        }
        if(status&&userId){
            dashixiong.updateVersionUseStatusByUserId(status,userId,function(err){
                if(!err){
                    res.end('update user version sus');
                }
                console.log(err);
            });
        }
    });
    //--------------------------------------app推送服务
    app.post('/dashixiongwx/api/app/tochat',function(req,res){//客服对app客户端回复消息
        var temp = req.body.info;
        var custom_id = temp.tocustomerid,//客服指定对那个用户的user_id推送
            fortime = new Date().format('yyyy-mm-dd HH:MM:ss'),
            content = temp.content;
        var forchat = {
            custom_id : custom_id,
            content : content,
            fortime : fortime
        };
        res.setHeader('Content-Type', 'text/json; charset=utf8');
        res.end(JSON.stringify(forchat));
        exports.dsx_pushApp(forchat);
    });

    exports.dsx_pushApp = function(forchat){
        //if( exports.isInDevelopment() ) return; //开发环境不推送消息，免得导致socket hang up的错误
        var zed = forchat.custom_id +'';
        var content = forchat.content;
        var type = '';//可能需要设定消息内容的类型
        //=======================
        client.push().setPlatform(JPush.ALL)//必填，推送平台设置--android,ios,winphone
            .setAudience(JPush.alias(zed))//必填，推送设备指定--[JPush.alias("2")]指定发送设备的别名//JPush.ALL推送全部可发现设备，广播
            //.setNotification("Hi, App", JPush.ios("ios alert"), JPush.android("android alert"))
            .setMessage(content,"大师兄的慰问","文字")
            .setOptions(null,0)//推送可选项，sendno：推送序号，api的调用标识(int)-time_to_live:离线消息保留时长,默认86400(1天),最长10天，设置0表示不保留离线消息，只有当前在线用户可收到
            //override_msg_id:(long)要覆盖的消息ID，覆盖有效时长1天-apns_production:(boolean)APNs是否生产环境，False表示推送开发环境,JPush官方(SDK)默认设置为推送开发环境
            //big_push_furation:(int)又名缓慢推送，在给定n分钟内，均匀的想这次推送的目标用户推送.最大值1440,未设置则不是定速推送
            .send(function(err, res) {
                if (err) {
                    console.log(err.message);
                } else {
                    console.log("Sendno: " + res.sendno);
                    console.log("Msg_id: " + res.msg_id);
                }
            });
    };

    //------app个人中心@设置头像
    //http://www.ksmimi.com/dashixiongwx/api/app/password/head
    app.post('/dashixiongwx/api/app/password/head',
        function(req,res){
            var zed = req.body.user_head;//此处接受由客户端传过来的base64的数据
            var user_id = req.param('user_id') || req.cookies.user_id;
            var head_path = '/home/uploads/dashixiong/user_head/';//制定图片存储路径'/home/zed/static/kaisa_static/dashixiong_static/img/user_head/'
            var head_name = hash.md5(user_id+new Date().getTime().toString());  //文件名弄成时间戳+userId.得转换正字符串，不然hash后的文件名是一样的
            var filepath = head_path+head_name+'.png';//丢过来的图像数据已经强制转为了png格式，无需多虑
            var sqlpath = 'http://img.ksmimi.com/uploads/heads/'+head_name+'.png';
            console.log(sqlpath);
            console.log('~~~~~~~~~~~~~~~~~~~~~~@@@开始更新用户头像@@@~~~~~~~~~~~~~~~~~~~~~~');
            dashixiong.updateUserHead(head_name+'.png',user_id,function(err){
                if(!err){
                    console.log('~~~~~~~~~~~~~~~~~~~~~~更新sql头像成功~~~~~~~~~~~~~~~~~~~~~~');
                    return;
                }
                console.log('~~~~~~~~~~~~~~~~~~~~~~更新sql头像失败~~~~~~~~~~~~~~~~~~~~~~');
                return;
            });

            fs.writeFile(filepath,zed,'base64',function(err){//fs.writeFile(文件名,数据,[options],回调函数(err));
                if(!err){
                    var dsxroot = {
                        'status':200,
                        'content':sqlpath
                    };
                    var root = JSON.stringify(dsxroot);
                    res.end(root);
                    console.log('~~~~~~~~~~~~~~~~~~~~~~上传头像成功~~~~~~~~~~~~~~~~~~~~~~');
                    return;
                }
                var dsxroot = {
                    'status':300,
                    'content':'upload headlog for failure'
                };
                var root = JSON.stringify(dsxroot);
                res.end(root);
                console.log('~~~~~~~~~~~~~~~~~~~~~~上传头像失败~~~~~~~~~~~~~~~~~~~~~~');
                return;
            });
        });

    //根据特定的userId发送微信消息--added--by--lufeng
    app.post('/dashixiongwx/admin/api/push/wx_msg',
        middleware_power.boss,
        function(req, res){
            var obj = req.body.args;
            dashixiong.getUserWXIDByuserId(obj,function(err, ret){
                if(err){
                    console.log(err);
                    return ;
                }
                var temp = [];
                if(ret.length>0){
                    try{
                        ret.forEach(function(ele, i){
                            temp.push(ele.openId);
                        });
                        tokener.accessToken_hjdsx(function(err, obj2){
                            request({
                                url: 'https://api.weixin.qq.com/cgi-bin/message/mass/send?access_token=' + obj2.access_token,
                                method: 'POST',
                                body: JSON.stringify({
                                    /*"touser":["ocB9as_ds8oUpwLCHsMXvcFm3_pk",
                                    "ocB9as0S5jWhBU1hXs-TQW3GUfYU"],*/
                                    "touser": temp,
                                    "text":{
                                        "content" : obj.msg
                                    },
                                    "msgtype":"text"
                                })
                            },function(err,response,body){
                                var data  = JSON.parse( body );
                                if(data.errcode){
                                    console.log( '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~操作失败' );
                                }
                                console.log( body );
                                console.log( '==============================================================');
                            });
                            console.log('**发送信息成功**');
                            res.end('sus');
                        });
                    }catch (e){
                        console.log('***特定用户发送微信消息异常**');
                        console.log(e);
                        res.end('');
                    }
                }
            });
        });

    //发送微信模板消息根据wx_id---added by lufeng
    app.get('/dashixiongwx/api/push/template/msg',
        middleware_load_user_by_wx_id,
        function(req, res){
            var user = req.user;
            var orderId = req.query.orderId;
            dashixiong.getOrderById(orderId,function(err, rows){
               if(err){
                   console.log(err);
                   return;
               }else{
                   if( rows.length>0 && JSON.parse(rows[0].snapshot).products_bought){
                       var products_bought = JSON.parse(rows[0].snapshot).products_bought;
                       var products = [];
                       products_bought.forEach(function(product,i){
                           var temp = {
                                title: product.title,
                                count: product.count,
                                unit: product.unit
                           };
                           products.push(temp);

                       });
                       render(req, res, 'activity/customer_evalutaion',{
                           layout: false,
                           openId: user.openId,
                           userId: user.id,
                           shopId: user.shopId,
                           orderId: orderId,
                           products: products,
                           date: uutil.getTimeTxt(rows[0].timeStamp)
                       });
                       return;
                   }
                   render(req, res, 'activity/customer_evalutaion',{
                       layout: false,
                       openId: user.openId,
                       userId: user.id,
                       shopId: user.shopId,
                       products: []
                   });
               }
            });

    });
    //保存客户的评价信息
    app.all('/dashixiongwx/api/sava/evalutaion/msg',
        function(req, res){
            var evaluationInfo = req.body.argInfo,
                isAjax = req.query.isAjax;
            if(isAjax){
                dashixiong.insertIntoCustomerEvaluation(evaluationInfo, function(err){
                    if(!err){
                        res.end('sus');
                        return;
                    }
                    console.log(err);
                });
            }else{
                render(req, res, 'activity/customer_evaluation_finish',{
                    layout: false,
                    wx_id: req.query.wx_id,
                    shopId: req.query.shopId
                });
            }

    });

    app.get('/dashixiongwx/admin/shop/:shop_id/customer/evaluation',
        middleware_power.customer_service,//客户评价下放到客服4级权限，也可以查看
        middleware_load_user_by_user_id,
        function(req, res){
            var shopId = req.params.shop_id,
                y = req.query.y,
                m = req.query.m,
                d = req.query.d;
            var dt = new Date();

            if(y && m && d){
                dt.setFullYear(y - 0);
                dt.setMonth(m - 0 -1);
                dt.setDate(d - 0);
            }else{
                y = dt.getFullYear();
                m = dt.getMonth() + 1;
                d = dt.getDate();
            }

            //从0点开始
            dt.setHours(0);
            dt.setMinutes(0);
            dt.setSeconds(0);
            var time_stamp_start =  dt.getTime();
            dt.setHours(23);
            dt.setMinutes(59);
            dt.setSeconds(59);
            var time_stamp_end = dt.getTime();
            // ---------------------- end时间设置 ------------------------------//
            var pre_date = dashixiong.getDates(dt.getTime()).pre;//前一天
            var next_date = dashixiong.getDates(dt.getTime()).next;//后一天

            var argObj = {
                shopId: shopId,
                time_stamp_start: time_stamp_start,
                time_stamp_end: time_stamp_end
            };
            dashixiong.getAllCustomerEvaluation(argObj, function(err, rows){
                if(err){
                    console.log(err);
                    return;
                }
                rows.forEach(function(row,i){
                    try{
                        var tempContent = '<span style="color: #ff0000">速度:</span>'+(JSON.parse(row.content).speed || '...') + '<span style="color: #ff0000">&nbsp;&nbsp;配送员:</span>'+(JSON.parse(row.content).performance || '...') + '<span style="color: #ff0000">&nbsp;&nbsp;唠叨:</span>'+(JSON.parse(row.content).extra?JSON.parse(row.content).extra:'...');
                        if(JSON.parse(row.content) && JSON.parse(row.content).performance2){
                            tempContent = '<span style="color: #ff0000">速度:</span>'+(JSON.parse(row.content).speed || '...') + '<span style="color: #ff0000">&nbsp;&nbsp;配送员:</span>'+(JSON.parse(row.content).performance || '...') +'<span style="color: #ff0000">&nbsp;&nbsp;漏配、错配:</span>'+(JSON.parse(row.content).performance2) + '<span style="color: #ff0000">&nbsp;&nbsp;唠叨:</span>'+(JSON.parse(row.content).extra?JSON.parse(row.content).extra:'...');
                        }
                        row.content = tempContent;
                        row.timeStamp = uutil.getDateTextByTimeStamp(row.timeStamp2);
                        row.nick = row.nick || 'null';
                    }catch (e){
                        row.timeStamp = uutil.getDateTextByTimeStamp(row.timeStamp);
                        console.log(e);
                    }
                });

                //TODO 选学校没做完
                dashixiong.getAllSchoolAddress(function(err2, rows2){
                    if(err2){
                        console.log(err2);
                    }
                    render(req, res, 'activity/display_customer_evaluation', {
                        layout: 'admin/layout',
                        comments: rows || [],
                        y: y,
                        m: m,
                        d: d,
                        pre_date_y: pre_date.getFullYear(),
                        pre_date_m: pre_date.getMonth() + 1,
                        pre_date_d: pre_date.getDate(),

                        next_date_y: next_date.getFullYear(),
                        next_date_m: next_date.getMonth() + 1,
                        next_date_d: next_date.getDate(),

                        //星期几
                        xingqi: uutil.getChineseDay(dt),

                        //power
                        power: req.user.power,

                        //分店
                        shops: rows2 || []

                    });
                });


            });

    });

    app.get('/dashixiongwx/api/enter/download/app',
        function(req, res){
            var UA = req.header('user-agent'),
                appVersion = req.query.v || '0.0.1';
            //--------------------记录app下载来自那种推广方式
            var from = req.query.from;
            //-------------------记录app下载来自那种推广方式
            //记录多少人点击该链接
            var argObj = {
                v: appVersion,//app的版本
                type: '0',//浏览器类型，0微信，1其他浏览器直接下载
                from: from//来自那种推广方式
            };
            //微信浏览器
            if(UA.indexOf('MicroMessenger') != -1){
                dashixiong.instertClickAppLink(argObj, function(err){
                    if(err){
                        console.log(err);
                        res.end('');
                        return;
                    }
                    render(req,res, 'activity/downLoad_app', {
                        layout: false
                    });
                });
            }else{
                var argObj2 = {
                    v: appVersion,
                    type: '1',
                    from: from
                };
                dashixiong.instertClickAppLink(argObj2,function(err2){
                    if(err2){
                        console.log(err2);
                        res.end(' ');
                        return;
                    }
                    //TODO 替换成服务器上的路径
                    res.download('/home/static/kaisa_static/dashixiong_static/apk/CallDashixiong1.9.apk',function(err){
                        if(err){
                            console.log('**********下载app报错************');
                            console.log(err);
                        }else{
                            console.log('*******一个用户正在下载app**********');
                        }
                    });
                });
            }

        });

    //获取日历计划
    app.get('/dashixiongwx/api/getPlans',
        function(req, res){
            var data = req.query.data,
                events = [];
            apis.getPlans(data, function(resp){
                resp.forEach(function(v, i){
                    events.push({
                        id : v.id,
                        title : v.title,
                        start : uutil.getDateByTimestamp( v.startTime ),
                        end : uutil.getDateByTimestamp( v.endTime ),
                        color : v.color ? v.color : ''
                    });
                });
                end(res, events );
            });
        });
    //保存日历计划
    app.post('/dashixiongwx/api/savePlan',
        middleware_load_user_by_wx_id,
        middleware_power.customer_service,
        function(req, res){
            var data = req.body.data;
            data.userId = req.cookies.user_id || 0;
            apis.savePlan(data, function(status){
                end(res, {
                    status : status,
                    msg : 'success'
                })
            });
        });
    //更新日历数据
    app.post('/dashixiongwx/api/updatePlan',
        middleware_load_user_by_wx_id,
        middleware_power.customer_service,
        function(req, res){
            var data = req.body.data;
            data.userId = req.cookies.user_id || 0;
            apis.updatePlan(data, function(status){
                end(res, {
                    status : status,
                    msg : 'success'
                })
            });
        });
    //删除日历数据
    app.post('/dashixiongwx/api/delPlan',
        middleware_load_user_by_wx_id,
        middleware_power.customer_service,
        function(req, res){
            var data = req.body.data;
            apis.delPlan(data, function(status){
                end(res, {
                    status : status
                })
            });
        });
    //更新日历颜色
    app.post('/dashixiongwx/api/updatePlanColor',
        middleware_load_user_by_wx_id,
        middleware_power.customer_service,
        function(req, res){
            var data = req.body.data;
            data.userId = req.cookies.user_id;
            apis.updatePlanColor(data, function(status){
                end(res, {
                    status : status
                })
            });
        });


    //发起微信支付请求-获取请求配置参数 add by lufeng
    /*var Payment = require('wechat-pay').Payment;
    var initConfig = {
        partnerKey: "fd48420c58c2f04f50f7e4364d2014de",
        appId: "wx7b52fd89b4cf460f",
        mchId: "1233910802",
        notifyUrl: "/dashixiongwx/shop/addr/confirm",
        pfx: fs.readFileSync(path.join(__dirname, '../cert/apiclient_cert.p12'))
    };
    var payment = new Payment(initConfig);*/
    var wechat_pay_config = require('../lib/wechat_pay_config'),
        payment = wechat_pay_config.getPayment(),
        initConfig = wechat_pay_config.getWechatPayConfig();
    app.post('/dashixiongwx/api/wcpay/getBrandWCPayRequest',
        function(req,res){
            var arg_order = req.body.order;
            //验证签名
            var wechatsign_cookie = req.cookies.wechatsign;
            var wechatPay_orderId = {
                order_id: arg_order.order_id,
                wx_id: arg_order.wx_id,
                pay_way: arg_order.pay_way,
                shop_id: arg_order.shop_id,
                total_pay: arg_order.ttp,
                appToken: conf.wxs.hjdsx.wx_app_token,
                appId: conf.wxs.hjdsx.wx_app_id
            };
            var wechatPay_secret = "dashixiong_store";
            var wechatsign = uutil.makeSig(wechatPay_orderId,wechatPay_secret);
            if(wechatsign != wechatsign_cookie){
                res.end('fail');
                return;
            }

            var order = {
                body: '呼叫大师兄订单',
                attach: '{"订单详情":"无订单详情","shop_id":"'+arg_order.shop_id+'"}',
                out_trade_no: arg_order.order_id,
                total_fee: (arg_order.ttp-0).toFixed(2)*100,
                spbill_create_ip: '127.0.0.1',
                openid: arg_order.wx_id,
                trade_type: 'JSAPI'
            };
            console.log('*********微信在线支付订单******');
            console.log(order);
            payment.getBrandWCPayRequestParams(order, function(err, payargs){
                if(err){
                    console.log('***********微信支付错误**********');
                    console.log(err);
                    res.end('fail');
                    return;
                }
                console.log('*****微信支付无错误**********');
                res.json(payargs);
            });
    });

    //接收微信付款确认请求 add by lufeng
    var middleware_wechat = wechat_pay_config.getMiddleware();
    app.use('/dashixiongwx/order/finish_wcpay', middleware_wechat(initConfig).getNotify().done(function(message, req, res, next){
        var openid = message.openid;
        var order_id = message.out_trade_no;
        var attach = message.attach;
        try{
            //业务逻辑
            console.log('***********接受微信付款确认请求**********');
            console.log('***********openid = ' + openid);
            console.log('***********order_id = ' + order_id);
            console.log('***********attach = ' + attach);
            var args = {
                payStatus: 1,
                orderId: order_id,
                orderStatus: 0
            };
            dashixiong.updateUserOrderPayStatus(args, function(err, ret){
                if(err){
                    console.log('********微信支付确认修改订单状态出错************');
                    console.log(err);
                    return;
                }
                var p = {
                    shop_id : attach.shop_id,
                    title : 'wx_id = '+openid+' 下了一个单, 别让人家等太久',
                    message : '微信支付订单 , 赶快送货呀~',
                    wechat: 'wechat'
                };
                alarmAdmin(p);
                console.log('**********订单：' + order_id + '的状态已改为 ' + (args.payStatus==1)?'微信支付':'货到付款');
                res.reply('success');
            });
        }catch (e){
            console.log('***********接受微信付款确认请求>>>err**********');
            res.reply(e);
            console.log(e);
            return;
        }
    }));

    //TODO 微信退个款 add by lufeng
    //TODO 查询历史订单 add by lufeng
};




