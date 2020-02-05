const log4js = require('log4js');

log4js.configure({
  appenders: {
    file: {
      type: 'file',
      filename: 'get.log',
      layout: {
        type: 'pattern',
        pattern: '[%r] %m'
      }
    },
    output: {
      type: 'stdout',
      layout: {
        type: 'pattern',
        pattern: '[%r] %m'
      }
    },
    imgFile: {
      type: 'file',
      filename: 'imageInfo.log',
      layout: {
        type: 'pattern',
        pattern: '[%r] %m'
      }
    }
  },
  categories: {
    default: {
      appenders: ['file', 'output'],
      level: 'debug'
    },
    imgFile: {
      appenders: ['imgFile'],
      level: 'debug'
    }
  }
});

const logger = log4js.getLogger();
logger.imgLogger = log4js.getLogger('imgFile'); // 为了不改动其他地方的require省工作
module.exports = logger;
