//方法名字驼峰写法, 参数名称下划线写法. 数据库采用驼峰写法. 专有名词缩写首字母大写, 其他小写
//以后管理员相关的业务都要全部移动到这儿controller里来
var request = require('request');
var accounter = require('../controllers/accounter');
var dao = require('../models/dao_admin');
var asyncMgr = require('../lib/asyncMgr');
var hash = require( '../lib/md5' );
var conf = require('../conf');
var products = require('../res/products');
var fs = require('fs');
var df = require( '../lib/date.format' );
var uutil = require('../lib/util'),
    dashixiong = require('../controllers/dashixiong'),
    sureAry = uutil.sureAry,
    sureObj = uutil.sureObj;

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'controllers/admin.js');
var ld = uutil.getLogger('DEBUG', 'controllers/admin.js');

exports.listUserComments = function (user_id, fn) {
    dao.listUserComments( user_id, fn);
};
exports.listUsersComments = function (user_ids, fn) {
    dao.listUsersComments( user_ids, fn );
};

exports.insertComment = function (comment, fn) {
    dao.insertComment( comment, fn );
};
exports.delUserComment = function (comment_id, fn) {
    dao.delUserComment( comment_id, fn );
};

exports.getWarningList = function(shop_id, pids, fn){
    dao.getWarningList(shop_id, pids, fn);
};

exports.getPromotionList = function(promotion, fn){
    dao.getPromotionList(promotion, fn);
};

exports.getPossibleReach = function(shop_id, fn){
    dao.getPossibleReach(shop_id, fn);
};

exports.updatePossibleReach = function(possibleReach, fn){
    dao.updatePossibleReach(possibleReach, fn);
};

//获取管理员列表，即power>0的用户
exports.getMembers = function(fn){
    dao.getMembers(fn);
};

exports.setRemarkByRemark = function(remark, fn){
    remark = remark || {};
    dashixiong.getOrderById(remark.order_id, function (err, ret) {
        if ( !err ){
            order = sureObj(ret);
            var snapshot = uutil.strSnapshotToObj(order.snapshot);
            snapshot.remark = remark.content;
            snapshot = JSON.stringify(snapshot);
            dao.updateSnapshot(remark.order_id, snapshot, fn);
            return;
        }
        ld.debug(err);
    });
};

exports.copySectionsInfo = function(info, fn ){
    if( info.need_to_del>0 ) dao.delSectionsByShopId(info.cur_shop_id, function(err, ret){});
    dao.getSectionsByShopId(info.from_shop_id, function(err, ret){
        if( !err ){
            ret.forEach(function(elem,i){
                elem.className = elem.className || 'no';
                elem.short_title = elem.short_title || elem.name;
            });
            var sections = sureAry(ret);
            sections.forEach(function(section, i){
                dao.insertSectionInfo(section, info.cur_shop_id, function(err_insert, ret_insert){
                    if( err_insert ) console.log(err_insert);
                });
            });
        }
        fn && fn();
    });
};

exports.getShopRelation = function(shopId, fn){
    dao.getShopRelation(shopId, function(err, ret){
        if( !err ){
            fn && fn( sureObj(ret) );
            return;
        }
        console.log(err);
    });
};
exports.updateShopRelation = function(info, fn){
    dao.updateShopRelation(info, function(err, ret){
        fn && fn(err, sureObj(ret));
    });
};

exports.getWarehouseIds = function(req, res, next){
    var shop_id = req.params.shop_id,
        ids = [];
    dao.getWarehouseByShopId(shop_id, function(err, ret){
        if( !err ){
            ret.forEach(function(v, i){
                ids.push(v.id);
            });
            req.warehouseIds = ids;
            next();
            return;
        }
        ld.debug(err);
    })
};

//获取货架信息
exports.getAllSections = function(fn){
    dao.getAllSections(fn);
};

//根据区间得到某店下单用户id
exports.getUserByRange = function(start, end, shopId, fn){
    dao.getUserByTimeRange(start, end, shopId, function(err, ret){
        if( !err ){
            fn && fn(err,ret);
            return;
        }
        console.log(err);
    });
};
//根据区间得到某店某用户的订单
exports.getOrderByRange = function(start, end, shopId, userIds, fn){
    dao.getOrderByTimeRange(start, end, shopId, userIds, function(err, ret){
        if( !err ){
            fn && fn(err,ret);
            return;
        }
        console.log(err);
    });
};
exports.getYinYeVisCount = function(shop_id, timeStr1, timeStr2, fn){
    var newIdstmp = [];
    var newIds = [];
    var tmp = [];
    dao.getIdByTwoTime(shop_id, timeStr1, timeStr2, function(err, ret){
        if(!err){
            for(var i=0;i<ret.length;i++) {
                var idArray = ret[i].lValue.split('___');
                newIdstmp.push(parseInt(idArray[0]));//某天到店用户ids
            }
            //ids去重
            tmp = uutil.quchong(newIdstmp);
            if(tmp.length>0){
                dao.getPowerByUserId(tmp, shop_id, function(err, _powers){
                    if (!err && _powers) {
                        _powers.forEach(function (doEle, i) {
                            if ( doEle.power == 0 ) {
                                newIds.push(doEle.id);
                            }
                        });
                        fn && fn(err,newIds);
                    }else{
                        console.log(err);
                    }
                });
            }else{
                console.log('admin.js newIdstmp.length < 0'+err);
                fn && fn(err);
            }
        }else{
            console.log('admin.js getIdByTwoTime err'+err);
            fn && fn(err);
        }

    });
};
//统计道具、人品来源
exports.tool_rp = function(content, timeStamp, type, fn){
    dao.insertToolRPSystem(content, timeStamp, type, function(err, ret){
        if(!err){
            fn && fn(err, ret);
        }else{
            console.log('admin.js tool_rp'+err);
            fn && fn(err);
        }
    });
};
//得到某店所有货架上的产品ID
exports.getProductIdsByShopId = function(shopId, fn){
    var proIds = [];
    var exittpid_str = '';
    var idStr ;
    var temp = [];

    dao.getProIdByShopId(shopId, function(err, ret){
        if(!err){
            if(ret){
                ret.forEach(function(doEle, i){
                    if( JSON.parse(doEle.content).length ) {
                        exittpid_str += doEle.content.substring(1, doEle.content.length-1)+',';
                    }
                });
                exittpid_str = exittpid_str.substring(0, exittpid_str.length-1);
                idStr = '['+exittpid_str+']';
                temp = JSON.parse(idStr);
                proIds = uutil.quchong(temp);

                ret.forEach(function(doEle, i){
                    doEle.pids = proIds;
                });
            }
            fn && fn(err, ret);
        }else{
            console.log(err);
            fn && fn(err);
        }
    });
};
//得到某店的营业时间
exports.getBusinessTime = function(y, m, d, shopId, fn){
    var settingValueStr = '';
    var timeArr = [];
    dao.getBusinessTimeByshopId(shopId, function(err, business_time){
        if(!err){
            if(business_time) {
                settingValueStr = business_time[0].settingValue;
            }
            if(settingValueStr.indexOf('|') == -1) {
                var t = settingValueStr.split(',');
                var start = t[0];
                var end = t[1];
                var start_hours;
                var start_minutes;
                var end_hours;
                var end_minutes;

                if (start) {
                    start_hours = start.substr(0, 2) - 0;
                    start_minutes = start.substr(2, 4) - 0;
                } else {
                    start_hours = 00;
                    start_minutes = 00;
                }
                if (end) {
                    end_hours = end.substr(0, 2) - 0;
                    end_minutes = end.substr(2, 4) - 0;
                } else {
                    end_hours = 00;
                    end_minutes = 00;
                }
                if (end_hours == 24) {
                    end_hours = 23;
                    end_minutes = 59;
                }
                var t1 = y+'-'+m+'-'+d+' '+start_hours+':'+start_minutes+':'+'00';
                var t2 = y+'-'+m+'-'+d+' '+end_hours+':'+end_minutes+':'+'00';
                var timeStr1 = new Date(t1).getTime();
                var timeStr2 = new Date(t2).getTime();
                timeArr.push(timeStr1, timeStr2);
            }
            if(settingValueStr.indexOf('|') > 0) {
                var time = settingValueStr.split('|');
                var t1 = time[0];//上一段时间
                var t2 = time[1];//下一段时间

                var t1Arr = t1.split(',');
                var t1Arr_start = t1Arr[0];//上一段时间的开始时间
                var t1Arr_end = t1Arr[1];//上一段时间的结束时间
                var t1_startTimeStamp = y+'-'+m+'-'+d+' '+t1Arr_start.substr(0,2)+':'+t1Arr_start.substr(2,4)+':'+'00';
                var t1_endTimeStamp = y+'-'+m+'-'+d+' '+t1Arr_end.substr(0,2)+':'+t1Arr_end.substr(2,4)+':'+'00';
                var timeStr1 = new Date(t1_startTimeStamp).getTime();//上一段时间的开始时间戳
                var timeStr2 = new Date(t1_endTimeStamp).getTime();//上一段时间的结束时间戳

                var t2Arr = t2.split(',');
                var t2Arr_start = t2Arr[0];//下一段时间的开始时间
                var t2Arr_end = t2Arr[1];//下一段时间的结束时间
                var t2_startTimeStamp = y+'-'+m+'-'+d+' '+t2Arr_start.substr(0,2)+':'+t2Arr_start.substr(2,4)+':'+'00';
                var t2_endTimeStamp = y+'-'+m+'-'+d+' '+t2Arr_end.substr(0,2)+':'+t2Arr_end.substr(2,4)+':'+'00';
                var timeStr3 = new Date(t2_startTimeStamp).getTime();//下一段时间的开始时间戳
                var timeStr4 = new Date(t2_endTimeStamp).getTime();//下一段时间的结束时间戳
                timeArr.push(timeStr1,timeStr2,timeStr3,timeStr4);
            }

            fn && fn(err,timeArr);
        }else{
            console.log(err);
            fn && fn(err);
        }
    });
};
exports.getAppUserInfo = function(shop_id, stamp_start, stamp_end, fn){
    var appIds = [];
    var appNewIds = [];
    var appNewIdLen = 0;
    var appOrderNum = 0;
    var appInfo = {};
    dao.getAppUserIds(shop_id, stamp_start, stamp_end, function(err, ret){
        if(!err) {
            if(ret && ret.length>0){
                ret.forEach(function(doEle, i){
                    var idArray = doEle.lValue.split('___');
                    appIds.push(parseInt(idArray[0]));
                });

                if(appIds && appIds.length>0) {
                    dao.getAppPowerByUserId(appIds, shop_id, function(err, newIds){
                        if(!err){
                            if(newIds && newIds.length>0){
                                newIds.forEach(function(v, i){
                                    if(v.power == 0) {
                                        appNewIds.push(v.id);
                                    }
                                });
                                appNewIdLen = appNewIds.length;
                                var transObj = {
                                    start: stamp_start,
                                    end: stamp_end,
                                    shopId: shop_id,
                                    ids: appNewIds || []
                                };
                                if(appNewIds.length>0){
                                    dao.getOrderByIdArr(transObj, function(err, orderNum){
                                        if(!err){
                                            appOrderNum = orderNum.length;
                                        }
                                        appInfo.visitcount = appNewIdLen;
                                        appInfo.appOrderNum = appOrderNum;
                                        fn && fn(err, appInfo);
                                    });
                                }else{
                                    fn && fn();
                                }
                            }else{
                                fn && fn();
                            }
                        }else{
                            console.log(err);
                            fn && fn(err);
                        }
                    });
                }else{
                    fn && fn();
                }
            }else{
                fn && fn();
            }
        }else{
            console.log(err);
            fn && fn(err);
        }
    });
};