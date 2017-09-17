var middleware_power = require('../lib/middleware_power');//这个模块里面有各种权限的中间件
var uutil = require('../lib/util'),
    render = uutil.render;


exports.route = function (app) {
    //fullCalendar -- 用日历的方式现实工作计划
    app.get('/dashixiongwx/admin/shop/:shop_id/plans',
        middleware_power.customer_service,
        function(req, res){
            render(req, res, 'admin/plans', {
                layout: false
            });
        });
};
