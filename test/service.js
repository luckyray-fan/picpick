var http = require('http');

const server = http
  .createServer((req, res) => {
    let data = [];
    req.on('data', (chunk) => {
      data.push(chunk);
    });
    req.on('end', () => {
      console.log('请求如下:');
      console.log(req.headers);
      console.log(data.join(''));
      res.end('打印完成');
    });
  })
  .listen(8989);
