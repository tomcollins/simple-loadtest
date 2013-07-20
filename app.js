var tls = require('tls')
  , https = require('https')
  , fs = require('fs')
  , path = require('path')
  , os = require("os")
  , cluster = require('cluster')
  , posix = require('posix')
  , argv = require('optimist').argv
  , request = require('request');

var numCPUs = os.cpus().length
  , port = argv.port || 3000
  , httpProxy = argv.http_proxy || null
  , cert = argv.cert || 'dev.bbc.co.uk.pem'
  , key = argv.cert || 'dev.bbc.co.uk.key'
  , ca = argv.ca || 'ca.pem'
  , tlsOptions
  , host = argv.host || 'api.travel.test.cloud.bbc.co.uk'
  , path = argv.path || '/travel-incident-api/{id}/incidents'
  , noOfOpenRequests = 0
  , maxOpenRequests = posix.getrlimit('nofile').soft - 20
  , inputFile = argv.input || 'locations.csv'
  , inputData
  , testData = []
  , testDataLength
  , testDataIndex = 0
  , requestsSinceUpdate = 0
  , updateTime
  , time
  , elapsedTime
  , successCount = 0
  , errorCount = 0;

  tlsOptions = {
    cert: fs.readFileSync(cert),
    key: fs.readFileSync(cert),
    ca: [fs.readFileSync(ca)],
    host: host,
    port: 443,
    path: null,
    rejectUnauthorized: false,
    agent: false
  };

  inputData = fs.readFileSync(inputFile).toString().split('\n');
  inputData.forEach(function(line){
    values = line.split(',');
    testData.push(values[0]);
  });
  testDataLength = testData.length;

  function doRequest(id) {
    tlsOptions.path = path.replace('{id}', id);
    noOfOpenRequests++;

    var req = https.get(tlsOptions, function(res) {
      //console.log('Status: ' + res.statusCode);
      //console.log('Headers: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        //console.log('BODY: ' + chunk);
      });
      res.on('end', function (chunk) {
        if (200 == res.statusCode) successCount++;
        else errorCount++;
        noOfOpenRequests--;
        requestsSinceUpdate++;
        req = null;
        res = null;
      });
    });
    req.on('error', function(e) {
      //console.log('problem with request: ' + e.message);
      errorCount++;
      noOfOpenRequests--;
      requestsSinceUpdate++;
      req = null;
      res = null;
    });
    req.end();
  }

  function nextRequest() {
    if (noOfOpenRequests < maxOpenRequests) {
      doRequest(testData[testDataIndex++]);
      if (testDataIndex >= testDataLength) testDataIndex = 0;
    }
  };
  nextRequest();
  setInterval(nextRequest, 10);


  console.log('Max concurrent requests', maxOpenRequests, ' (use ulimit -n $ to increase).');
  console.log('Using', testDataLength, 'location ids.')

  function update() {
    time = new Date().getTime();
    elapsedTime = time - updateTime;
    updateTime = time;
    console.log('Update: ' +Number(requestsSinceUpdate/(elapsedTime/1000)).toFixed(1) +'/s, C=' +successCount +', E=' +errorCount +', O: ' +noOfOpenRequests +'/' +maxOpenRequests +')');
    requestsSinceUpdate = 0;
  };
  updateTime = new Date().getTime();
  setInterval(update, 1000);


