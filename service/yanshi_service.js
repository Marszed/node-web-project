var yanshi = require('../controllers/yanshi'),
    util = require('../lib/util');

var sureObj = util.sureObj,
    sureAry = util.sureAry;

var render = util.render;

exports.route = function(app){

    app.get('/dashixiongwx/choujiang', function(req, res){
        var start = '2014-10-28 00:00:00',
            end = '2014-10-30 00:00:00',
            start_int = '1414425600000', //2014-10-28 00:00:00
            end_int = '1414598400000'; //2014-10-30 00:00:00
        yanshi.choujiang({start:start, end:end, start_int:start_int, end_int:end_int}, function(ids){
            render(req, res, 'yanshi/choujiang', {
                layout : false,
                userIds : ids
            });
        });
    });

};
