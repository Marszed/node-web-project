var fs = require('fs');
var uutil = require('../lib/util');
var dashixiong = require('../controllers/dashixiong');
var employee = require('../controllers/employee_controller');

//=============== 常用的工具方法 =================
var render = uutil.render; 
var end = uutil.end; 
var endErr = uutil.endErr; 


//中间件
var middleware_power = require( '../lib/middleware_power' );//这个模块里面有各种权限的中间件
var middleware_load_user_by_user_id = require('../lib/middleware_load_user_by_user_id');

exports.route = function(app){

app.get('/dashixiongwx/admin/shop/:shop_id/employee/list', function(req, res){
    dashixiong.listEmployee(req.params.shop_id, function (err, ret) {
        ret.forEach(function(v,i){
            if(!v.idCardNum||v.idCardNum==''){
                v.idCardNum = 0;
            }
        });
        render(req, res, 'admin/employee_list', {
            layout : true,
            employees : ret
        });
    });
});
app.get('/dashixiongwx/admin/shop/:shop_id/employee/add', function(req, res){
	render(req, res, 'admin/employee_add', {
		layout : true
	});
});
app.get('/dashixiongwx/admin/shop/:shop_id/employee/:employee_id/edit', function(req, res){
    var eid = req.params.employee_id;

    //获取员工信息
    dashixiong.getEmployee( eid,  function (err, ret) {
        render(req, res, 'admin/employee_edit', {
	    	layout : true,
            employee : ret[0]
	    });
    });
});
app.post('/dashixiongwx/admin/shop/:shop_id/employee/:employee_id/doedit', function(req, res){
    var employee = req.body.employee;

    //获取员工信息
    dashixiong.updateEmployee( employee,  function (err, ret) {
        res.redirect( '/dashixiongwx/admin/shop/'+ req.params.shop_id +'/employee/list' );
    });
});

app.post('/dashixiongwx/admin/shop/:shop_id/employee/doadd', function(req, res){
    dashixiong.insertEmployee( req.body.employee, function (err, ret) {
        if( err ){
            end( res, err );
            return;
        }
        res.redirect( '/dashixiongwx/admin/shop/'+ req.params.shop_id +'/employee/list' );
    });
});

//招聘员工信息
app.get('/dashixiongwx/shop/:shop_id/employee/register',
    middleware_load_user_by_user_id,
    function(req, res){
        var shopInfos= [];
        var user = req.user;
        var userId = user.id;
        var shopIds = [11,12,24];
        var obj = {
            shopIds: shopIds
        };
        res.cookie('wx_id', user.openId);
        employee.getShop(obj, function(err, ret){
            if(err){
                console.log(err);
                res.end('');
                return;
            }
            if(ret && ret.length>0) {
                ret.forEach(function(doEle, i){
                    var obj = {};
                    obj.shopId = doEle.id;
                    obj.shopName = doEle.name;
                    shopInfos.push(obj);
                });
                render(req, res, 'employee/employee_register', {
                    shopInfos: shopInfos,
                    userId: userId
                });
            }else{
                res.end(err);
            }
        });

    });
app.post('/dashixiongwx/shop/:shop_id/employee/doregister',
    function(req, res){
        var shopId = req.params.shop_id;
        var infos = req.body.info;
        var timeStamp = new Date().getTime();

        employee.register({infos: infos, timeStamp: timeStamp}, function(err, ret){
            if(err){
                end(res, err);
                return;
            }
            res.redirect('/dashixiongwx/shop/'+shopId+'/employee/jobtime');
        });
    });
app.get('/dashixiongwx/shop/:shop_id/employee/jobtime',
    function(req, res){
        render(req, res, 'employee/employee_jobtime', {});
    });
app.post('/dashixiongwx/shop/:shop_id/employee/dojobtime',
    function(req, res){
        var jobtime = JSON.stringify(req.body.time);

        employee.getMaxId(function(err, maxId){
            if(err){
                console.log(err);
                res.end('');
                return;
            }
            if(maxId && maxId.length>0) {
                var maxId = maxId[0].maxId;
                employee.updateJobTime({jobtime: jobtime, maxId: maxId}, function(err, ret){
                    if(err){
                        console.log(err);
                        res.end('');
                        return;
                    }
                    if(req.body.isAjax){
                        res.end('1');
                    }
                });
            }else{
                res.end('');
            }
        });
    });
app.get('/dashixiongwx/shop/:shop_id/employee/thanks',
    function(req, res){
        var wx_id = req.cookies.name;
        render(req, res, 'employee/employee_thanks', {
            wx_id : wx_id
        });
    });
//应聘类型
app.get('/dashixiongwx/shop/:shop_id/employee/type',
    middleware_load_user_by_user_id,
    function(req, res){
        var user = req.user;
        var userId = user.id;
        var wx_id = user.openId;
        var shopId = user.shopId;
        render(req, res, 'employee/employee_type',{
            userId : userId,
            wx_id : wx_id,
            shopId : shopId
        });
    });

    
};//end exports.route
