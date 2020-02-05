var { sauceResult, waitIpPool } = require('./sauce');
var { asciiResult } = require('./ascii2d');
var logger = require('./log');
var config = require('../config');
var { getUploadInfo, getImg, getSource } = require('./get');
var fs = require('fs');
var path = require('path');
var iqdbResult = require('./iqdb');

//在 provider 中最后返回的东西是一致的
const hostProvider = {
  sauce: sauceResult,
  ascii: asciiResult,
  iqdb: iqdbResult
};
process.env;
const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
//这里先默认sauce, 所有api返回的都是一定的格式, 这样探索最优的搜索方式时可以随意进行搭配, 高内聚低耦合
//方案: sauce,没找到,ascii特征,tineye找到尺寸最大的,返回ascii再搜
//实在找不到的就放入文件夹提示手动操作
//如果要说精确的话, iqdb最准, 其他两个则能找到相关作品
async function doSearch(imgURL, fileName, imgInfo) {
  var { similarity, source, code } = await hostProvider['sauce'](imgURL);

  if (similarity < 75) {
    if (typeof code === 'string') {
      imgInfo.searchSite.saucenao = code;
    } else {
      imgInfo.searchSite.saucenao = '文件 ' + fileName + ' 相似度小于60将自动切换为 ascii2d';
    }
    logger.warn(imgInfo.searchSite.saucenao);

    source = await hostProvider['ascii'](imgURL, fileName);
    if (typeof source.color == 'object') {
      imgInfo.searchSite.ascii2d = '文件' + fileName + ' ascii2d 没有找到, 转为iqdb查询';
      logger.warn(imgInfo.searchSite.ascii2d);
      source = await hostProvider['iqdb'](imgURL, fileName);
      if (typeof source !== 'string') {
        imgInfo.searchSite.iqdb = source.err;
        logger.warn(imgInfo.searchSite.iqdb);
        return imgInfo;
      }
      imgInfo.searchSite.iqdb = source;
      logger.info(`文件${fileName} 在 iqdb 找到了${source}`);
    } else {
      source = source.color;
      imgInfo.searchSite.ascii2d = source;
      logger.info(`文件${fileName} 在 ascii2d 找到了${source}`);
    }
  } else {
    imgInfo.searchSite.saucenao = source;
    logger.warn(`文件${fileName} sauceNao 相似度为${similarity} 开始下载`);
  }

  var urls = await getSource(source);
  if (urls.length <= 0) {
    imgInfo.download['err'] = [`${source} 中没有可供下载的图片,可能已被删除, 用iqdb查询图库`];
    logger.error(imgInfo.download['err']);
    //以后在这里重写的话再可复用, 现在先可读吧
    source = await hostProvider['iqdb'](imgURL, fileName);
    if (typeof source !== 'string') {
      imgInfo.searchSite.iqdb = source.err;
      logger.warn(imgInfo.searchSite.iqdb);
      return imgInfo;
    }
    imgInfo.searchSite.iqdb = source;
    logger.info(`文件${fileName} 在 iqdb 找到了${source}`);
    var urls = await getSource(source);
    if (urls.length <= 0) {
      imgInfo.download['err'].push(
        '图库的也被删了, 或者是需要高等级账号(danbooru), 或者赞助(pixiv)那这是真的没辙了, 手动google吧'
      );
    }
  }
  console.log(urls);
  //如果有一张没有下载成功如何处理?等以后用面向对象的形式重写的时候再来吧
  let successArr = await Promise.all(
    urls.map(async (i, j) => {
      if (i === undefined) {
        logger.error(`搜索${imgURL}时${source} 中解析错误`);
      }
      let downloadInfo = {
        size: '',
        url: i,
        success: false
      }; //目前只有两个属性, 为了不大幅度改变函数的返回值, 将对象传入函数
      imgInfo.download.push(downloadInfo);
      var nameSplit = fileName.split('.');
      let success = await getImg(i, config.pic.prefix + nameSplit[0] + 'A' + j, downloadInfo).catch(
        (i) => {
          logger.error(`在下载${i} 发生了i.message`);
          return i;
        }
      );
      if (success) downloadInfo.success = success;
      return success;
    })
  );
  if (!successArr.includes(true)) {
    logger.log(`在${source}中获取的链接一个也没下载成功`);
    return imgInfo;
  }
  fs.renameSync(
    path.resolve(config.path.move, fileName),
    path.resolve(config.path.out, 'IMG' + fileName)
  );
  logger.log(`查询文件${fileName}移动到${config.path.out}成功, 并添加上IMG前缀`);
  return imgInfo;
}

async function picpick(imgArr) {
  var len = imgArr.length;
  logger.info(config.output.date + config.output.filesNum(len));
  await waitIpPool();
  var searchArr = [],
    imgInfos = [];
  for (let i = 0; i < imgArr.length; i++) {
    let k = imgArr[i];
    let imgInfo = {
      name: k.name,
      upload: {
        url: '',
        size: k.size
      },
      download: [],
      searchSite: {
        saucenao: '',
        ascii2d: '',
        iqdb: ''
      }
    };
    imgInfos.push(imgInfo);
    await sleep(2000);
    searchArr.push(getUploadInfo(k.path, k.name, doSearch, imgInfo));
  }
  await Promise.all(searchArr);
  return imgInfos;
}
module.exports = { picpick, doSearch };
