var uutil = require('../lib/util');
var asyncMgr = require('../lib/asyncMgr');
var dashixiong = require('../controllers/dashixiong');
var accounter = require('../controllers/accounter'),
    community = require('../controllers/community');
var hash = require( '../lib/md5' );
var conf = require('../conf');
var md = require('node-markdown').Markdown;
var formidable = require('formidable');
var API = require('wechat').API;
var api = new API(conf.wx.wx_app_id, conf.wx.wx_app_secret),
    sureAry = uutil.sureAry,
    sureObj = uutil.sureObj;

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'community_service.js');
var ld = uutil.getLogger('DEBUG', 'community_service.js');

var end = uutil.end; 
var render = uutil.render; 

//--------------------------- 中间件 ---------------------------//
var middleware_load_user_by_wx_id = require( '../lib/middleware_load_user_by_wx_id' );
var middleware_load_user_by_user_id = require( '../lib/middleware_load_user_by_user_id' );
var middleware_power = require('../lib/middleware_power');//这个模块里面有各种权限的中间件

exports.route = function(app){

    //类中间件: 看到路由中含有的shop_id, 就直接加载shop 的各种参数
    //app.param('wx_id', function (req, res, next){
    //    var wx_id = req.params.wx_id;
    //    dashixiong.getUserByWxId(wx_id, function(err, ret){
    //		if(err){
    //			ld.debug(err);
    //			res.send(502);
    //			return;
    //		}
    //        var user = ret[0];
    //        if( !user ){
    //            next();
    //            return;
    //        }
    //
    //        req.user = user;//把user对象装入request, 方便后续的handler取用
    //        //好, 接下来继续获取这个店的所有配置
    //		dashixiong.getConfigOfShop(user.shopId, function(err, config){
    //			if(err){
    //				ld.debug(err);
    //                res.end(502);
    //                return;
    //			}
    //            var shop_conf = {};
    //            config.forEach(function (obj, i) {
    //                shop_conf[ obj.settingKey ] = obj.settingValue;
    //            })
    //            req.shop_conf = shop_conf
    //            next();
    //        });//end getConfigOfShop
    //    });//end getUserByWxId
    //
    //});

    //ticket合法时, 获取cache中的user对象
    var i_need_auth_user_middleware = function (req, res, next) {
        var user_id = req.cookies.user_id;
        var ticket = req.cookies.wx_dsx_ticket;

        console.log( '==============================user_id', user_id );
        console.log( '==============================ticket', ticket );

        if( !user_id || !ticket ){
            console.log( '==============================这是一个游客在访问, next ' );
            req.user = {};
            next();
            return;
        }

        dashixiong.getUserById( user_id, function (err, ret){
            if( err ){
                next();
                return;
            }
            var user = ret[0];
            if( !user ) next();

            accounter.isTicketAvailableForUserId( ticket, user_id, function (err, isAvailable, user_in_cache) {
                if( isAvailable ){
                    req.user = user_in_cache;
                }
                //票是不合法的, 不能取得用户信息给TA
                next();
            });
        });

    };

    //由于微信与服务器之间没有cookie, 没有办法确认身份
    var session_middleware = require('../lib/middleware_session');

    //社区首页就是文章首页
    app.get('/dashixiongwx/community/:wx_id', function(req, res){
        var wx_id = req.params.wx_id;

        dashixiong.listArticles(function(err, articles){
            articles.forEach(function(article, i){
                article.intime = uutil.getTimeTxt( article.timeStamp );
            });
            render(req, res, 'community/community_home', {
                layout : 'community/layout',
                articles : articles
            });
        });
    });

    var get_default_category_middleware = function(req, res, next){
        dashixiong.selectArticleCategory(function(err,_ArticleCategory){
            if (err)  console.log(err);
            req.categorys = sureAry(_ArticleCategory); //将返回的数据挂在到req.categorys上，sureAry()用以确保返回的数据为数组
            next();
        });
    };

    //社区首页就是文章首页
    app.get('/dashixiongwx/shop/:shop_id/community',
        session_middleware,
        i_need_auth_user_middleware,
        middleware_load_user_by_wx_id,
        get_default_category_middleware,
        function(req, res){
            var wx_id = req.query.wx_id;
            var shop_id = req.params.shop_id;
            var isAjax = req.query.isAjax;
            var start = req.query.start || 0;
            var length = req.query.length || 10;
            var a = new asyncMgr.AsyncAction(),
                articles,
                ArticleCategory = req.categorys;
            var category = req.query.category || (ArticleCategory.length > 0 ? ArticleCategory[0].id : 0);

            a.register('get articles');

            a.onAllDone = function(){
                render(req, res, 'community/community_home', {
                    layout : 'community/layout',
                    articles : articles,
                    ArticleCategory:ArticleCategory,
                    user : req.user,
                    wx_id : wx_id,
                    style : 'community-home',
                    script : 'community-home',
                    nextIndex : 0 + articles.length
                });
            };

            if( isAjax ){
                dashixiong.listArticlesStartFromByLength(shop_id,category, start-0, length-0, function(err, articles){
                    if( err ){
                        end(res, []);
                        return;
                    }
                    articles.forEach(function(article, i){
                        article.intime = uutil.getTimeTxt( article.lastUpdateTimeStamp.getTime() );
                    });
                    end(res, articles);
                });
                return;
            }

            dashixiong.listArticlesStartFromByLength(shop_id,category, 0, 20, function(err, _articles){
                if(err){
                    ld.debug( err );
                    a.thisDone('get articles');
                    return;
                }
                articles = _articles;
                articles.forEach(function(article, i){
                    article.intime = uutil.getTimeTxt( article.lastUpdateTimeStamp.getTime() );
                });
                a.thisDone('get articles');
            });
        });



    //社区发帖
    app.get('/dashixiongwx/shop/:shop_id/community/post', function(req, res){
        var user_id = req.cookies.user_id;//用户id
        var dsx_wx_t = req.cookies.dsx_wx_t;//票
        var wx_id = req.query.wx_id;
        render(req, res, 'community/community_post', {
            layout : 'community/layout',
            style : 'community-post',
            script : 'community-post',
            wx_id : wx_id
        });

    });
    //社区发帖提交
    app.post('/dashixiongwx/shop/:shop_id/community/nick', function(req, res){
        var user_id = req.cookies.user_id;//用户id
        var dsx_wx_t = req.cookies.dsx_wx_t;//票
        var content = req.body.nick;
        var url = req.body.url;

        dashixiong.updateUser({
            id : user_id,
            nick : nick
        }, function (err, ret) {
            render(req, res, 'community/wx_redirect', {
                layout : 'community/layout',
                url : url
            });
        });
    });




    /*社区发帖提交====================zed_star=====暂时取消了社区发帖，上传图片的功能============dao层的img字段取消了插入===================*/
    app.post('/dashixiongwx/shop/:shop_id/community/dopost',
        i_need_auth_user_middleware,
        function (req, res) {
            var dir = '/home/uploads/dashixiong/article';//页面从服务器拿文件的路径
            if( uutil.isInDevelopment()){//开发环境如果是MacOS, 竟然叫做'darwin'
                dir = '/home/zed/uploadimg/articles/';//上传文件存储到本地的文件路径
            }
            var form = new formidable.IncomingForm();
            form.uploadDir = dir;
            form.keepExtensions = true;
            form.parse(req, function (err, fields, files) {

                /*var img_name = files.img.path;*/  //定义页面传入的图片名    取消社区发帖上传图片的字段
                /*img_name= img_name.substr(dir.length);*///将图片的路径截掉    取消社区发帖上传图片的字段
                var user_id = req.cookies.user_id;//用户id
                var dsx_wx_t = req.cookies.dsx_wx_t;//票
                var content = fields.content,
                    wx_id = req.query.wx_id;
                      var title = content.replace(/!\[.+\]\(.+\)/ig, '');//把图片都去掉
                title = title.substr(0, 10);
                title = uutil.trim( title );
                if(!title){
                    title = '[奇图共赏]';//如果文章为空则显示[奇图共赏]
                }
                var article = { //文章这个对象具有的属性
                    shop_id : req.params.shop_id,
                    user_id : user_id,
                    author : req.user.nick,
                    /*img: img_name,*/          //取消社区发帖上传图片的字段
                    title : title,
                    content : content,
                    intime : new Date().getTime()
                };
                    dashixiong.insertArticle(article, function (err, ret) {        //将article插入数据库中
                        if (!err) {
                            render(req, res, 'community/community_post_sus', {
                                layout: 'community/layout',
                                insert_id: ret.insertId,
                                wx_id: wx_id
                            });
                            return;
                        }
                        ld.debug(err);
                    });
            });


        });
    /*社区发帖提交====================zed_end===================暂时取消了社区发帖，上传图片的功能=====dao层的img字段取消了插入==========*/

    var notifyByWx = function (obj, fn) {
        var from_user_id = obj.from_user_id;
        var to_user_id = obj.to_user_id;

        if( from_user_id == to_user_id ){
            return;
        }

        dashixiong.getUserById( to_user_id, function (err, ret) {
            if( err ){
                return;
            }
            var user = ret[0];
            if( !user )return;
            console.log( 'to ', user.openId );
            api.sendText(user.openId, obj.content, function (err, ret) {
                console.log( '发送微信通知的结果是: ', ret );
            });
        });
    };
    //评论
    app.post('/dashixiongwx/shop/:shop_id/community/comment', function(req, res){
        var user_id = req.cookies.user_id;//用户id
        var author_id = req.body.author_id;//作者id
        var dsx_wx_t = req.cookies.dsx_wx_t;//票
        var article_id = req.body.article_id;
        var content = req.body.content;

        var comment = {
            shop_id : req.params.shop_id,
            user_id : user_id,
            article_id : article_id,
            content : content
        };
        community.insertComment(comment, function (err, ret) {
            comment.intime = uutil.getTimeTxt( new Date().getTime() );
            dashixiong.getUserById(user_id, function(err, ret){
                var user = sureObj(ret);
                comment.head = user.head;
                comment.nick = user.nick;
                end(res, {
                    code : 0,
                    msg : 'sus',
                    comment : comment
                });
            });

            //搞一个通知
            notifyByWx({
                from_user_id : user_id,
                to_user_id : author_id,
                content : '你在社区发布的帖子太有料了好吗!? 收到了小伙伴们热烈的回应:“'+ content +'” <a href="http://www.ksmimi.com/dashixiongwx/shop/'+ req.params.shop_id +'/article/'+ article_id +'">点击查看</a>'
            });
        });
    });

    //查看文章功能
    app.get('/dashixiongwx/shop/:shop_id/article/:id', i_need_auth_user_middleware, function(req, res){
        var article_id = req.params.id;
        var article;
        var comments = [];
        var likes = [],
            wx_id = req.query.wx_id;

        var a = new asyncMgr.AsyncAction();
        a.register( 'increaseArticleViewCount' );
        a.register( 'listComments' );
        a.register( 'getLikes' );

        a.onAllDone = function () {
            article.content = article.content || '';

            article.intime = uutil.getTimeTxt( article.timeStamp );
            article.content = md(article.content);//Markdown 解析一下
            render(req, res, 'community/article_detail', {
                layout : 'community/layout',
                title : article.title + '-大师兄社区',
                article : article,
                style : 'community-detail',
                script : 'community-detail',
                wx_id : wx_id,
                comments : comments,
                staticheads : 'http://img.ksmimi.com/uploads/heads/',//http://img.ksmimi.com/grab_img/本地配置的路径
                defaultheads : 'http://s.ksmimi.com/dashixiong_static/img/default-p-pic.jpg',
                likes : likes
            });
        };

        community.increaseArticleViewCount( article_id, function (err, ret){
            community.getArticleById(article_id, function(err, ret){
                if(err){
                    a.thisDone( 'increaseArticleViewCount' );
                    ld.debug(err);
                    return;
                }
                article = sureObj(ret);
                a.thisDone( 'increaseArticleViewCount' );
            });
        });

        community.listComments( article_id, function (err, _comments) {
            if( err ){
                a.thisDone( 'listComments' );
                ld.debug(err);
                return;
            }
            _comments.forEach(function (comment, i) {
                comment.intime = uutil.getTimeTxt( comment.timeStamp );
            });
            comments = _comments;
            a.thisDone( 'listComments' );
        });

        dashixiong.getLikesOfArticle( article_id, function (err, _likes) {
            if( !err ) {
                likes = _likes;
            }
            a.thisDone( 'getLikes' );
        });

    });

    //赞功能
    app.get('/dashixiongwx/shop/:shop_id/community/article/:article_id/like', i_need_auth_user_middleware, function(req, res){
        dashixiong.likeArticle({
            article_id : req.params.article_id,
            user_id : req.cookies.user_id
        }, function (err, ret) {
            if( !err ){
                end(res, {
                    code : 0
                });
                return;
            }
            end(res, {
                code : 1,
                msg : 'maybe already liked'
            });
        });
    });


    //编辑文章
    app.get('/dashixiongwx/admin/shop/:shop_id/article/edit/:id',
        middleware_power.worker,
        function (req, res) {
            var id = req.params.id;

            community.getArticleById(id, function (err, ret) {
                if (!err) {
                    article = ret[0];

                    render(req, res, 'admin/edit_article', {
                        layout: 'admin/layout',
                        article: article
                    });
                    return;
                }
                ld.debug(err);
            });
        });

    //删除文章
    app.get('/dashixiongwx/admin/shop/:shop_id/article/del/:id',
        middleware_power.worker,
        function (req, res) {
            var id = req.params.id,
                shop_id = req.params.shop_id;

            community.delArticleById(id, function (err, ret) {
                if (!err) {
                    res.redirect('/dashixiongwx/admin/shop/'+ shop_id +'/article/list');
                    return;
                }
                ld.debug(err);
            });
        });

    //文章按照内容分类
    app.post('/dashixiongwx/admin/shop/:shop_id/article/update/categroy',
        middleware_power.worker,
        function(req, res){
        var id = req.body.id,
            category = req.body.catetory;
        community.updateArticleCategory(id,category,function(err, ret){
            if(!err){
                res.redirect('/dashixiongwx/admin/shop/'+ req.params.shop_id +'/article/list');
                return;
            }
            ld.debug(err);
        });

    });

    //设置文章所属店铺号
    app.post('/dashixiongwx/admin/shop/:shop_id/article/update/shopID',
        middleware_power.worker,
        function(req, res){
            var id = req.body.id,
                shopId = req.body.shopId;
            community.updateArticleShopId(id,shopId,function(err, ret){
                if(!err){
                    res.redirect('/dashixiongwx/admin/shop/'+ req.params.shop_id +'/article/list');
                    return;
                }
                ld.debug(err);
            });
        });

    //添加文章的分类
    app.post('/dashixiongwx/admin/shop/article/update/category',
        middleware_power.worker,
        function(req, res){
            var categoryValue = req.query.categoryValue;

            community.addArticleCategory(categoryValue,function(err, ret){
                if(err){

                }
            });
    });

};//end route
