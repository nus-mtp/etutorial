"use strict";

var fs    = require('fs');
var gm    = require('gm').subClass({ imageMagick: true });;
var pdf   = require('pdfinfo');
var path  = require('path');
var async = require('async');
var logger = require('../logger').serverLogger;

var options = {
  type      : 'png',
  size      : 1024,
  density   : 600,
  outputdir : null,
  targetname: 'test_',
  mem_limit : '32Mb',
  thread    : 4
};

var Pdf2Img = function() {};

Pdf2Img.prototype.setOptions = function(opts) {
  options.type      = opts.type || options.type;
  options.size      = opts.size || options.size;
  options.density   = opts.density || options.density;
  options.outputdir = opts.outputdir || options.outputdir;
  options.targetname = opts.targetname || options.targetname;
  options.mem_limit = opts.mem_limit || options.mem_limit;
  options.thread = opts.thread || options.thread;
};

Pdf2Img.prototype.convert = function(file, callbackreturn) {
  async.waterfall([
    function(callback) {
      fs.stat(file, function(error, result) {
        if (error) callback('[Error: File not found]', null);
        else {
          if (!fs.existsSync(options.outputdir)) {
            fs.mkdirSync(options.outputdir);
          }
          var input = fs.createReadStream(file);
          callback(null, input);
        }
      });
    },

    function(input, callback) {
      pdf(input).info(function(error, data) {
        if (error) callback(error, null);
        else callback(null, data);
      });
    },

    function(data, callback) {
      var pages = [];
      if (data.pages === 0 || data.pages === '0')
        callback('[Error: Invalid page number]', null);

      for (var i = 1; i <= data.pages; i++) {
        pages.push(i);

        if (i === data.pages) callback(null, pages);
      }
    },

    function(pages, callback) {
      async.map(pages, function(page, callbackmap) {
        var inputStream = fs.createReadStream(file);
        var outputStream = fs.createWriteStream(options.outputdir + '/' + options.targetname + page + '.' + options.type);
        convertPdf2Img(inputStream, outputStream, page, function(error, result) {
          if (result) {
            result.page = page;
            callbackmap(null, result);
          }
        });
      }, function(error, results) {
        callback(null, results);
      });
    }
  ], function(error, result) {
    if (error) logger.error(error);
    else callbackreturn(result);
  });
};

var convertPdf2Img = function(input, output, page, callback) {
  var datasize = 0;

  if (input.path) {
    var filepath = input.path;
  } else {
    callback('[Error: Invalid file path]', null);
  }

  var filename = filepath + '[' + (page - 1) + ']';

  var result = gm(input, filename).limit('memory', options.mem_limit)//.limit('threads', options.thread)
    .density(options.density, options.density)
    .resize(options.size)
    .stream(options.type);

  output.on('error', function(error) {
    callback(error, null);
  });

  result.on('error', function(error) {
    callback(error, null);
  });

  result.on('data', function(data) {
    datasize = data.length;
  });

  result.on('end', function() {
    if (datasize < 127) {
      callback('[Error: Invalid data size]', null);
    }

    var results  = {
      page: 0,
      name: path.basename(output.path),
      path: output.path
    };

    output.end();
    callback(null, results);
  });

  result.pipe(output);
};

module.exports = new Pdf2Img;