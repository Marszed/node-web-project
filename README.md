# redis install (MAC)
1. download --> https://redis.io/download 官网下载
2. unZip --> tar -xzf redis-4.0.1.tar.gz
3. mv --> mv **/redis-*.*.*.tar.gz /user/local (没权限加sudo)
4. test --> make test
5. install --> sudo make install
6. redis start --> redis-server
启动成功的标识<br>
![](https://github.com/Marszed/vue-family-bucket/raw/master/gitImage/WechatIMG1.png)


## ======常用命令说明======

redis-server redis服务器
redis-cli redis客户端
redis-benchmark redis性能测试工具
redis-check-aof AOF文件修复工具
redis-check-rdb RDB文件修复工具