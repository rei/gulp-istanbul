var es = require("event-stream");
var path = require("path");
"use strict";

var istanbul = require("istanbul");
var hook = istanbul.hook;
var Report = istanbul.Report;
var Collector = istanbul.Collector;
var instrumenter = new istanbul.Instrumenter( {
    saveEmpty: true
} );



var plugin  = module.exports = function () {
  var fileMap = {};

  hook.hookRequire(function (path) {
    return !!fileMap[path];
  }, function (code, path) {
    return fileMap[path];
  });

  return es.map(function (file, cb) {
    if (!file.contents instanceof Buffer) {
      return cb(new Error("gulp-istanbul: streams not supported"), undefined);
    }

    instrumenter.instrument(file.contents.toString(), file.path, function (err, code) {
      if (!err) file.contents = new Buffer(code);
      fileMap[file.path] = file.contents.toString();
      cb(err, file);
    });
  });
};

plugin.writeReports = function (dir) {
  dir = dir || path.join(process.cwd(), "coverage");

  return es.through(null, function () {
    var collector = new Collector();

    if ( global.__empty_coverage__ ) {
        collector.add(global.__empty_coverage__);
    }
    collector.add(global.__coverage__);

    var reports = [
        Report.create("lcov", { dir: dir }),
        Report.create("json", { dir: dir }),
        Report.create("text"),
        Report.create("text-summary")
    ];
    reports.forEach(function (report) { report.writeReport(collector, true); });
    this.emit('end');
  });

};
