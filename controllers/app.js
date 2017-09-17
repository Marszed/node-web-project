/**
 * Created by zed on 14-11-17.
 */
var request = require('request');
var accounter = require('../controllers/accounter');
var dao = require('../models/dao');
var asyncMgr = require('../lib/asyncMgr');
var hash = require( '../lib/md5' );
var conf = require('../conf');
var products = require('../res/products');
var fs = require('fs');
var df = require( '../lib/date.format' );
var uutil = require('../lib/util');

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'dashixiong.js');
var ld = uutil.getLogger('DEBUG', 'dashixiong.js');
var sureObj = uutil.sureObj,
    sureAry = uutil.sureAry;

var map = {};

exports.ready = function(fn){
    fn();
};