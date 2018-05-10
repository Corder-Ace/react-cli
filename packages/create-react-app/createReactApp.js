'use strict';

const validateProjectName = require('validate-npm-package-name');
const chalk = require('chalk');
const commander = require('commander');
const fs = require('fs-extra');
const path = require('path');
const execSync = require('child_process').execSync;
const spawn = require('cross-spawn');
const semver = require('semver');
const dns = require('dns');
const tmp = require('tmp');
const unpack = require('tar-pack').unpack;
const url = require('url');
const hyperquest = require('hyperquest');
const envinfo = require('envinfo');
const os = require('os');
//const findMonorepo = require('react-dev-utils/workspaceUtils').findMonorepo;
const packageJson = require('./package.json');


const errorLogFilePatterns = [
    'npm-debug.log',
    'yarn-error.log',
    'yarn-debug.log',
];

//项目名称
let projectName;

const program = new commander.Command(packageJson.name)
    .version(packageJson.version) // -v时输出版本信息
    .arguments('<project-directory>') //使用create-react-app <my-project>尖括号中的参数
    .usage(`${chalk.green('<project-directory>')} [options]`) // 使用create-react-app第一行打印的信息，也就是使用说明
    .action(name => {
        projectName = name //此处action函数的参数就是之前argument中的<project-directory> 初始化项目名称 --> 此处影响后面
    })
    .option('--verbose', '输出额外的日志信息')
    .option('--info', '打印本地开发环境信息')
    .option(
        '--scripts-version <alternative-package>',
        '指定react-scripts'
    )
    .option('--use-npm') //是否使用npm 默认使用yarn
    .allowUnknownOption() //允许无效的option
    .on('--help', () => {
        console.log(`${chalk.green('<project-directory>')} 为必填参数`);
        console.log();
        console.log(
            `    自定义的 ${chalk.cyan('--scripts-version')} 可以是其中一个:`
        );
        console.log(`      - a specific npm version: ${chalk.green('0.8.2')}`);
        console.log(`      - a specific npm tag: ${chalk.green('@next')}`);
        console.log(
            `      - a custom fork published on npm: ${chalk.green(
                'my-react-scripts'
            )}`
        );
        console.log(
            `      - a local path relative to the current working directory: ${chalk.green(
                'file:../my-react-scripts'
            )}`
        );
        console.log(
            `      - a .tgz archive: ${chalk.green(
                'https://mysite.com/my-react-scripts-0.8.2.tgz'
            )}`
        );
        console.log(
            `      - a .tar.gz archive: ${chalk.green(
                'https://mysite.com/my-react-scripts-0.8.2.tar.gz'
            )}`
        );
        console.log(
            `    It is not needed unless you specifically want to use a fork.`
        );
        console.log();
        console.log(
            `    If you have any problems, do not hesitate to file an issue:`
        );
        console.log(
            `      ${chalk.cyan(
                'https://github.com/facebook/create-react-app/issues/new'
            )}`
        );
        console.log();
    })
    .parse(process.argv);//解析Node进程,如果没有这个选项,commander则不能监听(?使用)Node

console.log(program)
if (program.info) {
    console.log(chalk.bold('\n 系统信息如下:'))
    return envinfo
        .run(
            {
                System: ['OS', 'CPU'],
                Binaries: ['Node', 'npm', 'Yarn'],
                Browsers: ['Chrome', 'Edge', 'Internet Explorer', 'Firefox', 'Safari'],
                npmPackages: ['react', 'react-dom', 'react-scripts'],
                npmGlobalPackages: ['create-react-app'],
            },
            {
                clipboard: true,
                duplicates: true,
                showNotFound: true,
            }
        )
        .then(console.log)
        .then(() => console.log(chalk.green('复制到剪切板!\n')));
}