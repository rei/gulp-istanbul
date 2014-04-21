var es   = require( "event-stream" );
var path = require( "path" );
var lynx = require( "lynx" );

"use strict";

var istanbul = require( "istanbul" );
var utils    = require( "istanbul/lib/object-utils" );

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

plugin.writeReports = function ( opts ) {

    var dir = opts.dir || path.join( process.cwd(), "coverage" );
    var reportStats = opts.reportStats || false;
    var statsHost   = opts.statsHost   || 'localhost';
    var statsPort   = opts.statsPort   || 8125;

    return es.through( null, function () {
        var collector = new Collector();

        if ( global.__empty_coverage__ ) {
            collector.add( global.__empty_coverage__ );
        }
        collector.add( global.__coverage__ );

        var reports = [
            Report.create( "html", { dir: dir } ),
            Report.create( "text-summary" )
        ];
        reports.forEach( function ( report ) { report.writeReport( collector, true ); } );

        if ( reportStats ) {
            try {
                var numberOfFiles = collector.files().length;
                var summary = utils.summarizeCoverage( collector.getFinalCoverage() );

                var metrics = new lynx( statsHost, statsPort );

                metrics.gauge( 'fed.js.total_files', numberOfFiles );
                metrics.gauge( 'fed.js.statements.covered', summary.statements.covered );
                metrics.gauge( 'fed.js.statements.percent', summary.statements.pct );
                metrics.gauge( 'fed.js.statements.total', summary.statements.total );
            } catch ( e ) {
                console.log( 'Unable to report statistics: ' + e );
            }
        }

        this.emit( 'end' );
    } );
};
