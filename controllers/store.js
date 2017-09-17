var dao = require('../models/dao'),
    util = require('../lib/util');

var sureAry = util.sureAry,
    sureObj = util.sureObj;

//--------------------------- 日志配置 ---------------------------//
var li = util.getLogger('INFO', 'store.js');
var ld = util.getLogger('DEBUG', 'store.js');

exports.checkProduct = function(products, fn,obj){
    var ids = [],
        marker = {},
        prices = [],
        rate = 0.9;//nPin--折扣


    if( typeof products == 'string' ) products = JSON.parse(products);

    products.forEach(function (product, i) {
        //如果是6号店（呼叫大师兄）来的单，由于是拼餐，id有可能是“2194+2214”的形式
        if( typeof product.id == 'string' && product.id.indexOf('+') > -1 ){
            product.id.split('+').forEach(function(pid, i){
                if( !marker[pid] ){
                    ids.push(pid);
                    marker[pid] = true;
                }
            });
            return;
        }
        //来自大师兄小卖部的单
        ids.push(product.id);
    });
    dao.getProductsByIds(ids, function(err, ret){
        //TODO:临时处理货架上的产品促销，有待重构--add-by-lufeng
        dao.getAllSectionStrategy(function(err2, rows){
            if(!err2){
                var strategyMap = {};
                rows.forEach(function(row, i){
                    strategyMap[row.id] = JSON.parse((row.content)).rate;
                });
                var pds,
                    map = {},
                    total_pay = 0;

                if( !err ){
                    pds = sureAry(ret);
                    pds.forEach(function(pd, i){
                        map[ pd.id ] = pd.promotePrice || pd.price;
                        if(pd.productStrategyId && strategyMap[pd.productStrategyId] && !pd.promotePrice){
                            map[pd.id] = (strategyMap[pd.productStrategyId])*(pd.price);//有折扣直接给出折扣价
                        }
                    });
                    products.forEach(function(product, i){
                        var prices = [],
                            price = 0;
                        //6号店拼餐，所以有个判断
                        if( typeof product.id == 'string' && product.id.indexOf('+') > -1 ){
                            product.id.split('+').forEach(function(pid, i){
//                              prices.push( map[pid] );
                                price += map[pid];
                            });
                            product.price = price;
                        }else{
                            //来自小卖部的产品的价格
                            product.price = map[ product.id ];
                        }
                        total_pay += product.price;
                    });
                    fn && fn('sus', total_pay);
                    return;
                }
                ld.debug(err, total_pay);
                console.log(err);
                fn && fn('err');

            }
            console.log(err2);
        });

    }, obj);
};

//将section这个数组转成一个对象并返回
exports.formatSectionsToObj = function(sections, req){
    var json = {},
        types = [],
        secs = sections.concat([]);
    if( util.getCookieVersion(req) == '' && req.curShop.shopType=='store' ) secs.length = 1;
    sections.forEach(function(v, i){
        json[v.tagId] = v;
        types.push({
            tagId : v.tagId,
            tagName : v.tagName,
            product_num : v.products.length,
            tagShortTitle : v.tagShortTitle || v.tagName,
            className : v.className
        });
        if(v.className=='redemption'){//n元换购产品
            secs.push(v);
        }
    });
    return {
        sections : secs,
        section_types : types,
        sections_json : json
    };
};
