var { picpick } = require('./src/picpick');
var fs = require('fs');
var path = require('path');
var fileType = require('file-type');
var config = require('./config');
var logger = require('./src/log');

//根据目录路径返回该路径下所有文件的路径, 递归, 同步写法, 这个file-type没有同步, 同步个屁, 递归加await头都大了
//不考虑报错?搞不死你
var minImageSize = 300000;
async function getImgsPath(dirPath) {
  var imgArr = [];
  try {
    var files = fs.readdirSync(dirPath);
  } catch (e) {
    logger.error(e);
  }
  // dirPath = path.resolve(__dirname, dirPath);
  await Promise.all(
    files.map(async (i) => {
      i = path.resolve(dirPath, i);
      var stat = fs.statSync(i);
      if (
        stat.isFile() &&
        ((await fileType.fromFile(i)).mime + '').indexOf('image') >= 0 &&
        stat.size < minImageSize
      ) {
        imgArr.push({ path: i, name: i.split('\\').pop(), size: stat.size / 1000 });
      } else if (stat.isDirectory()) {
        imgArr.push(...(await getImgsPath(i).catch(logger.error)));
        // getImgsPath(i);递归文件夹
      }
    })
  ).catch((i) => logger.error(i));
  return imgArr;
}
function getLowDir(dir) {
  var files = fs.readdirSync(dir);
  return files.map((i) => {
    var uploadUrl = config.qiniu.domain + i + config.qiniu.imageMagick;
    // path = path.resolve(dir, i);
    return { name: i, path: uploadUrl };
  });
}
function moveFile(imgArr) {
  var newDir = path.resolve(config.path.move);
  if (!fs.existsSync(newDir)) {
    fs.mkdirSync(newDir);
    fs.mkdirSync(config.path.out);
  }
  return imgArr.map((i) => {
    var newPath = path.resolve(newDir, i.name);
    fs.renameSync(i.path, newPath);
    logger.info(config.output.move(i.name, i.size));
    return { name: i.name, path: newPath, size: i.size };
  });
}
// var imgArr = getImgsPath(config.path.source)
//   .then((i) => picpick(moveFile(i)))
//   .catch(console.log);

module.exports = { getLowDir };
//流程: 获取图片路径, 上传, 用上传路径查询 sauce, ascii, 获取网页, 从网页中读取图片链接, 然后用图片链接下载, 填充图片信息
