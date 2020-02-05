var Axios = require('axios');
var SocksProxyAgent = require('socks-proxy-agent');
var Cheerio = require('cheerio');
var { parse } = require('url');
const fs = require('fs');
const Path = require('path');
const FormData = require('form-data');
const qiniu = require('qiniu');
const config = require('../config');
const ProgressBar = require('progress');
const logger = require('./log');
// const AxiosRetry = require('axios-retry');
const HttpsProxyAgent = require('https-proxy-agent');
const PROXY = config.proxy; //
const smms = config.smms;
const { bucket, accessKey, secretKey } = config.qiniu;
const output = config.output;

/**
 * 从代理字符串获取代理
 *
 * @param {string} str
 */
function getAgent(str) {
  if (str.startsWith('http://') || str.startsWith('https://')) return new HttpsProxyAgent(str);
  if (str.startsWith('socks://')) return new SocksProxyAgent(str, true);
}

const options = { headers: {} };
const agent = getAgent(PROXY.sock);
if (agent) options.httpsAgent = agent;

const client = Axios.create({
  ...options,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36'
  },
  timeout: 20000
});
// TODO 实现retry var retryText = 1;
// AxiosRetry(client, {
//   retries: 3,
//   retryCondition: (i) => {
//     logger.error(`累计因为 ${i.message}重试 ${retryText++}次`);
//   }
// });
var get = client.get;

/**
 * 得到图源
 *
 * @export
 * @param {String} url URL
 * @returns URL
 */
async function getSource(url) {
  searchSum += 1;
  if (typeof url !== 'string') return;
  const { hostname } = parse(url);
  var $;
  if (!url.includes('pixiv.net')) {
    const { data } = await get(url).catch((i) => {
      logger.error(`访问 ${url} 提取图片发生了 ${i}`);
      return {};
    });
    if (typeof data !== 'string') return [];
    $ = Cheerio.load(data);
  }
  switch (hostname) {
    case 'danbooru.donmai.us':
      return [
        $('#post-option-download a')
          .attr('href')
          .split('?')[0]
      ];
    case 'yande.re':
      return [$('#highres').attr('href')];
    case 'gelbooru.com':
      return [
        $('#tag-list li')
          .filter((i, elem) => {
            let aLink = $(elem)
              .find('a')
              .text();
            return aLink.includes('Original');
          })
          .find('a')
          .attr('href')
      ];
    case 'twitter.com':
      var $imgs = $('img');
      $imgs = $imgs.filter(
        (i, j) => $(j).attr('alt') === '' && (j.attribs.src + '').indexOf('media/') >= 0
      );
      return $imgs
        .map(
          (i, j) =>
            $(j)
              .attr('src')
              .split('&')[0]
        )
        .get(); //去掉链接后面的name字段
    case 'www.pixiv.net':
      var pathname = url.match(/\d+/)[0];
      var urls = (
        await Axios.get('https://api.imjad.cn/pixiv/v1/?type=illust&id=' + pathname, {
          timeout: 5000
        }).catch(async (i) => {
          logger.error(`访问别人搭建的pixiv API发生${i.message}`);
          let formData = new FormData();
          formData.append('p', url);
          let pixivCat = await Axios.post('https://ajax.pixiv.cat/getlink.php', formData, {
            headers: { ...formData.getHeaders() }
          }).catch((i) => {
            logger.warn(`连pixivcat都出现了 ${i.message}`);
            return '';
          });
          if (typeof pixivCat !== 'object') {
            return {};
          }
          pixivCat = pixivCat.data;
          let data = {
            pixivCat: true,
            urls: []
          };
          let baseUrl = 'https://pixiv.cat/';
          if (pixivCat.multiple) {
            let $ = Cheerio.load(pixivCat.html);
            let len = $('img').length;
            [...Array(len).keys()].map((i) => {
              i = i + 1;
              data.urls.push(baseUrl + pixivCat.id + '-' + i + '.jpg');
            });
          } else {
            data.urls.push(baseUrl + pixivCat.id + '.jpg');
          }
          return { data };
        })
      ).data;
      if (urls.pixivCat) {
        return urls.urls; //如果别人的api失效了, 要么retry要么用另一个, retry将来可能会写一下
      }
      if (typeof urls != 'object') {
        return [];
      }
      if (urls.has_error) {
        logger.error(urls.errors.system.message);
        return [];
      }
      if (urls.response[0].metadata)
        return urls.response[0].metadata.pages.map((i) => {
          return i.image_urls.large;
        });
      else return [urls.response[0].image_urls.large];
    case 'nijie.info':
      var urls = $('.mozamoza.ngtag');
      return [];
    case 'mangadex.org':
      var urls = $('img.noselect.nodrag.cursor-pointer').attr('src');
      return [urls];
    default:
      return [];
  }
}
//twitter, pixiv
const imagesBar = new ProgressBar(
  `-> 查询总数:searchSum, 下载总数:imgSum, 正在下载:imgCur, 下载成功:imgSuccess, 下载失败:imgFail, 下载队列:length`,
  { total: 2000 }
);
var searchSum = 0,
  imgSum = 0,
  imgCur = 0,
  imgSuccess = 0,
  imgFail = 0,
  downArr = [];
function imgTick() {
  imagesBar.tick({ searchSum, imgSum, imgCur, imgSuccess, imgFail, length: downArr.length });
}
var downFlag = {},
  maxDownNum = 3; //这work thread 修改值怎么写锁啊, 就干脆把这些看成线程算了, 查了以后,不用考虑内存同步问题, 不会A函数运行到一半, 切换到B函数
//线程并发数最大是4, 考虑打开文件系统的数目
async function getImg(url, fileName, downloadInfo) {
  if (!url) return;
  if (downFlag[fileName] !== undefined) {
    downFlag[fileName] = false;
    logger.info(`文件${fileName}出队列开始下载`);
  } else {
    imgSum += 1;
    imgTick();
  }

  if (imgCur >= maxDownNum && downFlag[fileName] !== false) {
    downArr.push([url, fileName, downloadInfo]);
    downFlag[fileName] = '';
    logger.info(`文件${fileName}加入队列`);
    return new Promise((resolve) => {
      let time = setInterval(() => {
        if (downFlag[fileName]) {
          clearInterval(time);
          resolve(downFlag[fileName]);
        }
      }, 3000);
    }).catch((i) => {
      logger.error(i.message);
    });
  }
  if (!fileName) {
    fileName = url.split('/').pop();
    if (fileName.indexOf('twimg') >= 0) {
      fileName = fileName.split('?')[0] + '.jfif';
      options.headers.Referer = 'https://www.pixiv.net/'; //防盗链, referer, csrf
    }
  }
  if (url.includes('pximg')) {
    options.headers.Referer = 'https://www.pixiv.net/';
  }
  logger.info(output.connect(url));
  imgCur += 1;
  imgTick();
  const res = await Axios({
    ...options,
    url,
    method: 'GET',
    responseType: 'stream'
  }).catch((i) => {
    downloadInfo.success = `访问页面 ${url} ${i.message}`;
    logger.error(downloadInfo.success);
    imgCur -= 1;
    imgFail += 1;
    imgTick();
    return ''; //有时候没有这个页面, 被删掉了之类的
  });
  if (res !== '') {
    logger.info(output.start + url);
    const totalLen = res.headers['content-length'];
    var fileType = res.headers['content-type'].split('/')[1];
    fileType = ['jpg', 'png', 'gif'].includes(fileType) ? fileType : 'jpg';
    if (totalLen <= 0 || isNaN(parseInt(totalLen))) {
      downloadInfo.success = `${url} 中的文件大小为 ${totalLen} 出现异常`;
      logger.warn(downloadInfo.success); //progressbar 出现了invalid array length, issue里说可能是total 为0
      imgCur -= 1;
      imgFail += 1;
      imgTick();
      return '';
    }
    downloadInfo.size = totalLen / 1000 + 'k';

    const progressBar = new ProgressBar('-> ' + fileName + '  [:bar] :percent :etas', {
      width: 25,
      complete: '=',
      incomplete: ' ',
      renderThrottle: 1,
      total: parseInt(totalLen)
    });
    res.data.on('data', (chunk) => {
      let len = chunk.length || 0;
      progressBar.tick(len);
    });
    res.data.on('end', () => {
      logger.info(config.output.done(fileName, totalLen / 1000));
    });
    const path = Path.resolve(config.path.out, fileName + '.' + fileType);
    const writer = fs.createWriteStream(path);
    res.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        imgCur -= 1;
        imgSuccess += 1;
        Array.from({ length: maxDownNum - imgCur }).map((i) => {
          if (imgCur < maxDownNum && downArr.length > 0) {
            getImg(...downArr.shift());
          }
        });
        downFlag[fileName] = true;
        imgTick();
        resolve(true);
      });
      writer.on('error', (i) => {
        imgCur -= 1;
        imgFail += 1;
        Array.from({ length: maxDownNum - imgCur }).map((i) => {
          if (imgCur < maxDownNum && downArr.length > 0) {
            getImg(...downArr.shift());
          }
        });
        downFlag[fileName] = true;
        imgTick();
        reject(i);
      });
    }).catch((i) => {
      logger.error(i.message);
    });
  }
}

async function getUploadInfoSMMS(path) {
  var formData = new FormData();
  formData.append('smfile', fs.createReadStream(path));
  formData.append('format', 'json');
  // console.log(formData);我哭了, 这什么鬼呀, 终于ok了, 哭了
  const res = await Axios.post(smms.url + smms.uploadApi, formData, {
    headers: { Authorization: smms.TOKEN, ...formData.getHeaders() }
  });
  return res.data;
}

function getUploadInfo(path, fileName, doSearch, imageInfo) {
  var mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
  var options = {
    scope: bucket
  };
  var putPolicy = new qiniu.rs.PutPolicy(options);
  var uploadToken = putPolicy.uploadToken(mac);

  var Qconfig = new qiniu.conf.Config();
  // 空间对应的机房
  Qconfig.zone = config.qiniu.zone(qiniu);
  var formUploader = new qiniu.form_up.FormUploader(Qconfig);
  var putExtra = new qiniu.form_up.PutExtra();
  var key = fileName;
  // 文件上传
  formUploader.putFile(uploadToken, key, path, putExtra, function(respErr, respBody, respInfo) {
    if (respErr) {
      throw respErr;
    }
    if (respInfo.statusCode == 200) {
      logger.info(config.output.upload(fileName));
      var uploadUrl = config.qiniu.domain + fileName;
      imageInfo.upload.url = uploadUrl;

      return doSearch(uploadUrl + config.qiniu.imageMagick, fileName, imageInfo); //是个异步
    } else {
      imageInfo.upload.url = respBody;
      console.log(respInfo.statusCode);
      logger.error('上传出错' + respBody);
    }
  });
}
// let formData = new FormData();
// formData.append('p', 'https://www.pixiv.net/artworks/79136582');
// Axios.post('https://ajax.pixiv.cat/getlink.php', formData, {
//   headers: { ...formData.getHeaders() }
// }).then((i) => {
//   let $ = Cheerio.load(i.data.html);
//   console.log($('img').length);
// }); //用于测试连接所获得的数据

module.exports = { get, getSource, getImg, getUploadInfo };
