/**
 * 根据create-react-app源码自实现
 * index.js 主要负责检测node版本
 * package.json中 bin -> 启动create-react-app的命令 等价于执行 node index.js。
 */
'use strict';

//chalk负责将命令行中输出的信息变色
var chal = require('chalk')

var currentNodeVersion = process.versions.node;//返回node的版本信息,如果有多个就返回多个
var semver = currentNodeVersion.split('.');
var major = semver[0];

if(major < 4){
    console.error(
        chalk.red(
            `您的Node版本:${major}
            \n
            创建ReactAPP需要Node 4+
            \n
            请更新您的Node
            `
        )
    );
    process.exit(1);// 终止进程
}
//如果Node验证通过 则执行下文
require('./createReactApp');