var express = require('express');
var RedisStore = require('connect-redis')(express);
var cache = require( '../lib/cache' );

var redis_ip='127.0.0.1',
    redis_port ='6379' ;

//var store = new RedisStore();

/*
var app;
app = module.exports = express.createServer();

app.use(express.session({
    secret: 'wefew',
    store:  new RedisStore({
        host:   redis_ip,
        port:   redis_port
    }),
}));


app.get('/redisses',function(req,res){
    req.session.user = 'auscar';
    res.send(req.session.user);
});

app.get('/checkses',function(req,res){
    console.log(req.session.user);
});

app.listen( 9999 );
*/
