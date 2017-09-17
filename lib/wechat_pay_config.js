/**
 * Created by lufeng on 15-4-10.
 * 微信支付配置参数
 * 支付授权目录
 * http://www.ksmimi.com/dashixiongwx/
 * http://www.ksmimi.com/dashixiongwx/shop/
 * http://www.ksmimi.com/dashixiongwx/shop/addr/
 * 告警通知URL
 * http://www.ksmimi.com/dashixiongwx/shop/addr/
 *
 */
//发起微信支付请求-获取请求配置参数 add by lufeng
var fs = require('fs'),
    path = require('path');
var Payment = require('wechat-pay').Payment;
var middleware = require('wechat-pay').middleware;
var initConfig = {
    partnerKey: "fd48420c58c2f04f50f7e4364d2014de",
    appId: "wx7b52fd89b4cf460f",
    mchId: "1233910802",
//    notifyUrl: "http://www.ksmimi.com/dashixiongwx/shop/addr/confirm",
    notifyUrl: "http://www.ksmimi.com/dashixiongwx/order/finish_wcpay",
    pfx: fs.readFileSync(path.join(__dirname, '../cert/apiclient_cert.p12'))
};
var payment = new Payment(initConfig);

exports.getPayment  = function(){
    return payment;
};
exports.getWechatPayConfig = function(){
  return initConfig;
};

exports.getMiddleware = function(){
  return  middleware;
};