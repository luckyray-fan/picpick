var Axios = require('axios');
const logger = require('./log');
var Cheerio = require('cheerio');
const FormData = require('form-data');
var config = require('../config');
var Path = require('path');
var fs = require('fs');

var hasSource = [
  'mangadex.org',
  'danbooru.donmai.us',
  'yande.re',
  'gelbooru.com',
  'twitter.com',
  'www.pixiv.net'
];
//从这里面优先选 danbooru
async function iqdbResult(url, fileName) {
  var formData = new FormData();
  formData.append('url', url);
  // var path = Path.resolve(config.path.move, fileName);
  // formData.append('file', fs.createReadStream(path));
  var res = await Axios.post('https://www.iqdb.org', formData, {
    headers: { ...formData.getHeaders() }
  }).catch((i) => {
    logger.error(i.message);
  });
  if (!res) {
    return '';
  }
  const $ = Cheerio.load(res.data, {
    decodeEntities: false
  });
  var $result = $('#pages div');
  var source = $result.eq(1);
  if ($result.length === 0) {
    return {
      err: $('.err').text()
    };
  } //干, 实际看了下我那标识为jpg的图片的exif信息, 原来是webp格式的, 草(中日双语)
  if (source.hasClass('nomatch')) {
    return { err: '没有匹配的项目' };
  }
  var linkArr = $result
    .map((i, elem) => {
      if (i == 0) return '';
      let link = $(elem)
        .find('.image a')
        .attr('href');
      return link;
    })
    .get();
  logger.info(`在iqdb查询${url}找到了${linkArr}`);
  for (let i = 0; i < linkArr.length; i++) {
    let temLink = linkArr[i] + ''; // 防止有undefined等奇怪的值
    let sourceFlag = hasSource.some((i) => temLink.includes(i));
    if (sourceFlag) {
      temLink = temLink.startsWith('//') ? 'https:' + temLink : temLink;
      return temLink;
    }
  }
  return { err: '项目中没有能解析的链接' + linkArr.join('||') };
  //如果这里面都是90%以上选出能解析图片链接的那个
}

module.exports = iqdbResult;
// iqdbResult(
//   'http://q4226ngy7.bkt.clouddn.com/7cf722e17a5bba90cb05e7a73ff3dffcaa94c2db.jpg',
//   'IMG_20190623_002729_357.jpg'
// ).then((i) => console.log(i));
//http://q4226ngy7.bkt.clouddn.com/7cf722e17a5bba90cb05e7a73ff3dffcaa94c2db.jpg - application-octet-stream
//http://q4226ngy7.bkt.clouddn.com/14114e9578442f77.jpg - no match
