var app = require('./app');
var port = 6789;
app.listen(port);

console.log('========================================= server start ================================================');
console.log('dashixiong server start at ' + port);
console.log('========================================= server end ==================================================');


//捕获异常错误，避免进程挂掉
process.on('uncaughtException', function (exception) {
    console.log('========================================= exception start ================================================');
    console.log(exception);
    console.log('========================================= exception end ==================================================');
});
