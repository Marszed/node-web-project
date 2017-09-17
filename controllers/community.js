var dao = require('../models/dao'),
    dao_community = require('../models/dao_community');

exports.getArticleById = function(id, fn){
	dao.getArticleById(id, fn);
};
exports.delArticleById = function(id, fn){
	dao_community.delArticleById(id, fn);
};

exports.increaseArticleViewCount = function (article_id, fn) {
    dao.increaseArticleViewCount( article_id, fn );
};

exports.insertComment = function (comment, fn) {
    dao.insertComment(comment, fn);
};

exports.listComments = function (article_id, fn){
    dao.listComments( article_id, fn);
};

//文章按照内容分类
exports.updateArticleCategory = function(id,category,fn){
    dao.updateArticleCategory(id,category,fn)
};
//文章按照ShopId分类
exports.updateArticleShopId = function(id,shopId,fn){
    dao.updateArticleShopId(id,shopId,fn);
};