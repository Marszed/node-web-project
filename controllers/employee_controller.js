var employeeDao = require('../models/employee_dao');

exports.register = function( obj, fn ){
    employeeDao.register( obj, fn);
};
exports.getShop = function( obj, fn ){
    employeeDao.getShop( obj, fn );
};
exports.getMaxId = function(fn){
    employeeDao.getMaxId(fn);
};
exports.updateJobTime = function(obj, fn){
    employeeDao.updateJobTime(obj, fn);
};