var dao = require( '../models/dao' );

exports.insertTakeawayList = function (takeaway_list, fn) {
    dao.insertTakeawayList( takeaway_list, fn);
};
exports.delTakeawayList = function (takeaway_list_id, fn) {
    dao.delTakeawayList( takeaway_list_id, fn);
};
exports.getTakeawayListById = function (takeaway_list_id, fn) {
    dao.getTakeawayListById( takeaway_list_id, fn);
};
exports.listTakeaways = function (shop_id, fn) {
    dao.listTakeaways( shop_id, fn);
};
exports.updateTakeawayList = function (takeaway_list, fn) {
    dao.updateTakeawayList( takeaway_list, fn);
};
