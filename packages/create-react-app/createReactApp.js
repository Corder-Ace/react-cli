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
        '指定react-scripts版本'
    )
    .option('--use-npm') //是否使用npm 默认使用yarn
    .allowUnknownOption() //允许无效的option
    .on('--help', () => {
        console.log(`${chalk.green('<project-directory>')} 为必填参数`);
        console.log();
        console.log(
            `    自定义的 ${chalk.cyan('--scripts-version')} 可以是下列其中一个:`
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

if (typeof projectName === 'undefined') {
    console.error('请指定项目目录:')
    console.log(`
    ${chalk.cyan(program.name())} ${chalk.green('<project-directory>')}`);
    console.log();
    console.log('例子:');
    console.log(`
    ${chalk.cyan(program.name())} ${chalk.green('my-react-app')}
    `)
    console.log();
    console.log(`运行 ${chalk.cyan(`${program.name()} --help`)} 查看配置项.`);
    process.exit(1);
}

//打印验证结果
function printValidationResults(results) {
    if (typeof results !== 'undefined') {
        results.forEach(error => {
            console.error(chalk.red(`*${error}`));
        });
    }
}

//隐藏配置项
//这是用来指定react-script模板的,只推荐开发人员使用
const hiddenProgram = new commander.Command()
    .option(
        '--internal-testing-template <path-to-template>',
        '(internal usage only, DO NOT RELY ON THIS) ' +
        'use a non-standard application template'
    )
    .parse(process.argv);


createApp(
    projectName,
    program.verbose,
    program.scriptsVersion,
    program.useNpm,
    hiddenProgram.internalTestingTemplate
);

//创建项目的主函数
function createApp(name, verbose, version, useNpm, template) {
    const root = path.resolve(name)//项目根目录
    const appName = path.basename(root)//path.basename 会返回路径最根节点的文件名

    //检查项目名称是否合法
    checkAppName(appName);

    //这里的fs并非node原生的fs组件,该方法确保该名称的目录存在,如果不存在,则会自动创建一个
    fs.ensureDirSync(name);

    //检查目录是否安全,如果不安全则退出进程
    if (!isSafeToCreateProjectIn(root, name)) {
        process.exit(1);
    }

    console.log(`正在创建新的React app,请稍后...`);
    console.log();

    const packageJson = {
        name: appName,
        version: '0.1.0',
        private: true,
    };

    /**
     * JSON.stringify
     * #1 要序列化的对象
     * #2 如果该参数是一个函数，则在序列化过程中，被序列化的值的每个属性都会经过该函数的转换和处理；
     * 如果该参数是一个数组，则只有包含在这个数组中的属性名才会被序列化到最终的 JSON 字符串中；
     * 如果该参数为null或者未提供，则对象所有的属性都会被序列化；关于该参数更详细的解释和示例
     * #3 指定缩进用的空白字符串
     */

    /**
     * os.EOL:一个字符串常量,定义操作系统相关的行末标志:
     * \n 在 POSIX 系统上
     * \r\n 在 Windows系统上
     */
    fs.writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify(packageJson, null, 2) + os.EOL
    );

    //是否使用Yarn 
    //shouldUseYarn:检测Yarn
    const useYarn = useNpm ? false : shouldUseYarn();
    //缓存当前目录,为了方便之后使用 process.cwd() --> 返回当前目录
    const originalDirectory = process.cwd();
    //切换到root路径
    process.chdir(root);
    //如果不使用Yarn并且NPM检测未通过则退出进程
    if (!useYarn && !checkThatNpmCanReadCwd()) {
        process.exit(1);
    }
    //比较Node版本,小于6的时候发出警告
    if (!semver.satisfies(process.version, '>=6.0.0')) {
        console.log(
            chalk.yellow(`您正在使用一个低版本的Node(< 6),该项目将使用一个旧的不受支持的工具版本进行引导
            请更新到Node 6或更高版本，以获得更好、完全支持的体验。
            `));

        version = 'react-scripts@0.9.x';
    }

    if (!useYarn) {
        const npmInfo = checkNpmVersion();
        if (!npmInfo.hasMinNpm) {
            if (npmInfo.npmVersion) {
                console.log(
                    `Node版本过低,请更新!`
                )
            };
        }
        version = 'react-scripts@0.9.x';
    }
    //
    run(root, appName, version, verbose, originalDirectory, template, useYarn);
}

//检查appName是否合法(npm包标准)
function checkAppName(appName) {
    const validationResult = validateProjectName(appName);
    if (!validationResult.validForNewPackages) {
        console.error(`不能创建项目名称为
        ${chalk.red(`"${appName}"`)}
        的项目,因为项目名称不合符npm标准
        `)
        printValidationResults(validationResult.errors);
        printValidationResults(validationResult.warnings);
        process.exit(1);
    }

    //定义依赖项
    const dependencies = ['react', 'react-dom', 'react-scripts'].sort();
    if (dependencies.indexOf(appName) >= 0) {
        console.error(
            chalk.red(
                `不能创建项目名称为${chalk.red(`"${appName}"`)}的项目,因为存在一个同名的依赖项`
            ) +
            chalk.cyan(dependencies.map(depName => `\n${depName}`).join('\n')) +
            chalk.red('\n\n 请输入一个与上述依赖不同的项目名.')
        );
        process.exit(1);
    }
}

//在当前目录下创建的项目是否安全
function isSafeToCreateProjectIn(root, name) {
    //要验证的文件名list
    const validFiles = [
        '.DS_Store',
        'Thumbs.db',
        '.git',
        '.gitignore',
        '.idea',
        'README.md',
        'LICENSE',
        'web.iml',
        '.hg',
        '.hgignore',
        '.hgcheck',
        '.npmignore',
        'mkdocs.yml',
        'docs',
        '.travis.yml',
        '.gitlab-ci.yml',
        '.gitattributes',
    ];

    console.log();

    //排斥文件
    const conflicts = fs
        .readdirSync(root)
        .filter(file => !validFiles.includes(file))//返回所有validFiles中不存在的文件
        .filter(file => !errorLogFilePatterns.some(pattern => file.indexOf(pattern) === 0))//寻找是否有与errolog中相同的文件,如果没有则返回false,一旦有一个符合条件则立即返回true

    //如果存在排斥文件
    if (conflicts.length > 0) {
        console.log(`该目录下存在排斥文件:`);
        console.log();
        //这里说明一下,for-of不是随便用的,只有在支持生成器和迭代器的对象中才可以使用
        for (const file of conflicts) {
            console.log(`${file}`);
        }
        console.log();
        console.log('可以尝试使用新的目录名，或者删除上面列出的文件。');
        return false
    }
    console.log(root)
    //从之前的安装目录中删除残余的文件
    const currentFiles = fs.readdirSync(path.join(root));
    currentFiles.forEach(file => {
        errorLogFilePatterns.forEach(errorLogFilePattern => {
            if (file.indexOf(errorLogFilePattern) === 0) {
                //删除残余文件
                fs.removeSync(path.join(root, file));
            }
        });
    });
    return true;
}

//Yarn检测
function shouldUseYarn() {
    try {
        //execSync用于执行子进程
        execSync('yarnpkg --version', { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

//检测Npm是否可以读取当前进程目录
function checkThatNpmCanReadCwd() {
    const cwd = process.cwd;
    let childOutput = null;

    try {
        //相当于执行`npm config list`并将其输出的信息组合成为一个字符串
        childOutput = spawn.sync('npm', ['config', 'list']).output.join('');
    } catch (err) {
        return true
    }

    if (typeof childOutput !== 'string') {
        return true;
    }

    const lines = childOutput.split('\n');
    const prefix = '; cwd = ';
    const line = lines.find(line => line.indexOf(prefix) === 0);

    if (typeof line !== 'string') {
        return true;
    }

    const npmCWD = line.substring(prefix.length);
    if (npmCWD === cwd) {
        return true;
    }

    console.error(
        chalk.red(
            `npm没有在正确的目录下执行`
        )
    );

    //windows情况下
    if (process.platform === 'win32') {
        console.error(
            chalk.red(`On Windows, this can usually be fixed by running:\n\n`) +
            `  ${chalk.cyan(
                'reg'
            )} delete "HKCU\\Software\\Microsoft\\Command Processor" /v AutoRun /f\n` +
            `  ${chalk.cyan(
                'reg'
            )} delete "HKLM\\Software\\Microsoft\\Command Processor" /v AutoRun /f\n\n` +
            chalk.red(`Try to run the above two lines in the terminal.\n`) +
            chalk.red(
                `To learn more about this problem, read: https://blogs.msdn.microsoft.com/oldnewthing/20071121-00/?p=24433/`
            )
        );
    }
}

//检测Npm版本
function checkNpmVersion() {
    let hasMinNpm = false;
    let npmVersion = null;
    try {
        npmVersion = execSync('npm --version')
            .toString()
            .trim();
        hasMinNpm = semver.gte(npmVersion, '3.0.0');
    } catch (err) {
        // ignore
    }
    return {
        hasMinNpm: hasMinNpm,
        npmVersion: npmVersion,
    };
}

//运行
function run(root,
    appName,
    version,
    verbose,
    originalDirectory,
    template,
    useYarn) {
    const packageToInstall = getInstallPackage(version, originalDirectory);// 获取依赖包信息
    const allDependencies = ['react', 'react-dom', packageToInstall]; // 所有的开发依赖包

    console.log('正在安装依赖,这可能需要几分钟,请稍后...');

    //获取依赖包的原始名称并返回
    getPackageName(packageToInstall)
        .then(packageName =>
            //检查是否是离线模式
            checkIfOnline(useYarn)
                .then(isOnline => ({
                    isOnline: isOnline,
                    packageName: packageName,
                }))
        )
        .then(info => {
            //接收到上述结果
            const isOnline = info.isOnline;
            const packageName = info.packageName;
            console.log(
                `
                正在安装
                ${chalk.cyan('react')},
                ${chalk.cyan('react-dom')},
                ${chalk.cyan(packageName)}...
                `
            );
            console.log();
            //安装依赖
            return install(root, useYarn, allDependencies, verbose, isOnline)
                .then(() => packageName);
        })
        .then(packageName => {
            // 检查当前Node版本是否支持包 
            checkNodeVersion(packageName);
            // 检查package.json的开发依赖是否正常
            setCaretRangeForRuntimeDeps(packageName);
            // `react-scripts`脚本的目录
            const scriptsPath = path.resolve(
                process.cwd(),
                'node_modules',
                packageName,
                'scripts',
                'init.js'
            );
            const init = require(scriptsPath);
            //执行目录的拷贝
            init(root, appName, verbose, originalDirectory, template);
            //当react-script的版本为0.9.x时发出警告
            if (version === 'react-scripts@0.9.x') {
                console.log(
                    chalk.yellow(`您正在使用一个旧的不受支持的工具来引导,请更新您的Node>=6和npm>=3`)
                )
            }
        })
        //异常处理
        .catch(resson => { })
}
/**
 * @version 版本号
 * @originalDirectory 原始目录
 */
function getInstallPackage(version, originalDirectory) {
    let packageToInstall = 'react-scripts'//定义要安装的常量
    const validSemver = semver.valid(version);//校验版本号是否合法

    if (validSemver) {
        packageToInstall += `@${validSemver}`//合法的话执行，就安装指定版本
    } else if (version && version.match(/^file:/)) {
        // 不合法并且版本号参数带有`file:`执行以下代码，作用是指定安装包为我们自身定义的包
        packageToInstall = `file:${path.resolve(
            originalDirectory,
            version.match(/^file:(.*)?$/)[1]
        )}`;
    } else if (version) {
        // 不合法并且没有`file:`开头，默认为在线的`tar.gz`文件
        packageToInstall = version;
    }
}
/**
 * 返回一个正常的依赖包名
 * @param {*} installPackage 包名
 */
function getPackageName(installPackage) {
    if (installPackage.match(/^.+\.(tgz|tar\.gz)$/)) {
        return getTemporaryDirectory()
            .then(obj => {
                let stream;
                if (/^http/.test(installPackage)) {
                    //hyperquest:用于将http请求流媒体传输
                    stream = hyperquest(installPackage);
                } else {
                    stream = fs.createReadStream(installPackage);
                }
                return extractStream(stream, obj.tmpdir).then(() => obj);
            })
            .then(obj => {
                const packageName = require(path.join(obj.tmpdir, 'package.json')).name;
                obj.cleanup();
                return packageName;
            })
            .catch(err => {
                console.log(`无法提取包名:${err.message}`)
                const assumedProjectName = installPackage.match(
                    /^.+\/(.+?)(?:-\d+.+)?\.(tgz|tar\.gz)$/
                )[1];
                console.log(
                    `根据文件名, 如果它是 "${chalk.cyan(
                        assumedProjectName
                    )}"`
                );
                return Promise.resolve(assumedProjectName);
            })
    } else if (installPackage.indexOf('git+') === 0) {
        return Promise.resolve(installPackage.match(/([^/]+)\.git(#.*)?$/)[1]);
        // 此处为只有版本信息的时候的情况
    } else if (installPackage.match(/.+@/)) {
        return Promise.resolve(
            installPackage.charAt(0) + installPackage.substr(1).split('@')[0]
        );
        // 此处为信息中包含`file:`开头的情况
    } else if (installPackage.match(/^file:/)) {
        const installPackagePath = installPackage.match(/^file:(.*)?$/)[1];
        const installPackageJson = require(path.join(installPackagePath, 'package.json'));
        return Promise.resolve(installPackageJson.name);
    }
    // 什么都没有直接返回包名
    return Promise.resolve(installPackage);
}

/**
 * 检查是否使用离线安装 Yarn才有离线安装 
 * @param boolean useYarn 
 * @param dns 用来检测是否能够请求到指定的地址
 */
function checkIfOnline(useYarn) {
    if (!useYarn) {
        return Promise.resolve(true)
    }

    return new Promise(resolve => {
        dns.lookup('registry.yarnpkg.com', err => {
            let proxy;
            if (err != null && (proxy = getProxy())) {
                dns.lookup(url.parse(proxy).hostname, proxyErr => {
                    resolve(proxyErr == null);
                });
            } else {
                resolve(err == null);
            }
        })
    })
}
/**
 * 
 * @param {String} root 目录
 * @param {Boolean} useYarn 是否使用Yarn
 * @param {Array} dependencies 依赖
 * @param {String} verbose 
 * @param {Boolean} isOnline 
 */
function install(root, useYarn, dependencies, verbose, isOnline) {
    return new Promise((resolve, reject) => {
        let command;//定义一个命令
        let args; //定义一个命令参数

        //如果使用Yarn
        if (useYarn) {
            command = 'yarnpkg';//命令名称
            args = ['add', '--exact'];//命令参数的基础
            if (!isOnline) {
                args.push('--offline');//在args基础上增加离线模式
            }
            [].push.apply(args, dependencies);//组合参数和开发依赖 react react-dom react-scripts
            args.push('--cwd');//指定命令执行目录的地址
            args.push(root);//地址的绝对路径
            //在使用离线模式时会发出警告
            if (!isOnline) {
                console.log(chalk.yellow('脱机模式'));
                console.log(chalk.yellow('使用缓存'));
                console.log();
            }
        } else {
            //此处和上述一样,命令定义,参数组合
            command = 'npm';
            args = [
                'install',
                '--save',
                '--save-exact',
                '--loglevel',
                'error',
            ].concat(dependencies)
        }
        if (verbose) {
            args.push('--verbose');
        }
        console.log(args)
        // 这里就把命令组合起来执行
        const child = spawn(command, args, { stdio: 'inherit' });
        child.on('close', code => {
            //code为0代表正常关闭,不为0就打印错误
            if (code !== 0) {
                reject({
                    command: `${command} ${args.join(' ')}`,
                });
                return;
            }
            //正常继续往下执行
            resolve();
        })
    })
}
/**
 * 检查Node版本 react-scripts 依赖Node
 * @param {String} packageName 
 */
function checkNodeVersion(packageName) {
    //找到react-scripts的package.json路径
    const packageJsonPath = path.resolve(
        process.cwd(),
        'node_modules',
        packageName,
        'package.json'
    )
    console.log(packageJsonPath);
    //引入react-scripts的package.json
    const packageJson = require(packageJsonPath);
}


